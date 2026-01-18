// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BatchScheduledPayment V2
 * @notice Paiement programmé unique pour PLUSIEURS bénéficiaires
 * @dev Nouvelle logique : bénéficiaires reçoivent montants EXACTS, fees additives
 * 
 * Use case : Payroll d'entreprise, distribution airdrop, paiements multiples
 * 
 * Exemple :
 * - msg.value = 1.0179 ETH
 * - Bénéficiaires : [0.5 ETH, 0.3 ETH, 0.2 ETH] = 1.0 ETH total
 * - Fees : 0.0179 ETH (variable)
 * - Chaque bénéficiaire reçoit son montant EXACT
 */
contract BatchScheduledPayment is ReentrancyGuard {
    
    // ============================================================
    // STORAGE
    // ============================================================
    
    address public payer;
    address[] public payees;
    uint256[] public amounts;
    uint256 public releaseTime;
    
    bool public released;
    bool public cancelled;
    bool public cancellable;
    
    // Calculs fees V2
    uint256 public totalToBeneficiaries; // Somme des montants exacts
    uint256 public protocolFee;          // Fees additionnels (variable)
    uint256 public feeBps;
    
    // Constantes
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    
    // ============================================================
    // EVENTS
    // ============================================================
    
    event BatchPaymentCreated(
        address indexed payer,
        uint256 beneficiariesCount,
        uint256 totalToBeneficiaries,
        uint256 protocolFee,
        uint256 releaseTime
    );
    
    event BatchPaymentReleased(
        address indexed executor,
        uint256 beneficiariesPaid,
        uint256 totalPaid,
        uint256 protocolFeeCollected
    );
    
    event BatchPaymentCancelled(
        address indexed payer,
        uint256 refundAmount
    );
    
    // ============================================================
    // CONSTRUCTOR
    // ============================================================
    
    /**
     * @notice Crée un paiement batch programmé
     * @param _payees Liste des adresses bénéficiaires (max 50)
     * @param _amounts Montants EXACTS que chaque bénéficiaire recevra
     * @param _releaseTime Timestamp de libération
     * @param _cancellable Si true, payer peut annuler avant releaseTime
     * 
     * @dev msg.value DOIT être = somme(_amounts) + fees
     *      Formule : msg.value = totalToBeneficiaries * (10000 + feeBps) / 10000
     */
    constructor(
        address _payer,
        address[] memory _payees,
        uint256[] memory _amounts,
        uint256 _releaseTime,
        bool _cancellable,
        uint256 _feeBps
    ) payable {
        // Validations
        require(_payees.length > 0, "No payees");
        require(_payees.length <= 50, "Max 50 payees");
        require(_payees.length == _amounts.length, "Arrays length mismatch");
        require(_payer != address(0), "Invalid payer");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        require(msg.value > 0, "No funds sent");
        
        // Vérifier que tous les montants sont > 0
        uint256 totalBenef = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] > 0, "Amount must be > 0");
            require(_payees[i] != address(0), "Invalid payee address");
            totalBenef += _amounts[i];
        }
        
        require(_feeBps <= BASIS_POINTS_DENOMINATOR, "Invalid fee bps");

        // Calculer les fees (nouvelle logique V2)
        totalToBeneficiaries = totalBenef;
        protocolFee = (totalToBeneficiaries * _feeBps) / BASIS_POINTS_DENOMINATOR;
        uint256 expectedTotal = totalToBeneficiaries + protocolFee;
        
        require(msg.value == expectedTotal, "Incorrect total sent");
        
        // Stocker
        payer = _payer;
        payees = _payees;
        amounts = _amounts;
        releaseTime = _releaseTime;
        cancellable = _cancellable;
        released = false;
        cancelled = false;
        feeBps = _feeBps;
        
        emit BatchPaymentCreated(
            _payer,
            _payees.length,
            totalToBeneficiaries,
            protocolFee,
            _releaseTime
        );
    }
    
    // ============================================================
    // RELEASE
    // ============================================================
    
    /**
     * @notice Libère les fonds à tous les bénéficiaires
     * @dev Peut être appelé par n'importe qui après releaseTime
     *      Chaque bénéficiaire reçoit son montant EXACT
     */
    function release() external nonReentrant {
        require(!released, "Already released");
        require(!cancelled, "Payment cancelled");
        require(block.timestamp >= releaseTime, "Too early");
        
        released = true;
        
        // Transférer à chaque bénéficiaire
        for (uint256 i = 0; i < payees.length; i++) {
            (bool success, ) = payable(payees[i]).call{value: amounts[i]}("");
            require(success, string(abi.encodePacked("Transfer failed to payee ", i)));
        }
        
        // Transférer les fees au protocole
        (bool feeSuccess, ) = PROTOCOL_WALLET.call{value: protocolFee}("");
        require(feeSuccess, "Protocol fee transfer failed");
        
        emit BatchPaymentReleased(
            msg.sender,
            payees.length,
            totalToBeneficiaries,
            protocolFee
        );
    }
    
    // ============================================================
    // CANCEL
    // ============================================================
    
    /**
     * @notice Annule le paiement et rembourse le payer
     * @dev Seulement si cancellable = true et avant releaseTime
     *      Remboursement INTÉGRAL (totalToBeneficiaries + fees)
     */
    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(cancellable, "Not cancellable");
        require(!released, "Already released");
        require(!cancelled, "Already cancelled");
        require(block.timestamp < releaseTime, "Too late to cancel");
        
        cancelled = true;
        
        // Remboursement TOTAL (pas de fees si annulé)
        uint256 refundAmount = totalToBeneficiaries + protocolFee;
        (bool success, ) = payable(payer).call{value: refundAmount}("");
        require(success, "Refund failed");
        
        emit BatchPaymentCancelled(payer, refundAmount);
    }
    
    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================
    
    /**
     * @notice Obtient les détails complets du paiement
     */
    function getPaymentDetails() external view returns (
        address _payer,
        uint256 _beneficiariesCount,
        uint256 _totalToBeneficiaries,
        uint256 _protocolFee,
        uint256 _totalLocked,
        uint256 _releaseTime,
        bool _released,
        bool _cancelled,
        bool _cancellable,
        bool _canBeReleased,
        bool _canBeCancelled
    ) {
        return (
            payer,
            payees.length,
            totalToBeneficiaries,
            protocolFee,
            totalToBeneficiaries + protocolFee,
            releaseTime,
            released,
            cancelled,
            cancellable,
            !released && !cancelled && block.timestamp >= releaseTime,
            cancellable && !released && !cancelled && block.timestamp < releaseTime
        );
    }
    
    /**
     * @notice Liste tous les bénéficiaires et montants
     */
    function getAllPayees() external view returns (
        address[] memory _payees,
        uint256[] memory _amounts
    ) {
        return (payees, amounts);
    }
    
    /**
     * @notice Obtient un bénéficiaire spécifique
     */
    function getPayee(uint256 index) external view returns (
        address payee,
        uint256 amount,
        bool paid
    ) {
        require(index < payees.length, "Index out of bounds");
        return (
            payees[index],
            amounts[index],
            released // Tous payés en même temps
        );
    }
    
    /**
     * @notice Compte de bénéficiaires
     */
    function getPayeesCount() external view returns (uint256) {
        return payees.length;
    }
    
    /**
     * @notice Vérifie si une adresse est bénéficiaire
     */
    function isPayee(address _address) external view returns (bool) {
        for (uint256 i = 0; i < payees.length; i++) {
            if (payees[i] == _address) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @notice Statut complet du paiement
     */
    function getStatus() external view returns (
        string memory status,
        uint256 timeUntilRelease,
        bool canExecute,
        bool canCancel
    ) {
        if (cancelled) {
            return ("cancelled", 0, false, false);
        }
        if (released) {
            return ("released", 0, false, false);
        }
        
        if (block.timestamp >= releaseTime) {
            return ("ready", 0, true, false);
        }
        
        uint256 timeLeft = releaseTime - block.timestamp;
        bool canCancelNow = cancellable && block.timestamp < releaseTime;
        
        return ("pending", timeLeft, false, canCancelNow);
    }
}