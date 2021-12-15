// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../utils/SafeMath.sol";
import "./DxlnTraderConstants.sol";
import "../utils/BaseMath.sol";
import "../utils/Math.sol";
import "../impl/DxlnGetters.sol";
import "../lib/DxlnBalanceMath.sol";
import "../lib/DxlnTypes.sol";

/**
 * @notice Contract allowing accounts to be liquidated by other accounts.
 */

contract DxlnLiquidation is DxlnTraderConstants {
    using SafeMath for uint256;
    using Math for uint256;
    using DxlnBalanceMath for DxlnTypes.Balance;

    // ============ Structs ============

    struct TradeData {
        uint256 amount;
        bool isBuy; // from taker's perspective
        bool allOrNothing; // if true, will revert if maker's position is less than the amount
    }

    // ============ Events ============

    event LogLiquidated(
        address indexed maker,
        address indexed taker,
        uint256 amount,
        bool isBuy, // from taker's perspective
        uint256 oraclePrice
    );

    // ============ Immutable Storage ============

    // address of the perpetual contract
    address public _PERPETUAL_V1_;

    // ============ Constructor ============

    constructor(address perpetualV1) {
        _PERPETUAL_V1_ = perpetualV1;
    }

    // ============ External Functions ============

    /**
     * @notice Allows an account below the minimum collateralization to be liquidated by another
     *  account. This allows the account to be partially or fully subsumed by the liquidator.
     * @dev Emits the LogLiquidated event.
     *
     * @param  sender  The address that called the trade() function on PerpetualV1.
     * @param  maker   The account to be liquidated.
     * @param  taker   The account of the liquidator.
     * @param  price   The current oracle price of the underlying asset.
     * @param  data    A struct of type TradeData.
     * @return         The amounts to be traded, and flags indicating that a liquidation occurred.
     */
    function trade(
        address sender,
        address maker,
        address taker,
        uint256 price,
        bytes calldata data,
        bytes32 /* traderFlags */
    ) external returns (DxlnTypes.TradeResult memory) {
        address perpetual = _PERPETUAL_V1_;

        require(msg.sender == perpetual, "msg.sender must be PerpetualV1");

        require(
            DxlnGetters(perpetual).getIsGlobalOperator(sender),
            "Sender is not a global operator"
        );

        TradeData memory tradeData = abi.decode(data, (TradeData));
        DxlnTypes.Balance memory makerBalance = DxlnGetters(perpetual)
            .getAccountBalance(maker);

        _verifyTrade(tradeData, makerBalance, perpetual, price);

        // Bound the execution amount by the size of the maker position.
        uint256 amount = Math.min(tradeData.amount, makerBalance.position);

        // When partially liquidating the maker, maintain the same position/margin ratio.
        // Ensure the collateralization of the maker does not decrease.
        uint256 marginAmount;
        if (tradeData.isBuy) {
            marginAmount = uint256(makerBalance.margin).getFractionRoundUp(
                amount,
                makerBalance.position
            );
        } else {
            marginAmount = uint256(makerBalance.margin).getFraction(
                amount,
                makerBalance.position
            );
        }

        emit LogLiquidated(maker, taker, amount, tradeData.isBuy, price);

        return
            DxlnTypes.TradeResult({
                marginAmount: marginAmount,
                positionAmount: amount,
                isBuy: tradeData.isBuy,
                traderFlags: TRADER_FLAG_LIQUIDATION
            });
    }

    // ============ Helper Functions ============

    function _verifyTrade(
        TradeData memory tradeData,
        DxlnTypes.Balance memory makerBalance,
        address perpetual,
        uint256 price
    ) private view {
        require(
            _isUndercollateralized(makerBalance, perpetual, price),
            "Cannot liquidate since maker is not undercollateralized"
        );
        require(
            !tradeData.allOrNothing ||
                makerBalance.position >= tradeData.amount,
            "allOrNothing is set and maker position is less than amount"
        );
        require(
            tradeData.isBuy == makerBalance.positionIsPositive,
            "liquidation must not increase maker's position size"
        );

        // Disallow liquidating in the edge case where both the position and margin are negative.
        //
        // This case is not handled correctly by P1Trade. If an account is in this situation, the
        // margin should first be set to zero via a deposit, then the account should be deleveraged.
        require(
            makerBalance.marginIsPositive ||
                makerBalance.margin == 0 ||
                makerBalance.positionIsPositive ||
                makerBalance.position == 0,
            "Cannot liquidate when maker position and margin are both negative"
        );
    }

    function _isUndercollateralized(
        DxlnTypes.Balance memory balance,
        address perpetual,
        uint256 price
    ) private view returns (bool) {
        uint256 minCollateral = DxlnGetters(perpetual).getMinCollateral();
        (uint256 positive, uint256 negative) = balance
            .getPositiveAndNegativeValue(price);

        // See P1Settlement.sol for discussion of overflow risk.
        return positive.mul(BaseMath.base()) < negative.mul(minCollateral);
    }
}
