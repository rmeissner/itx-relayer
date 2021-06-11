// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >0.7.0 <0.9.0;

contract GasTank {

    uint128 private constant MAX_UINT128 = uint128(int128(-1));
    
    address public owner;
    uint256 public immutable fee;
    bytes4 public immutable method;

    struct Account {
        uint128 deposit;
        uint128 used;
    }

    mapping(address => Account) public accounts;
    
    constructor(address _owner, uint256 _fee, bytes4 _method) {
        owner = _owner;
        fee = _fee;
        method = _method;
    }
    
    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "Not Authorized");
        owner = newOwner;
    }

    /**
     * Method to unstuck tokens from this contract. We disallow to specify value else balances could be compromised
     */
    function unstuck(address payable to, bytes calldata data) external returns (bool success, bytes memory response) {
        require(msg.sender == owner, "Not Authorized");
        (success, response) = to.call(data);
    }
    
    function payout(address[] calldata accs) external {
        require(msg.sender == owner, "Not Authorized");
        uint256 amount = 0;
        for (uint256 i = 0; i < accs.length; i++) {
            Account memory current = accounts[accs[i]];
            require(current.used < MAX_UINT128, "Account in use");
            amount += current.used;
            current.deposit = current.deposit - current.used;
            current.used = 0;
            accounts[accs[i]] = current;
        }
        require(amount > 0, "Nothing to payout");
        (bool success,) = owner.call{ value: amount }("");
        require(success, "Could not payout funds");
    }

    receive() external payable {
        deposit(msg.sender);
    }

    function deposit(address receiver) public payable {
        uint128 depositAmount = uint128(msg.value);
        require(depositAmount == msg.value, "Can only deposit a max of 2**128 - 1");
        Account memory userAccount = accounts[receiver];
        userAccount.deposit += depositAmount;
        require(userAccount.deposit >= depositAmount, "Adding deposit failed");
        accounts[receiver] = userAccount;
    }

    function withdraw() public {
        Account memory userAccount = accounts[msg.sender];
        require(userAccount.used < MAX_UINT128, "Account in use");
        require(userAccount.deposit > userAccount.used, "No funds to withdraw");
        uint256 amount = userAccount.deposit - userAccount.used;
        userAccount.used = 0;
        userAccount.deposit = 0;
        accounts[msg.sender] = userAccount;
        (bool success,) = owner.call{ value: amount }("");
        require(success, "Could not withdraw funds");
    }
    
    function execute(address target, bytes calldata functionData) external {
        Account memory userAccount = accounts[target];
        // Some additional gas is charged for submitting the tx on-chain
        uint256 additionalGas = 20000 + (40 + functionData.length) * 14;
        // A fee is charged per gas used (aka in the gas price)
        uint256 gasPrice = tx.gasprice + fee;
        // Protect against reentrency. We reuse a known slot to minimize gas costs
        require(userAccount.used < MAX_UINT128, "Already in use");
        accounts[target].used = MAX_UINT128;
        uint256 startGas = gasleft();
        // The method id is appended by the contract to avoid that another method is called
        bytes memory data = abi.encodePacked(method, functionData);
        bool success;
        // Assembly reduced the costs by 400 gas
        assembly {
            success := call(sub(gas(), 12000), target, 0, add(data, 0x20), mload(data), 0, 0)
        }
        // Forward error message
        if(!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
        uint256 totalGas = startGas - gasleft() + additionalGas;
        require(totalGas > additionalGas, "Gas overflow");
        uint256 chargedAmount = totalGas * gasPrice;
        require(chargedAmount >= totalGas && chargedAmount <= MAX_UINT128, "Amount overflow");
        // We check the used agains the original state to avoid the reentry protection state
        uint128 newUsed = userAccount.used + uint128(chargedAmount);
        require(newUsed > userAccount.used, "Cannot calculate new used");
        // Reload the account to get up to date state
        userAccount = accounts[target];
        require(newUsed <= userAccount.deposit, "Insufficient funds");
        userAccount.used = newUsed;
        accounts[target] = userAccount;
    }
}