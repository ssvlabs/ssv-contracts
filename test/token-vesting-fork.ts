import {
  mine,
  time,
  setBalance,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { Address, TestClient, walletActions, parseGwei } from "viem";

// Declare globals
let ssvTokenVestingController: any,
  ssvToken: any,
  owners: any[],
  client: TestClient,
  publicClient: any;

const beneficiaryAddress = "0x5619231b400142B7482e7b540d34cc61Ff1Fbc3f";
const ssvAddress = "0x5a52E96BAcdaBb82fd05763E25335261B270Efcb";
const foundationAddress = "0x073F564419b625A45D8aEa3bb0dE4d5647113AD7";

const vestingContollerAddress = "0xb8471180c79a0a69c7790a1ccf62e91b3c3559bf";
const ssvTokenAddress = "0x9d65ff81a3c488d585bbfb0bfe3c7707c7917f54";

describe("3 vestings operations", () => {
  let vesting12months: any, vesting6months: any, vesting0months: any;
  let vesting12monthsAddress: any,
    vesting6monthsAddress: any,
    vesting0monthsAddress: any;
  const initialDeposit = 100n * 10n ** 18n; // 100 × 10¹⁸
  const foundationFullDeposit = 50000n * 10n ** 18n; // 50000 × 10¹⁸
  const foundationDeposit = foundationFullDeposit - initialDeposit;

  const vesting12mParams = {
    amount: initialDeposit, // 100 × 10¹⁸
    start: 1751673600n, // 2025-07-05
    cliff: 0n, // no cliff
    duration: 31536000n, // 1 year
    revocable: false,
  };
  const vesting6mParams = {
    amount: initialDeposit, // 100 × 10¹⁸
    start: 1767571200n, // 2026-01-05
    cliff: 0n, // no cliff
    duration: 15768000n, // 6 months
    revocable: false,
  };
  const vesting0mParams = {
    amount: initialDeposit, // 100 × 10¹⁸
    start: 1783209600n, // 2026-07-05
    cliff: 0n, // no cliff
    duration: 1n, // 0 months (1 second)
    revocable: false,
  };

  before(async () => {
    publicClient = await hre.viem.getPublicClient();

    owners = await hre.viem.getWalletClients();

    client = (await hre.viem.getTestClient()).extend(walletActions);

    ssvToken = await hre.viem.getContractAt(
      "SSVToken",
      ssvTokenAddress as Address
    );

    ssvTokenVestingController = await hre.viem.getContractAt(
      "TokenVestingController",
      vestingContollerAddress as Address
    );

    // Use SSV controlled address
    await client.impersonateAccount({
      address: ssvAddress,
    });

    // Approve the SSV Token Vesting Controller to spend SSV tokens
    await ssvToken.write.approve(
      [vestingContollerAddress, initialDeposit * 3n],
      {
        account: ssvAddress,
        maxFeePerGas: parseGwei("25"),
      }
    );

    // Create 3 vestings
    let { amount, start, cliff, duration, revocable } = vesting12mParams;

    // 12 Months Vesting
    await ssvTokenVestingController.write.createVesting(
      [beneficiaryAddress, amount, start, cliff, duration, revocable],
      { account: ssvAddress, maxFeePerGas: parseGwei("25") }
    );

    ({ amount, start, cliff, duration, revocable } = vesting6mParams);

    // 6 Months Vesting
    await ssvTokenVestingController.write.createVesting(
      [beneficiaryAddress, amount, start, cliff, duration, revocable],
      { account: ssvAddress }
    );

    ({ amount, start, cliff, duration, revocable } = vesting0mParams);

    // 0 Months Vesting
    await ssvTokenVestingController.write.createVesting(
      [beneficiaryAddress, amount, start, cliff, duration, revocable],
      { account: ssvAddress }
    );

    vesting12monthsAddress = await ssvTokenVestingController.read.vestings([
      beneficiaryAddress,
      0n,
    ]);

    vesting6monthsAddress = await ssvTokenVestingController.read.vestings([
      beneficiaryAddress,
      1n,
    ]);

    vesting0monthsAddress = await ssvTokenVestingController.read.vestings([
      beneficiaryAddress,
      2n,
    ]);

    vesting12months = await hre.ethers.getContractAt(
      "TokenVesting",
      vesting12monthsAddress
    );

    vesting6months = await hre.ethers.getContractAt(
      "TokenVesting",
      vesting6monthsAddress
    );

    vesting0months = await hre.ethers.getContractAt(
      "TokenVesting",
      vesting0monthsAddress
    );
  });

  it("Check balances after deployment - direct vesting calls", async () => {
    let { start, duration, revocable } = vesting12mParams;

    // Check 12m vesting
    expect(await ssvToken.read.balanceOf([vesting12monthsAddress])).to.equal(
      initialDeposit
    );
    expect(await vesting12months.beneficiary()).to.equal(beneficiaryAddress);
    expect(await vesting12months.start()).to.equal(start);
    expect(await vesting12months.cliff()).to.equal(start); // No cliff, so start is the same
    expect(await vesting12months.duration()).to.equal(duration);
    expect(await vesting12months.revocable()).to.equal(revocable);
    expect(await vesting12months.releasableAmount(ssvTokenAddress)).to.equal(
      0n
    );

    ({ start, duration, revocable } = vesting6mParams);

    // Check 6m vesting
    expect(await ssvToken.read.balanceOf([vesting6monthsAddress])).to.equal(
      initialDeposit
    );
    expect(await vesting6months.beneficiary()).to.equal(beneficiaryAddress);
    expect(await vesting6months.start()).to.equal(start);
    expect(await vesting6months.cliff()).to.equal(start); // No cliff, so start is the same
    expect(await vesting6months.duration()).to.equal(duration);
    expect(await vesting6months.revocable()).to.equal(revocable);
    expect(await vesting6months.releasableAmount(ssvTokenAddress)).to.equal(0n);

    ({ start, duration, revocable } = vesting0mParams);

    // Check 6m vesting
    expect(await ssvToken.read.balanceOf([vesting0monthsAddress])).to.equal(
      initialDeposit
    );
    expect(await vesting0months.beneficiary()).to.equal(beneficiaryAddress);
    expect(await vesting0months.start()).to.equal(start);
    expect(await vesting0months.cliff()).to.equal(start); // No cliff, so start is the same
    expect(await vesting0months.duration()).to.equal(duration);
    expect(await vesting0months.revocable()).to.equal(revocable);
    expect(await vesting0months.releasableAmount(ssvTokenAddress)).to.equal(0n);
  });

  it("Check balances after deployment - controller calls", async () => {
    expect(
      await ssvTokenVestingController.read.totalVestingBalanceOf([
        beneficiaryAddress,
      ])
    ).to.equal(initialDeposit * 3n);

    expect(
      await ssvTokenVestingController.read.vestedBalanceOf([beneficiaryAddress])
    ).to.equal(0n);

    expect(
      await ssvTokenVestingController.read.unvestedBalanceOf([
        beneficiaryAddress,
      ])
    ).to.equal(initialDeposit * 3n);
  });

  it("Check balances after deployment - revoke reverts", async () => {
    // Use SSV controlled address
    await client.impersonateAccount({
      address: ssvAddress,
    });

    // RevokeAll does not revert but does not change balances
    await ssvTokenVestingController.write.revokeAll([beneficiaryAddress], {
      account: ssvAddress,
    });

    expect(await ssvToken.read.balanceOf([vesting12monthsAddress])).to.equal(
      initialDeposit
    );
    expect(await ssvToken.read.balanceOf([vesting6monthsAddress])).to.equal(
      initialDeposit
    );
    expect(await ssvToken.read.balanceOf([vesting0monthsAddress])).to.equal(
      initialDeposit
    );

    await expect(
      ssvTokenVestingController.write.revoke([beneficiaryAddress, 0n], {
        account: ssvAddress,
      })
    ).to.be.rejectedWith("TokenVesting: cannot revoke");

    await expect(
      ssvTokenVestingController.write.revoke([beneficiaryAddress, 1n], {
        account: ssvAddress,
      })
    ).to.be.rejectedWith("TokenVesting: cannot revoke");

    await expect(
      ssvTokenVestingController.write.revoke([beneficiaryAddress, 2n], {
        account: ssvAddress,
      })
    ).to.be.rejectedWith("TokenVesting: cannot revoke");
  });

  it("The Foundation makes the deposits - check balances and vested tokens", async () => {
    // Use Foundation controlled address
    await client.impersonateAccount({
      address: foundationAddress,
    });

    // Approve and transfer SSV tokens to the 12m vesting
    await ssvToken.write.approve([vesting12monthsAddress, foundationDeposit], {
      account: foundationAddress,
    });
    await ssvToken.write.transfer([vesting12monthsAddress, foundationDeposit], {
      account: foundationAddress,
    });

    // Approve and transfer SSV tokens to the 6m vesting
    await ssvToken.write.approve([vesting6monthsAddress, foundationDeposit], {
      account: foundationAddress,
    });
    await ssvToken.write.transfer([vesting6monthsAddress, foundationDeposit], {
      account: foundationAddress,
    });

    // Approve and transfer SSV tokens to the 0m vesting
    await ssvToken.write.approve([vesting0monthsAddress, foundationDeposit], {
      account: foundationAddress,
    });
    await ssvToken.write.transfer([vesting0monthsAddress, foundationDeposit], {
      account: foundationAddress,
    });

    // Check balances after deposits are equal to the full foundation deposit
    expect(await ssvToken.read.balanceOf([vesting12monthsAddress])).to.equal(
      foundationFullDeposit
    );
    expect(await ssvToken.read.balanceOf([vesting6monthsAddress])).to.equal(
      foundationFullDeposit
    );
    expect(await ssvToken.read.balanceOf([vesting0monthsAddress])).to.equal(
      foundationFullDeposit
    );

    // Check the total vesting balance of the beneficiary is equal to the full foundation deposit
    expect(
      await ssvTokenVestingController.read.totalVestingBalanceOf([
        beneficiaryAddress,
      ])
    ).to.equal(foundationFullDeposit * 3n);
  });

  it("Fast forward to start + 8 months - check vested amounts", async () => {
    const eightMonths = 20736000n;
    const targetTimestamp = vesting12mParams.start + eightMonths;

    await time.setNextBlockTimestamp(targetTimestamp);
    await mine();

    const vested = await ssvTokenVestingController.read.vestedBalanceOf([
      beneficiaryAddress,
    ]);

    const vested12mBalance = await ssvToken.read.balanceOf([
      vesting12monthsAddress,
    ]);
    const vested6mBalance = await ssvToken.read.balanceOf([
      vesting6monthsAddress,
    ]);

    const expected12m =
      ((targetTimestamp - vesting12mParams.start) * vested12mBalance) /
      vesting12mParams.duration;
    const expected6m =
      ((targetTimestamp - vesting6mParams.start) * vested6mBalance) /
      vesting6mParams.duration;

    const expected = expected12m + expected6m;

    // Check that the vested balance is equal to the expected amount
    expect(vested).to.equal(expected);
  });

  it("Fast forward to start + 8 months - withdraw vested amount from 12m and 6m", async () => {
    const eightMonths = 20736000n;
    const targetTimestamp = vesting12mParams.start + eightMonths;

    await time.setNextBlockTimestamp(targetTimestamp);
    await mine();

    const vested = await ssvTokenVestingController.read.vestedBalanceOf([
      beneficiaryAddress,
    ]);

    const releasable12m = await vesting12months.releasableAmount(
      ssvTokenAddress
    );
    const releasable6m = await vesting6months.releasableAmount(ssvTokenAddress);
    const releasableSum = releasable12m + releasable6m;

    // Use SSV controlled address
    await client.impersonateAccount({
      address: beneficiaryAddress,
    });

    // Set beneficiary balance to 2 ETH to cover gas costs
    await setBalance(beneficiaryAddress, 2000000000000000000n);

    await ssvTokenVestingController.write.withdraw([], {
      account: beneficiaryAddress,
    });

    const beneficiary2Balance = await ssvToken.read.balanceOf([
      beneficiaryAddress,
    ]);

    // Check that the beneficiary received the expected amount from the 12m and 6m vestings
    expect(beneficiary2Balance).to.equal(vested);
    expect(beneficiary2Balance).to.equal(releasableSum);

    // Now, there are no vested tokens left in the vestings
    expect(
      await ssvTokenVestingController.read.vestedBalanceOf([beneficiaryAddress])
    ).to.equal(0n);

    const unvestedBalance =
      await ssvTokenVestingController.read.unvestedBalanceOf([
        beneficiaryAddress,
      ]);

    // Check that the unvested balance + the withdrawn amount is equal to the full foundation deposit
    expect(unvestedBalance + beneficiary2Balance).to.equal(
      foundationFullDeposit * 3n
    );
  });

  it("Fast forward to start + 12 months - withdraw vested amount from 12m, 6m and 0m", async () => {
    const oneYear = 31708800n; // 1 year + 2 day in seconds
    const targetTimestamp = vesting12mParams.start + oneYear;

    await time.setNextBlockTimestamp(targetTimestamp);
    await mine();

    const vested = await ssvTokenVestingController.read.vestedBalanceOf([
      beneficiaryAddress,
    ]);

    // Use SSV controlled address
    await client.impersonateAccount({
      address: beneficiaryAddress,
    });

    const beneficiary2Balance = await ssvToken.read.balanceOf([
      beneficiaryAddress,
    ]);

    await ssvTokenVestingController.write.withdraw([], {
      account: beneficiaryAddress,
    });

    const postBeneficiary2Balance = await ssvToken.read.balanceOf([
      beneficiaryAddress,
    ]);

    // Check that the beneficiary received the expected amount from the 12m, 6m and 0m vestings
    expect(postBeneficiary2Balance).to.equal(vested + beneficiary2Balance);
    expect(postBeneficiary2Balance).to.equal(foundationFullDeposit * 3n);
  });
});
