// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import {I_DxlnFunder} from "../intf/I_DxlnFunder.sol";

/**
 * @title TestFunder
 * @notice I_DxlnFunder implementation for testing.
 */
/* solium-disable-next-line camelcase */
contract TestFunder is I_DxlnFunder {
    bool public _FUNDING_IS_POSITIVE_ = true;
    uint256 public _FUNDING_ = 0;

    function getFunding(
        uint256 // timeDelta
    ) external view override returns (bool, uint256) {
        return (_FUNDING_IS_POSITIVE_, _FUNDING_);
    }

    function setFunding(bool isPositive, uint256 newFunding) external {
        _FUNDING_IS_POSITIVE_ = isPositive;
        _FUNDING_ = newFunding;
    }
}
