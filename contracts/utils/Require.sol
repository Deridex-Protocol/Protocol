// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

/**
 * @dev Stringifies parameters to pretty-print revert messages.
 */
library Require {
    // ============ Constants ============

    uint256 constant ASCII_ZERO = 0x30; // '0'
    uint256 constant ASCII_RELATIVE_ZERO = 0x57; // 'a' - 10
    uint256 constant FOUR_BIT_MASK = 0xf;
    bytes23 constant ZERO_ADDRESS =
        0x3a20307830303030303030302e2e2e3030303030303030; // ": 0x00000000...00000000"

    // ============ Library Functions ============

    /**
     * @dev If the must condition is not true, reverts using a string combination of the reason and
     *  the address.
     */
    function that(
        bool must,
        string memory reason,
        address addr
    ) internal pure {
        if (!must) {
            revert(string(abi.encodePacked(reason, stringify(addr))));
        }
    }

    // ============ Helper Functions ============

    /**
     * @dev Returns a bytes array that is an ASCII string representation of the input address.
     *  Returns " 0x", the first 4 bytes of the address in lowercase hex, "...", then the last 4
     *  bytes of the address in lowercase hex.
     */
    function stringify(address input) private pure returns (bytes memory) {
        // begin with ": 0x00000000...00000000"
        bytes memory result = abi.encodePacked(ZERO_ADDRESS);

        // initialize values
        uint256 z = uint256(uint160(input));
        uint256 shift1 = 8 * 20 - 4;
        uint256 shift2 = 8 * 4 - 4;

        // populate both sections in parallel
        for (uint256 i = 4; i < 12; i++) {
            result[i] = char(z >> shift1); // set char in first section
            result[i + 11] = char(z >> shift2); // set char in second section
            shift1 -= 4;
            shift2 -= 4;
        }

        return result;
    }

    /**
     * @dev Returns the ASCII hex character representing the last four bits of the input (0-9a-f).
     */
    function char(uint256 input) private pure returns (bytes1) {
        uint256 b = input & FOUR_BIT_MASK;
        return bytes1(uint8(b + ((b < 10) ? ASCII_ZERO : ASCII_RELATIVE_ZERO)));
    }
}
