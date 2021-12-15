// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../utils/Math.sol";
import "../utils/SafeMath.sol";
import "../utils/IERC20.sol";
import "../utils/SafeERC20.sol";
import "../utils/BaseMath.sol";
import "../lib/DxlnBalanceMath.sol";
import "../lib/DxlnTypes.sol";
import "./DxlnSettlement.sol";
import "../utils/ReentrancyGuard.sol";
import "../utils/SafeCast.sol";

/**
 * @notice Functions regulating the smart contract's behavior during final settlement.
 */

contract DxlnFinalSettlement is DxlnSettlement {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using DxlnBalanceMath for DxlnTypes.Balance;

    // ============ Events ============

    event LogWithdrawFinalSettlement(
        address indexed account,
        uint256 amount,
        bytes32 balance
    );

    // ============ Modifiers ============

    /**
     * @dev Modifier to ensure the function is not run after final settlement has been enabled.
     */

    modifier noFinalSettlement() {
        require(
            !_FINAL_SETTLEMENT_ENABLED_,
            "Not permitted during final settlement"
        );
        _;
    }

    /**
     * @dev Modifier to ensure the function is only run after final settlement has been enabled.
     */
    modifier onlyFinalSettlement() {
        require(
            _FINAL_SETTLEMENT_ENABLED_,
            "Only permitted during final settlement"
        );
        _;
    }

    // ============ Functions ============

    /**
     * @notice Withdraw the number of margin tokens equal to the value of the account at the time
     *  that final settlement occurred.
     * @dev Emits the LogAccountSettled and LogWithdrawFinalSettlement events.
     */
    function withdrawFinalSettlement()
        external
        onlyFinalSettlement
        nonReentrant
    {
        // Load the context using the final settlement price.
        DxlnTypes.Context memory context = DxlnTypes.Context({
            price: _FINAL_SETTLEMENT_PRICE_,
            minCollateral: _MIN_COLLATERAL_,
            index: _GLOBAL_INDEX_
        });

        // Apply funding changes.
        DxlnTypes.Balance memory balance = _settleAccount(context, msg.sender);

        // Determine the account net value.
        // `positive` and `negative` are base values with extra precision.
        (uint256 positive, uint256 negative) = DxlnBalanceMath
            .getPositiveAndNegativeValue(balance, context.price);

        // No amount is withdrawable.
        if (positive < negative) {
            return;
        }

        // Get the account value, which is rounded down to the nearest token amount.
        uint256 accountValue = positive.sub(negative).div(BaseMath.base());

        // Get the number of tokens in the Perpetual Contract.
        uint256 contractBalance = IERC20(_TOKEN_).balanceOf(address(this));

        // Determine the maximum withdrawable amount.
        uint256 amountToWithdraw = Math.min(contractBalance, accountValue);

        // Update the user's balance.
        uint120 remainingMargin = accountValue
            .sub(amountToWithdraw)
            .toUint120();
        balance = DxlnTypes.Balance({
            marginIsPositive: remainingMargin != 0,
            positionIsPositive: false,
            margin: remainingMargin,
            position: 0
        });
        _BALANCES_[msg.sender] = balance;

        // Send the tokens.
        SafeERC20.safeTransfer(IERC20(_TOKEN_), msg.sender, amountToWithdraw);

        // Emit the log.
        emit LogWithdrawFinalSettlement(
            msg.sender,
            amountToWithdraw,
            balance.toBytes32()
        );
    }
}
