import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";
import { getConfig } from "../src/config/refunder_config";
import { logGas } from "./utils";
import { parseEther } from "ethers/lib/utils";

describe.only("Benchmark", async () => {

    const [user1] = waffle.provider.getWallets();

    const setupTest = deployments.createFixture(async () => {
        await deployments.fixture();
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        const TestToken = await hre.ethers.getContractFactory("TestToken");
        const token = await TestToken.deploy();
        const config = getConfig()
        const Refunder = await hre.ethers.getContractFactory("Refunder");
        const refunder = await Refunder.deploy(token.address, user1.address, config.fee, executor.interface.getSighash("exec"))
        return { Executor, executor, token, refunder };
    })

    // TODO: move to separe test suite
    describe("Noop transfer", async () => {
        it("Limited allowance", async () => {
            const { refunder, executor, token } = await setupTest();

            await user1.sendTransaction({ to: token.address, value: parseEther("10") })
            const approveData = token.interface.encodeFunctionData("approve", [refunder.address, parseEther("1")])
            await executor.exec(token.address, 0, approveData)
            await token.transfer(refunder.address, 10)
            await token.transfer(executor.address, parseEther("1"))

            await logGas("Execute directly", executor.exec(executor.address, 0, "0x"))

            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [executor.address, 0, "0x"]).slice(10)
            await logGas("Execute via relayer trusted", refunder.executeTrusted(executor.address, relayData))
            await logGas("Execute via relayer", refunder.execute(executor.address, relayData))
        })

        it("Unimited allowance", async () => {
            const { refunder, executor, token } = await setupTest();

            await user1.sendTransaction({ to: token.address, value: parseEther("10") })
            const approveData = token.interface.encodeFunctionData("approve", [refunder.address, ethers.constants.MaxUint256])
            await executor.exec(token.address, 0, approveData)
            await token.transfer(refunder.address, 10)
            await token.transfer(executor.address, parseEther("1"))

            await logGas("Execute directly", executor.exec(executor.address, 0, "0x"))

            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [executor.address, 0, "0x"]).slice(10)
            await logGas("Execute via relayer trusted", refunder.executeTrusted(executor.address, relayData))
            await logGas("Execute via relayer", refunder.execute(executor.address, relayData))
        })
    })

    describe("Ether transfer", async () => {

        it("Limited allowance", async () => {
            const { refunder, executor, token } = await setupTest();

            await user1.sendTransaction({ to: token.address, value: parseEther("10") })
            await user1.sendTransaction({ to: executor.address, value: parseEther("10") })
            const approveData = token.interface.encodeFunctionData("approve", [refunder.address, parseEther("1")])
            await executor.exec(token.address, 0, approveData)
            await token.transfer(refunder.address, 10)
            await token.transfer(executor.address, parseEther("1"))

            await logGas("Execute directly", executor.exec(user1.address, parseEther("1"), "0x"))

            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [user1.address, parseEther("1"), "0x"]).slice(10)
            await logGas("Execute via relayer trusted", refunder.executeTrusted(executor.address, relayData))
            await logGas("Execute via relayer", refunder.execute(executor.address, relayData))
        })

        it("Unimited allowance", async () => {
            const { refunder, executor, token } = await setupTest();

            await user1.sendTransaction({ to: token.address, value: parseEther("10") })
            await user1.sendTransaction({ to: executor.address, value: parseEther("10") })
            const approveData = token.interface.encodeFunctionData("approve", [refunder.address, ethers.constants.MaxUint256])
            await executor.exec(token.address, 0, approveData)
            await token.transfer(refunder.address, 10)
            await token.transfer(executor.address, parseEther("1"))

            await logGas("Execute directly", executor.exec(user1.address, parseEther("1"), "0x"))

            const relayData = "0x" + executor.interface.encodeFunctionData("exec", [user1.address, parseEther("1"), "0x"]).slice(10)
            await logGas("Execute via relayer trusted", refunder.executeTrusted(executor.address, relayData))
            await logGas("Execute via relayer", refunder.execute(executor.address, relayData))
        })
    })
})