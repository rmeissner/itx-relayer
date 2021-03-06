// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >0.7.0 <0.9.0;

contract TestExecutor {
    address public module;
    bool public denyFunds;

    receive() external payable {
        require(!denyFunds);
    }

    function setDenyFunds(bool _deny) external {
        denyFunds = _deny;
    }

    function setModule(address _module) external {
        module = _module;
    }

    function exec(
        address payable to,
        uint256 value,
        bytes calldata data
    ) external {
        bool success;
        bytes memory response;
        (success, response) = to.call{value: value}(data);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                revert(add(response, 0x20), mload(response))
            }
        }
    }

    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        require(msg.sender == module, "Not authorized");
        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, ) = to.call{value: value}(data);
    }
}
