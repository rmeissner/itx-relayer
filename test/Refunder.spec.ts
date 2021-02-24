import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { injectHardhatDefaults } from "../src/config/refunder_config";
import { logGas } from "./utils";

describe("Refunder", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTest = deployments.createFixture(async () => {
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        const Mock = await hre.ethers.getContractFactory("MockContract");
        const mock = await Mock.deploy();
        injectHardhatDefaults({ token: mock.address, method: executor.interface.getSighash("exec") })
        await deployments.fixture();
        const RefunderDeployment = await deployments.get("Refunder");
        const Refunder = await hre.ethers.getContractFactory("Refunder");
        const refunder = Refunder.attach(RefunderDeployment.address)
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
                executor.exec(refunder.address, 0, calldata)
            ).to.be.revertedWith("Not Authorized")
        })
    })
})