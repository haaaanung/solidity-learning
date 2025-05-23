import hre from "hardhat";
import { expect } from "chai";
import { MyToken, TinyBank } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const MINTING_AMOUNT = 100n;
const DECIMALS = 18n;

describe("TinyBank", () => {
  let signers: HardhatEthersSigner[];
  let myTokenC: MyToken;
  let tinyBankC: TinyBank;
  beforeEach("TinyBank", async () => {
    signers = await hre.ethers.getSigners();
    const MANAGERS: string[] = [];
    for (let i = 0; i < 4; i++) {
      MANAGERS.push(signers[i].address);
    }
    myTokenC = await hre.ethers.deployContract("MyToken", [
      "MyToken",
      "MT",
      DECIMALS,
      MINTING_AMOUNT,
    ]);
    tinyBankC = await hre.ethers.deployContract("TinyBank", [
      await myTokenC.getAddress(),
      MANAGERS,
    ]);
    await myTokenC.setManager(tinyBankC.getAddress());
  });

  describe("Initialized state check", () => {
    it("should return totalStaked 0", async () => {
      expect(await tinyBankC.totalStaked()).equal(0);
    });
    it("should return staked 0 amount of signer0", async () => {
      const signer0 = signers[0];
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
  });

  describe("Staking", async () => {
    it("should return staked amount", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(stakingAmount);
      expect(await tinyBankC.totalStaked()).equal(stakingAmount);
      expect(await myTokenC.balanceOf(tinyBankC)).equal(
        await tinyBankC.totalStaked()
      );
    });
  });
  describe("Withdraw", () => {
    it("should return 0 staked after withdrawing total token", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      await tinyBankC.withdraw(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
  });

  describe("reward", () => {
    it("should reward 1MT every blocks", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);

      const BLOCKS = 5n;
      const transferAmount = hre.ethers.parseUnits("1", DECIMALS);
      for (var i = 0; i < BLOCKS; i++) {
        await myTokenC.transfer(transferAmount, signer0.address);
      }

      await tinyBankC.withdraw(stakingAmount);
      expect(await myTokenC.balanceOf(signer0.address)).equal(
        hre.ethers.parseUnits((BLOCKS + MINTING_AMOUNT + 1n).toString())
      );
    });

    it("Should revert when it does not all confirmed yet", async () => {
      const manager0 = signers[0];
      const manager1 = signers[1];
      const manager2 = signers[2];
      const manager3 = signers[3];
      const nonmanager0 = signers[4];
      const rewardToChange = hre.ethers.parseUnits("10000", DECIMALS);
      await tinyBankC.connect(manager0).confirm();
      await tinyBankC.connect(manager1).confirm();
      await tinyBankC.connect(manager2).confirm();
      await expect(
        tinyBankC.connect(manager0).setRewardPerBlock(rewardToChange)
      ).to.be.revertedWith("Not all confirmed yet");
    });
  });
  describe("MultiManagedAccess reward", () => {
    const rewardAmount = hre.ethers.parseUnits("100", DECIMALS);

    it("Should revert if it's not a manager", async () => {
      const notManager = signers[4];
      await expect(tinyBankC.connect(notManager).confirm()).to.be.revertedWith(
        "You are not a manager"
      );
    });
  });
});
