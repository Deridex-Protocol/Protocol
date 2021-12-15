// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./DxlnAdmin.sol";
import "../utils/Storage.sol";
import "./DxlnFinalSettlement.sol";
import "./DxlnGetters.sol";
import "./DxlnMargin.sol";
import "./DxlnOperator.sol";
import "./DxlnTrade.sol";
import "../lib/DxlnTypes.sol";
import "../intf/I_DxlnOracle.sol";

/**
 * @notice A market for a perpetual contract, a financial derivative which may be traded on margin
 *  and which aims to closely track the spot price of an underlying asset. The underlying asset is
 *  specified via the price oracle which reports its spot price. Tethering of the perpetual market
 *  price is supported by a funding oracle which governs funding payments between longs and shorts.
 * @dev Main perpetual market implementation contract that inherits from other contracts.
 */
contract DxlnPerpetualV1 is
    DxlnFinalSettlement,
    DxlnAdmin,
    DxlnGetters,
    DxlnMargin,
    DxlnOperator,
    DxlnTrade
{
    // Non-colliding storage slot.
    bytes32 internal constant DXLN_PERPETUAL_V1_INITIALIZE_SLOT =
        bytes32(uint256(keccak256("Dxln.PerpetualV1.initialize")) - 1);

    /**
     * @dev Once-only initializer function that replaces the constructor since this contract is
     *  proxied. Uses a non-colliding storage slot to store if this version has been initialized.
     * @dev Can only be called once and can only be called by the admin of this contract.
     *
     * @param  token          The address of the token to use for margin-deposits.
     * @param  oracle         The address of the price oracle contract.
     * @param  funder         The address of the funder contract.
     * @param  minCollateral  The minimum allowed initial collateralization percentage.
     */
    function initializeV1(
        address token,
        address oracle,
        address funder,
        uint256 minCollateral
    ) external onlyAdmin nonReentrant {
        // only allow initialization once
        require(
            Storage.load(DXLN_PERPETUAL_V1_INITIALIZE_SLOT) == 0x0,
            "DxlnPerpetualV1 already initialized"
        );
        Storage.store(DXLN_PERPETUAL_V1_INITIALIZE_SLOT, bytes32(uint256(1)));

        _TOKEN_ = token;
        _ORACLE_ = I_DxlnOracle(oracle);
        _FUNDER_ = I_DxlnFunder(funder);
        _MIN_COLLATERAL_ = minCollateral;

        _GLOBAL_INDEX_ = DxlnTypes.Index({
            timestamp: uint32(block.timestamp),
            isPositive: false,
            value: 0
        });
    }
}
