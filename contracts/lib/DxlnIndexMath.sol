// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "./DxlnTypes.sol";

/**
 * @dev Library for manipulating DxlnTypes.Index structs.
 */

library DxlnIndexMath {
    // ============ Constants ============

    uint256 private constant FLAG_IS_POSITIVE = 1 << (8 * 16);

    // ============ Functions ============

    /**
     * @dev Returns a compressed bytes32 representation of the index for logging.
     */

    function toBytes32(DxlnTypes.Index memory index)
        internal
        pure
        returns (bytes32)
    {
        uint256 result = index.value |
            (index.isPositive ? FLAG_IS_POSITIVE : 0) |
            (uint256(index.timestamp) << 136);
        return bytes32(result);
    }
}
