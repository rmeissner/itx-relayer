import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { getConfig } from "../src/config/refunder_config";
import { BigNumber, utils } from "ethers";

describe("Refunder", async () => {

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
                executor.exec(gasTank.address, 0, calldata).then((tx:any) => { console.log({tx}); return tx})
            ).to.be.revertedWith("Not Authorized")
        })
    })

    describe.only("deposit", async () => {
        it("can deposit with relay", async () => {
            const { gasTank, executor } = await setupTest();

            await user1.sendTransaction({ to: executor.address, value: utils.parseEther("10") })
    
            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [gasTank.address, utils.parseEther("1"), "0x"]).slice(10)
            await gasTank.execute(executor.address, relayData)
            const account = await gasTank.accounts(executor.address)
            expect(account.deposit).to.be.equal(utils.parseEther("1"))
            expect(account.used).to.be.gt(BigNumber.from(0))
        })
    })
})