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
        const Refunder = await hre.ethers.getContractFactory("Refunder");
        const refunder = await Refunder.deploy(mock.address, user1.address, config.fee, executor.interface.getSighash("exec"))
        return { Executor, executor, mock, refunder };
    })

    describe("changeOwner", async () => {
        it("updates owner", async () => {
            const { refunder, executor } = await setupTest();

            expect(
                await refunder.owner()
            ).to.be.equals(user1.address);

            await refunder.changeOwner(executor.address)

            expect(
                await refunder.owner()
            ).to.be.equals(executor.address);
        })

        it("throws if called by non-owner", async () => {
            const { refunder, executor } = await setupTest();
            const calldata = refunder.interface.encodeFunctionData("changeOwner", [user1.address])
            await expect(
                executor.exec(refunder.address, 0, calldata).then((tx:any) => { console.log({tx}); return tx})
            ).to.be.revertedWith("Not Authorized")
        })
    })
})