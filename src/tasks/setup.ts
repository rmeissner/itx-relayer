import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";

task("setup", "Setups the reunder contract")
    .addParam("token", "Token that should be used by the Refunder contract", undefined, types.string)
    .addParam("owner", "Owner that can withdraw the gathered fees", undefined, types.string, true)
    .addParam("fee", "Timeout in seconds that should be required for the oracle", "21000000000", types.string, true)
    .addParam("method", "Method id that should be allowed to be called on the target contracts", "0x6a761202", types.string, true)
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);
        const Refunder = await hardhatRuntime.ethers.getContractFactory("Refunder");
        const refunder = await Refunder.deploy(taskArgs.token, taskArgs.owner || caller.address, taskArgs.fee, taskArgs.method);

        console.log("Refunder deployed to:", refunder.address);
    });
export { };