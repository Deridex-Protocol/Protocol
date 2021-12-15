// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../utils/SafeMath.sol";
import "../utils/Ownable.sol";
import "../utils/IERC20.sol";
import "../utils/SafeERC20.sol";
import "../utils/BaseMath.sol";
import "../utils/SignedMath.sol";
import "../intf/I_DxlnPerpetualV1.sol";
import "../lib/DxlnBalanceMath.sol";
import "../lib/DxlnTypes.sol";

/**
 * @notice Proxy contract for liquidating accounts. A fixed percentage of each liquidation is
 * directed to the insurance fund.
 */
contract DxlnLiquidatorProxy is Ownable {
    using BaseMath for uint256;
    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;
    using DxlnBalanceMath for DxlnTypes.Balance;
    using SafeERC20 for IERC20;

    // ============ Events ============

    event LogLiquidatorProxyUsed(
        address indexed liquidatee,
        address indexed liquidator,
        bool isBuy,
        uint256 liquidationAmount,
        uint256 feeAmount
    );

    event LogInsuranceFundSet(address insuranceFund);

    event LogInsuranceFeeSet(uint256 insuranceFee);

    // ============ Immutable Storage ============

    // Address of the perpetual contract.
    address public _PERPETUAL_V1_;

    // Address of the P1Liquidation contract.
    address public _LIQUIDATION_;

    // ============ Mutable Storage ============

    // Address of the insurance fund.
    address public _INSURANCE_FUND_;

    // Proportion of liquidation profits that is directed to the insurance fund.
    // This number is represented as a fixed-point number with 18 decimals.
    uint256 public _INSURANCE_FEE_;

    // ============ Constructor ============

    constructor(
        address perpetualV1,
        address liquidator,
        address insuranceFund,
        uint256 insuranceFee
    ) {
        _PERPETUAL_V1_ = perpetualV1;
        _LIQUIDATION_ = liquidator;
        _INSURANCE_FUND_ = insuranceFund;
        _INSURANCE_FEE_ = insuranceFee;

        emit LogInsuranceFundSet(insuranceFund);
        emit LogInsuranceFeeSet(insuranceFee);
    }

    // ============ External Functions ============

    /**
     * @notice Sets the maximum allowance on the perpetual contract. Must be called at least once.
     * @dev Cannot be run in the constructor due to technical restrictions in Solidity.
     */
    function approveMaximumOnPerpetual() external {
        address perpetual = _PERPETUAL_V1_;
        IERC20 tokenContract = IERC20(
            I_DxlnPerpetualV1(perpetual).getTokenContract()
        );

        // safeApprove requires unsetting the allowance first.
        tokenContract.safeApprove(perpetual, 0);

        // Set the allowance to the highest possible value.
        tokenContract.safeApprove(perpetual, type(uint256).max);
    }

    /**
     * @notice Allows an account below the minimum collateralization to be liquidated by another
     *  account. This allows the account to be partially or fully subsumed by the liquidator.
     *  A proportion of all liquidation profits is directed to the insurance fund.
     * @dev Emits the LogLiquidatorProxyUsed event.
     *
     * @param  liquidatee   The account to liquidate.
     * @param  liquidator   The account that performs the liquidation.
     * @param  isBuy        True if the liquidatee has a long position, false otherwise.
     * @param  maxPosition  Maximum position size that the liquidator will take post-liquidation.
     * @return              The change in position.
     */
    function liquidate(
        address liquidatee,
        address liquidator,
        bool isBuy,
        SignedMath.Int calldata maxPosition
    ) external returns (uint256) {
        I_DxlnPerpetualV1 perpetual = I_DxlnPerpetualV1(_PERPETUAL_V1_);

        // Verify that this account can liquidate for the liquidator.
        require(
            liquidator == msg.sender ||
                perpetual.hasAccountPermissions(liquidator, msg.sender),
            "msg.sender cannot operate the liquidator account"
        );

        // Settle the liquidator's account and get balances.
        perpetual.deposit(liquidator, 0);
        DxlnTypes.Balance memory initialBalance = perpetual.getAccountBalance(
            liquidator
        );

        // Get the maximum liquidatable amount.
        SignedMath.Int memory maxPositionDelta = _getMaxPositionDelta(
            initialBalance,
            isBuy,
            maxPosition
        );

        // Do the liquidation.
        _doLiquidation(perpetual, liquidatee, liquidator, maxPositionDelta);

        // Get the balances of the liquidator.
        DxlnTypes.Balance memory currentBalance = perpetual.getAccountBalance(
            liquidator
        );

        // Get the liquidated amount and fee amount.
        (uint256 liqAmount, uint256 feeAmount) = _getLiquidatedAndFeeAmount(
            perpetual,
            initialBalance,
            currentBalance
        );

        // Transfer fee from liquidator to insurance fund.
        if (feeAmount > 0) {
            perpetual.withdraw(liquidator, address(this), feeAmount);
            perpetual.deposit(_INSURANCE_FUND_, feeAmount);
        }

        // Log the result.
        emit LogLiquidatorProxyUsed(
            liquidatee,
            liquidator,
            isBuy,
            liqAmount,
            feeAmount
        );

        return liqAmount;
    }

    // ============ Admin Functions ============

    /**
     * @dev Allows the owner to set the insurance fund address. Emits the LogInsuranceFundSet event.
     *
     * @param  insuranceFund  The address to set as the insurance fund.
     */
    function setInsuranceFund(address insuranceFund) external onlyOwner {
        _INSURANCE_FUND_ = insuranceFund;
        emit LogInsuranceFundSet(insuranceFund);
    }

    /**
     * @dev Allows the owner to set the insurance fee. Emits the LogInsuranceFeeSet event.
     *
     * @param  insuranceFee  The new fee as a fixed-point number with 18 decimal places. Max of 50%.
     */
    function setInsuranceFee(uint256 insuranceFee) external onlyOwner {
        require(
            insuranceFee <= BaseMath.base().div(2),
            "insuranceFee cannot be greater than 50%"
        );
        _INSURANCE_FEE_ = insuranceFee;
        emit LogInsuranceFeeSet(insuranceFee);
    }

    // ============ Helper Functions ============

    /**
     * @dev Calculate (and verify) the maximum amount to liquidate based on the maxPosition input.
     */
    function _getMaxPositionDelta(
        DxlnTypes.Balance memory initialBalance,
        bool isBuy,
        SignedMath.Int memory maxPosition
    ) private pure returns (SignedMath.Int memory) {
        SignedMath.Int memory result = maxPosition.signedSub(
            initialBalance.getPosition()
        );

        require(
            result.isPositive == isBuy && result.value > 0,
            "Cannot liquidate if it would put liquidator past the specified maxPosition"
        );

        return result;
    }

    /**
     * @dev Perform the liquidation by constructing the correct arguments and sending it to the
     * perpetual.
     */
    function _doLiquidation(
        I_DxlnPerpetualV1 perpetual,
        address liquidatee,
        address liquidator,
        SignedMath.Int memory maxPositionDelta
    ) private {
        // Create accounts. Base protocol requires accounts to be sorted.
        bool takerFirst = liquidator < liquidatee;
        address[] memory accounts = new address[](2);
        uint256 takerIndex = takerFirst ? 0 : 1;
        uint256 makerIndex = takerFirst ? 1 : 0;
        accounts[takerIndex] = liquidator;
        accounts[makerIndex] = liquidatee;

        // Create trade args.
        I_DxlnPerpetualV1.TradeArg[]
            memory trades = new I_DxlnPerpetualV1.TradeArg[](1);
        trades[0] = I_DxlnPerpetualV1.TradeArg({
            takerIndex: takerIndex,
            makerIndex: makerIndex,
            trader: _LIQUIDATION_,
            data: abi.encode(
                maxPositionDelta.value,
                maxPositionDelta.isPositive,
                false // allOrNothing
            )
        });

        // Do the liquidation.
        perpetual.trade(accounts, trades);
    }

    /**
     * @dev Calculate the liquidated amount and also the fee amount based on a percentage of the
     * value of the repaid debt.
     * @return  The position amount bought or sold.
     * @return  The fee amount in margin token.
     */
    function _getLiquidatedAndFeeAmount(
        I_DxlnPerpetualV1 perpetual,
        DxlnTypes.Balance memory initialBalance,
        DxlnTypes.Balance memory currentBalance
    ) private view returns (uint256, uint256) {
        // Get the change in the position and margin of the liquidator.
        SignedMath.Int memory deltaPosition = currentBalance
            .getPosition()
            .signedSub(initialBalance.getPosition());
        SignedMath.Int memory deltaMargin = currentBalance
            .getMargin()
            .signedSub(initialBalance.getMargin());

        // Get the change in the balances of the liquidator.
        DxlnTypes.Balance memory deltaBalance;
        deltaBalance.setPosition(deltaPosition);
        deltaBalance.setMargin(deltaMargin);

        // Get the positive and negative value taken by the liquidator.
        uint256 price = perpetual.getOraclePrice();
        (uint256 posValue, uint256 negValue) = deltaBalance
            .getPositiveAndNegativeValue(price);

        // Calculate the fee amount based on the liquidation profit.
        uint256 feeAmount = posValue > negValue
            ? posValue.sub(negValue).baseMul(_INSURANCE_FEE_).div(
                BaseMath.base()
            )
            : 0;

        return (deltaPosition.value, feeAmount);
    }
}
