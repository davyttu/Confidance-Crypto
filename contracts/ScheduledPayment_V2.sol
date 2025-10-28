// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ScheduledPayment V2
 * @notice Paiement programmé avec nouvelle logique de fees
 * @dev Le bénéficiaire reçoit le montant EXACT, fees additives
 * 
 * Changement V2 :
 * - msg.value = amountToPayee + protocolFee
 * - Bénéficiaire reçoit exactement amountToPayee
 * - Protocole reçoit protocolFee (1.79%)
 */
contract ScheduledPayment is ReentrancyGuard {
    
    // ============================================================
    // STORAGE
    // ============================================================
    
    address public payer;
    address public payee;
    uint256 public amountToPayee;    // Montant EXACT pour le bénéficiaire
    uint256 public protocolFee;      // Fees (1.79%)
    uint256 public releaseTime;
    
    bool public released;
    bool public cancelled;
    bool public cancellable;
    
    // Constantes
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179; // 1.79%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    
    // ============================================================
    // EVENTS
    // ============================================================
    
    event PaymentCreated(
        address indexed payer,
        address indexed payee,
        uint256 amountToPayee,
        uint256 protocolFee,
        uint256 releaseTime
    );
    
    event Released(
        address indexed payee,
        uint256 amountToPayee,
        uint256 protocolFee
    );
    
    event Cancelled(
        address indexed payer,
        uint256 refundedAmount
    );
    
    // ============================================================
    // CONSTRUCTOR
    // ============================================================
    
    /**
     * @notice Crée un paiement programmé
     * @param _payee Adresse du bénéficiaire
     * @param _amountToPayee Montant EXACT que le bénéficiaire recevra
     * @param _releaseTime Timestamp de libération
     * @param _cancellable Si true, le payer peut annuler avant releaseTime
     * 
     * @dev msg.value DOIT être égal à _amountToPayee + fees
     *      La Factory calcule : totalRequired = amountToPayee * 10179 / 10000
     */
    constructor(
        address _payee,
        uint256 _amountToPayee,
        uint256 _releaseTime,
        bool _cancellable
    ) payable {
        require(_amountToPayee > 0, "Amount must be > 0");
        require(_payee != address(0), "Invalid payee");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        require(msg.value > 0, "No funds sent");
        
        // Calculer les fees
        uint256 calculatedFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 expectedTotal = _amountToPayee + calculatedFee;
        
        require(msg.value == expectedTotal, "Incorrect amount sent");
        
        // Stocker
        payer = msg.sender;
        payee = _payee;
        amountToPayee = _amountToPayee;
        protocolFee = calculatedFee;
        releaseTime = _releaseTime;
        cancellable = _cancellable;
        released = false;
        cancelled = false;
        
        emit PaymentCreated(
            msg.sender,
            _payee,
            _amountToPayee,
            calculatedFee,
            _releaseTime
        );
    }
    
    // ============================================================
    // RELEASE
    // ============================================================
    
    /**
     * @notice Libère les fonds au bénéficiaire
     * @dev Peut être appelé par n'importe qui après releaseTime
     */
    function release() external nonReentrant {
        require(!released, "Already released");
        require(!cancelled, "Payment cancelled");
        require(block.timestamp >= releaseTime, "Too early");
        
        released = true;
        
        // Transférer au bénéficiaire (montant exact)
        (bool payeeSuccess, ) = payable(payee).call{value: amountToPayee}("");
        require(payeeSuccess, "Payee transfer failed");
        
        // Transférer les fees au protocole
        (bool feeSuccess, ) = PROTOCOL_WALLET.call{value: protocolFee}("");
        require(feeSuccess, "Protocol fee transfer failed");
        
        emit Released(payee, amountToPayee, protocolFee);
    }
    
    // ============================================================
    // CANCEL
    // ============================================================
    
    /**
     * @notice Annule le paiement et rembourse le payer
     * @dev Seulement si cancellable = true et avant releaseTime
     *      Remboursement INTÉGRAL (amountToPayee + protocolFee)
     */
    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(cancellable, "Payment not cancellable");
        require(!released, "Already released");
        require(!cancelled, "Already cancelled");
        require(block.timestamp < releaseTime, "Too late to cancel");
        
        cancelled = true;
        
        // Remboursement total (pas de fees si annulé)
        uint256 refundAmount = amountToPayee + protocolFee;
        (bool success, ) = payable(payer).call{value: refundAmount}("");
        require(success, "Refund failed");
        
        emit Cancelled(payer, refundAmount);
    }
    
    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================
    
    /**
     * @notice Obtient les montants du paiement
     */
    function getAmounts() external view returns (
        uint256 _amountToPayee,
        uint256 _protocolFee,
        uint256 _totalLocked
    ) {
        return (
            amountToPayee,
            protocolFee,
            amountToPayee + protocolFee
        );
    }
    
    /**
     * @notice Vérifie le statut complet du paiement
     */
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
    
    /**
     * @notice Obtient toutes les informations du paiement
     */
    function getPaymentDetails() external view returns (
        address _payer,
        address _payee,
        uint256 _amountToPayee,
        uint256 _protocolFee,
        uint256 _totalLocked,
        uint256 _releaseTime,
        bool _released,
        bool _cancelled,
        bool _cancellable
    ) {
        return (
            payer,
            payee,
            amountToPayee,
            protocolFee,
            amountToPayee + protocolFee,
            releaseTime,
            released,
            cancelled,
            cancellable
        );
    }
    
    /**
     * @notice Calcule le temps restant avant release
     */
    function timeUntilRelease() external view returns (uint256) {
        if (block.timestamp >= releaseTime) {
            return 0;
        }
        return releaseTime - block.timestamp;
    }
    
    /**
     * @notice Retourne la balance du contrat
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
