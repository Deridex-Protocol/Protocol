import BigNumber from 'bignumber.js';
import {
  Fee,
  FundingRate,
  Price,
} from './types';

const ONE_MINUTE_IN_SECONDS = new BigNumber(60);
const ONE_HOUR_IN_SECONDS = ONE_MINUTE_IN_SECONDS.times(60);
const ONE_DAY_IN_SECONDS = ONE_HOUR_IN_SECONDS.times(24);
const ONE_YEAR_IN_SECONDS = ONE_DAY_IN_SECONDS.times(365);

export const PRICES = {
  NONE: new Price(0),
  ONE: new Price(1),
};

export const FEES = {
  ZERO: new Fee(0),
  ONE_BIP: new Fee('1e-4'),
  ONE_PERCENT: new Fee('1e-2'),
};

export const INTEGERS = {
  ONE_MINUTE_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_YEAR_IN_SECONDS,
  ZERO: new BigNumber(0),
  ONE: new BigNumber(1),
  ONES_255: new BigNumber(
    '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  ), // 2**256-1
};

export const ADDRESSES = {
  ZERO: '0x0000000000000000000000000000000000000000',
  TEST: [],
};

// ============ P1TraderConstants.sol ============

export const TRADER_FLAG_ORDERS = new BigNumber(1);
export const TRADER_FLAG_LIQUIDATION = new BigNumber(2);
export const TRADER_FLAG_DELEVERAGING = new BigNumber(4);

// ============ P1Orders.sol ============

export const ORDER_FLAGS = {
  IS_BUY: 1,
  IS_DECREASE_ONLY: 2,
  IS_NEGATIVE_LIMIT_FEE: 4,
};

// ============ P1FundingOracle.sol ============

// Rate limiting is based on a 45 minute period, equal to the funding rate update interval
// of one hour, with fifteen minutes as a buffer.
const FUNDING_LIMIT_PERIOD = INTEGERS.ONE_MINUTE_IN_SECONDS.times(45);

// Funding rate limits set by the smart contract.
export const FUNDING_RATE_MAX_ABS_VALUE = FundingRate.fromEightHourRate('0.0075').roundedDown();
export const FUNDING_RATE_MAX_ABS_DIFF_PER_SECOND =
  FUNDING_RATE_MAX_ABS_VALUE.times(2).div(FUNDING_LIMIT_PERIOD).roundedDown();