// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ScheduledPayment.sol";

contract PaymentFactory {
    address public constant PROTOCOL_FEE_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_PERCENTAGE = 179; // 1.79%
    uint256 public constant FEE_DENOMINATOR = 10000;

    event PaymentCreated(
        address indexed payer,
        address indexed payee,
        address paymentContract,
        uint256 releaseTime,
        uint256 totalAmount,
        uint256 amountToPayee,
        uint256 protocolFee
    );

    function createPayment(address _payee, uint256 _releaseTime) external payable {
        require(msg.value > 0, "No funds sent");

        // Créer le contrat ScheduledPayment
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(_payee, _releaseTime);

        // Calculer les montants pour l'event
        uint256 protocolFee = (msg.value * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 amountToPayee = msg.value - protocolFee;

        emit PaymentCreated(
            msg.sender,
            _payee,
            address(newPayment),
            _releaseTime,
            msg.value,
            amountToPayee,
            protocolFee
        );
    }

    // 🆕 Fonction pour prévisualiser les fees AVANT de créer le paiement
    function previewFees(uint256 amount) external pure returns (
        uint256 protocolFee,
        uint256 amountToPayee
    ) {
        protocolFee = (amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        amountToPayee = amount - protocolFee;
    }
}