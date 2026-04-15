#!/usr/bin/env node
const solc = require('solc');
const { ethers } = require('ethers');
const program = require('commander');
const fs = require('fs')
const path = require('path')

const MAIN_CONTRACT_URL = "https://raw.githubusercontent.com/1inch/merkle-distribution/1f8b2a6ed27d1b2d18cf8475e42eece60f41c896/contracts/CumulativeMerkleDrop.sol";
const INTERFACE_URL = "https://raw.githubusercontent.com/1inch/merkle-distribution/1f8b2a6ed27d1b2d18cf8475e42eece60f41c896/contracts/interfaces/ICumulativeMerkleDrop.sol";
const CONTRACT_NAME = 'CumulativeMerkleDrop';

async function fetchContentFromURL(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
}

async function compileContract(contractContent, interfaceContent) {
    const openzeppelinPath = path.resolve(__dirname, 'node_modules', '@openzeppelin', 'contracts');

    const input = {
        language: 'Solidity',
        sources: {
            'CumulativeMerkleDrop.sol': {
                content: contractContent
            },
            'interfaces/ICumulativeMerkleDrop.sol': {
                content: interfaceContent
            },
            '@openzeppelin/contracts/access/Ownable.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'access', 'Ownable.sol'), 'utf8')
            },
            '@openzeppelin/contracts/token/ERC20/ERC20.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'token', 'ERC20', 'ERC20.sol'), 'utf8')
            },
            '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'token', 'ERC20', 'extensions', 'IERC20Metadata.sol'), 'utf8')
            },
            '@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'token', 'ERC20', 'extensions', 'IERC20Permit.sol'), 'utf8')
            },
            '@openzeppelin/contracts/token/ERC20/IERC20.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'token', 'ERC20', 'IERC20.sol'), 'utf8')
            },
            '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'token', 'ERC20', 'utils', 'SafeERC20.sol'), 'utf8')
            },
            '@openzeppelin/contracts/utils/Address.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'utils', 'Address.sol'), 'utf8')
            },
            '@openzeppelin/contracts/utils/Context.sol': {
                content: fs.readFileSync(path.resolve(openzeppelinPath, 'utils', 'Context.sol'), 'utf8')
            },
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 10000
            },
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
        const errors = output.errors.filter(e => e.severity === 'error');
        const warnings = output.errors.filter(e => e.severity === 'warning');
        if (warnings.length > 0) {
            console.warn('Compilation warnings:', warnings.map(w => w.formattedMessage).join('\n'));
        }
        if (errors.length > 0) {
            console.error(errors);
            throw new Error('Compilation failed');
        }
    }

    return {
        abi: output.contracts[`${CONTRACT_NAME}.sol`][CONTRACT_NAME].abi,
        bytecode: output.contracts[`${CONTRACT_NAME}.sol`][CONTRACT_NAME].evm.bytecode.object
    };
}

async function deployContract(args) {
    const contractContent = await fetchContentFromURL(MAIN_CONTRACT_URL);
    const interfaceContent = await fetchContentFromURL(INTERFACE_URL);
    const { abi, bytecode } = await compileContract(contractContent, interfaceContent, CONTRACT_NAME);

    const provider = new ethers.getDefaultProvider(args.providerUrl);
    const wallet = new ethers.Wallet(args.privateKey, provider);

    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await contractFactory.deploy(args.tokenAddress);
    await contract.deployed();

    console.log(`Contract deployed to: ${contract.address}`);
}

program
    .version('1.0.0')
    .requiredOption('-k, --privateKey <string>', 'Account private key')
    .requiredOption('-u, --providerUrl <string>', 'Ethereum provider URL (e.g., http://localhost:8545)')
    .requiredOption('-t, --tokenAddress <string>', 'SSV token address')
    .action(deployContract);

program.parse(process.argv);
