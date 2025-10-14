// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ScheduledPayment is ReentrancyGuard {
    address public payer;
    address public payee;
    uint256 public amount;
    uint256 public releaseTime;
    bool public released;

    event Released(address indexed payee, uint256 amount);

    constructor(address _payee, uint256 _releaseTime) payable {
        require(msg.value > 0, "No funds sent");
        payer = msg.sender;
        payee = _payee;
        amount = msg.value;
        releaseTime = _releaseTime;
        released = false;
    }

    function release() external nonReentrant {
        require(!released, "Already released");
        require(block.timestamp >= releaseTime, "Too early");
        released = true;
        payable(payee).transfer(amount);
        emit Released(payee, amount);
    }
}
