// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IScheduledPayment {
    function releaseTime() external view returns (uint256);
    function released() external view returns (bool);
    function release() external;
}

contract Resolver {
    IScheduledPayment public scheduledPayment;

    constructor(address _scheduledPayment) {
        scheduledPayment = IScheduledPayment(_scheduledPayment);
    }

    function checker() external view returns (bool canExec, bytes memory execPayload) {
        if (block.timestamp >= scheduledPayment.releaseTime() && !scheduledPayment.released()) {
            canExec = true;
            execPayload = abi.encodeWithSelector(
                IScheduledPayment.release.selector
            );
        } else {
            canExec = false;
            execPayload = bytes("Not yet time");
        }
    }
}
