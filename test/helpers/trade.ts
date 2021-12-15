import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { TRADER_FLAG_ORDERS } from '../../src/lib/Constants';
import { BigNumberable, TxResult, address } from '../../src/lib/types';

const traderFlags = `0x${new BigNumber(TRADER_FLAG_ORDERS).toString(16).padStart(64, '0')}`

export async function buy(
  perpetual, 
  trader,  
  taker: address,
  maker: address,
  position: BigNumberable,
  cost: BigNumberable,
){
  return trade(perpetual,trader,taker, maker, position, cost, true);
}

export async function sell(
  perpetual,
  trader,  
  taker: address,
  maker: address,
  position: BigNumberable,
  cost: BigNumberable,
){
  return trade(perpetual, trader, taker, maker, position, cost, false);
}

export async function trade(
  perpetual,
  trader,  
  taker: address,
  maker: address,
  position: BigNumberable,
  cost: BigNumberable,
  isBuy: boolean,
){
  await trader.setTradeResult(
    new BigNumber(cost),
    new BigNumber(position),
    isBuy,
    traderFlags,
  );
  const accounts = _.chain([taker, maker]).map(_.toLower).sort().sortedUniq().value();
  return perpetual.methods.trade(
    accounts,
    [
      {
        makerIndex: accounts.indexOf(maker.toLowerCase()),
        takerIndex: accounts.indexOf(taker.toLowerCase()),
        trader: trader.address,
        data: '0x00',
      },
    ],
  ).send({from: maker, gas: '300000', gasPrice: '130000000000'})
}