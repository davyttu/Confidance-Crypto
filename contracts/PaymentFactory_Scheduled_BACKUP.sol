// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ScheduledPayment_V2.sol";
import "./ScheduledPaymentERC20.sol";
import "./BatchScheduledPayment_V2.sol";
import "./BatchScheduledPaymentERC20.sol";
import "./RecurringPaymentERC20.sol";
import "./PaymentFactoryLib.sol";

/**
 * @title PaymentFactory_Scheduled
 * @notice Factory pour paiements programmés
 */
contract PaymentFactory_Scheduled {
    using SafeERC20 for IERC20;
    using PaymentFactoryLib for uint256;
    
    error InvalidAmount();
    error InvalidAddress();
    error InvalidTime();
    error ArrayMismatch();
    error TooManyPayees();
    
    // ============================================================
    // CONSTANTS
    // ============================================================
    
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179;
    
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
    
    event BatchPaymentCreatedERC20(
        address indexed payer,
        address indexed tokenAddress,
        address paymentContract,
        uint256 beneficiariesCount,
        uint256 totalToBeneficiaries,
        uint256 protocolFee,
        uint256 releaseTime,
        bool cancellable
    );
    
    event RecurringPaymentCreatedERC20(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress,
        address paymentContract,
        uint256 monthlyAmount,
        uint256 protocolFeePerMonth,
        uint256 startDate,
        uint256 totalMonths
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
        if (_amountToPayee == 0 || _payee == address(0) || _releaseTime <= block.timestamp) revert InvalidAmount();
        (uint256 protocolFee, uint256 totalRequired) = PaymentFactoryLib.calculateTotal(_amountToPayee);
        if (msg.value != totalRequired) revert InvalidAmount();
        
        // Déployer
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(
            msg.sender,
            _payee,
            _amountToPayee,
            _releaseTime,
            _cancellable,
            PROTOCOL_WALLET,
            FEE_BASIS_POINTS
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
        if (_amountToPayee == 0 || _payee == address(0) || _tokenAddress == address(0) || _releaseTime <= block.timestamp) revert InvalidAmount();
        (uint256 protocolFee, uint256 totalRequired) = PaymentFactoryLib.calculateTotal(_amountToPayee);
        
        // ✅ ÉTAPE 1 : Factory reçoit les tokens de l'utilisateur
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), totalRequired);
        
        // ✅ ÉTAPE 2 : Créer le contrat (SANS transferFrom dans le constructor)
        ScheduledPaymentERC20 newPayment = new ScheduledPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _amountToPayee,
            _releaseTime,
            _cancellable,
            PROTOCOL_WALLET,
            FEE_BASIS_POINTS
        );
        
        // ✅ ÉTAPE 3 : Factory transfère les tokens au nouveau contrat
        IERC20(_tokenAddress).safeTransfer(address(newPayment), totalRequired);
        
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
        if (_payees.length == 0 || _payees.length > 50) revert TooManyPayees();
        if (_payees.length != _amounts.length) revert ArrayMismatch();
        if (_releaseTime <= block.timestamp) revert InvalidTime();
        
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] == 0 || _payees[i] == address(0)) revert InvalidAmount();
        }
        
        (uint256 totalToBeneficiaries, uint256 protocolFee, uint256 totalRequired) = PaymentFactoryLib.calculateBatchTotal(_amounts);
        if (msg.value != totalRequired) revert InvalidAmount();
        
        // Déployer
        BatchScheduledPayment batchPayment = new BatchScheduledPayment{value: msg.value}(
            msg.sender,
            _payees,
            _amounts,
            _releaseTime,
            _cancellable,
            FEE_BASIS_POINTS
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
    // BATCH PAYMENT ERC20
    // ============================================================
    
    /**
     * @notice Crée un paiement batch ERC20 (multi-bénéficiaires)
     * @param _tokenAddress Adresse du token ERC20
     * @param _payees Liste des bénéficiaires (max 50)
     * @param _amounts Montants EXACTS pour chaque bénéficiaire
     * @param _releaseTime Timestamp
     * @param _cancellable Si annulable
     * @return Adresse du contrat batch
     * 
     * @dev Utilisateur doit approuver : somme(_amounts) + fees
     *      Frontend calcule : totalRequired = totalBenef * 10179 / 10000
     */
    function createBatchPaymentERC20(
        address _tokenAddress,
        address[] memory _payees,
        uint256[] memory _amounts,
        uint256 _releaseTime,
        bool _cancellable
    ) external returns (address) {
        if (_payees.length == 0 || _payees.length > 50) revert TooManyPayees();
        if (_payees.length != _amounts.length) revert ArrayMismatch();
        if (_tokenAddress == address(0) || _releaseTime <= block.timestamp) revert InvalidAddress();
        
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] == 0 || _payees[i] == address(0)) revert InvalidAmount();
        }
        
        (uint256 totalToBeneficiaries, uint256 protocolFee, uint256 totalRequired) = PaymentFactoryLib.calculateBatchTotal(_amounts);
        
        // ✅ ÉTAPE 1 : Factory reçoit les tokens de l'utilisateur
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), totalRequired);
        
        // ✅ ÉTAPE 2 : Créer le contrat (SANS transferFrom dans le constructor)
        BatchScheduledPaymentERC20 batchPayment = new BatchScheduledPaymentERC20(
            msg.sender,
            _tokenAddress,
            _payees,
            _amounts,
            _releaseTime,
            _cancellable,
            PROTOCOL_WALLET,
            FEE_BASIS_POINTS
        );
        
        // ✅ ÉTAPE 3 : Factory transfère les tokens au nouveau contrat
        IERC20(_tokenAddress).safeTransfer(address(batchPayment), totalRequired);
        
        emit BatchPaymentCreatedERC20(
            msg.sender,
            _tokenAddress,
            address(batchPayment),
            _payees.length,
            totalToBeneficiaries,
            protocolFee,
            _releaseTime,
            _cancellable
        );
        
        return address(batchPayment);
    }
    
    // ============================================================
    // RECURRING PAYMENT ERC20 (NOUVEAU)
    // ============================================================
    
    /**
     * @notice Crée un paiement récurrent mensuel en ERC20
     * @param _payee Bénéficiaire
     * @param _tokenAddress Adresse du token (USDT, USDC)
     * @param _monthlyAmount Montant EXACT par mensualité (sans fees)
     * @param _startDate Timestamp de la première échéance
     * @param _totalMonths Nombre de mensualités (1-12)
     * @param _dayOfMonth Jour du mois pour les prélèvements (1-28)
     * @return Adresse du contrat récurrent
     *
     * @dev Utilisateur DOIT avoir approve : (_monthlyAmount + fees) × _totalMonths
     *      Exemple : 1000 USDT/mois × 12 = approve 12,214.8 USDT
     *      ⚠️ Trésorerie NON bloquée, prélèvements mensuels automatiques
     */
    function createRecurringPaymentERC20(
        address _payee,
        address _tokenAddress,
        uint256 _monthlyAmount,
        uint256 _startDate,
        uint256 _totalMonths,
        uint256 _dayOfMonth
    ) external returns (address) {
        if (_payee == address(0) || _tokenAddress == address(0) || _monthlyAmount == 0) revert InvalidAddress();
        if (_startDate <= block.timestamp) revert InvalidTime();
        if (_totalMonths < 1 || _totalMonths > 12 || _dayOfMonth < 1 || _dayOfMonth > 28) revert InvalidAmount();
        uint256 protocolFeePerMonth = PaymentFactoryLib.calculateFee(_monthlyAmount);

        // Déployer le contrat récurrent
        RecurringPaymentERC20 newRecurringPayment = new RecurringPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _monthlyAmount,
            0,
            _startDate,
            _totalMonths,
            _dayOfMonth,
            PROTOCOL_WALLET,
            FEE_BASIS_POINTS
        );
        
        emit RecurringPaymentCreatedERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            address(newRecurringPayment),
            _monthlyAmount,
            protocolFeePerMonth,
            _startDate,
            _totalMonths
        );
        
        return address(newRecurringPayment);
    }

}