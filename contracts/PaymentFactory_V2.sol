// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ScheduledPayment_V2.sol";
import "./ScheduledPaymentERC20.sol";
import "./BatchScheduledPayment_V2.sol";
import "./RecurringPaymentERC20.sol";
import "./InstantPayment.sol";
import "./InstantPaymentERC20.sol";

/**
 * @title PaymentFactory V2
 * @notice Factory unifiée pour créer des paiements programmés
 * @dev Support : Single ETH, Single ERC20, Batch ETH, Recurring ERC20
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
    
    event InstantPaymentCreatedETH(
        address indexed payer,
        address indexed payee,
        address paymentContract,
        uint256 amount,
        uint256 timestamp
    );
    
    event InstantPaymentCreatedERC20(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress,
        address paymentContract,
        uint256 amount,
        uint256 timestamp
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
        
        // Déployer
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(
            msg.sender,
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
        
        // Déployer
        ScheduledPaymentERC20 newPayment = new ScheduledPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            totalRequired,
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
        
        // Déployer
        BatchScheduledPayment batchPayment = new BatchScheduledPayment{value: msg.value}(
            msg.sender,
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
        require(_payee != address(0), "Invalid payee");
        require(_tokenAddress != address(0), "Invalid token");
        require(_monthlyAmount > 0, "Monthly amount must be > 0");
        require(_startDate > block.timestamp, "Start date must be in future");
        require(_totalMonths >= 1 && _totalMonths <= 12, "Total months must be 1-12");
        require(_dayOfMonth >= 1 && _dayOfMonth <= 28, "Day of month must be 1-28");

        // Calculer les fees par mois
        uint256 protocolFeePerMonth = (_monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;

        // Déployer le contrat récurrent
        RecurringPaymentERC20 newRecurringPayment = new RecurringPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _monthlyAmount,
            _startDate,
            _totalMonths,
            _dayOfMonth
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
    
    // ============================================================
    // INSTANT PAYMENT ETH
    // ============================================================
    
    /**
     * @notice Crée un paiement instantané ETH (0% fees)
     * @param _payee Bénéficiaire
     * @return Adresse du contrat créé
     * 
     * @dev Le transfert s'exécute immédiatement dans le constructor
     *      Pas de fees, transfert direct au bénéficiaire
     */
    function createInstantPaymentETH(
        address _payee
    ) external payable returns (address) {
        require(_payee != address(0), "Invalid payee");
        require(msg.value > 0, "No funds sent");
        
        InstantPayment newPayment = new InstantPayment{value: msg.value}(
            msg.sender,
            _payee
        );
        
        emit InstantPaymentCreatedETH(
            msg.sender,
            _payee,
            address(newPayment),
            msg.value,
            block.timestamp
        );
        
        return address(newPayment);
    }
    
    // ============================================================
    // INSTANT PAYMENT ERC20
    // ============================================================
    
    /**
     * @notice Crée un paiement instantané ERC20 (USDC/USDT) - 0% fees
     * @param _payee Bénéficiaire
     * @param _tokenAddress Token (USDC/USDT)
     * @param _amount Montant
     * @return Adresse du contrat créé
     * 
     * @dev Le transfert s'exécute immédiatement dans le constructor
     *      L'utilisateur doit avoir approuvé le montant au préalable
     *      Pas de fees, transfert direct au bénéficiaire
     */
    function createInstantPaymentERC20(
        address _payee,
        address _tokenAddress,
        uint256 _amount
    ) external returns (address) {
        require(_payee != address(0), "Invalid payee");
        require(_tokenAddress != address(0), "Invalid token");
        require(_amount > 0, "Amount must be > 0");
        
        InstantPaymentERC20 newPayment = new InstantPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _amount
        );
        
        emit InstantPaymentCreatedERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            address(newPayment),
            _amount,
            block.timestamp
        );
        
        return address(newPayment);
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
     * @notice Calcule le total à approuver pour un paiement récurrent
     * @param monthlyAmount Montant mensuel pour le bénéficiaire
     * @param totalMonths Nombre de mensualités
     * @return protocolFeePerMonth Fees par mois
     * @return totalPerMonth Total par mois (montant + fees)
     * @return totalRequired Total à approuver
     */
    function calculateRecurringTotal(uint256 monthlyAmount, uint256 totalMonths)
        external
        pure
        returns (
            uint256 protocolFeePerMonth,
            uint256 totalPerMonth,
            uint256 totalRequired
        )
    {
        protocolFeePerMonth = (monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        totalPerMonth = monthlyAmount + protocolFeePerMonth;
        totalRequired = totalPerMonth * totalMonths;
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