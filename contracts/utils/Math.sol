// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./SafeMath.sol";

/**
 * @dev Library for non-standard Math functions.
 */

library Math {
    using SafeMath for uint256;

    // ============ Library Functions ============

    /**
     * @dev Return target * (numerator / denominator), rounded down.
     */
    function getFraction(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    ) internal pure returns (uint256) {
        return target.mul(numerator).div(denominator);
    }

    /**
     * @dev Return target * (numerator / denominator), rounded up.
     */
    function getFractionRoundUp(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    ) internal pure returns (uint256) {
        if (target == 0 || numerator == 0) {
            // SafeMath will check for zero denominator
            return SafeMath.div(0, denominator);
        }
        return target.mul(numerator).sub(1).div(denominator).add(1);
    }

    /**
     * @dev Returns the minimum between a and b.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the maximum between a and b.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}
