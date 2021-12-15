
import _ from 'lodash';
// import { Contracts } from './Contracts';
import {
  SendOptions,
  TradeArg,
  TxResult,
} from '../lib/types';

import TradeOperation from './TradeOperation';
import Orders from './Orders';

export default class Trade {
//   private contracts: Contracts;
//   private orders: Orders;

  constructor(
    // contracts: Contracts,
    // orders: Orders,
  ) {
    // this.contracts = contracts;
    // this.orders = orders;
  }

  // ============ Public Functions ============

  public initiate(): TradeOperation {
    return new TradeOperation(
    //   this.contracts,
    //   this.orders,
    );
  }

  // ============ Solidity Functions ============

  public async trade(
    perpetual,
    sender,
    accounts: string[],
    tradeArgs: TradeArg[],
    options?: SendOptions,
  ): Promise<TxResult> {
    if (!_.isEqual(accounts, _.chain(accounts).map(_.toLower).sort().sortedUniq().value())) {
      throw new Error(
        'Accounts passed to trade() should be lowercase, unique, and sorted; got: '
        + `${JSON.stringify(accounts)}`,
      );
    }
    for (const { makerIndex, takerIndex } of tradeArgs) {
      if (makerIndex < 0 || makerIndex >= accounts.length) {
        throw new Error(`Trade arg maker index out of bounds: ${makerIndex}`);
      }
      if (takerIndex < 0 || takerIndex >= accounts.length) {
        throw new Error(`Trade arg taker index out of bounds: ${takerIndex}`);
      }
    }
    return perpetual.methods.trade(
        accounts,
        tradeArgs).send({from: sender, gas: '300000', gasPrice: '130000000000'})
  }
}