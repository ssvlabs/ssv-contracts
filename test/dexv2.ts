import { ethers, upgrades } from 'hardhat';
import { solidity } from 'ethereum-waffle';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { rawListeners } from 'process';

before(() => {
  chai.should();
  chai.use(chaiAsPromised);
});

const { expect } = chai;

let dexV2, oldToken, ssvToken;
let owner, account2, account3;
const RATE = 10;
const ssvBalance = '1000000000000000000000';
const oldToExchange = '10000000000000000000';
describe('DEXV2', function() {
  beforeEach(async function () {
    [owner, account2, account3] = await ethers.getSigners();
    const oldTokenFactory = await ethers.getContractFactory('OldTokenMock');
    const ssvTokenFactory = await ethers.getContractFactory('SSVTokenMock');
    oldToken = await oldTokenFactory.deploy();
    ssvToken = await ssvTokenFactory.deploy();
    await oldToken.deployed();
    await ssvToken.deployed();
    const dexV2Factory = await ethers.getContractFactory('DEXV2');
    dexV2 = await upgrades.deployProxy(
      dexV2Factory,
      [oldToken.address, ssvToken.address, RATE]
    );
    await dexV2.deployed();
    await ssvToken.transfer(dexV2.address, ssvBalance);
  });

  it('rate 0 error', async function() {
    const dexV2Factory = await ethers.getContractFactory('DEXV2');
    await expect(upgrades.deployProxy(
      dexV2Factory,
      [oldToken.address, ssvToken.address, 0]
    )).to.be.revertedWith('rate cannot be zero');
  })

  it('getters', async function () {
    expect(await dexV2.cdtToken()).to.equal(oldToken.address);
    expect(await dexV2.ssvToken()).to.equal(ssvToken.address);
    expect(await dexV2.rate()).to.equal(RATE);
  });

  it('Exchange CDT to SSV', async function () {
    await oldToken.approve(dexV2.address, oldToExchange);
    await dexV2.convertCDTToSSV(oldToExchange);
    expect(await oldToken.balanceOf(dexV2.address)).to.equal(oldToExchange);
  });

  it('drain', async function () {
    await oldToken.approve(dexV2.address, oldToExchange);
    await dexV2.convertCDTToSSV(oldToExchange);
    expect(await oldToken.balanceOf(dexV2.address)).to.equal(oldToExchange);
    expect(await ssvToken.balanceOf(dexV2.address)).to.equal('999000000000000000000');

    const drainCall = dexV2.drain();
    await expect(drainCall).to.emit(dexV2, "Drain").withArgs('0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6', '999000000000000000000');
    await expect(drainCall).to.emit(ssvToken, "Transfer").withArgs(dexV2.address, '0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6', '999000000000000000000');
    expect (await ssvToken.balanceOf('0xb35096b074fdb9bBac63E3AdaE0Bbde512B2E6b6'), '999000000000000000000');
  });
});
