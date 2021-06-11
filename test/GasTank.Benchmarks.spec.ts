import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { getConfig } from "../src/config/refunder_config";
import { logGas } from "./utils";
import { utils } from "ethers";

describe("Benchmark", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTest = deployments.createFixture(async () => {
        await deployments.fixture();
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        const config = getConfig()
        const GasTank = await hre.ethers.getContractFactory("GasTank");
        const gasTank = await GasTank.deploy(user1.address, config.fee, executor.interface.getSighash("exec"))
        return { Executor, executor, gasTank };
    })

    it("noop", async () => {
        const { gasTank, executor } = await setupTest();

        await user1.sendTransaction({ to: executor.address, value: utils.parseEther("10") })
        await executor.exec(gasTank.address, utils.parseEther("1"), "0x")

        await logGas("Execute directly", executor.exec(executor.address, 0, "0x"))

        const relayData = "0x" + executor.interface.encodeFunctionData("exec", [executor.address, 0, "0x"]).slice(10)
        await logGas("Execute via gasTank", gasTank.execute(executor.address, relayData))
    })

    it("Ether transfer", async () => {
        const { gasTank, executor } = await setupTest();

        await user1.sendTransaction({ to: executor.address, value: utils.parseEther("10") })
        await executor.exec(gasTank.address, utils.parseEther("1"), "0x")

        await logGas("Execute directly", executor.exec(executor.address, utils.parseEther("0.001"), "0x"))

        const relayData = "0x" + executor.interface.encodeFunctionData("exec", [user1.address, utils.parseEther("0.001"), "0x"]).slice(10)
        await logGas("Execute via gasTank", gasTank.execute(executor.address, relayData))
    })
})