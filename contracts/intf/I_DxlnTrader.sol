// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../lib/DxlnTypes.sol";

/**
 * @notice Interface that PerpetualV1 Traders must implement.
 */
interface I_DxlnTrader {
    /**
     * @notice Returns the result of the trade between the maker and the taker. Expected to be
     *  called by PerpetualV1. Reverts if the trade is disallowed.
     *
     * @param  sender       The address that called the `trade()` function of PerpetualV1.
     * @param  maker        The address of the passive maker account.
     * @param  taker        The address of the active taker account.
     * @param  price        The current oracle price of the underlying asset.
     * @param  data         Arbitrary data passed in to the `trade()` function of PerpetualV1.
     * @param  traderFlags  Any flags that have been set by other I_P1Trader contracts during the
     *                      same call to the `trade()` function of PerpetualV1.
     * @return              The result of the trade from the perspective of the taker.
     */
    function trade(
        address sender,
        address maker,
        address taker,
        uint256 price,
        bytes calldata data,
        bytes32 traderFlags
    ) external returns (DxlnTypes.TradeResult memory);
}
