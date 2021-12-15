// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../utils/BaseMath.sol";
import "../utils/SafeMath.sol";
import "../utils/SignedMath.sol";
import "./DxlnTypes.sol";
import "../utils/SafeCast.sol";

/**
 * @dev Library for manipulating DxlnTypes.Balance structs.
 */

library DxlnBalanceMath {
    using BaseMath for uint256;
    using SafeCast for uint256;
    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;
    using DxlnBalanceMath for DxlnTypes.Balance;

    // ============ Constants ============

    uint256 private constant FLAG_MARGIN_IS_POSITIVE = 1 << (8 * 31);
    uint256 private constant FLAG_POSITION_IS_POSITIVE = 1 << (8 * 15);

    // ============ Functions ============

    /**
     * @dev Create a copy of the balance struct.
     */
    function copy(DxlnTypes.Balance memory balance)
        internal
        pure
        returns (DxlnTypes.Balance memory)
    {
        return
            DxlnTypes.Balance({
                marginIsPositive: balance.marginIsPositive,
                positionIsPositive: balance.positionIsPositive,
                margin: balance.margin,
                position: balance.position
            });
    }

    /**
     * @dev In-place add amount to balance.margin.
     */
    function addToMargin(DxlnTypes.Balance memory balance, uint256 amount)
        internal
        pure
    {
        SignedMath.Int memory signedMargin = balance.getMargin();
        signedMargin = signedMargin.add(amount);
        balance.setMargin(signedMargin);
    }

    /**
     * @dev In-place subtract amount from balance.margin.
     */
    function subFromMargin(DxlnTypes.Balance memory balance, uint256 amount)
        internal
        pure
    {
        SignedMath.Int memory signedMargin = balance.getMargin();
        signedMargin = signedMargin.sub(amount);
        balance.setMargin(signedMargin);
    }

    /**
     * @dev In-place add amount to balance.position.
     */
    function addToPosition(DxlnTypes.Balance memory balance, uint256 amount)
        internal
        pure
    {
        SignedMath.Int memory signedPosition = balance.getPosition();
        signedPosition = signedPosition.add(amount);
        balance.setPosition(signedPosition);
    }

    /**
     * @dev In-place subtract amount from balance.position.
     */
    function subFromPosition(DxlnTypes.Balance memory balance, uint256 amount)
        internal
        pure
    {
        SignedMath.Int memory signedPosition = balance.getPosition();
        signedPosition = signedPosition.sub(amount);
        balance.setPosition(signedPosition);
    }

    /**
     * @dev Returns the positive and negative values of the margin and position together, given a
     *  price, which is used as a conversion rate between the two currencies.
     *
     *  No rounding occurs here--the returned values are "base values" with extra precision.
     */
    function getPositiveAndNegativeValue(
        DxlnTypes.Balance memory balance,
        uint256 price
    ) internal pure returns (uint256, uint256) {
        uint256 positiveValue = 0;
        uint256 negativeValue = 0;

        // add value of margin
        if (balance.marginIsPositive) {
            positiveValue = uint256(balance.margin).mul(BaseMath.base());
        } else {
            negativeValue = uint256(balance.margin).mul(BaseMath.base());
        }

        // add value of position
        uint256 positionValue = uint256(balance.position).mul(price);
        if (balance.positionIsPositive) {
            positiveValue = positiveValue.add(positionValue);
        } else {
            negativeValue = negativeValue.add(positionValue);
        }

        return (positiveValue, negativeValue);
    }

    /**
     * @dev Returns a compressed bytes32 representation of the balance for logging.
     */
    function toBytes32(DxlnTypes.Balance memory balance)
        internal
        pure
        returns (bytes32)
    {
        uint256 result = uint256(balance.position) |
            (uint256(balance.margin) << 128) |
            (balance.marginIsPositive ? FLAG_MARGIN_IS_POSITIVE : 0) |
            (balance.positionIsPositive ? FLAG_POSITION_IS_POSITIVE : 0);
        return bytes32(result);
    }

    // ============ Helper Functions ============

    /**
     * @dev Returns a SignedMath.Int version of the margin in balance.
     */
    function getMargin(DxlnTypes.Balance memory balance)
        internal
        pure
        returns (SignedMath.Int memory)
    {
        return
            SignedMath.Int({
                value: balance.margin,
                isPositive: balance.marginIsPositive
            });
    }

    /**
     * @dev Returns a SignedMath.Int version of the position in balance.
     */
    function getPosition(DxlnTypes.Balance memory balance)
        internal
        pure
        returns (SignedMath.Int memory)
    {
        return
            SignedMath.Int({
                value: balance.position,
                isPositive: balance.positionIsPositive
            });
    }

    /**
     * @dev In-place modify the signed margin value of a balance.
     */
    function setMargin(
        DxlnTypes.Balance memory balance,
        SignedMath.Int memory newMargin
    ) internal pure {
        balance.margin = newMargin.value.toUint120();
        balance.marginIsPositive = newMargin.isPositive;
    }

    /**
     * @dev In-place modify the signed position value of a balance.
     */
    function setPosition(
        DxlnTypes.Balance memory balance,
        SignedMath.Int memory newPosition
    ) internal pure {
        balance.position = newPosition.value.toUint120();
        balance.positionIsPositive = newPosition.isPositive;
    }
}
