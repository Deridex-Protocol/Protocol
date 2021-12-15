import { artifacts, Web3 } from "hardhat";
import { web3 } from "hardhat";
import { waffle } from "hardhat";
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { BASE_DECIMALS, BaseValue, Price, address } from '../src/lib/types';
import { INTEGERS } from "../src/lib/Constants"
import { buy, sell } from "./helpers/trade"

const BigNumber = require("bignumber.js")

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
const TestToken = artifacts.require("TestToken")
let testToken;
const TestTrader = artifacts.require("TestTrader")
let testTrader;
const TestOracle = artifacts.require("TestOracle")
let testOracle
let perpetual;

let owner;
let operator;
let otherAccount

const minCollateralInit = "1075000000000000000"

const marginAmount = new BigNumber('1e17');
const positionAmount = new BigNumber('1e15');

describe("DxlnGetters", function(){

        beforeEach(async function(){

            this.timeout(0);
    
            [owner, operator, otherAccount] = await web3.eth.getAccounts();
    
            // Initialize perpetual protocol 
    
            dxlnPerpetualV1 = await DxlnPerpetualV1.new({from: owner})
            dxlnPerpetualProxy = await DxlnPerpetualProxy.new(dxlnPerpetualV1.address, owner, "0x", {from:owner})
        
            perpetual = new web3.eth.Contract(dxlnPerpetualV1.abi, dxlnPerpetualProxy.address)

            dxlnFundingOracle = await DxlnFundingOracle.new(owner, {from: owner})
    
            testToken = await TestToken.new()
            testTrader = await TestTrader.new()
            testOracle = await TestOracle.new()
            
            await perpetual.methods.initializeV1(testToken.address, testOracle.address, dxlnFundingOracle.address, minCollateralInit).send({from: owner, gas: '300000', gasPrice: '130000000000'})
    
            // Set up initial balances 

            await testToken.mint(operator, marginAmount.toFixed(0), {from: owner})
            await testToken.mint(otherAccount, marginAmount.toFixed(0), {from: owner})
    
            // Set maximum perpetual allowance

            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: operator})
            await testToken.approve(perpetual._address, new BigNumber(INTEGERS.ONES_255).toFixed(0), {from: otherAccount})
    
            // Do the deposit 

            await perpetual.methods.deposit(operator, marginAmount.toFixed()).send({from: operator, gas: '300000', gasPrice: '130000000000'})
            await perpetual.methods.deposit(otherAccount, marginAmount.toFixed()).send({from: otherAccount, gas: '300000', gasPrice: '130000000000'})

            // Do the trade 

            await perpetual.methods.setGlobalOperator(testTrader.address, true).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            await buy(perpetual, testTrader, operator, otherAccount, positionAmount.toFixed(0), marginAmount.div(2).toFixed(0))
    
        })
    
        it("getAccountBalance()", async function(){

            const balance = await perpetual.methods.getAccountBalance(operator).call({from:operator});

            expect(balance.margin).to.be.equal(marginAmount.div(2).toFixed(0));
            expect(balance.position).to.be.equal(positionAmount.toFixed(0));
        })

        it("getAccountIndex()", async () => {

            const index = await perpetual.methods.getAccountIndex(operator).call({from:operator});
            
            expect(index.value).to.be.equal(new BaseValue(0).toSolidity());
            
        });

        it('getIsLocalOperator()', async () => {

            const isOperator = await perpetual.methods.getIsLocalOperator(operator, otherAccount).call({from: owner});
            expect(isOperator).to.be.false;

        });

        it('getIsGlobalOperator()', async () => {

            let isOperator = await perpetual.methods.getIsGlobalOperator(operator).call({from: operator});

            expect(isOperator).to.be.false;

            isOperator = await perpetual.methods.getIsGlobalOperator(
              testTrader.address,
            ).call({from: owner});

            expect(isOperator).to.be.true;
        });

        it('getTokenContract()', async () => {

            const contractAddress = await perpetual.methods.getTokenContract().call({from: owner});
            expect(contractAddress).to.be.equal(testToken.address);

        });

        it('getOracleContract()', async () => {

            const contractAddress = await perpetual.methods.getOracleContract().call({from: owner});
            expect(contractAddress).to.equal(testOracle.address);

        });

        it('getFunderContract()', async () => {

            const contractAddress = await perpetual.methods.getFunderContract().call({from: owner});
            expect(contractAddress).to.equal(dxlnFundingOracle.address);

        });

        it("getMinCollateral()", async () => {

            const minCollateral = await perpetual.methods.getMinCollateral().call({from: owner});

            expect(minCollateral).to.be.equal(minCollateralInit)

        });

        it('hasAccountPermissions()', async () => {

            let hasPermissions = await perpetual.methods.hasAccountPermissions(operator, otherAccount).call({from: owner});
            expect(hasPermissions).to.be.false;

            hasPermissions = await perpetual.methods.hasAccountPermissions(operator, operator).call({from: owner});
            expect(hasPermissions).to.be.true;

            const ordersContract = testTrader.address;
            hasPermissions = await perpetual.methods.hasAccountPermissions(operator, ordersContract).call({from: owner});
            expect(hasPermissions).to.be.true;

        });

        it('getGlobalIndex()', async () => {

            const index = await perpetual.methods.getGlobalIndex().call({from: owner});

            expect(index.value).to.be.equal(new BaseValue(0).toSolidity());

        });

        
        it('getFinalSettlementEnabled()', async () => {

            let enabled = await perpetual.methods.getFinalSettlementEnabled().call({from: owner});

            expect(enabled).to.be.false;

            await perpetual.methods.enableFinalSettlement(new Price(0).toSolidity(), new Price(0).toSolidity()).send({from: owner, gas: '300000', gasPrice: '130000000000'})

            enabled = await perpetual.methods.getFinalSettlementEnabled().call({from: owner});
            expect(enabled).to.be.true;

        });

        it('getOraclePrice():', async () => {

            await testOracle.setPrice(new Price(1234).toSolidity());
            const price = await perpetual.methods.getOraclePrice().call({from: owner})
            const actualPrice = await testOracle.getPrice({from: owner})

            expect(price).to.be.equal(new BigNumber(actualPrice).toFixed(0))

        });
        
})