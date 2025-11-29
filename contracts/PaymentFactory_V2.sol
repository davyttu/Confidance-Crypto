// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ScheduledPayment_V2.sol";
import "./ScheduledPaymentERC20.sol";
import "./BatchScheduledPayment_V2.sol";

/**
 * @title PaymentFactory V2
 * @notice Factory unifiée pour créer des paiements programmés
 * @dev Support : Single ETH, Single ERC20, Batch ETH
 *      Nouvelle logique : bénéficiaires reçoivent montants EXACTS
 */
contract PaymentFactory {
    
    // ============================================================
    // CONSTANTS
    // ============================================================
    
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179; // 1.79%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    
    // ============================================================
    // EVENTS
    // ============================================================
    
    event PaymentCreatedETH(
        address indexed payer,
        address indexed payee,
        address paymentContract,
        uint256 releaseTime,
        uint256 amountToPayee,
        uint256 protocolFee,
        uint256 totalSent,
        bool cancellable
    );
    
    event PaymentCreatedERC20(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress,
        address paymentContract,
        uint256 releaseTime,
        uint256 amountToPayee,
        uint256 protocolFee,
        bool cancellable
    );
    
    event BatchPaymentCreatedETH(
        address indexed payer,
        address paymentContract,
        uint256 beneficiariesCount,
        uint256 totalToBeneficiaries,
        uint256 protocolFee,
        uint256 totalSent,
        uint256 releaseTime,
        bool cancellable
    );
    
    // ============================================================
    // SINGLE PAYMENT ETH
    // ============================================================
    
    /**
     * @notice Crée un paiement single ETH
     * @param _payee Bénéficiaire
     * @param _amountToPayee Montant EXACT que le bénéficiaire recevra
     * @param _releaseTime Timestamp de libération
     * @param _cancellable Si annulable
     * @return Adresse du contrat créé
     * 
     * @dev msg.value DOIT être = _amountToPayee + fees
     *      Frontend calcule : totalRequired = amountToPayee * 10179 / 10000
     */
    function createPaymentETH(
        address _payee,
        uint256 _amountToPayee,
        uint256 _releaseTime,
        bool _cancellable
    ) external payable returns (address) {
        require(_amountToPayee > 0, "Amount must be > 0");
        require(_payee != address(0), "Invalid payee");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        
        // Calculer total requis
        uint256 protocolFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = _amountToPayee + protocolFee;
        require(msg.value == totalRequired, "Incorrect amount sent");
        
        // Déployer - ✅ MODIFIÉ : ajout msg.sender
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(
            msg.sender,       // ✅ AJOUTÉ - Le vrai payer (utilisateur)
            _payee,
            _amountToPayee,
            _releaseTime,
            _cancellable
        );
        
        emit PaymentCreatedETH(
            msg.sender,
            _payee,
            address(newPayment),
            _releaseTime,
            _amountToPayee,
            protocolFee,
            msg.value,
            _cancellable
        );
        
        return address(newPayment);
    }
    
    // ============================================================
    // SINGLE PAYMENT ERC20
    // ============================================================
    
    /**
     * @notice Crée un paiement single ERC20
     * @param _payee Bénéficiaire
     * @param _tokenAddress Adresse du token
     * @param _amountToPayee Montant EXACT pour le bénéficiaire
     * @param _releaseTime Timestamp
     * @param _cancellable Si annulable
     * @return Adresse du contrat
     * 
     * @dev Utilisateur doit approuver : amountToPayee + fees
     */
    function createPaymentERC20(
        address _payee,
        address _tokenAddress,
        uint256 _amountToPayee,
        uint256 _releaseTime,
        bool _cancellable
    ) external returns (address) {
        require(_amountToPayee > 0, "Amount must be > 0");
        require(_payee != address(0), "Invalid payee");
        require(_tokenAddress != address(0), "Invalid token");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        
        // Calculer total
        uint256 protocolFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = _amountToPayee + protocolFee;
        
        // Déployer - ✅ MODIFIÉ : ajout msg.sender
        ScheduledPaymentERC20 newPayment = new ScheduledPaymentERC20(
            msg.sender,       // ✅ AJOUTÉ - Le vrai payer
            _payee,
            _tokenAddress,
            totalRequired, // Le contrat gère la répartition
            _releaseTime,
            _cancellable
        );
        
        emit PaymentCreatedERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            address(newPayment),
            _releaseTime,
            _amountToPayee,
            protocolFee,
            _cancellable
        );
        
        return address(newPayment);
    }
    
    // ============================================================
    // BATCH PAYMENT ETH
    // ============================================================
    
    /**
     * @notice Crée un paiement batch (multi-bénéficiaires)
     * @param _payees Liste des bénéficiaires (max 50)
     * @param _amounts Montants EXACTS pour chaque bénéficiaire
     * @param _releaseTime Timestamp
     * @param _cancellable Si annulable
     * @return Adresse du contrat batch
     * 
     * @dev msg.value = somme(_amounts) + fees
     *      Frontend calcule : totalRequired = totalBenef * 10179 / 10000
     */
    function createBatchPaymentETH(
        address[] memory _payees,
        uint256[] memory _amounts,
        uint256 _releaseTime,
        bool _cancellable
    ) external payable returns (address) {
        require(_payees.length > 0, "No payees");
        require(_payees.length <= 50, "Max 50 payees");
        require(_payees.length == _amounts.length, "Length mismatch");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        
        // Calculer total
        uint256 totalToBeneficiaries = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] > 0, "Amount must be > 0");
            require(_payees[i] != address(0), "Invalid payee");
            totalToBeneficiaries += _amounts[i];
        }
        
        uint256 protocolFee = (totalToBeneficiaries * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = totalToBeneficiaries + protocolFee;
        require(msg.value == totalRequired, "Incorrect total sent");
        
        // Déployer - ✅ MODIFIÉ : ajout msg.sender
        BatchScheduledPayment batchPayment = new BatchScheduledPayment{value: msg.value}(
            msg.sender,       // ✅ AJOUTÉ - Le vrai payer
            _payees,
            _amounts,
            _releaseTime,
            _cancellable
        );
        
        emit BatchPaymentCreatedETH(
            msg.sender,
            address(batchPayment),
            _payees.length,
            totalToBeneficiaries,
            protocolFee,
            msg.value,
            _releaseTime,
            _cancellable
        );
        
        return address(batchPayment);
    }
    
    // ============================================================
    // HELPERS
    // ============================================================
    
    /**
     * @notice Calcule le total à envoyer pour un single payment
     * @param amountToPayee Montant pour le bénéficiaire
     * @return protocolFee Fees
     * @return totalRequired Total à envoyer
     */
    function calculateSingleTotal(uint256 amountToPayee) 
        external 
        pure 
        returns (
            uint256 protocolFee,
            uint256 totalRequired
        ) 
    {
        protocolFee = (amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        totalRequired = amountToPayee + protocolFee;
    }
    
    /**
     * @notice Calcule le total pour un batch payment
     * @param amounts Liste des montants pour bénéficiaires
     * @return totalToBeneficiaries Somme des montants
     * @return protocolFee Fees
     * @return totalRequired Total à envoyer
     */
    function calculateBatchTotal(uint256[] memory amounts)
        external
        pure
        returns (
            uint256 totalToBeneficiaries,
            uint256 protocolFee,
            uint256 totalRequired
        )
    {
        for (uint256 i = 0; i < amounts.length; i++) {
            totalToBeneficiaries += amounts[i];
        }
        protocolFee = (totalToBeneficiaries * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        totalRequired = totalToBeneficiaries + protocolFee;
    }
    
    /**
     * @notice Prévisualise les fees
     * @param amount Montant de base
     * @return fee Montant des fees
     */
    function previewFee(uint256 amount) external pure returns (uint256 fee) {
        return (amount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
    }
}
