# Refunder contract

## Known instances
- `0x2d8cE02dd1644A9238e08430CaeA15a609503140`

## Example

- `yarn hardhat --network rinkeby balanceOnItx`
- `yarn hardhat --network rinkeby depositToItx --amount 0.1`
- `yarn hardhat --network rinkeby setup --token 0xc778417E063141139Fce010982780140Aa0cD5Ab --fee 1000000000`
- `yarn hardhat --network rinkeby relayTransaction --refunder 0x2d8cE02dd1644A9238e08430CaeA15a609503140 --target 0x05c85Ab5B09Eb8A55020d72daf6091E04e264af9 --data 0x07`