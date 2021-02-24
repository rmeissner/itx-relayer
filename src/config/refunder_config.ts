export interface Config {
    fee?: string,
    method?: string,
    owner?: string,
    token?: string
}

const configs: Record<string, Config> = {
    default: {
        // Fee that has to be paid additionally to the gas price
        fee: "20000000000",
        // Method id that should be allowed to be called on the target contracts
        method: "0x6a761202", // execTransaction
        // Owner that can withdraw the gathered fees
        owner: undefined,
        // Token that should be used by the Refunder contract
        token: undefined,
    },
    rinkeby: {
        token: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
        fee: "1000000000", // 1 GWei
    }
}

export const getConfig = (network?: string): Config => {
    return { ...configs.default, ...configs[network || "hardhat"] }
}