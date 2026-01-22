// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
    using SafeERC20 for IERC20;
    
    // ============================================================
    // CONSTANTS
    // ============================================================
    
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179; // 1.79%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_MONTH = 30 * 24 * 60 * 60;
    
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
     *      Frontend calcule : totalRequired = amountToPayee * (10000 + feeBps) / 10000
     */
    function createPaymentETH(
        address _payee,
        uint256 _amountToPayee,
        uint256 _releaseTime,
        bool _cancellable
    ) external payable returns (address) {
        require(_amountToPayee > 0);
        require(_payee != address(0));
        require(_releaseTime > block.timestamp);
        
        // Calculer total requis
        uint256 protocolFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = _amountToPayee + protocolFee;
        require(msg.value == totalRequired);
        
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
        require(_amountToPayee > 0);
        require(_payee != address(0));
        require(_tokenAddress != address(0));
        require(_releaseTime > block.timestamp);
        
        // Calculer total
        uint256 protocolFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = _amountToPayee + protocolFee;
        
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
        require(_payees.length > 0);
        require(_payees.length <= 50);
        require(_payees.length == _amounts.length);
        require(_releaseTime > block.timestamp);
        
        // Calculer total
        uint256 totalToBeneficiaries = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] > 0);
            require(_payees[i] != address(0));
            totalToBeneficiaries += _amounts[i];
        }
        
        uint256 protocolFee = (totalToBeneficiaries * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = totalToBeneficiaries + protocolFee;
        require(msg.value == totalRequired);
        
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
        require(_payee != address(0));
        require(_tokenAddress != address(0));
        require(_monthlyAmount > 0);
        require(_startDate > block.timestamp);
        require(_totalMonths >= 1 && _totalMonths <= 12);
        require(_dayOfMonth >= 1 && _dayOfMonth <= 28);

        // Calculer les fees par mois
        uint256 protocolFeePerMonth = (_monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;

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
            FEE_BASIS_POINTS,
            SECONDS_PER_MONTH
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

    function createInstantPaymentETH(
        address _payee
    ) external payable returns (address) {
        require(_payee != address(0));
        require(msg.value > 0);

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

    function createInstantPaymentERC20(
        address _payee,
        address _tokenAddress,
        uint256 _amount
    ) external returns (address) {
        require(_payee != address(0));
        require(_tokenAddress != address(0));
        require(_amount > 0);

        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        InstantPaymentERC20 newPayment = new InstantPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _amount
        );

        IERC20(_tokenAddress).safeTransfer(address(newPayment), _amount);

        newPayment.execute();

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
    // HELPERS (TEMPORAIREMENT DÉSACTIVÉES POUR RÉDUIRE LA TAILLE)
    // ============================================================
    // Ces fonctions peuvent être réintroduites plus tard via un upgrade
    // Le frontend peut calculer les fees lui-même : fee = amount * 179 / 10000
    
    /*
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
    
    function previewFee(uint256 amount) external pure returns (uint256 fee) {
        return (amount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
    }
    */
}