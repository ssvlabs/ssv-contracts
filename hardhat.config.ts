import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
      },
    ],
  },
  networks: {
    hoodi: {
      chainId: 560048,
      url: `${process.env.HOODI_ETH_NODE_URL}${process.env.NODE_PROVIDER_KEY}`,
      accounts: [`0x${process.env.HOODI_OWNER_PRIVATE_KEY}`],
      gasPrice: +(process.env.GAS_PRICE || ""),
      gas: +(process.env.GAS || ""),
    },
    hardhat: {
      forking: {
        url: 'https://ethereum-rpc.publicnode.com',
        blockNumber: 22820149,
      },
      allowBlocksWithSameTimestamp: true,
  }
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_KEY}`,
    customChains: [
      {
        network: "hoodi",
        chainId: 560048,
        urls: {
          apiURL: "https://api-hoodi.etherscan.io/api",
          browserURL: "https://hoodi.etherscan.io",
        },
      },
    ],
  },
};

export default config;
