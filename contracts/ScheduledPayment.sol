// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ScheduledPayment is ReentrancyGuard {
    address public payer;
    address public payee;
    uint256 public amount;
    uint256 public releaseTime;
    bool public released;
    
    // 🆕 Système d'annulation
    bool public cancellable;
    bool public cancelled;

    // Système de fees
    address public constant PROTOCOL_FEE_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_PERCENTAGE = 179; // 1.79%
    uint256 public constant FEE_DENOMINATOR = 10000;

    event Released(address indexed payee, uint256 amountToPayee, uint256 protocolFee);
    event Cancelled(address indexed payer, uint256 refundedAmount);

    constructor(
        address _payee, 
        uint256 _releaseTime,
        bool _cancellable  // 🆕 Nouveau paramètre
    ) payable {
        require(msg.value > 0, "No funds sent");
        require(_payee != address(0), "Invalid payee");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        
        payer = msg.sender;
        payee = _payee;
        amount = msg.value;
        releaseTime = _releaseTime;
        cancellable = _cancellable;
        released = false;
        cancelled = false;
    }

    // 🆕 Fonction d'annulation
    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(cancellable, "Payment is not cancellable");
        require(!released, "Already released");
        require(!cancelled, "Already cancelled");
        require(block.timestamp < releaseTime, "Payment deadline passed");
        
        cancelled = true;

        // Remboursement INTÉGRAL au payer (0% de fees)
        (bool success, ) = payable(payer).call{value: amount}("");
        require(success, "Refund failed");

        emit Cancelled(payer, amount);
    }

    function release() external nonReentrant {
        require(!cancelled, "Payment was cancelled");
        require(!released, "Already released");
        require(block.timestamp >= releaseTime, "Too early");
        
        released = true;

        // Calcul des fees (seulement si exécuté)
        uint256 protocolFee = (amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 amountToPayee = amount - protocolFee;

        // Transfert au protocole
        (bool feeSuccess, ) = PROTOCOL_FEE_WALLET.call{value: protocolFee}("");
        require(feeSuccess, "Protocol fee transfer failed");

        // Transfert au bénéficiaire
        (bool payeeSuccess, ) = payable(payee).call{value: amountToPayee}("");
        require(payeeSuccess, "Payee transfer failed");

        emit Released(payee, amountToPayee, protocolFee);
    }

    // Fonction pour voir les montants avant release
    function getAmounts() external view returns (
        uint256 totalAmount,
        uint256 protocolFee,
        uint256 amountToPayee
    ) {
        totalAmount = amount;
        protocolFee = (amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        amountToPayee = amount - protocolFee;
    }

    // 🆕 Fonction pour vérifier le status complet
    function getStatus() external view returns (
        bool isReleased,
        bool isCancelled,
        bool isCancellable,
        bool canBeReleased,
        bool canBeCancelled
    ) {
        isReleased = released;
        isCancelled = cancelled;
        isCancellable = cancellable;
        canBeReleased = !released && !cancelled && block.timestamp >= releaseTime;
        canBeCancelled = cancellable && !released && !cancelled && block.timestamp < releaseTime;
    }
}