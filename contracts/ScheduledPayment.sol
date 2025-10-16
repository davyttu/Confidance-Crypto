// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ScheduledPayment is ReentrancyGuard {
    address public payer;
    address public payee;
    uint256 public amount;
    uint256 public releaseTime;
    bool public released;

    // 🆕 Système de fees
    address public constant PROTOCOL_FEE_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_PERCENTAGE = 179; // 1.79% (en basis points: 179/10000)
    uint256 public constant FEE_DENOMINATOR = 10000;

    event Released(address indexed payee, uint256 amountToPayee, uint256 protocolFee);

    constructor(address _payee, uint256 _releaseTime) payable {
        require(msg.value > 0, "No funds sent");
        require(_payee != address(0), "Invalid payee");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        
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

        // 🆕 Calcul des fees
        uint256 protocolFee = (amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 amountToPayee = amount - protocolFee;

        // 🆕 Transfert au protocole
        (bool feeSuccess, ) = PROTOCOL_FEE_WALLET.call{value: protocolFee}("");
        require(feeSuccess, "Protocol fee transfer failed");

        // Transfert au bénéficiaire
        (bool payeeSuccess, ) = payable(payee).call{value: amountToPayee}("");
        require(payeeSuccess, "Payee transfer failed");

        emit Released(payee, amountToPayee, protocolFee);
    }

    // 🆕 Fonction pour voir les montants avant release
    function getAmounts() external view returns (
        uint256 totalAmount,
        uint256 protocolFee,
        uint256 amountToPayee
    ) {
        totalAmount = amount;
        protocolFee = (amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        amountToPayee = amount - protocolFee;
    }
}