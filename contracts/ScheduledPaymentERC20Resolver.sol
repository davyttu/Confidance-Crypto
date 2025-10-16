// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IScheduledPaymentERC20 {
    function releaseTime() external view returns (uint256);
    function released() external view returns (bool);
}

contract ScheduledPaymentERC20Resolver {
    address public target;

    constructor(address _target) {
        target = _target;
    }

    function checker() external view returns (bool canExec, bytes memory execPayload) {
        IScheduledPaymentERC20 sp = IScheduledPaymentERC20(target);
        if (!sp.released() && block.timestamp >= sp.releaseTime()) {
            bytes4 selector = bytes4(keccak256("release()"));
            execPayload = abi.encodeWithSelector(selector);
            canExec = true;
        } else {
            canExec = false;
            execPayload = bytes("");
        }
    }
}