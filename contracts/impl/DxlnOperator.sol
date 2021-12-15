// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./DxlnStorage.sol";

/**
 * @notice Contract for setting local operators for an account.
 */
contract DxlnOperator is DxlnStorage {
    // ============ Events ============

    event LogSetLocalOperator(
        address indexed sender,
        address operator,
        bool approved
    );

    // ============ Functions ============

    /**
     * @notice Grants or revokes permission for another account to perform certain actions on behalf
     *  of the sender.
     * @dev Emits the LogSetLocalOperator event.
     *
     * @param  operator  The account that is approved or disapproved.
     * @param  approved  True for approval, false for disapproval.
     */
    function setLocalOperator(address operator, bool approved) external {
        _LOCAL_OPERATORS_[msg.sender][operator] = approved;
        emit LogSetLocalOperator(msg.sender, operator, approved);
    }
}
