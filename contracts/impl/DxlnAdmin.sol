// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./DxlnStorage.sol";
import "./DxlnFinalSettlement.sol";
import "../intf/I_DxlnOracle.sol";
import "../intf/I_DxlnFunder.sol";
import "../lib/DxlnTypes.sol";
import "../utils/BaseMath.sol";
import "../utils/ReentrancyGuard.sol";
import "../utils/Adminable.sol";

/**
 * @notice Contract allowing the Admin address to set certain parameters.
 */
contract DxlnAdmin is DxlnStorage, DxlnFinalSettlement {
    // ============ Events ============

    event LogSetGlobalOperator(address operator, bool approved);

    event LogSetOracle(address oracle);

    event LogSetFunder(address funder);

    event LogSetMinCollateral(uint256 minCollateral);

    event LogFinalSettlementEnabled(uint256 settlementPrice);

    // ============ Functions ============

    /**
     * @notice Add or remove a Global Operator address.
     * @dev Must be called by the PerpetualV1 admin. Emits the LogSetGlobalOperator event.
     *
     * @param  operator  The address for which to enable or disable global operator privileges.
     * @param  approved  True if approved, false if disapproved.
     */
    function setGlobalOperator(address operator, bool approved)
        external
        onlyAdmin
        nonReentrant
    {
        _GLOBAL_OPERATORS_[operator] = approved;
        emit LogSetGlobalOperator(operator, approved);
    }

    /**
     * @notice Sets a new price oracle contract.
     * @dev Must be called by the PerpetualV1 admin. Emits the LogSetOracle event.
     *
     * @param  oracle  The address of the new price oracle contract.
     */
    function setOracle(address oracle) external onlyAdmin nonReentrant {
        I_DxlnOracle newOracle = I_DxlnOracle(oracle);
        require(
            newOracle.getPrice() != 0,
            "New oracle cannot return a zero price"
        );
        _ORACLE_ = newOracle;
        emit LogSetOracle(oracle);
    }

    /**
     * @notice Sets a new funder contract.
     * @dev Must be called by the DexilonV1 admin. Emits the LogSetFunder event.
     *
     * @param  funder  The address of the new funder contract.
     */
    function setFunder(address funder) external onlyAdmin nonReentrant {
        // call getFunding to ensure that no reverts occur
        I_DxlnFunder newFunder = I_DxlnFunder(funder);
        newFunder.getFunding(0);

        _FUNDER_ = newFunder;
        emit LogSetFunder(funder);
    }

    /**
     * @notice Sets a new value for the minimum collateralization percentage.
     * @dev Must be called by the PerpetualV1 admin. Emits the LogSetMinCollateral event.
     *
     * @param  minCollateral  The new value of the minimum initial collateralization percentage,
     *                        as a fixed-point number with 18 decimals.
     */
    function setMinCollateral(uint256 minCollateral)
        external
        onlyAdmin
        nonReentrant
    {
        require(
            minCollateral >= BaseMath.base(),
            "The collateral requirement cannot be under 100%"
        );
        _MIN_COLLATERAL_ = minCollateral;
        emit LogSetMinCollateral(minCollateral);
    }

    /**
     * @notice Enables final settlement if the oracle price is between the provided bounds.
     * @dev Must be called by the PerpetualV1 admin. The current result of the price oracle
     *  must be between the two bounds supplied. Emits the LogFinalSettlementEnabled event.
     *
     * @param  priceLowerBound  The lower-bound (inclusive) of the acceptable price range.
     * @param  priceUpperBound  The upper-bound (inclusive) of the acceptable price range.
     */
    function enableFinalSettlement(
        uint256 priceLowerBound,
        uint256 priceUpperBound
    ) external onlyAdmin noFinalSettlement nonReentrant {
        // Update the Global Index and grab the Price.
        DxlnTypes.Context memory context = _loadContext();

        // Check price bounds.
        require(
            context.price >= priceLowerBound,
            "Oracle price is less than the provided lower bound"
        );
        require(
            context.price <= priceUpperBound,
            "Oracle price is greater than the provided upper bound"
        );

        // Save storage variables.
        _FINAL_SETTLEMENT_PRICE_ = context.price;
        _FINAL_SETTLEMENT_ENABLED_ = true;

        emit LogFinalSettlementEnabled(_FINAL_SETTLEMENT_PRICE_);
    }
}
