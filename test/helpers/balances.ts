import BigNumber from 'bignumber.js';

import { expectBN } from './Expect';
import { INTEGERS } from '../../src/lib/Constants';
import { address, Balance, BigNumberable, TxResult } from '../../src/lib/types';
import Getters from "../../src/modules/Getters"

const gettersModule = new Getters

export async function expectBalances(
  perpetual,
  testToken,
  txResult: TxResult,
  accounts: address[],
  expectedMargins: BigNumberable[],
  expectedPositions: BigNumberable[],
  fullySettled: boolean = true,
  positionsSumToZero: boolean = true,
): Promise<void> {
  await Promise.all([
    expectMarginBalances(perpetual, testToken, txResult, accounts, expectedMargins, fullySettled),
    expectPositions(perpetual, txResult, accounts, expectedPositions, positionsSumToZero),
  ]);
}

/**
 * Verify that the account margin balances match the expected values.
 *
 * A final solvency check may be performed to verify that the total margin balance is equal to the
 * token balance actually owned by the contract.
 */
export async function expectMarginBalances(
  perpetual,
  testToken,
  txResult: TxResult,
  accounts: address[],
  expectedMargins: BigNumberable[],
  fullySettled: boolean = true,
): Promise<void> {
  const actualMargins= await Promise.all(accounts.map((account: address) => {
    return gettersModule.getAccountBalance(perpetual,account).then(balance => balance.margin);
    
  }));

  // const eventBalances = getBalanceEvents(ctx, txResult, accounts);

  for (const i in expectedMargins) {
    const actualMargin = new BigNumber(actualMargins[i])
    const expectedMargin = new BigNumber(expectedMargins[i]);
    expectBN(actualMargins[i], `accounts[${i}] actual margin`).to.be.equal(expectedMargin);
    // if (eventBalances[i]) {
    //   expectBN(eventBalances[i].margin, `accounts[${i}] event margin`).eq(expectedMargin);
    // }
  }

  // Contract solvency check
  if (fullySettled) {
    const accountSumMargin = actualMargins.reduce((a, b) => a.plus(b), INTEGERS.ZERO);
    const perpetualTokenBalance = await testToken.balanceOf(
      perpetual._address,
    );
    expectBN(accountSumMargin, 'sum of margins equals token balance').to.be.equal(new BigNumber(perpetualTokenBalance));
  }
}

/**
 * Verify that the account position balances match the expected values.
 *
 * If sumToZero is set to true (the default) then a check will be performed to ensure the position
 * balances sum to zero. This should always be the case when (for example) the prvoided accounts
 * represent all accounts on the contract with positions.
 */

 export async function expectPositions(
   perpetual,
   txResult: TxResult,
   accounts: address[],
   expectedPositions: BigNumberable[],
   sumToZero: boolean = true,
 ) {
   const actualPositions = await Promise.all(accounts.map((account: address) => {
     return gettersModule.getAccountBalance(perpetual,account).then(balance => balance.position);
   }));
   // const eventBalances = getBalanceEvents(ctx, txResult, accounts);

   for (const i in expectedPositions) {
     const expectedPosition = new BigNumber(expectedPositions[i]);
     expectBN(actualPositions[i], `accounts[${i}] actual position`).to.be.equal(expectedPosition);
    //  if (eventBalances[i]) {
    //    expectBN(eventBalances[i].position, `accounts[${i}] event position`).eq(expectedPosition);
    //  }
   }

   if (sumToZero) {
     const accountSumPosition = actualPositions.reduce((a, b) => a.plus(b), INTEGERS.ZERO);
     expectBN(accountSumPosition, 'sum of positions is not zero').to.be.equal(INTEGERS.ZERO);
   }
 }

/**
 * Verify that the account token balances match the expected values.
 */
// export async function expectTokenBalances(
//   ctx: ITestContext,
//   accounts: address[],
//   expectedBalances: BigNumberable[],
//   tokenAddress: address = ctx.perpetual.contracts.testToken.options.address,
// ): Promise<void> {
//   const balances = await Promise.all(accounts.map((account: address) =>
//     ctx.perpetual.testing.token.getBalance(
//       tokenAddress,
//       account,
//     ),
//   ));
//   for (const i in expectedBalances) {
//     expectBN(balances[i], `accounts[${i}] token balance`).to.eq(expectedBalances[i]);
//   }
// }

// /**
//  * Check that the contract has a surplus (or deficit) relative to the current margin balances.
//  *
//  * The surplus/deficit could be due to unsettled interest or due to rounding errors in settlement.
//  */
// export async function expectContractSurplus(
//   ctx: ITestContext,
//   accounts: address[],
//   expectedSurplus: BigNumberable,
// ): Promise<void> {
//   const marginBalances = await Promise.all(accounts.map((account: address) => {
//     return ctx.perpetual.getters.getAccountBalance(account).then(balance => balance.margin);
//   }));
//   const accountSumMargin = marginBalances.reduce((a, b) => a.plus(b), INTEGERS.ZERO);
//   const perpetualMarginToken = await ctx.perpetual.getters.getTokenContract();
//   const perpetualTokenBalance = await ctx.perpetual.testing.token.getBalance(
//     perpetualMarginToken,
//     ctx.perpetual.contracts.perpetualV1.options.address,
//   );
//   const actualSurplus = perpetualTokenBalance.minus(accountSumMargin);
//   expectBN(actualSurplus, 'contract margin token surplus').eq(expectedSurplus);
// }
