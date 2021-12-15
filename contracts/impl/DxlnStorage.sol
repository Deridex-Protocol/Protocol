// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../utils/Adminable.sol";
import "../lib/DxlnTypes.sol";
import "../utils/ReentrancyGuard.sol";
import "../lib/DxlnTypes.sol";
import "../intf/I_DxlnOracle.sol";
import "../intf/I_DxlnFunder.sol";

/**
 * @notice Storage contract. Contains or inherits from all contracts that have ordered storage.
 */
contract DxlnStorage is Adminable, ReentrancyGuard {
    mapping(address => DxlnTypes.Balance) internal _BALANCES_;
    mapping(address => DxlnTypes.Index) internal _LOCAL_INDEXES_;

    mapping(address => bool) internal _GLOBAL_OPERATORS_;
    mapping(address => mapping(address => bool)) internal _LOCAL_OPERATORS_;

    address internal _TOKEN_;
    I_DxlnOracle internal _ORACLE_;
    I_DxlnFunder internal _FUNDER_;

    DxlnTypes.Index internal _GLOBAL_INDEX_;
    uint256 internal _MIN_COLLATERAL_;

    bool internal _FINAL_SETTLEMENT_ENABLED_;
    uint256 internal _FINAL_SETTLEMENT_PRICE_;
}
