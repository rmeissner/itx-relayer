import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { getConfig } from "../config/refunder_config";

const deploy: DeployFunction = async (
  hre: HardhatRuntimeEnvironment,
) => {
  const { deployments, hardhatArguments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments
  const config = getConfig(hardhatArguments.network)
  await deploy("Refunder", {
    from: deployer,
    args: [ config.token, config.owner || deployer, config.fee, config.method],
    log: true,
    deterministicDeployment: true,
  });
};

deploy.skip = async (
  hre: HardhatRuntimeEnvironment,) => {
    const { hardhatArguments } = hre
    const config = getConfig(hardhatArguments.network)
    return !config.token
}
deploy.tags = ['refunder']
export default deploy
