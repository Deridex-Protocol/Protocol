// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../utils/IERC20.sol";
import "../utils/SafeERC20.sol";
import "../lib/DxlnBalanceMath.sol";
import "../lib/DxlnTypes.sol";
import "./DxlnFinalSettlement.sol";
import "./DxlnGetters.sol";
import "../utils/ReentrancyGuard.sol";

/**
 * @notice Contract for withdrawing and depositing.
 */
contract DxlnMargin is DxlnFinalSettlement, DxlnGetters {
    using DxlnBalanceMath for DxlnTypes.Balance;

    // ============ Events ============

    event LogDeposit(address indexed account, uint256 amount, bytes32 balance);

    event LogWithdraw(
        address indexed account,
        address destination,
        uint256 amount,
        bytes32 balance
    );

    // ============ Functions ============

    /**
     * @notice Deposit some amount of margin tokens from the msg.sender into an account.
     * @dev Emits LogIndex, LogAccountSettled, and LogDeposit events.
     *
     * @param  account  The account for which to credit the deposit.
     * @param  amount   the amount of tokens to deposit.
     */
    function deposit(address account, uint256 amount)
        external
        noFinalSettlement
        nonReentrant
    {
        DxlnTypes.Context memory context = _loadContext();
        DxlnTypes.Balance memory balance = _settleAccount(context, account);

        SafeERC20.safeTransferFrom(
            IERC20(_TOKEN_),
            msg.sender,
            address(this),
            amount
        );

        balance.addToMargin(amount);
        _BALANCES_[account] = balance;

        emit LogDeposit(account, amount, balance.toBytes32());
    }

    /**
     * @notice Withdraw some amount of margin tokens from an account to a destination address.
     * @dev Emits LogIndex, LogAccountSettled, and LogWithdraw events.
     *
     * @param  account      The account for which to debit the withdrawal.
     * @param  destination  The address to which the tokens are transferred.
     * @param  amount       The amount of tokens to withdraw.
     */
    function withdraw(
        address account,
        address destination,
        uint256 amount
    ) external noFinalSettlement nonReentrant {
        require(
            hasAccountPermissions(account, msg.sender),
            "sender does not have permission to withdraw"
        );

        DxlnTypes.Context memory context = _loadContext();
        DxlnTypes.Balance memory balance = _settleAccount(context, account);

        SafeERC20.safeTransfer(IERC20(_TOKEN_), destination, amount);

        balance.subFromMargin(amount);
        _BALANCES_[account] = balance;

        require(
            _isCollateralized(context, balance),
            "account not collateralized"
        );

        emit LogWithdraw(account, destination, amount, balance.toBytes32());
    }
}
