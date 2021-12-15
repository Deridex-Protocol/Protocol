import { artifacts, Web3 } from "hardhat";
import { web3 } from "hardhat";
import { waffle } from "hardhat";
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { BASE_DECIMALS, BaseValue, Price, address } from '../src/lib/types';
const BigNumber = require("bignumber.js")
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
const TestOracle = artifacts.require("TestOracle")
const TestFunder = artifacts.require("TestFunder")
let owner;
let operator;
let perpetual;
let newOracleContract
let newFunderContract;
const chainlinkOracle = "0xb31357d152638fd1ae0853d24b9Ea81dF29E3EF2"
const tokenUsdc = "0xe22da380ee6B445bb8273C81944ADEB6E8450422"
const minCollateralInit = "1075000000000000000"
const oraclePrice = new Price(100);

function parseLogs(receipt): any[] {
    let events: any[];

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

describe("DxlnAdmin", function(){

    describe("setGlobalOperator()", function(){

        beforeEach(async function(){

            this.timeout(0);
    
            [owner, operator] = await web3.eth.getAccounts();
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
    
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
    
            dxlnChainlinkOracle = await DxlnChainlinkOracle.new(chainlinkOracle, perpetual._address, "28", {from: owner})
            dxlnFundingOracle = await DxlnFundingOracle.new(owner, {from: owner})

            await perpetual.methods.initializeV1(tokenUsdc, dxlnChainlinkOracle.address, dxlnFundingOracle.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
        }) 

        it("Sets global operator properly", async function(){

            const txResult = await perpetual.methods.
            setGlobalOperator(operator, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            // Check with DxlnGetters
    
            const gettersResult = await perpetual.methods.getIsGlobalOperator(operator).call({from:owner})
            expect(gettersResult).to.be.true
    
            // Check result with events
    
            const logs = parseLogs(txResult)
    
            expect(logs.length).to.equal(1);
            expect(logs[0].event).to.equal('LogSetGlobalOperator');
            expect(logs[0].returnValues.operator).to.be.equal(operator)
            expect(logs[0].returnValues.approved).to.equal(true);
        })
    
        it("Fails if called by non-admin", async function(){
    
            await truffleAssert.reverts(
                perpetual.methods.setGlobalOperator(operator, true).send({from: operator, gas: '300000', gasPrice: '130000000000'}), "Adminable: caller is not admin"
            );
    
        })

    })

    describe("setOracle()", function(){

        beforeEach(async function(){

            this.timeout(0);
    
            [owner, operator] = await web3.eth.getAccounts();
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
    
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
    
            dxlnChainlinkOracle = await DxlnChainlinkOracle.new(chainlinkOracle, perpetual._address, "28", {from: owner})
            dxlnFundingOracle = await DxlnFundingOracle.new(owner, {from: owner})

            await perpetual.methods.initializeV1(tokenUsdc, dxlnChainlinkOracle.address, dxlnFundingOracle.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            newOracleContract = await TestOracle.new()
            newFunderContract = await TestFunder.new()
    
        }) 

        it("Sets new oracle contract properly", async function(){
    
            const originalOracleAddress = await perpetual.methods.getOracleContract().call({from:owner})
            
            await newOracleContract.setPrice(new BigNumber(1), {from: owner})
    
            const txResult = await perpetual.methods.setOracle(newOracleContract.address).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            // Check result
    
            const oracle = await perpetual.methods.getOracleContract().call({from:owner})
    
            expect(oracle).to.be.equal(newOracleContract.address)
            expect(oracle).to.not.equal(originalOracleAddress)
    
            const logs = parseLogs(txResult)
    
            expect(logs.length).to.equal(1);
            expect(logs[0].event).to.equal('LogSetOracle');
            expect(logs[0].returnValues.oracle).to.be.equal(oracle)
        
        })

        it("Fails if new oracle returns 0 as price", async function(){
    
            await truffleAssert.reverts(
                perpetual.methods.setOracle(newOracleContract.address).send({from: owner, gas: '300000', gasPrice: '130000000000'}), "New oracle cannot return a zero price"
            );
    
        })

        it("Fails if new oracle does not have getPrice() function", async function(){
    
            await truffleAssert.fails(
                perpetual.methods.setOracle(newFunderContract.address).send({from: owner, gas: '300000', gasPrice: '130000000000'})
            );
    
            await truffleAssert.fails(
                perpetual.methods.setOracle(operator).send({from: owner, gas: '300000', gasPrice: '130000000000'})
            );
        })

        it("Fails if called by non-admin", async function(){
    
            await newOracleContract.setPrice(new BigNumber(1), {from: owner})
    
            await truffleAssert.reverts(perpetual.methods.setOracle(newOracleContract.address).send({from: operator, gas: '300000', gasPrice: '130000000000'}), "Adminable: caller is not admin")
        })

    })

    describe("setFunder()", function(){

        beforeEach(async function(){

            this.timeout(0);
    
            [owner, operator] = await web3.eth.getAccounts();
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
    
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
    
            dxlnChainlinkOracle = await DxlnChainlinkOracle.new(chainlinkOracle, perpetual._address, "28", {from: owner})
            dxlnFundingOracle = await DxlnFundingOracle.new(owner, {from: owner})

            await perpetual.methods.initializeV1(tokenUsdc, dxlnChainlinkOracle.address, dxlnFundingOracle.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            newOracleContract = await TestOracle.new()
            newFunderContract = await TestFunder.new()
    
        }) 

        it("Sets new funder contract properly", async function(){
    
            const originalFunderAddress = await perpetual.methods.getFunderContract().call({from:owner})

            const txResult = await perpetual.methods.setFunder(newFunderContract.address).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            // Check result
    
            const funder = await perpetual.methods.getFunderContract().call({from:owner})
    
            expect(funder).to.be.equal(newFunderContract.address)
            expect(funder).to.not.equal(originalFunderAddress)
    
            // Check result with events 
    
            const logs = parseLogs(txResult);
            expect(logs.length).to.equal(1);
            expect(logs[0].event).to.equal('LogSetFunder');
            expect(logs[0].returnValues.funder).to.be.equal(funder)
        })

        it("Fails if new funder contract does not have getFunding() function", async function(){
    
            await truffleAssert.fails(
                perpetual.methods.setFunder(newOracleContract.address).send({from: owner, gas: '300000', gasPrice: '130000000000'})
            );
    
            await truffleAssert.fails(
                perpetual.methods.setFunder(operator).send({from: owner, gas: '300000', gasPrice: '130000000000'})
            );
    
        })

        it("Fails if called by non-admin", async function(){
    
            await truffleAssert.reverts(perpetual.methods.setFunder(newFunderContract.address).send({from: operator, gas: '300000', gasPrice: '130000000000'}), "Adminable: caller is not admin")
    
        })
    })

    describe("setMinCollateral()", function(){

        beforeEach(async function(){

            this.timeout(0);
    
            [owner, operator] = await web3.eth.getAccounts();
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
    
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
    
            dxlnChainlinkOracle = await DxlnChainlinkOracle.new(chainlinkOracle, perpetual._address, "28", {from: owner})
            dxlnFundingOracle = await DxlnFundingOracle.new(owner, {from: owner})

            await perpetual.methods.initializeV1(tokenUsdc, dxlnChainlinkOracle.address, dxlnFundingOracle.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            newOracleContract = await TestOracle.new()
            newFunderContract = await TestFunder.new()
        }) 

        it(" Sets the collateral requirement properly", async function(){
    
            const baseValue = new BaseValue("1.2")
            const minCollateral = baseValue.toSolidity()
    
            const txResult = await perpetual.methods.setMinCollateral(minCollateral).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            // Check with DxlnGetters
    
            const gettersResult = await perpetual.methods.getMinCollateral().call({from:owner})
    
            expect(gettersResult).to.be.equal(minCollateral)
    
            // Check result with events 
    
            const logs = parseLogs(txResult);
            expect(logs.length).to.equal(1);
            expect(logs[0].event).to.equal('LogSetMinCollateral');
            expect(logs[0].returnValues.minCollateral).to.be.equal(minCollateral)
        })

        it("Fails if called by non-admin", async function(){
    
            const baseValue = new BaseValue("1.2")
            const minCollateral = baseValue.toSolidity()
    
            await truffleAssert.reverts(perpetual.methods.setMinCollateral(minCollateral).send({from: operator, gas: '300000', gasPrice: '130000000000'}), "Adminable: caller is not admin") 
    
        })

        it("setMinCollateral(): Fails to set the collateral requirement below 100%", async function(){
    
            const baseValue = new BaseValue(
                new BigNumber(1)
                .shiftedBy(BASE_DECIMALS)
                .minus(1)
                .shiftedBy(-BASE_DECIMALS),
            );
    
            const minCollateral = baseValue.toSolidity()
    
            await truffleAssert.reverts(perpetual.methods.setMinCollateral(minCollateral).send({from: owner, gas: '300000', gasPrice: '130000000000'}), "The collateral requirement cannot be under 100%") 
            
        })
    })

    describe("enableFinalSettlement()", function(){

        beforeEach(async function(){

            this.timeout(0);
    
            [owner, operator] = await web3.eth.getAccounts();
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
    
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)
    
            dxlnChainlinkOracle = await DxlnChainlinkOracle.new(chainlinkOracle, perpetual._address, "28", {from: owner})
            dxlnFundingOracle = await DxlnFundingOracle.new(owner, {from: owner})

            newOracleContract = await TestOracle.new()
            await newOracleContract.setPrice(oraclePrice.toSolidity(), {from: owner})
            newFunderContract = await TestFunder.new()

            await perpetual.methods.initializeV1(tokenUsdc, newOracleContract.address, dxlnFundingOracle.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})
        }) 

        it("Enables final settlement at the oracle price properly", async function(){
    
            const priceLowerBound = oraclePrice.minus(20).toSolidity()
            const priceUpperBound = oraclePrice.plus(50).toSolidity()
    
            const txResult = await perpetual.methods.enableFinalSettlement(priceLowerBound, priceUpperBound).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            // Check with DxlnGetters 
    
            const gettersResult = await perpetual.methods.getFinalSettlementEnabled().call({from: owner})
    
            expect(gettersResult).to.be.true
    
            // Check results with events 
    
            const logs = parseLogs(txResult);
            expect(logs.length).to.equal(2);
            const [indexLog, settlementLog] = logs;
            expect(indexLog.event).to.equal('LogIndex');
            expect(settlementLog.event).to.equal('LogFinalSettlementEnabled');
            expect(settlementLog.returnValues.settlementPrice).to.be.equal(oraclePrice.toSolidity());
        })

        it("Succeeds if the bounds are equal to the price", async function(){
    
            await perpetual.methods.enableFinalSettlement(oraclePrice.toSolidity(), oraclePrice.toSolidity()).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            // Check with DxlnGetters 
    
            const gettersResult = await perpetual.methods.getFinalSettlementEnabled().call({from: owner})
    
            expect(gettersResult).to.be.true
    
        })

        it("Fails if final settlement is already enabled", async function(){
    
            const priceLowerBound = oraclePrice.minus(20).toSolidity()
            const priceUpperBound = oraclePrice.plus(50).toSolidity()
    
            await perpetual.methods.enableFinalSettlement(priceLowerBound, priceUpperBound).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            await truffleAssert.reverts(perpetual.methods.enableFinalSettlement(priceLowerBound, priceUpperBound).send({from: owner, gas: '300000', gasPrice: '130000000000'}), "Not permitted during final settlement")
        })

        it("Fails if the oracle price is below the provided lower bound", async function(){
    
            const priceLowerBound = oraclePrice.plus('1e-18').toSolidity()
            const priceUpperBound = oraclePrice.plus(50).toSolidity()
    
            await truffleAssert.reverts(perpetual.methods.enableFinalSettlement(priceLowerBound, priceUpperBound).send({from: owner, gas: '300000', gasPrice: '130000000000'}), "Oracle price is less than the provided lower bound")
    
        })

        it("Fails if the oracle price is above the provided upper bound", async function(){

            const priceLowerBound = oraclePrice.minus(20).toSolidity()
            const priceUpperBound = oraclePrice.minus("1e-18").toSolidity()

            await truffleAssert.reverts(perpetual.methods.enableFinalSettlement(priceLowerBound, priceUpperBound).send({from: owner, gas: '300000', gasPrice: '130000000000'}), "Oracle price is greater than the provided upper bound")
        })

        it("Fails if called by non-admin", async function(){
    
            const priceLowerBound = oraclePrice.minus(20).toSolidity()
            const priceUpperBound = oraclePrice.plus(50).toSolidity()
    
            await truffleAssert.reverts(perpetual.methods.enableFinalSettlement(priceLowerBound, priceUpperBound).send({from: operator, gas: '300000', gasPrice: '130000000000'}), "Adminable: caller is not admin")
    
        })
    
    })
    
})
