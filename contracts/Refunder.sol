// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

interface Token {
    function transferFrom(address from, address to, uint256 value) external returns(bool);
    function transfer(address to, uint256 value) external returns(bool);
    function balanceOf(address holder) external returns(uint256);
}

contract Refunder {
    
    address public owner;
    Token public immutable token;
    uint256 public immutable fee;
    bytes4 public immutable method;
    
    constructor(Token _token, address _owner, uint256 _fee, bytes4 _method) {
        token = _token;
        owner = _owner;
        fee = _fee;
        method = _method;
    }
    
    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "Not Authorized");
        owner = newOwner;
    }
    
    function withdrawTokensTo(Token withdrawToken, address target) external {
        require(msg.sender == owner, "Not Authorized");
        if (address(withdrawToken) == address(0)) {
            target.call{ value: address(this).balance }("");
        } else {
            withdrawToken.transfer(target, withdrawToken.balanceOf(address(this)));
        }
    }
    
    function execute(address target, bytes calldata functionData) external {
        // 9k are for the token transfers + 21k base + data (8 bytes method + 32 bytes address + data)
        // We will use 14 as the gas price per data byte, to avoid overcharging too much
        uint256 additionalGas = 30000 + (40 + functionData.length) * 14;
        uint256 gasPrice = tx.gasprice + fee;
        require(token.transferFrom(target, address(this), (gasleft() + additionalGas) * gasPrice), "Could not aquire tokens");
        // The method id is appended by the contract to avoid that another method is called
        bytes memory data = abi.encodePacked(method, functionData);
        bool success;
        // Assembly reduced the costs by 400 gas
        assembly {
            success := call(sub(gas(), 12000), target, 0, add(data, 0x20), mload(data), 0, 0)
        }
        require(success, "Could not successfully call target");
        require(token.transfer(target, (gasleft()) * gasPrice), "Could not refund unused gas");
    } 
    
    function executeTrusted(address target, bytes calldata functionData) external {
        // 9k are for the token transfers + 21k base + data (8 bytes method + 32 bytes address + data)
        // We will use 14 as the gas price per data byte, to avoid overcharging too much
        uint256 additionalGas = 30000 + (40 + functionData.length) * 14;
        uint256 gasPrice = tx.gasprice + fee;
        uint256 gasStart = gasleft();
        // The method id is appended by the contract to avoid that another method is called
        bytes memory data = abi.encodePacked(method, functionData);
        bool success;
        // Assembly reduced the costs by 400 gas
        assembly {
            success := call(sub(gas(), 12000), target, 0, add(data, 0x20), mload(data), 0, 0)
        }
        require(success, "Could not successfully call target");
        require(token.transferFrom(target, address(this), (gasStart + additionalGas - gasleft()) * gasPrice), "Could not pay gas");
    } 
}