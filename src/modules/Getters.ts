
import BigNumber from 'bignumber.js';
import {
  address,
  Balance,
  BaseValue,
  CallOptions,
  Index,
  Price,
  PosAndNegValues,
} from '../lib/types';

export default class Getters {
  

  // ============ Helper Functions ============

  /**
   * Get the margin and position for an account, taking into account unsettled interest.
   */
  public async getNetAccountBalance(
    perpetual,  
    account: address,
    options?: CallOptions,
  ): Promise<Balance> {
    // Get the unsettled balance.
    const balance = await this.getAccountBalance(perpetual, account, options);

    // Calculate the unsettled interest.
    const globalIndex: Index = await this.getGlobalIndex(options);
    const localIndex: Index = await this.getAccountIndex(perpetual, account, options);
    const indexDiff: BaseValue = globalIndex.baseValue.minus(localIndex.baseValue.value);
    const interest: BigNumber = indexDiff.times(balance.position.negated()).value;

    // Follow P1Settlement rounding rules: round debits up and credits down.
    const roundedInterest: BigNumber = interest.integerValue(BigNumber.ROUND_FLOOR);

    // Return the current balance with interest applied.
    const netMargin = balance.margin.plus(roundedInterest);
    return new Balance(netMargin, balance.position);
  }

  public async getNetAccountValues(
    perpetual,
    account: address,
    options?: CallOptions,
  ): Promise<PosAndNegValues> {
    const [
      balance,
      price,
    ] = await Promise.all([
      this.getNetAccountBalance(perpetual, account, options),
      this.getOraclePrice(options),
    ]);
    return balance.getPositiveAndNegativeValues(price);
  }

  public async getNetAccountCollateralization(
    perpetual,
    account: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const [
      balance,
      price,
    ] = await Promise.all([
      this.getNetAccountBalance(perpetual,account, options),
      this.getOraclePrice(options),
    ]);
    return balance.getCollateralization(price);
  }

  public async getNetAccountIsLiquidatable(
    perpetual,  
    account: address,
    options?: CallOptions,
  ): Promise<boolean> {
    const [
      collateralization,
      minCollateralization,
    ] = await Promise.all([
      this.getNetAccountCollateralization(perpetual,account, options),
      this.getMinCollateral(options),
    ]);
    return collateralization.lt(minCollateralization.value);
  }

  // ============ Account Getters ============

  public async getAccountBalance(
    perpetual,
    account: address,
    options?: CallOptions,
  ): Promise<Balance> {
    const balance = await perpetual.methods.getAccountBalance(account).call()
    return Balance.fromSolidity(balance);
  }

  public async getAccountIndex(
    perpetual,
    account: address,
    options?: CallOptions,
  ): Promise<Index> {
    const result = await perpetual.methods.getAccountIndex(account).call()
    return this.solidityIndexToIndex(result);
  }

  public async getIsLocalOperator(
    perpetual,
    account: address,
    operator: address,
    options?: CallOptions,
  ): Promise<boolean> {
    return perpetual.getIsLocalOperator(
        account,
        operator,
    ).call();
  }

  public async hasAccountPermissions(
    perpetual,  
    account: address,
    operator: address,
    options?: CallOptions,
  ): Promise<boolean> {
    return perpetual.methods.hasAccountPermissions(
        account,
        operator,
      ).call()
     
  }

  // ============ Global Getters ============

  public async getAdmin(
    perpetual,  
    options?: CallOptions,
  ): Promise<address> {
    return await perpetual.methods.getAdmin().call();

  }

  public async getIsGlobalOperator(
    perpetual,  
    operator: address,
    options?: CallOptions,
  ): Promise<boolean> {
    return await perpetual.methods.getIsGlobalOperator(
        operator,
      ).call()
  }

  public async getTokenContract(
    perpetual,  
    options?: CallOptions,
  ): Promise<address> {
    return await perpetual.methods.getTokenContract().call()
  }

  public async getOracleContract(
    perpetual,  
    options?: CallOptions,
  ): Promise<address> {
    return await perpetual.methods.getOracleContract().call()
  }

  public async getFunderContract(
    perpetual,  
    options?: CallOptions,
  ): Promise<address> {
    return await perpetual.methods.getFunderContract().call();
  }

  public async getGlobalIndex(
    perpetual,
    options?: CallOptions,
  ): Promise<Index> {
    const result = await perpetual.methods.getGlobalIndex().call();
    return this.solidityIndexToIndex(result);
  }

  public async getMinCollateral(
    perpetual,
    options?: CallOptions,
  ): Promise<BaseValue> {
    const result = await perpetual.methods.getMinCollateral().call();
      
    return BaseValue.fromSolidity(result);
  }

  public async getFinalSettlementEnabled(
    perpetual,
    options?: CallOptions,
  ): Promise<boolean> {
    return await perpetual.methods.getFinalSettlementEnabled().call();
      
  }

  public async getOraclePrice(
    perpetual,
    options?: CallOptions,
  ): Promise<Price> {
    const result = await perpetual.methods.getOraclePrice().call();
    return Price.fromSolidity(result);
  }

  // ============ Helper Functions ============

  private solidityIndexToIndex(
    solidityIndex: any[],
  ): Index {
    const [
      timestamp,
      isPositive,
      value,
    ] = solidityIndex;
    return {
      timestamp: new BigNumber(timestamp),
      baseValue: BaseValue.fromSolidity(value, isPositive),
    };
  }
}