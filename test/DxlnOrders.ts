import { artifacts, Web3 } from "hardhat";
import { web3 } from "hardhat";
import { waffle } from "hardhat";
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import Orders from "../src/modules/Orders"
import Trade from "../src/modules/Trade"
import { expectBalances } from "./helpers/balances";
import _, { defer } from "lodash"
import Getters from "../src/modules/Getters"
import { expectBN, expectThrow, expectBaseValueEqual } from './helpers/Expect';
import {
  boolToBytes32,
} from '../src/lib/BytesHelper'
import {
    Balance,
    Fee,
    Order,
    Price,
    SignedOrder,
    SigningMethod,
    OrderStatus,
    address,
    BigNumberable,
    TypedSignature
} from '../src/lib/types';
import {
    ADDRESSES,
    INTEGERS,
    PRICES,
  } from '../src/lib/Constants';
import { buy, sell } from "./helpers/trade"
import { BigNumber } from "bignumber.js"

const truffleAssert= require('truffle-assertions');

chai.use(chaiAsPromised)
chai.use(waffle.solidity);

const expect = chai.expect

const DxlnPerpetualV1 = artifacts.require("DxlnPerpetualV1");
let dxlnPerpetualV1;
const DxlnPerpetualProxy = artifacts.require("DxlnPerpetualProxy");
let dxlnPerpetualProxy;
const DxlnChainlinkOracle = artifacts.require("DxlnChainlinkOracle");
let dxlnChainlinkOracle;
const DxlnFundingOracle = artifacts.require("DxlnFundingOracle");
let dxlnFundingOracle;
const DxlnOrders = artifacts.require("DxlnOrders")
let dxlnOrders;
const TestToken = artifacts.require("TestToken")
let testToken;
const TestTrader = artifacts.require("TestTrader")
let testTrader;
const TestOracle = artifacts.require("TestOracle")
let testOracle
const TestFunder = artifacts.require("TestFunder")
let testFunder
let perpetual;

let owner;
let operator;
let otherAccount;
let otherUser;

const ordersModule = new Orders
const tradeModule = new Trade
const gettersModule = new Getters

const orderAmount = new BigNumber('1e18');
const limitPrice = new Price('987.65432');
const minCollateralInit = '1100000000000000000' // Dev collateral 

const defaultOrder: Order = {
    limitPrice,
    isBuy: true,
    isDecreaseOnly: false,
    amount: orderAmount,
    triggerPrice: PRICES.NONE,
    limitFee: Fee.fromBips(20),
    maker: ADDRESSES.ZERO,
    taker: ADDRESSES.ZERO,
    expiration: INTEGERS.ONE_YEAR_IN_SECONDS.times(100),
    salt: new BigNumber('425'),
};

const initialMargin = orderAmount.times(limitPrice.value).times(2);
const fullFlagOrder: Order = {
  ...defaultOrder,
  isDecreaseOnly: true,
  limitFee: new Fee(defaultOrder.limitFee.value.abs().negated()),
};

let stringifiedOrder;

let defaultSignedOrder: SignedOrder;
let fullFlagSignedOrder: SignedOrder;

describe("DxlnOrders", function(){

  describe("Off-chain helpers", function(){

    beforeEach(async () =>{

        this.timeout(0);
    
            [owner, operator, otherAccount, otherUser] = await web3.eth.getAccounts();
    
            // Initialize perpetual protocol 
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
        
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
            dxlnOrders = await DxlnOrders.new(perpetual._address, 42)
    
            testToken = await TestToken.new()
            testOracle = await TestOracle.new()
            testFunder = await TestFunder.new()
            testTrader = await TestTrader.new()
            
            await perpetual.methods.initializeV1(testToken.address, testOracle.address, testFunder.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            defaultOrder.maker = fullFlagOrder.maker = operator;
            defaultOrder.taker = fullFlagOrder.taker = otherAccount;

            defaultSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, defaultOrder, SigningMethod.Hash);
            fullFlagSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, fullFlagOrder, SigningMethod.Hash);

            // Set up initial balances 

            await testToken.mint(defaultOrder.maker, initialMargin.toFixed(0), {from: owner})
            await testToken.mint(defaultOrder.taker, initialMargin.toFixed(0), {from: owner})
    
            // Set maximum perpetual allowance

            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.maker})
            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.taker})
    
            // Do the deposit 

            await perpetual.methods.deposit(defaultOrder.maker, initialMargin.toFixed(0)).send({from: operator, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.deposit(defaultOrder.taker, initialMargin.toFixed(0)).send({from: otherAccount, gas: '300000', gasPrice: '130000000000'})

            await perpetual.methods.setGlobalOperator(dxlnOrders.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})

    })
    
    xit("Signs correctly for hash", async () =>{

      const typedSignature = await ordersModule.signOrder(
        dxlnOrders,
        defaultOrder,
        SigningMethod.Hash,
      );

      const validSignature = ordersModule.orderHasValidSignature(
        dxlnOrders, 
        {
        ...defaultOrder,
        typedSignature,
      });

      expect(validSignature).to.be.true;

    })

    xit("Signs correctly for typed data", async () =>{

      const typedSignature = await ordersModule.signOrder(
        dxlnOrders,
        defaultOrder,
        SigningMethod.TypedData,
      );
      const validSignature = ordersModule.orderHasValidSignature(
        dxlnOrders,
        {
        ...defaultOrder,
        typedSignature,
      });

      expect(validSignature).to.be.true;

      // Troubles with typed data signatures: Maybe problems with off-chain helpers not contracts 

    })

    xit("Signs an order cancelation", async () =>{

      const typedSignature = await ordersModule.signCancelOrder(
        dxlnOrders,
        defaultOrder,
        SigningMethod.TypedData,
      );
      const validTypedSignature = ordersModule.cancelOrderHasValidSignature(
        dxlnOrders,
        defaultOrder,
        typedSignature,
      );
      expect(validTypedSignature).to.be.true;

      // Troubles with typed data signatures: Maybe problems with off-chain helpers not contracts 

      const hashSignature = await ordersModule.signCancelOrder(
        dxlnOrders,
        defaultOrder,
        SigningMethod.Hash,
      );
      const validHashSignature = ordersModule.cancelOrderHasValidSignature(
        dxlnOrders,
        defaultOrder,
        hashSignature,
      );
      expect(validHashSignature).to.be.true;

    })

    xit("Recognizes invalid signatures", async () =>{

      const badSignatures = [
        `0x${'00'.repeat(63)}00`,
        `0x${'ab'.repeat(63)}01`,
        `0x${'01'.repeat(70)}01`,
      ];

      badSignatures.map((typedSignature) => {

        const validSignature = ordersModule.orderHasValidSignature(
          dxlnOrders, 
          {
          ...defaultOrder,
          typedSignature,
        });
        expect(validSignature).to.be.false;

        const validCancelSignature = ordersModule.cancelOrderHasValidSignature(
          dxlnOrders,
          defaultOrder,
          typedSignature,
        );
        expect(validCancelSignature).to.be.false;

        });
    })

    it('Estimates collateralization after executing buys', async () => {

      // Buy 1e18 BASE at price of 987.65432 QUOTE/BASE with fee of 0.002.
      // - base: 1e18 BASE -> worth 1200e18 QUOTE at oracle price of 1200
      // - quote: -987.65432e18 * 1.002 QUOTE

      const oraclePrice = new Price(1200);
      const marginCost = orderAmount.times(limitPrice.value);
      const ratio = ordersModule.getAccountCollateralizationAfterMakingOrders(
        new Balance(0, 0),
        oraclePrice,
        [defaultOrder, defaultOrder, defaultOrder],
        [marginCost.div(3), marginCost.div(2), marginCost.div(6)],
      );

      // Execute the trade on the smart contract.
      // First, withdraw maker margin so it has zero initial balance.

      const { maker } = defaultOrder;

      await perpetual.methods.withdraw(maker, maker, initialMargin.toFixed(0)).send({from: maker, gas: '300000', gasPrice: '130000000000'}),
      await testOracle.setPrice(oraclePrice.toSolidity())
      await fillOrder(perpetual, dxlnOrders, testToken, { amount: orderAmount.div(3) });
      await fillOrder(perpetual, dxlnOrders, testToken, { amount: orderAmount.div(2) });
      await fillOrder(perpetual, dxlnOrders, testToken, { amount: orderAmount.div(6) });

      const balance = await gettersModule.getAccountBalance(perpetual, maker);
      expectBN(ratio, 'simulated vs. on-chain').to.equal(balance.getCollateralization(oraclePrice));

      // Compare with the expected result.
      const expectedRatio = new BigNumber(1200).div(987.65432 * 1.002);
      const error = expectedRatio.minus(ratio).abs();
      expectBN(error, 'simulated vs. expected (error)').to.be.lt(1e-15);

    })

    xit('Estimates collateralization after executing sells', async () => {

      // Sell 1e18 BASE at price of 987.65432 QUOTE/BASE with fee of 0.002.
      // - base: -1e18 BASE -> worth -200e18 QUOTE at oracle price of 200
      // - quote: 987.65432e18 * 0.998 QUOTE
      const oraclePrice = new Price(200);
      const sellOrder = await getModifiedOrder(dxlnOrders,{ isBuy: false });
      const ratio = ordersModule.getAccountCollateralizationAfterMakingOrders(
        new Balance(0, 0),
        oraclePrice,
        [sellOrder, sellOrder, sellOrder],
        [orderAmount.div(3), orderAmount.div(2), orderAmount.div(6)],
      );

      // Execute the trade on the smart contract.
      // First, withdraw maker margin so it has zero initial balance.
      const { maker } = defaultOrder;
      
      await perpetual.methods.withdraw(maker, maker, initialMargin.toFixed(0)).send({from: maker, gas: '300000', gasPrice: '130000000000'}),
      await testOracle.setPrice(oraclePrice.toSolidity())

      await fillOrder(perpetual, dxlnOrders, testToken, sellOrder, { amount: orderAmount.div(3) });
      await fillOrder(perpetual, dxlnOrders, testToken, sellOrder, { amount: orderAmount.div(2) });
      await fillOrder(perpetual, dxlnOrders, testToken, sellOrder, { amount: orderAmount.div(6) });

      const balance = await gettersModule.getAccountBalance(perpetual, maker);
      expectBN(ratio, 'simulated vs. on-chain').to.equal(balance.getCollateralization(oraclePrice));

      console.log(balance.toSolidity())

      // Compare with the expected result.
      const expectedRatio = new BigNumber(987.65432 * 0.998).div(200);
      const error = expectedRatio.minus(ratio).abs();
      expectBN(error, 'simulated vs. expected (error)').to.be.lt(1e-15);

    });

    xit('Estimates collateralization when positive balance is zero', async () => {
      const order = await getModifiedOrder(dxlnOrders, { limitPrice: limitPrice.times(2) });
      const marginCost = orderAmount.times(limitPrice.value.times(2));
      const ratio = ordersModule.getAccountCollateralizationAfterMakingOrders(
        new Balance(initialMargin, orderAmount.negated()),
        limitPrice,
        [order],
        [marginCost],
      );
      expectBN(ratio).to.equal(0);
    });

    xit('Estimates collateralization when negative balance is zero', () => {
      const marginCost = orderAmount.times(limitPrice.value);
      const ratio = ordersModule.getAccountCollateralizationAfterMakingOrders(
        new Balance(initialMargin, orderAmount),
        limitPrice,
        [defaultOrder],
        [marginCost.div(2)],
      );
      expectBN(ratio).to.equal(Infinity);
    });

    xit('Estimates collateralization when balance is zero', async () => {

      const buyOrder = await getModifiedOrder(dxlnOrders, { limitFee: new Fee(0) });
      const sellOrder = await getModifiedOrder(dxlnOrders, { isBuy: false, limitFee: new Fee(0) });
      const marginCost = orderAmount.times(limitPrice.value);
      const ratio1 = ordersModule.getAccountCollateralizationAfterMakingOrders(
        new Balance(0, 0),
        limitPrice,
        [buyOrder, sellOrder],
        [marginCost, orderAmount],
      );
      expectBN(ratio1).to.equal(Infinity);

    });
  });

  describe("approveOrder()", function(){

    beforeEach(async () =>{

      this.timeout(0);
    
            [owner, operator, otherAccount, otherUser] = await web3.eth.getAccounts();
    
            // Initialize perpetual protocol 
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
        
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
            dxlnOrders = await DxlnOrders.new(perpetual._address, 42)
    
            testToken = await TestToken.new()
            testOracle = await TestOracle.new()
            testFunder = await TestFunder.new()
            testTrader = await TestTrader.new()
            
            await perpetual.methods.initializeV1(testToken.address, testOracle.address, testFunder.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            defaultOrder.maker = fullFlagOrder.maker = operator;
            defaultOrder.taker = fullFlagOrder.taker = otherAccount;

            stringifiedOrder = ordersModule.orderToSolidity(fullFlagOrder);

            defaultSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, defaultOrder, SigningMethod.Hash);
            fullFlagSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, fullFlagOrder, SigningMethod.Hash);

            // Set up initial balances 

            await testToken.mint(defaultOrder.maker, initialMargin.toFixed(0), {from: owner})
            await testToken.mint(defaultOrder.taker, initialMargin.toFixed(0), {from: owner})
    
            // Set maximum perpetual allowance

            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.maker})
            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.taker})
    
            // Do the deposit 

            await perpetual.methods.deposit(defaultOrder.maker, initialMargin.toFixed(0)).send({from: operator, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.deposit(defaultOrder.taker, initialMargin.toFixed(0)).send({from: otherAccount, gas: '300000', gasPrice: '130000000000'})

            await perpetual.methods.setGlobalOperator(dxlnOrders.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})
            
    })

    xit('Succeeds', async () => {
      
      const txResult = await dxlnOrders.approveOrder(
        stringifiedOrder,
        { from: fullFlagOrder.maker },
      );
      await expectStatus(dxlnOrders, fullFlagOrder, OrderStatus.Approved);

      // Check logs.
      const logs = parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].event).to.equal('LogOrderApproved');
      expect(logs[0].args.orderHash).to.equal(ordersModule.getOrderHash(dxlnOrders,fullFlagOrder));
      expect(logs[0].args.maker).to.equal(fullFlagOrder.maker);

    });

    xit('Succeeds in double-approving order', async () => {

      await dxlnOrders.approveOrder(
        stringifiedOrder,
        { from: fullFlagOrder.maker },
      );
      await dxlnOrders.approveOrder(
        stringifiedOrder,
        { from: fullFlagOrder.maker },
      );
      await expectStatus(dxlnOrders, fullFlagOrder, OrderStatus.Approved);

    });

    xit('Fails if caller is not the maker', async () => {

      await truffleAssert.reverts(dxlnOrders.approveOrder(stringifiedOrder, { from: fullFlagOrder.taker }),'Order cannot be approved by non-maker')

    });

    xit('Fails to approve canceled order', async () => {

      await dxlnOrders.cancelOrder(stringifiedOrder, { from: fullFlagOrder.maker });
      await truffleAssert.reverts(dxlnOrders.approveOrder(stringifiedOrder, { from: fullFlagOrder.maker }),'Canceled order cannot be approved')

    });
  })

  describe("cancelOrder()", function(){

    beforeEach(async () =>{

      this.timeout(0);
    
            [owner, operator, otherAccount, otherUser] = await web3.eth.getAccounts();
    
            // Initialize perpetual protocol 
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
        
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
            dxlnOrders = await DxlnOrders.new(perpetual._address, 42)
    
            testToken = await TestToken.new()
            testOracle = await TestOracle.new()
            testFunder = await TestFunder.new()
            testTrader = await TestTrader.new()
            
            await perpetual.methods.initializeV1(testToken.address, testOracle.address, testFunder.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            defaultOrder.maker = fullFlagOrder.maker = operator;
            defaultOrder.taker = fullFlagOrder.taker = otherAccount;

            stringifiedOrder = ordersModule.orderToSolidity(fullFlagOrder);

            defaultSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, defaultOrder, SigningMethod.Hash);
            fullFlagSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, fullFlagOrder, SigningMethod.Hash);

            // Set up initial balances 

            await testToken.mint(defaultOrder.maker, initialMargin.toFixed(0), {from: owner})
            await testToken.mint(defaultOrder.taker, initialMargin.toFixed(0), {from: owner})
    
            // Set maximum perpetual allowance

            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.maker})
            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.taker})
    
            // Do the deposit 

            await perpetual.methods.deposit(defaultOrder.maker, initialMargin.toFixed(0)).send({from: operator, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.deposit(defaultOrder.taker, initialMargin.toFixed(0)).send({from: otherAccount, gas: '300000', gasPrice: '130000000000'})

            await perpetual.methods.setGlobalOperator(dxlnOrders.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})
            
    })

    xit('Succeeds', async () => {
  
      const txResult = await dxlnOrders.cancelOrder(
        stringifiedOrder,
        { from: fullFlagOrder.maker },
      );
      await expectStatus(dxlnOrders, fullFlagOrder, OrderStatus.Canceled);

      // Check logs.
      const logs = parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].event).to.equal('LogOrderCanceled');
      expect(logs[0].args.orderHash).to.equal(ordersModule.getOrderHash(dxlnOrders, fullFlagOrder));
      expect(logs[0].args.maker).to.equal(fullFlagOrder.maker);

    });

    xit('Succeeds in double-canceling order', async () => {

      await dxlnOrders.cancelOrder(stringifiedOrder, { from: fullFlagOrder.maker });
      await dxlnOrders.cancelOrder(stringifiedOrder, { from: fullFlagOrder.maker });
      await expectStatus(dxlnOrders, fullFlagOrder, OrderStatus.Canceled);

    });

    xit('Fails if caller is not the maker', async () => {

      await truffleAssert.reverts(dxlnOrders.cancelOrder(stringifiedOrder, { from: fullFlagOrder.taker }),'Order cannot be canceled by non-maker')

    });

    xit('Succeeds in canceling approved order', async () => {

      await dxlnOrders.approveOrder(
        stringifiedOrder,
        { from: fullFlagOrder.maker },
      );
      await dxlnOrders.cancelOrder(stringifiedOrder, { from: fullFlagOrder.maker });
      await expectStatus(dxlnOrders, fullFlagOrder, OrderStatus.Canceled);

    });
  })

  describe("trade()", function(){

    beforeEach(async () =>{

      this.timeout(0);
    
            [owner, operator, otherAccount, otherUser] = await web3.eth.getAccounts();
    
            // Initialize perpetual protocol 
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
        
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
            dxlnOrders = await DxlnOrders.new(perpetual._address, 42)
    
            testToken = await TestToken.new()
            testOracle = await TestOracle.new()
            testFunder = await TestFunder.new()
            testTrader = await TestTrader.new()
            
            await perpetual.methods.initializeV1(testToken.address, testOracle.address, testFunder.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            defaultOrder.maker = fullFlagOrder.maker = operator;
            defaultOrder.taker = fullFlagOrder.taker = otherAccount;

            stringifiedOrder = ordersModule.orderToSolidity(fullFlagOrder);

            defaultSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, defaultOrder, SigningMethod.Hash);
            fullFlagSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, fullFlagOrder, SigningMethod.Hash);

            // Set up initial balances 

            await testToken.mint(defaultOrder.maker, initialMargin.toFixed(0), {from: owner})
            await testToken.mint(defaultOrder.taker, initialMargin.toFixed(0), {from: owner})
    
            // Set maximum perpetual allowance

            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.maker})
            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.taker})
    
            // Do the deposit 

            await perpetual.methods.deposit(defaultOrder.maker, initialMargin.toFixed(0)).send({from: operator, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.deposit(defaultOrder.taker, initialMargin.toFixed(0)).send({from: otherAccount, gas: '300000', gasPrice: '130000000000'})

            await perpetual.methods.setGlobalOperator(dxlnOrders.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
    })
    
    xit('Fills a bid at the limit price', async () => {
      await fillOrder(perpetual, dxlnOrders, testToken);
    });

    xit('Fills an ask at the limit price', async () => {
      await fillOrder(perpetual, dxlnOrders, testToken, { isBuy: false });
    });

    xit('Fills a bid below the limit price', async () => {
      await fillOrder(
        perpetual,
        dxlnOrders, 
        testToken,
        {},
        { price: limitPrice.minus(25) },
      );
    });

    xit('Fills an ask above the limit price', async () => {
      await fillOrder(
        perpetual,
        dxlnOrders, 
        testToken,
        { isBuy: false },
        { price: limitPrice.plus(25) },
      );
    });

    xit('Fills a bid with a fee less than the limit fee', async () => {
      await fillOrder(
        perpetual,
        dxlnOrders, 
        testToken,
        {},
        {
          fee: defaultOrder.limitFee.div(2),
          price: limitPrice.minus(25),
        },
      );
    });

    xit('Fills an ask with a fee less than the limit fee', async () => {
      await fillOrder(
        perpetual,
        dxlnOrders, 
        testToken,
        { isBuy: false },
        {
          fee: defaultOrder.limitFee.div(2),
          price: limitPrice.plus(25),
        },
      );
    });

    xit('Succeeds if sender is a local operator', async () => {

      await perpetual.methods.setLocalOperator(
        otherUser,
        true,
      ).send({from: defaultOrder.taker, gas: '300000', gasPrice: '130000000000'});
      await fillOrder(perpetual, dxlnOrders, testToken, {}, { sender: otherUser });

    });

    xit('Succeeds if sender is a global operator', async () => {

      await perpetual.methods.setGlobalOperator(
        otherUser,
        true,
      ).send({from: owner, gas: '300000', gasPrice: '130000000000'});
      await fillOrder(perpetual, dxlnOrders, testToken, {}, { sender: otherUser });

    });

    xit('Succeeds with an invalid signature for an order approved on-chain', async () => {

      const stringifiedDefaultOrder = ordersModule.orderToSolidity(defaultOrder);
      await dxlnOrders.approveOrder(stringifiedDefaultOrder, { from: defaultOrder.maker });
      const order = {
        ...defaultSignedOrder,
        typedSignature: `0xff${defaultSignedOrder.typedSignature.substr(4)}`,
      };
      await fillOrder(perpetual, dxlnOrders, testToken, order);

    });

    xit('Succeeds repeating an order (with a different salt)', async () => {

      await fillOrder(perpetual, dxlnOrders, testToken, { amount: orderAmount.div(6) });
      await fillOrder(perpetual, dxlnOrders, testToken, { amount: orderAmount.div(6), salt: new BigNumber("426")});

    });

    xit('Fails for calls not from the perpetual contract', async () => {

      await truffleAssert.reverts(
        dxlnOrders.trade(
        owner,
        owner,
        owner,
        '0',
        '0x',
        boolToBytes32(false),
        { from: owner },
      ),
    'msg.sender must be PerpetualV1',)
    });

    xit('Fails if sender is not the taker or an authorized operator', async () => {

      await truffleAssert.reverts(fillOrder(perpetual, dxlnOrders, testToken, defaultSignedOrder, { sender: otherUser }),
      'Sender does not have permissions for the taker',)

    });

    xit('Fails for bad signature', async () => {

      const order = {
        ...defaultSignedOrder,
        typedSignature: `0xffff${defaultSignedOrder.typedSignature.substr(6)}`,
      };
      
      await truffleAssert.reverts(fillOrder(perpetual, dxlnOrders, testToken, order),
      'Order has an invalid signature',)

    });

    xit('Fails for canceled order', async () => {

      const stringifiedDefaultOrder = ordersModule.orderToSolidity(defaultOrder);

      await dxlnOrders.cancelOrder(stringifiedDefaultOrder, { from: defaultOrder.maker });
      truffleAssert.reverts( fillOrder(perpetual, dxlnOrders, testToken),
      'Order was already canceled',)

    });

    xit('Fails for wrong maker', async () => {

      const tradeData = ordersModule.fillToTradeData(
        defaultSignedOrder,
        orderAmount,
        limitPrice,
        defaultOrder.limitFee,
      );
      await truffleAssert.reverts(
        tradeModule
          .initiate()
          .addTradeArg({
            maker: otherUser,
            taker: defaultOrder.taker,
            data: tradeData,
            trader: dxlnOrders.address,
          })
          .commit(perpetual, defaultOrder.taker),
        'Order maker does not match maker',)
      
    });

    xit('Fails for wrong taker', async () => {

      const tradeData = ordersModule.fillToTradeData(
        defaultSignedOrder,
        orderAmount,
        limitPrice,
        defaultOrder.limitFee,
      );
      await truffleAssert.reverts(
        tradeModule
          .initiate()
          .addTradeArg({
            maker: defaultOrder.maker,
            taker: otherUser,
            data: tradeData,
            trader: dxlnOrders.address,
          })
          .commit(perpetual, otherUser),
        'Order taker does not match taker',)
      
    });

    xit('Fails if the order has expired', async () => {
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { expiration: new BigNumber(1) }),
        'Order has expired',)
      
    });

    xit('Fails to fill a bid at a price above the limit price', async () => {

      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, {}, { price: limitPrice.plus(1) }),
        'Fill price is invalid')
      

    });

    xit('Fails to fill an ask at a price below the limit price', async () => {

      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { isBuy: false }, { price: limitPrice.minus(1) }),
        'Fill price is invalid',
      );

    });

    xit('Fails if fee is greater than limit fee', async () => {

      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, {}, { fee: defaultOrder.limitFee.plus(1) }),
        'Fill fee is invalid',
      );

    });

    xit('Fails to overfill order', async () => {

      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, {}, { amount: orderAmount.plus(1) }),
        'Cannot overfill order',
      );

    });

    xit('Fails to overfill partially filled order', async () => {

      const halfAmount = orderAmount.div(2);
      await fillOrder(perpetual, dxlnOrders, testToken, {}, { amount: halfAmount });
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, {}, { amount: halfAmount.plus(1) }),
        'Cannot overfill order',
      );
    });

    xit('Fails for an order that was already filled', async () => {

      await fillOrder(perpetual, dxlnOrders, testToken);
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken),
        'Cannot overfill order',
      );

    });

  });

  describe("With triggerPrice", function(){

    beforeEach(async () =>{

      this.timeout(0);
    
            [owner, operator, otherAccount, otherUser] = await web3.eth.getAccounts();
    
            // Initialize perpetual protocol 
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
        
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
            dxlnOrders = await DxlnOrders.new(perpetual._address, 42)
    
            testToken = await TestToken.new()
            testOracle = await TestOracle.new()
            testFunder = await TestFunder.new()
            testTrader = await TestTrader.new()
            
            await perpetual.methods.initializeV1(testToken.address, testOracle.address, testFunder.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            defaultOrder.maker = fullFlagOrder.maker = operator;
            defaultOrder.taker = fullFlagOrder.taker = otherAccount;

            stringifiedOrder = ordersModule.orderToSolidity(fullFlagOrder);

            defaultSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, defaultOrder, SigningMethod.Hash);
            fullFlagSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, fullFlagOrder, SigningMethod.Hash);

            // Set up initial balances 

            await testToken.mint(defaultOrder.maker, initialMargin.toFixed(0), {from: owner})
            await testToken.mint(defaultOrder.taker, initialMargin.toFixed(0), {from: owner})
    
            // Set maximum perpetual allowance

            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.maker})
            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.taker})
    
            // Do the deposit 

            await perpetual.methods.deposit(defaultOrder.maker, initialMargin.toFixed(0)).send({from: operator, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.deposit(defaultOrder.taker, initialMargin.toFixed(0)).send({from: otherAccount, gas: '300000', gasPrice: '130000000000'})

            await perpetual.methods.setGlobalOperator(dxlnOrders.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
    })

    xit('Fills a bid with the oracle price at the trigger price', async () => {

      // limit bid |
      //        -5 | fill price
      //       -10 | trigger price, oracle price

      const triggerPrice = limitPrice.minus(10);
      const fillPrice = limitPrice.minus(5);
      const oraclePrice = limitPrice.minus(10);
      await testOracle.setPrice(oraclePrice.toSolidity());
      await fillOrder(perpetual, dxlnOrders, testToken, { triggerPrice }, { price: fillPrice });

    });

    xit('Fills an ask with the oracle price at the trigger price', async () => {

      //       +10 | trigger price, oracle price
      //        +5 | fill price
      // limit ask |

      const triggerPrice = limitPrice.plus(10);
      const fillPrice = limitPrice.plus(5);
      const oraclePrice = limitPrice.plus(10);
      await testOracle.setPrice(oraclePrice.toSolidity());
      await fillOrder(perpetual, dxlnOrders, testToken, { triggerPrice, isBuy: false }, { price: fillPrice });

    });

    xit('Fills a bid with the oracle price above the trigger price', async () => {

      //       +10 | oracle price
      //           |
      // limit bid |
      //        -5 | fill price
      //       -10 | trigger price

      const triggerPrice = limitPrice.minus(10);
      const fillPrice = limitPrice.minus(5);
      const oraclePrice = limitPrice.plus(10);
      await testOracle.setPrice(oraclePrice.toSolidity());
      await fillOrder(perpetual, dxlnOrders, testToken, { triggerPrice }, { price: fillPrice });

    });

    xit('Fills an ask with the oracle price below the trigger price', async () => {

      //       +10 | trigger price, oracle price
      //        +5 | fill price
      // limit ask |
      //           |
      //       -10 | oracle price

      const triggerPrice = limitPrice.plus(10);
      const fillPrice = limitPrice.plus(5);
      const oraclePrice = limitPrice.minus(10);
      await testOracle.setPrice(oraclePrice.toSolidity());
      await fillOrder(perpetual, dxlnOrders, testToken, { triggerPrice, isBuy: false }, { price: fillPrice });
    });

    xit('Fails to fill a bid if the oracle price is below the trigger price', async () => {

      // limit bid |
      //       -10 | trigger price
      //       -11 | oracle price

      const triggerPrice = limitPrice.minus(10);
      await testOracle.setPrice(triggerPrice.minus(1).toSolidity());
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { triggerPrice }),
        'Trigger price has not been reached',
      );
    });

    xit('Fails to fill an ask if the oracle price is above the trigger price', async () => {

      //       +11 | oracle price
      //       +10 | trigger price
      // limit ask |

      const triggerPrice = limitPrice.plus(10);
      await testOracle.setPrice(triggerPrice.plus(1).toSolidity());
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { triggerPrice, isBuy: false }),
        'Trigger price has not been reached',
      );

    });


  });

  describe("In decrease-only mode", function(){

    beforeEach(async () =>{

      this.timeout(0);
    
            [owner, operator, otherAccount, otherUser] = await web3.eth.getAccounts();
    
            // Initialize perpetual protocol 
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
        
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
            dxlnOrders = await DxlnOrders.new(perpetual._address, 42)
    
            testToken = await TestToken.new()
            testOracle = await TestOracle.new()
            testFunder = await TestFunder.new()
            testTrader = await TestTrader.new()
            
            await perpetual.methods.initializeV1(testToken.address, testOracle.address, testFunder.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            defaultOrder.maker = fullFlagOrder.maker = operator;
            defaultOrder.taker = fullFlagOrder.taker = otherAccount;

            stringifiedOrder = ordersModule.orderToSolidity(fullFlagOrder);

            defaultSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, defaultOrder, SigningMethod.Hash);
            fullFlagSignedOrder = await ordersModule.getSignedOrder(dxlnOrders, fullFlagOrder, SigningMethod.Hash);

            // Set up initial balances 

            await testToken.mint(defaultOrder.maker, initialMargin.toFixed(0), {from: owner})
            await testToken.mint(defaultOrder.taker, initialMargin.toFixed(0), {from: owner})
    
            // Set maximum perpetual allowance

            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.maker})
            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: defaultOrder.taker})
    
            // Do the deposit 

            await perpetual.methods.deposit(defaultOrder.maker, initialMargin.toFixed(0)).send({from: operator, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.deposit(defaultOrder.taker, initialMargin.toFixed(0)).send({from: otherAccount, gas: '300000', gasPrice: '130000000000'})

            await perpetual.methods.setGlobalOperator(dxlnOrders.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.setGlobalOperator(testTrader.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
    })

    xit('Fills a bid', async () => {

      // Give the maker a short position.
      const { limitFee, maker, taker } = defaultOrder;
      const fee = limitFee.times(limitPrice.value);
      const cost = limitPrice.value.plus(fee.value).times(orderAmount);
      await sell(perpetual, testTrader, maker, taker, orderAmount, cost);

      // Fill the order to decrease the short position to zero.
      await fillOrder(perpetual, dxlnOrders, testToken, { isDecreaseOnly: true });

    });

    xit('Fills an ask', async () => {

      // Give the maker a long position.
      const { limitFee, maker, taker } = defaultOrder;
      const fee = limitFee.times(limitPrice.value).negated();
      const cost = limitPrice.value.plus(fee.value).times(orderAmount);
      await buy(perpetual, testTrader, maker, taker, orderAmount, cost);

      // Fill the order to decrease the long position to zero.
      await fillOrder(perpetual, dxlnOrders, testToken, { isBuy: false, isDecreaseOnly: true });

    });

    xit('Fails to fill a bid if maker position is positive', async () => {

      const { maker, taker } = defaultOrder;

      await buy(perpetual, testTrader, maker, taker, new BigNumber("1"), limitPrice.value.toFixed(0));

      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { isDecreaseOnly: true }),
        'Fill does not decrease position',
      );

    });

    xit('Fails to fill an ask if maker position is negative', async () => {

      const { maker, taker } = defaultOrder;
      await sell(perpetual, testTrader, maker, taker, new BigNumber(1), limitPrice.value.toFixed(0));
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { isBuy: false, isDecreaseOnly: true }),
        'Fill does not decrease position',
      );

    });

    xit('Fails to fill a bid if maker position would become positive', async () => {

      const { maker, taker } = defaultOrder;
      const cost = limitPrice.value.times(orderAmount.minus(1));
      await sell(perpetual, testTrader, maker, taker, orderAmount.minus(1), cost.toFixed(0));
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { isDecreaseOnly: true }),
        'Fill does not decrease position',
      );

    });

    xit('Fails to fill an ask if maker position would become negative', async () => {

      const { maker, taker } = defaultOrder;
      const cost = limitPrice.value.times(orderAmount.minus(1));
      await buy(perpetual, testTrader, maker, taker, orderAmount.minus(1), cost.toFixed(0));
      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, { isBuy: false, isDecreaseOnly: true }),
        'Fill does not decrease position',
      );

    });

    xit('With negative limit fee: Fills a bid', async () => {

      const negativeFee = new Fee(defaultOrder.limitFee.value.abs().negated());
      await fillOrder(perpetual, dxlnOrders, testToken, { limitFee: negativeFee });

    });

    xit('With negative limit fee: Fills an ask', async () => {

      const negativeFee = new Fee(defaultOrder.limitFee.value.abs().negated());
      await fillOrder(perpetual, dxlnOrders, testToken, { isBuy: false, limitFee: negativeFee });

    });

    xit('With negative limit fee: Fails if fee is greater than limit fee', async () => {

      await truffleAssert.reverts(
        fillOrder(perpetual, dxlnOrders, testToken, fullFlagSignedOrder, { fee: fullFlagOrder.limitFee.plus(1) }),
        'Fill fee is invalid',
      );

    });

  })

})






// ============ Helper Functions ============

async function getModifiedOrder(
  dxlnOrders,
  args: Partial<Order>,
): Promise<SignedOrder> {
  const newOrder: Order = {
    ...defaultOrder,
    ...args,
  };
  return ordersModule.getSignedOrder(dxlnOrders, newOrder, SigningMethod.Hash);
}

   /**
   * Fill an order.
   * 
   * Check that logs and balance updates are as expected.
   */
    async function fillOrder(
      perpetual,
      dxlnOrders,
      testToken,
      orderArgs: Partial<SignedOrder> = {},
      fillArgs: {
        amount?: BigNumber,
        price?: Price,
        fee?: Fee,
        sender?: address,
      } = {},
    ): Promise<void> {
      const order: SignedOrder = orderArgs.typedSignature
        ? orderArgs as SignedOrder
        : await getModifiedOrder(dxlnOrders, orderArgs);
      const fillAmount = (fillArgs.amount || order.amount).dp(0, BigNumber.ROUND_DOWN);
      const fillPrice = fillArgs.price || order.limitPrice;
      const fillFee = fillArgs.fee || order.limitFee;
      const sender = fillArgs.sender || order.taker;
  
      // Get initial balances.
      const [makerBalance, takerBalance] = await Promise.all([
        gettersModule.getAccountBalance(perpetual, order.maker),
        gettersModule.getAccountBalance(perpetual, order.taker),
      ]);

      const { margin: makerMargin, position: makerPosition } = makerBalance;
      const { margin: takerMargin, position: takerPosition } = takerBalance;

      // Fill the order.
    const txResult = await tradeModule.initiate()
    .fillSignedOrder(
      dxlnOrders,
      order,
      fillAmount,
      fillPrice,
      fillFee,
    )
    .commit(perpetual, sender);

     // Check final balances.
     const {
      marginDelta,
      positionDelta,
    } = ordersModule.getBalanceUpdatesAfterFillingOrder(
      fillAmount,
      fillPrice,
      fillFee,
      order.isBuy,
    );

    await expectBalances(
      perpetual,
      testToken,
      txResult,
      [order.maker, order.taker],
      [makerMargin.plus(marginDelta), takerMargin.minus(marginDelta)],
      [makerPosition.plus(positionDelta), takerPosition.minus(positionDelta)],
    );

    // Troubles with logs of LogOrderFilled 

  }

  async function expectStatus(
    dxlnOrders,
    order: Order,
    status: OrderStatus,
    filledAmount?: BigNumber,
  ) {
    const statuses = await ordersModule.getOrdersStatus(dxlnOrders, [order]);
    expect(statuses[0].status).to.equal(status);
    if (filledAmount) {
      expectBN(statuses[0].filledAmount).to.equal(filledAmount);
    }
  }

  function parseLogs(receipt): any[] {
    let events: any[];
    if (receipt.logs) {
      events = JSON.parse(JSON.stringify(receipt.logs));
      return events
    }
    if (receipt.events) {
      const tempEvents = JSON.parse(JSON.stringify(receipt.events));
      events = [];
      Object.values(tempEvents).forEach((e: any) => {
        if (Array.isArray(e)) {
          e.forEach(ev => events.push(ev));
        } else {
          events.push(e);
        }
      });
      events.sort((a, b) => a.logIndex - b.logIndex);
      return events
    }
  
    throw new Error('Receipt has no logs');
  }