// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ScheduledPayment {
    address payable public sender;
    address payable public recipient;
    address public platformWallet;
    uint256 public releaseTime;
    uint256 public feePercent;
    bool public isCancelable;
    bool public isDefinitive;
    bool public executed;

    constructor(
        address payable _sender,
        address payable _recipient,
        uint256 _releaseTime,
        bool _isCancelable,
        bool _isDefinitive,
        address _platformWallet,
        uint256 _feePercent
    ) payable {
        require(msg.value > 0, "No funds sent");
        require(_releaseTime > block.timestamp, "Invalid release time");

        sender = _sender;
        recipient = _recipient;
        releaseTime = _releaseTime;
        isCancelable = _isCancelable;
        isDefinitive = _isDefinitive;
        platformWallet = _platformWallet;
        feePercent = _feePercent;
        executed = false;
    }

    function release() external {
        require(!executed, "Already executed");
        require(block.timestamp >= releaseTime, "Too early");
        executed = true;

        uint256 feeAmount = (address(this).balance * feePercent) / 10000;
        uint256 remaining = address(this).balance - feeAmount;

        payable(platformWallet).transfer(feeAmount);
        payable(recipient).transfer(remaining);
    }

    function cancel() external {
        require(isCancelable, "Not cancelable");
        require(!executed, "Already executed");
        require(msg.sender == sender, "Only sender can cancel");

        executed = true;
        payable(sender).transfer(address(this).balance);
    }

    receive() external payable {}
}
