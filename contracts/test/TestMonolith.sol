// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import {TestFunder} from "./TestFunder.sol";
import {TestOracle} from "./TestOracle.sol";
import {TestTrader} from "./TestTrader.sol";

/**
 * @title TestMonolith
 * @notice A second contract for testing the funder, oracle, and trader.
 */
/* solium-disable-next-line camelcase, no-empty-blocks */
contract TestMonolith is TestFunder, TestOracle, TestTrader {

}
