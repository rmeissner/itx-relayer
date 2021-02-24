// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

contract GasTank {
    
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

    receive() payable external {
        require(msg.value < uint128(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF));
        accounts[msg.sender].deposit += uint128(msg.value);
    }
    
    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "Not Authorized");
        owner = newOwner;
    }
    
    function withdrawBalances(address[] calldata accs) external {
        require(msg.sender == owner, "Not Authorized");
        uint256 amount = 0;
        for (uint256 i = 0; i < accs.length; i++) {
            Account memory current = accounts[accs[i]];
            amount += current.used;
            // Note: if we seperate the deposit and used in 2 slots this will become a lot cheaper for the owner
            accounts[accs[i]].deposit = current.deposit - current.used;
        }
        require(amount > 0, "Nothing to widthdraw");
        owner.call{ value: amount }("");
    }
    
    function execute(address target, bytes calldata functionData) external {
        Account memory userAccount = accounts[target];
        uint256 additionalGas = 20000 + (40 + functionData.length) * 14;
        uint256 gasPrice = tx.gasprice + fee;
        uint256 newUsed = userAccount.used + (gasleft() + additionalGas) * gasPrice;
        require(newUsed <= userAccount.deposit, "Insufficient funds");
        accounts[target].used = uint128(newUsed);
        // The method id is appended by the contract to avoid that another method is called
        bytes memory data = abi.encodePacked(method, functionData);
        bool success;
        // Assembly reduced the costs by 400 gas
        assembly {
            success := call(sub(gas(), 12000), target, 0, add(data, 0x20), mload(data), 0, 0)
        }
        require(success, "Could not successfully call target");
        accounts[target].used -= uint128(gasleft() * gasPrice);
    }
}