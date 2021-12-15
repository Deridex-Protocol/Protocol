// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./SafeMath.sol";

/**
 * @dev SignedMath library for doing math with signed integers.
 */

library SignedMath {
    using SafeMath for uint256;

    // ============ Structs ============

    struct Int {
        uint256 value;
        bool isPositive;
    }

    // ============ Functions ============

    /**
     * @dev Returns a new signed integer equal to a signed integer plus an unsigned integer.
     */
    function add(Int memory sint, uint256 value)
        internal
        pure
        returns (Int memory)
    {
        if (sint.isPositive) {
            return Int({value: value.add(sint.value), isPositive: true});
        }
        if (sint.value < value) {
            return Int({value: value.sub(sint.value), isPositive: true});
        }
        return Int({value: sint.value.sub(value), isPositive: false});
    }

    /**
     * @dev Returns a new signed integer equal to a signed integer minus an unsigned integer.
     */
    function sub(Int memory sint, uint256 value)
        internal
        pure
        returns (Int memory)
    {
        if (!sint.isPositive) {
            return Int({value: value.add(sint.value), isPositive: false});
        }
        if (sint.value > value) {
            return Int({value: sint.value.sub(value), isPositive: true});
        }
        return Int({value: value.sub(sint.value), isPositive: false});
    }

    /**
     * @dev Returns a new signed integer equal to a signed integer plus another signed integer.
     */
    function signedAdd(Int memory augend, Int memory addend)
        internal
        pure
        returns (Int memory)
    {
        return
            addend.isPositive
                ? add(augend, addend.value)
                : sub(augend, addend.value);
    }

    /**
     * @dev Returns a new signed integer equal to a signed integer minus another signed integer.
     */
    function signedSub(Int memory minuend, Int memory subtrahend)
        internal
        pure
        returns (Int memory)
    {
        return
            subtrahend.isPositive
                ? sub(minuend, subtrahend.value)
                : add(minuend, subtrahend.value);
    }

    /**
     * @dev Returns true if signed integer `a` is greater than signed integer `b`, false otherwise.
     */
    function gt(Int memory a, Int memory b) internal pure returns (bool) {
        if (a.isPositive) {
            if (b.isPositive) {
                return a.value > b.value;
            } else {
                // True, unless both values are zero.
                return a.value != 0 || b.value != 0;
            }
        } else {
            if (b.isPositive) {
                return false;
            } else {
                return a.value < b.value;
            }
        }
    }

    /**
     * @dev Returns the minimum of signed integers `a` and `b`.
     */
    function min(Int memory a, Int memory b)
        internal
        pure
        returns (Int memory)
    {
        return gt(b, a) ? a : b;
    }

    /**
     * @dev Returns the maximum of signed integers `a` and `b`.
     */
    function max(Int memory a, Int memory b)
        internal
        pure
        returns (Int memory)
    {
        return gt(a, b) ? a : b;
    }
}
