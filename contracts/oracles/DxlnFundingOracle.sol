// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../utils/SafeMath.sol";
import "../utils/Ownable.sol";
import "../utils/BaseMath.sol";
import "../utils/Math.sol";
import "../utils/SafeCast.sol";
import "../utils/SignedMath.sol";
import "../intf/I_DxlnFunder.sol";
import "../lib/DxlnIndexMath.sol";
import "../lib/DxlnTypes.sol";

/**
 * @notice Oracle providing the funding rate for a perpetual market.
 */
contract DxlnFundingOracle is Ownable, I_DxlnFunder {
    using BaseMath for uint256;
    using SafeCast for uint256;
    using SafeMath for uint128;
    using SafeMath for uint256;
    using DxlnIndexMath for DxlnTypes.Index;
    using SignedMath for SignedMath.Int;

    // ============ Constants ============

    uint256 private constant FLAG_IS_POSITIVE = 1 << 128;
    uint128 internal constant BASE = 10**18;

    /**
     * @notice Bounding params constraining updates to the funding rate.
     *
     *  Like the funding rate, these are per-second rates, fixed-point with 18 decimals.
     *  We calculate the per-second rates from the market specifications, which use 8-hour rates:
     *  - The max absolute funding rate is 0.75% (8-hour rate).
     *  - The max change over a 45-minute period is 1.5% (8-hour rate).
     *
     *  This means the fastest the funding rate can go from its min to its max value, or vice versa,
     *  is in 45 minutes.
     */
    uint128 public constant MAX_ABS_VALUE = (BASE * 75) / 10000 / (8 hours);
    uint128 public constant MAX_ABS_DIFF_PER_SECOND =
        (MAX_ABS_VALUE * 2) / (45 minutes);

    // ============ Events ============

    event LogFundingRateUpdated(bytes32 fundingRate);

    event LogFundingRateProviderSet(address fundingRateProvider);

    // ============ Mutable Storage ============

    // The funding rate is denoted in units per second, as a fixed-point number with 18 decimals.
    DxlnTypes.Index private _FUNDING_RATE_;

    // Address which has the ability to update the funding rate.
    address public _FUNDING_RATE_PROVIDER_;

    // ============ Constructor ============

    constructor(address fundingRateProvider) {
        DxlnTypes.Index memory fundingRate = DxlnTypes.Index({
            timestamp: block.timestamp.toUint32(),
            isPositive: true,
            value: 0
        });
        _FUNDING_RATE_ = fundingRate;
        _FUNDING_RATE_PROVIDER_ = fundingRateProvider;

        emit LogFundingRateUpdated(fundingRate.toBytes32());
        emit LogFundingRateProviderSet(fundingRateProvider);
    }

    // ============ External Functions ============

    /**
     * @notice Set the funding rate, denoted in units per second, fixed-point with 18 decimals.
     * @dev Can only be called by the funding rate provider. Emits the LogFundingRateUpdated event.
     *
     * @param  newRate  The intended new funding rate. Is bounded by the global constant bounds.
     * @return          The new funding rate with a timestamp of the update.
     */
    function setFundingRate(SignedMath.Int calldata newRate)
        external
        returns (DxlnTypes.Index memory)
    {
        require(
            msg.sender == _FUNDING_RATE_PROVIDER_,
            "The funding rate can only be set by the funding rate provider"
        );

        SignedMath.Int memory boundedNewRate = _boundRate(newRate);
        DxlnTypes.Index memory boundedNewRateWithTimestamp = DxlnTypes.Index({
            timestamp: block.timestamp.toUint32(),
            isPositive: boundedNewRate.isPositive,
            value: boundedNewRate.value.toUint128()
        });
        _FUNDING_RATE_ = boundedNewRateWithTimestamp;

        emit LogFundingRateUpdated(boundedNewRateWithTimestamp.toBytes32());

        return boundedNewRateWithTimestamp;
    }

    /**
     * @notice Set the funding rate provider. Can only be called by the admin.
     * @dev Emits the LogFundingRateProviderSet event.
     *
     * @param  newProvider  The new provider, who will have the ability to set the funding rate.
     */
    function setFundingRateProvider(address newProvider) external onlyOwner {
        _FUNDING_RATE_PROVIDER_ = newProvider;
        emit LogFundingRateProviderSet(newProvider);
    }

    // ============ Public Functions ============

    /**
     * @notice Calculates the signed funding amount that has accumulated over a period of time.
     *
     * @param  timeDelta  Number of seconds over which to calculate the accumulated funding amount.
     * @return            True if the funding rate is positive, and false otherwise.
     * @return            The funding amount as a unitless rate, represented as a fixed-point number
     *                    with 18 decimals.
     */
    function getFunding(uint256 timeDelta)
        public
        view
        override
        returns (bool, uint256)
    {
        // Note: Funding interest in PerpetualV1 does not compound, as the interest affects margin
        // balances but is calculated based on position balances.
        DxlnTypes.Index memory fundingRate = _FUNDING_RATE_;
        uint256 fundingAmount = uint256(fundingRate.value).mul(timeDelta);
        return (fundingRate.isPositive, fundingAmount);
    }

    // ============ Helper Functions ============

    /**
     * @dev Apply the contract-defined bounds and return the bounded rate.
     */
    function _boundRate(SignedMath.Int memory newRate)
        private
        view
        returns (SignedMath.Int memory)
    {
        // Get the old rate from storage.
        DxlnTypes.Index memory oldRateWithTimestamp = _FUNDING_RATE_;
        SignedMath.Int memory oldRate = SignedMath.Int({
            value: oldRateWithTimestamp.value,
            isPositive: oldRateWithTimestamp.isPositive
        });

        // Get the maximum allowed change in the rate.
        uint256 timeDelta = block.timestamp.sub(oldRateWithTimestamp.timestamp);
        uint256 maxDiff = MAX_ABS_DIFF_PER_SECOND.mul(timeDelta);

        // Calculate and return the bounded rate.
        if (newRate.gt(oldRate)) {
            SignedMath.Int memory upperBound = SignedMath.min(
                oldRate.add(maxDiff),
                SignedMath.Int({value: MAX_ABS_VALUE, isPositive: true})
            );
            return SignedMath.min(newRate, upperBound);
        } else {
            SignedMath.Int memory lowerBound = SignedMath.max(
                oldRate.sub(maxDiff),
                SignedMath.Int({value: MAX_ABS_VALUE, isPositive: false})
            );
            return SignedMath.max(newRate, lowerBound);
        }
    }
}
