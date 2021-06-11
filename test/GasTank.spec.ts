import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { getConfig } from "../src/config/refunder_config";

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
})