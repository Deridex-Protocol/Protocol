// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../intf/AggregatorV3Interface.sol";
import "../utils/BaseMath.sol";
import "../intf/I_DxlnOracle.sol";

/**
 * @notice DxlnChainlinkOracle that reads the price from a Chainlink aggregator.
 */
contract DxlnChainlinkOracle is I_DxlnOracle {
    using BaseMath for uint256;

    // ============ Storage ============

    // The underlying aggregator to get the price from.
    AggregatorV3Interface public _ORACLEAGG_;

    // The address with permission to read the oracle price.
    address public _READER_;

    // A constant factor to adjust the price by, as a fixed-point number with 18 decimal places.
    uint256 public _ADJUSTMENT_;

    // Compact storage for the above parameters.
    mapping(address => bytes32) public _MAPPING_;

    // ============ Constructor ============

    constructor(
        address oracle,
        address reader,
        uint96 adjustmentExponent
    ) {
        _ORACLEAGG_ = AggregatorV3Interface(oracle);
        _READER_ = reader;
        _ADJUSTMENT_ = 10**uint256(adjustmentExponent);

        bytes32 oracleAndAdjustment = bytes32(bytes20(oracle)) |
            bytes32(uint256(adjustmentExponent));
        _MAPPING_[reader] = oracleAndAdjustment;
    }

    // ============ Public Functions ============

    /**
     * @notice Returns the oracle price from the aggregator.
     *
     * @return The adjusted price as a fixed-point number with 18 decimals.
     */
    function getPrice() external view override returns (uint256) {
        bytes32 oracleAndExponent = _MAPPING_[msg.sender];
        require(
            oracleAndExponent != bytes32(0),
            "DxlnChainlinkOracle: Sender not authorized to get price"
        );
        (address oracle, uint256 adjustment) = getOracleAndAdjustment(
            oracleAndExponent
        );

        AggregatorV3Interface priceFeed = AggregatorV3Interface(oracle);
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(
            answer > 0,
            "DxlnChainlinkOracle: Invalid answer from aggregator"
        );

        uint256 rawPrice = uint256(answer);
        return rawPrice.baseMul(adjustment);
    }

    function getOracleAndAdjustment(bytes32 oracleAndExponent)
        private
        pure
        returns (address, uint256)
    {
        address oracle = address(bytes20(oracleAndExponent));
        uint256 exponent = uint256(uint96(uint256(oracleAndExponent)));
        return (oracle, 10**exponent);
    }
}
