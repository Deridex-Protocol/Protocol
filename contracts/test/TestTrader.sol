// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import {I_DxlnTrader} from "../intf/I_DxlnTrader.sol";
import {DxlnTypes} from "../lib/DxlnTypes.sol";

/**
 * @title TestTrader
 * @notice I_DxlnTrader implementation for testing.
 */
/* solium-disable-next-line camelcase */
contract TestTrader is I_DxlnTrader {
    DxlnTypes.TradeResult public _TRADE_RESULT_;
    DxlnTypes.TradeResult public _TRADE_RESULT_2_;

    // Special testing-only trader flag that will cause the second result to be returned.
    bytes32 public constant TRADER_FLAG_RESULT_2 = bytes32(~uint256(0));

    function trade(
        address, // sender
        address, // maker
        address, // taker
        uint256, // price
        bytes calldata, // data
        bytes32 traderFlags
    ) external override returns (DxlnTypes.TradeResult memory) {
        if (traderFlags == TRADER_FLAG_RESULT_2) {
            return _TRADE_RESULT_2_;
        }
        return _TRADE_RESULT_;
    }

    function setTradeResult(
        uint256 marginAmount,
        uint256 positionAmount,
        bool isBuy,
        bytes32 traderFlags
    ) external {
        _TRADE_RESULT_ = DxlnTypes.TradeResult({
            marginAmount: marginAmount,
            positionAmount: positionAmount,
            isBuy: isBuy,
            traderFlags: traderFlags
        });
    }

    /**
     * Sets a second trade result which can be triggered by the trader flags of the first trade.
     */
    function setSecondTradeResult(
        uint256 marginAmount,
        uint256 positionAmount,
        bool isBuy,
        bytes32 traderFlags
    ) external {
        _TRADE_RESULT_2_ = DxlnTypes.TradeResult({
            marginAmount: marginAmount,
            positionAmount: positionAmount,
            isBuy: isBuy,
            traderFlags: traderFlags
        });
    }
}
