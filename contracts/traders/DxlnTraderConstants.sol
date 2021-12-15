// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

/**
 * @notice Constants for traderFlags set by contracts implementing the I_DxlnTrader interface.
 */

contract DxlnTraderConstants {
    bytes32 internal constant TRADER_FLAG_ORDERS = bytes32(uint256(1));
    bytes32 internal constant TRADER_FLAG_LIQUIDATION = bytes32(uint256(2));
    bytes32 internal constant TRADER_FLAG_DELEVERAGING = bytes32(uint256(4));
}
