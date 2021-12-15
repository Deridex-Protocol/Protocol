import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-web3"
import "@nomiclabs/hardhat-waffle";

// import "@typechain/hardhat";
// import "hardhat-gas-reporter";
// import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
//   const accounts = await hre.ethers.getSigners();

//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000
      }
    }
  },
  networks: {
    hardhat:{
      forking:{
        url: "https://eth-kovan.alchemyapi.io/v2/pR-TMKhTV6P-hdDjLHao1riaZVvS-PHd",
        blockNumber: 24000000,
      }
    },
    development: {
      url: "http://127.0.0.1:7545",
    },
    kovan: {
      url: process.env.KOVAN_URL || "",
      accounts:
        process.env.PRIVATE_KEY && process.env.OPERATOR_PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY, process.env.OPERATOR_PRIVATE_KEY] : [],
    },
    
  },
  // gasReporter: {
  //   enabled: process.env.REPORT_GAS !== undefined,
  //   currency: "USD",
  // },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;