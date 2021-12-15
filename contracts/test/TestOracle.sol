// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import {I_DxlnOracle} from "../intf/I_DxlnOracle.sol";

/**
 * @title TestOracle
 * @notice I_DxlnOracle implementation for testing.
 */
/* solium-disable-next-line camelcase */
contract TestOracle is I_DxlnOracle {
    uint256 public _PRICE_ = 0;

    function getPrice() external view override returns (uint256) {
        return _PRICE_;
    }

    function setPrice(uint256 newPrice) external {
        _PRICE_ = newPrice;
    }
}
