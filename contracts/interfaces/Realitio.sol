// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.0;

interface Token {
    function transferFrom(address from, address to, uint256 value) external returns(bool);
    function transfer(address to, uint256 value) external returns(bool);
    function balanceOf(address holder) external returns(uint256);
}