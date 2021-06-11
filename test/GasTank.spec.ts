import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { getConfig } from "../src/config/refunder_config";
import { BigNumber, utils } from "ethers";

describe("GasTank", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTest = deployments.createFixture(async () => {
        await deployments.fixture();
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        const Mock = await hre.ethers.getContractFactory("MockContract");
        const mock = await Mock.deploy();
        const config = getConfig()
        const GasTank = await hre.ethers.getContractFactory("GasTank");
        const gasTank = await GasTank.deploy(user1.address, config.fee, executor.interface.getSighash("exec"))
        return { Executor, executor, mock, gasTank };
    })

    describe("changeOwner", async () => {
        it("updates owner", async () => {
            const { gasTank, executor } = await setupTest();

            expect(
                await gasTank.owner()
            ).to.be.equals(user1.address);

            await gasTank.changeOwner(executor.address)

            expect(
                await gasTank.owner()
            ).to.be.equals(executor.address);
        })

        it("throws if called by non-owner", async () => {
            const { gasTank, executor } = await setupTest();
            const calldata = gasTank.interface.encodeFunctionData("changeOwner", [user1.address])
            await expect(
                executor.exec(gasTank.address, 0, calldata)
            ).to.be.revertedWith("Not Authorized")
        })
    })

    describe("unstuck", async () => {
        it("throws if called by non-owner", async () => {
            const { gasTank, executor } = await setupTest();
            const calldata = gasTank.interface.encodeFunctionData("unstuck", [user1.address, "0x"])
            await expect(
                executor.exec(gasTank.address, 0, calldata)
            ).to.be.revertedWith("Not Authorized")
        })
    })

    describe("payout", async () => {
        it("throws if called by non-owner", async () => {
            const { gasTank, executor } = await setupTest();
            const calldata = gasTank.interface.encodeFunctionData("payout", [[user1.address, executor.address]])
            await expect(
                executor.exec(gasTank.address, 0, calldata)
            ).to.be.revertedWith("Not Authorized")
        })

        it("throws if no payout", async () => {
            const { gasTank, executor } = await setupTest();
            await expect(
                gasTank.payout([user1.address, executor.address])
            ).to.be.revertedWith("Nothing to payout")
        })

        it("throws if payout fails", async () => {
            const { gasTank, executor } = await setupTest();

            // Deposit and use funds to have something to payout
            await user1.sendTransaction({ to: executor.address, value: utils.parseEther("1") })
            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [gasTank.address, utils.parseEther("1"), "0x"]).slice(10)
            await gasTank.execute(executor.address, relayData)
            const account = await gasTank.accounts(executor.address)
            expect(account.deposit).to.be.equal(utils.parseEther("1"))
            expect(account.used).to.be.gt(BigNumber.from(0))

            await gasTank.changeOwner(executor.address)

            await executor.setDenyFunds(true)

            const calldata = gasTank.interface.encodeFunctionData("payout", [[user1.address, executor.address]])
            await expect(
                executor.exec(gasTank.address, 0, calldata)
            ).to.be.revertedWith("Could not payout funds")
        })

        it("throws if entered from relayed tx", async () => {
            const { gasTank, executor } = await setupTest();

            // Deposit and use funds to have something to payout
            await user1.sendTransaction({ to: executor.address, value: utils.parseEther("1") })
            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [gasTank.address, utils.parseEther("1"), "0x"]).slice(10)
            await gasTank.execute(executor.address, relayData)
            const account = await gasTank.accounts(executor.address)
            expect(account.deposit).to.be.equal(utils.parseEther("1"))
            expect(account.used).to.be.gt(BigNumber.from(0))

            await gasTank.changeOwner(executor.address)

            const calldata = gasTank.interface.encodeFunctionData("payout", [[user1.address, executor.address]])
            const payoutData = "0x" + executor.interface.encodeFunctionData("exec", [gasTank.address, 0, calldata]).slice(10)
            await expect(gasTank.execute(executor.address, payoutData)).to.be.revertedWith("Account in use")
        })

        it.only("updates for accounts correctly", async () => {
            const { gasTank, executor } = await setupTest();

            // Deposit and use funds to have something to payout
            await user1.sendTransaction({ to: executor.address, value: utils.parseEther("1") })
            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [gasTank.address, utils.parseEther("1"), "0x"]).slice(10)
            await gasTank.execute(executor.address, relayData)
            const account = await gasTank.accounts(executor.address)
            expect(account.deposit).to.be.equal(utils.parseEther("1"))
            expect(account.used).to.be.gt(BigNumber.from(0))

            await gasTank.changeOwner(executor.address)

            const calldata = gasTank.interface.encodeFunctionData("payout", [[user1.address, executor.address]])
            await executor.exec(gasTank.address, 0, calldata)
            const updatedAccount = await gasTank.accounts(executor.address)
            expect(updatedAccount.deposit).to.be.equal(utils.parseEther("1").sub(account.used))
            expect(updatedAccount.used).to.be.equal(BigNumber.from(0))
            expect(await hre.ethers.provider.getBalance(executor.address)).to.be.equal(account.used)
        })
    })

    describe("receive", async () => {
        it("can deposit as ETH transfer via relay", async () => {
            const { gasTank, executor } = await setupTest();

            await user1.sendTransaction({ to: executor.address, value: utils.parseEther("10") })
    
            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [gasTank.address, utils.parseEther("1"), "0x"]).slice(10)
            await gasTank.execute(executor.address, relayData)
            const account = await gasTank.accounts(executor.address)
            expect(account.deposit).to.be.equal(utils.parseEther("1"))
            expect(account.used).to.be.gt(BigNumber.from(0))
        })
    })

    describe("deposit", async () => {
        it("can deposit with relay", async () => {
            const { gasTank, executor } = await setupTest();

            await user1.sendTransaction({ to: executor.address, value: utils.parseEther("10") })
    
            const depositData = gasTank.interface.encodeFunctionData("deposit", [executor.address])
            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [gasTank.address, utils.parseEther("1"), depositData]).slice(10)
            await gasTank.execute(executor.address, relayData)
            const account = await gasTank.accounts(executor.address)
            expect(account.deposit).to.be.equal(utils.parseEther("1"))
            expect(account.used).to.be.gt(BigNumber.from(0))
        })

        it("can deposit for a different account", async () => {
            const { gasTank, executor } = await setupTest()
    
            await gasTank.deposit(executor.address, { value: utils.parseEther("1") })
            const account = await gasTank.accounts(executor.address)
            expect(account.deposit).to.be.equal(utils.parseEther("1"))
            expect(account.used).to.be.equal(BigNumber.from(0))
        })

        it("should be limited to 2**128 - 1 per deposit", async () => {
            const { gasTank, executor } = await setupTest()
    
            const amount = BigNumber.from(2).pow(128)
            await expect(
                gasTank.deposit(executor.address, { value: amount })
            ).to.be.revertedWith("Can only deposit a max of 2**128 - 1")
        })

        it("should be limited to 2**128 - 1 total", async () => {
            const { gasTank, executor } = await setupTest()
    
            await gasTank.deposit(executor.address, { value: BigNumber.from(200) })
            const amount = BigNumber.from(2).pow(128).sub(200)
            await expect(
                gasTank.deposit(executor.address, { value: amount })
            ).to.be.revertedWith("Adding deposit failed")
        })
    })

    describe("withdraw", async () => {
        it.skip("throws if account is in use", async () => {
        })

        it.skip("throws if nothing to withdraw", async () => {
        })
        
        it.skip("throws if funds cannot be transfered", async () => {
        })
        
        it.skip("correctly update account", async () => {
        })
    })

    describe("execute", async () => {
        it.skip("throws if internal call fails", async () => {
        })

        it.skip("TBD: fail if not boolean true is returned from internal call", async () => {
        })

        it.skip("throws if total gas is too high", async () => {
        })

        it.skip("throws used funds overflow", async () => {
        })

        it.skip("throws charged amount is higher than maxium", async () => {
        })

        it.skip("throws if not enough funds available", async () => {
        })

        it.skip("can execute token transfer", async () => {
        })
    })
})