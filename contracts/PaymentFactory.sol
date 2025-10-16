// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ScheduledPayment.sol";
import "./ScheduledPaymentERC20.sol";

/**
 * @title PaymentFactory
 * @notice Factory unifiée pour créer des paiements programmés (ETH natif et ERC20)
 * @dev Support paiements cancellable + non-cancellable
 */
contract PaymentFactory {
    // Wallet protocole qui reçoit les fees (1.79%)
    address public constant PROTOCOL_FEE_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_PERCENTAGE = 179; // 1.79%
    uint256 public constant FEE_DENOMINATOR = 10000;

    event PaymentCreatedETH(
        address indexed payer,
        address indexed payee,
        address paymentContract,
        uint256 releaseTime,
        uint256 totalAmount,
        uint256 amountToPayee,
        uint256 protocolFee,
        bool cancellable
    );

    event PaymentCreatedERC20(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress,
        address paymentContract,
        uint256 releaseTime,
        uint256 totalAmount,
        uint256 amountToPayee,
        uint256 protocolFee,
        bool cancellable
    );

    /**
     * @notice Crée un paiement programmé en ETH natif
     * @param _payee Adresse du bénéficiaire
     * @param _releaseTime Timestamp de libération (en secondes)
     * @param _cancellable Si true, le payer peut annuler avant releaseTime
     * @return Adresse du contrat créé
     */
    function createPaymentETH(
        address _payee, 
        uint256 _releaseTime,
        bool _cancellable
    ) external payable returns (address) {
        require(msg.value > 0, "No funds sent");
        require(_payee != address(0), "Invalid payee");
        require(_releaseTime > block.timestamp, "Release time must be in future");

        // Déployer le contrat ScheduledPayment
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(
            _payee, 
            _releaseTime,
            _cancellable
        );

        // Calculer les montants pour l'event
        uint256 protocolFee = (msg.value * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 amountToPayee = msg.value - protocolFee;

        emit PaymentCreatedETH(
            msg.sender,
            _payee,
            address(newPayment),
            _releaseTime,
            msg.value,
            amountToPayee,
            protocolFee,
            _cancellable
        );

        return address(newPayment);
    }

    /**
     * @notice Crée un paiement programmé en ERC20
     * @param _payee Adresse du bénéficiaire
     * @param _tokenAddress Adresse du token ERC20
     * @param _amount Montant de tokens
     * @param _releaseTime Timestamp de libération
     * @param _cancellable Si true, le payer peut annuler avant releaseTime
     * @return Adresse du contrat créé
     * @dev L'utilisateur doit avoir approuvé cette Factory AVANT d'appeler cette fonction
     */
    function createPaymentERC20(
        address _payee,
        address _tokenAddress,
        uint256 _amount,
        uint256 _releaseTime,
        bool _cancellable
    ) external returns (address) {
        require(_amount > 0, "Amount must be > 0");
        require(_payee != address(0), "Invalid payee");
        require(_tokenAddress != address(0), "Invalid token");
        require(_releaseTime > block.timestamp, "Release time must be in future");

        // Déployer le contrat ScheduledPaymentERC20
        ScheduledPaymentERC20 newPayment = new ScheduledPaymentERC20(
            _payee,
            _tokenAddress,
            _amount,
            _releaseTime,
            _cancellable
        );

        // Calculer les montants pour l'event
        uint256 protocolFee = (_amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 amountToPayee = _amount - protocolFee;

        emit PaymentCreatedERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            address(newPayment),
            _releaseTime,
            _amount,
            amountToPayee,
            protocolFee,
            _cancellable
        );

        return address(newPayment);
    }

    /**
     * @notice Prévisualise les fees AVANT de créer le paiement
     * @param amount Montant à envoyer
     * @return protocolFee Montant des fees
     * @return amountToPayee Montant que recevra le bénéficiaire
     */
    function previewFees(uint256 amount) external pure returns (
        uint256 protocolFee,
        uint256 amountToPayee
    ) {
        protocolFee = (amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        amountToPayee = amount - protocolFee;
    }
}