import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { ethers, BigNumber } from "ethers";
import { InfuraProvider } from "@ethersproject/providers";
import { task, types } from "hardhat/config";
import axios from "axios";

const relayTransaction = async (ethers: any, refunder: string, target: string, data: string) => {
    console.log({
        target,
        data
    })
    const network = (await ethers.provider.getNetwork());
    console.log(`Running on ${network.name}`)

    const itx = new InfuraProvider(
        network.name,
        process.env.INFURA_KEY
    )
    const itxSigner = ethers.Wallet.fromMnemonic(process.env.ITX_MNEMONIC!!).connect(itx)

    const balance = await itx.send('relay_getBalance', [itxSigner.address])
    console.log(`The ITX balance for ${await itxSigner.getAddress()} is ${balance}`)

    const Refunder = await ethers.getContractFactory("Refunder", itxSigner);

    const relayData = Refunder.interface.encodeFunctionData('execute', [target, data])
    const tx: any = {
        to: refunder,
        data: relayData
    }

    const estimate = BigNumber.from(await itx.send('eth_estimateGas', [tx]))
    console.log("Estimated gas limit:", estimate.toString())
    tx.gas = estimate.mul(3).div(2).toString()
    const relayTransactionHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ['address', 'bytes', 'uint256', 'uint256'],
            [tx.to, tx.data, tx.gas, network.chainId]
        )
    )
    console.log(ethers.utils.arrayify(relayTransactionHash))
    const signature = await itxSigner.signMessage(ethers.utils.arrayify(relayTransactionHash))
    console.log(signature)
    await itx.send('relay_sendTransaction', [
        tx,
        signature
    ])
    console.log(`ITX relay hash: ${relayTransactionHash}`)
    const balanceAfter = await itx.send('relay_getBalance', [itxSigner.address])
    console.log(`The new ITX balance for ${await itxSigner.getAddress()} is ${balanceAfter}`)
}

interface SafeConfirmation {
    owner: string,
    signature: string
}

interface SafeTransaction {
    safe: string,
    to: string,
    value: string,
    data: string,
    operation: number,
    gasToken: string,
    safeTxGas: number,
    baseGas: number,
    gasPrice: string,
    refundReceiver: string,
    nonce: number,
    confirmationsRequired: number,
    confirmations: SafeConfirmation[]
}

const buildSignaturesBytes = (confirmations: SafeConfirmation[]): string => {
    return confirmations.sort((left, right) => left.owner.toLowerCase().localeCompare(right.owner.toLowerCase()))
        .reduce((acc, val) => acc + val.signature.slice(2), "0x")
}

const encodeSafeTransaction = (safeTx: SafeTransaction): { to: string, data: string } => {
    console.log({
        safeTx
    })
    const safeInterface = new ethers.utils.Interface(['function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)'])
    const encodedCall = safeInterface.encodeFunctionData('execTransaction', [safeTx.to, safeTx.value, safeTx.data || "0x", safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, buildSignaturesBytes(safeTx.confirmations)])
    const data = "0x" + encodedCall.slice(10)
    return {
        to: safeTx.safe,
        data
    }
}

task("relayTransaction", "Relays a transaction")
    .addParam("refunder", "Address of the Refunder contract", undefined, types.string)
    .addParam("target", "Target to be called", undefined, types.string)
    .addParam("data", "Data to be used", undefined, types.string)
    .setAction(async (taskArgs, hardhatRuntime) => {
        await relayTransaction(hardhatRuntime.ethers, taskArgs.refunder, taskArgs.target, taskArgs.data)
    });


task("relaySafeTransaction", "Relays a transaction")
    .addParam("refunder", "Address of the Refunder contract", undefined, types.string)
    .addParam("txhash", "Hash of safe tx that should be relayed", undefined, types.string)
    .setAction(async (taskArgs, hardhatRuntime) => {
        const network = (await hardhatRuntime.ethers.provider.getNetwork());
        const safeTxResponse = await axios.get<SafeTransaction>(
            `https://safe-transaction.${network.name}.gnosis.io/api/v1/multisig-transactions/${taskArgs.txhash}/`
        )
        const safeTx = safeTxResponse.data
        if (safeTx.confirmationsRequired > safeTx.confirmations.length) {
            throw Error("Not enough confirmations")
        }
        const relayData = encodeSafeTransaction(safeTx)
        console.log({relayData})
        await relayTransaction(hardhatRuntime.ethers, taskArgs.refunder, relayData.to, relayData.data)
    });

task("balanceOnItx", "Shows current gas tank")
    .setAction(async (taskArgs, hardhatRuntime) => {
        const networkName = (await hardhatRuntime.ethers.provider.getNetwork()).name;
        console.log(`Running on ${networkName}`)
        const itx = new InfuraProvider(
            networkName,
            process.env.INFURA_KEY
        )
        const itxSigner = hardhatRuntime.ethers.Wallet.fromMnemonic(process.env.ITX_MNEMONIC!!).connect(itx)
        const balance = await itx.send('relay_getBalance', [itxSigner.address])
        console.log(`The ITX balance for ${await itxSigner.getAddress()} is ${balance}`)
    });

task("depositToItx", "Fills up gas tank")
    .addParam("itx", "ITX contract", "0x015C7C7A7D65bbdb117C573007219107BD7486f9", types.string, true)
    .addParam("target", "Target for whom it should deposit", undefined, types.string, true)
    .addParam("amount", "Amount to be deposited in Ether", undefined, types.string)
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [signer] = await hardhatRuntime.ethers.getSigners();

        let data = undefined
        if (taskArgs.target !== undefined) {
            const iface = new ethers.utils.Interface(['function depositFor(address _recipient)'])
            data = iface.encodeFunctionData('depositFor', [taskArgs.target])
        }
        const tx = await signer.sendTransaction({
            to: taskArgs.itx,
            value: ethers.utils.parseUnits(taskArgs.amount, 'ether'),
            data
        })
        console.log("Transaction:", tx.hash);
        await tx.wait();
    });

export { };