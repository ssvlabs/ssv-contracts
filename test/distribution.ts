// Distribution Test

// Declare imports
import { ethers } from 'hardhat'
const fs = require('fs')
import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { parse } from 'csv-parse';

before(() => {
  chai.should()
  chai.use(chaiAsPromised)
})
const { expect } = chai

// Declare global variables
let treasury, fakeAccount, ssvToken, merkleDistributor, distributionDataJSON
let doubleClaimAddress, noClaimAddress, addressData, addressDataNoClaim, noClaimIndex
let distributionDataObject = {}

describe('Distribution: IO1-77', function () {
  before(async function () {
    // Create treasury and fake account wallets
    [treasury, fakeAccount] = await ethers.getSigners()

    // Get the JSON data from resultFake.json in scripts folder
    distributionDataJSON = await JSON.parse(await fs.readFileSync(`./scripts/resultFake.json`))
    
    // Define no claim index
    noClaimIndex = (Object.keys(distributionDataJSON.claims).length) - 1

    // Initialize contracts
    const ssvTokenFactory = await ethers.getContractFactory('SSVToken')
    const merkleDistributorFactory = await ethers.getContractFactory('MerkleDistributor')

    // Deploy contracts
    ssvToken = await ssvTokenFactory.deploy()
    merkleDistributor = await merkleDistributorFactory.deploy(ssvToken.address, distributionDataJSON.merkleRoot, treasury.address)

    // Wait for contract deployment to finish
    await ssvToken.deployed()
    await merkleDistributor.deployed()
  })

  it('Claim all tokens', async function () {
    // Get rewards csv data from scripts folder and parse to JSON
    const distributionData = fs.createReadStream(`./scripts/rewardsFake.csv`).pipe(parse({ columns: true }));
    for await (const record of distributionData) { distributionDataObject[(record.address.replace(/\n/, '')).toUpperCase()] = record.amount }

    // Mint tokens
    await ssvToken.mint(merkleDistributor.address, distributionDataJSON.tokenTotal)

    // Do a claim from all addresses except one and make sure the claimed wallet matches amounts in the csv file
    for (const address in distributionDataJSON.claims) {
      const addressData = distributionDataJSON.claims[address]
      if (addressData.index !== noClaimIndex) {
        if (addressData.index === 1) doubleClaimAddress = address
        await merkleDistributor.claim(addressData.index, address, addressData.amount, addressData.proof)
        expect(ethers.utils.formatEther(await ssvToken.balanceOf(address))).to.equal(String(distributionDataObject[address.toUpperCase()]))
      } else noClaimAddress = address
    }

    // Expect distribution contract to have a certain amount of SSV left
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(noClaimAddress))).to.equal('0.0')
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(merkleDistributor.address))).to.equal(String(distributionDataObject[noClaimAddress.toUpperCase()]))
  })

  it('Double Claim', async function () {
    // Try to claim from an address that has already claimed
    addressData = distributionDataJSON.claims[doubleClaimAddress]
    await merkleDistributor.claim(addressData.index, doubleClaimAddress, addressData.amount, addressData.proof).should.be.rejectedWith('Drop already claimed.')
    expect(await merkleDistributor.isClaimed(noClaimIndex)).to.equal(false)
    expect(await merkleDistributor.isClaimed(addressData.index)).to.equal(true)
  })

  it('Invalid Claims', async function () {
    // Define no claim data
    addressDataNoClaim = distributionDataJSON.claims[noClaimAddress]
    
    // Invalid address
    await merkleDistributor.claim(addressDataNoClaim.index, fakeAccount.address, addressDataNoClaim.amount, addressDataNoClaim.proof).should.be.rejectedWith('Invalid proof.')

    // Invalid amount
    await merkleDistributor.claim(addressDataNoClaim.index, noClaimAddress, addressData.amount, addressDataNoClaim.proof).should.be.rejectedWith('Invalid proof.')

    // Invalid proof
    await merkleDistributor.claim(addressDataNoClaim.index, noClaimAddress, addressDataNoClaim.amount, addressData.proof).should.be.rejectedWith('Invalid proof.')
  })

  it('Close Air Drop', async function () {
    // Close air drop with an incorrect treasury address
    await merkleDistributor.connect(fakeAccount).endAirdrop().should.be.rejectedWith('Not initiated by treasury.')

    // Close air drop and make sure remaining balance has transferred to the treasury and distribution contract is empty
    await merkleDistributor.connect(treasury).endAirdrop()
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(treasury.address))).to.equal(String(distributionDataObject[noClaimAddress.toUpperCase()]))
    expect(ethers.utils.formatEther(await ssvToken.balanceOf(merkleDistributor.address))).to.equal('0.0')
  })

  it('Claim After Air Drop Close', async function () {
    // Claim from account that did not claim yet after air drop closed
    await merkleDistributor.claim(addressDataNoClaim.index, noClaimAddress, addressDataNoClaim.amount, addressDataNoClaim.proof).should.be.rejectedWith('transfer amount exceeds balance')

    // Claim from account that did claim already after air drop closed
    await merkleDistributor.claim(addressData.index, doubleClaimAddress, addressData.amount, addressData.proof).should.be.rejectedWith('Drop already claimed.')
  })
})