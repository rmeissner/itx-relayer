import { time } from "console";
import hre, { deployments, ethers, waffle } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export const nextBlockTime = async (hre: HardhatRuntimeEnvironment, timestamp: number) =>  {
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp])
}

export const increaseBlockTime = async (hre: HardhatRuntimeEnvironment, seconds: number) =>  {
    const block = await hre.ethers.provider.getBlock("latest")
    await nextBlockTime(hre, block.timestamp + seconds)
}