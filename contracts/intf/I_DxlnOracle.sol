// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

/**
 * @notice Interface that PerpetualV1 Price Oracles must implement.
 */
interface I_DxlnOracle {
    /**
     * @notice Returns the price of the underlying asset relative to the margin token.
     *
     * @return The price as a fixed-point number with 18 decimals.
     */
    function getPrice() external view returns (uint256);
}
