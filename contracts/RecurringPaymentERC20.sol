// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RecurringPaymentERC20
 * @notice Paiements mensuels récurrents en tokens ERC20 (USDT, USDC)
 * @dev L'utilisateur approve le montant total, le contrat prélève chaque mois
 *      ✅ Trésorerie NON bloquée entre les paiements
 *      ✅ Annulation possible (mensualités futures non prélevées)
 *      ✅ Skip automatique si un prélèvement échoue
 */
contract RecurringPaymentERC20 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============================================================
    // STORAGE
    // ============================================================
    
    address public payer;
    address public payee;
    address public tokenAddress;

    uint256 public monthlyAmount;        // Montant EXACT par mensualité pour le bénéficiaire
    uint256 public protocolFeePerMonth;  // 1.79% par mensualité
    uint256 public startDate;            // Timestamp première échéance
    uint256 public totalMonths;          // Nombre de mensualités (1-12)
    uint256 public dayOfMonth;           // Jour du mois pour les prélèvements (1-28)
    uint256 public executedMonths;       // Nombre de mois RÉELLEMENT payés

    bool public cancelled;
    
    // 🆕 Mapping pour tracker les mois exécutés (éviter double exécution)
    mapping(uint256 => bool) public monthExecuted;
    
    // Constantes
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179; // 1.79%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_MONTH = 30 days;
    
    // ============================================================
    // EVENTS
    // ============================================================
    
    event RecurringPaymentCreated(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress,
        uint256 monthlyAmount,
        uint256 protocolFeePerMonth,
        uint256 startDate,
        uint256 totalMonths,
        uint256 dayOfMonth
    );
    
    event MonthlyPaymentExecuted(
        uint256 indexed monthNumber,
        address indexed payee,
        uint256 amount,
        uint256 protocolFee,
        uint256 nextPaymentDate
    );
    
    event MonthlyPaymentFailed(
        uint256 indexed monthNumber,
        address indexed payer,
        string reason
    );
    
    event RecurringPaymentCancelled(
        address indexed payer,
        uint256 monthsExecuted,
        uint256 monthsRemaining
    );
    
    event RecurringPaymentCompleted(
        address indexed payee,
        uint256 monthsExecuted,
        uint256 totalPaid
    );
    
    // ============================================================
    // CONSTRUCTOR
    // ============================================================
    
    constructor(
        address _payer,
        address _payee,
        address _tokenAddress,
        uint256 _monthlyAmount,
        uint256 _startDate,
        uint256 _totalMonths,
        uint256 _dayOfMonth
    ) {
        require(_payer != address(0), "Invalid payer");
        require(_payee != address(0), "Invalid payee");
        require(_tokenAddress != address(0), "Invalid token");
        require(_monthlyAmount > 0, "Monthly amount must be > 0");
        require(_startDate > block.timestamp, "Start date must be in future");
        require(_totalMonths >= 1 && _totalMonths <= 12, "Total months must be 1-12");
        require(_dayOfMonth >= 1 && _dayOfMonth <= 28, "Day of month must be 1-28");
        
        // Calculer les fees (utilisé dans l'event)
        uint256 feePerMonth = (_monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        
        // ⚠️ NOTE IMPORTANTE : Pas de vérification d'allowance ici car :
        // 1. L'approve est fait pour la PaymentFactory (qui déploie ce contrat)
        // 2. Ce contrat RecurringPaymentERC20 a une adresse DIFFÉRENTE de la Factory
        // 3. L'allowance sera vérifiée AUTOMATIQUEMENT lors de chaque executeMonthlyPayment()
        //    via transferFrom() qui inclut cette vérification dans le standard ERC20
        // 4. Cette architecture "approve-once, deduct-monthly" garde la trésorerie disponible
        
        payer = _payer;
        payee = _payee;
        tokenAddress = _tokenAddress;
        monthlyAmount = _monthlyAmount;
        protocolFeePerMonth = feePerMonth;
        startDate = _startDate;
        totalMonths = _totalMonths;
        dayOfMonth = _dayOfMonth;
        executedMonths = 0;
        cancelled = false;

        emit RecurringPaymentCreated(
            _payer,
            _payee,
            _tokenAddress,
            _monthlyAmount,
            feePerMonth,
            _startDate,
            _totalMonths,
            _dayOfMonth
        );
    }
    
    // ============================================================
    // EXECUTE MONTHLY PAYMENT (OPTION 2 : SKIP AUTOMATIQUE)
    // ============================================================
    
    /**
     * @notice Exécute la mensualité du mois en cours
     * @dev 🆕 SKIP AUTOMATIQUE : Si un mois échoue, on passe au suivant
     */
    function executeMonthlyPayment() external nonReentrant {
        require(!cancelled, "Payment cancelled");
        
        // 🆕 Calculer quel mois on DEVRAIT être (indépendamment des échecs)
        require(block.timestamp >= startDate, "Payment not started yet");
        uint256 monthsSinceStart = (block.timestamp - startDate) / SECONDS_PER_MONTH;
        uint256 currentMonthIndex = monthsSinceStart; // 0-indexed
        
        require(currentMonthIndex < totalMonths, "All payment periods completed");
        require(!monthExecuted[currentMonthIndex], "This month already executed");
        
        // Marquer le mois comme exécuté (même si échec, on skip)
        monthExecuted[currentMonthIndex] = true;
        
        // Tenter le prélèvement
        try IERC20(tokenAddress).transferFrom(payer, payee, monthlyAmount) {
            // Succès du transfert au bénéficiaire
            try IERC20(tokenAddress).transferFrom(payer, PROTOCOL_WALLET, protocolFeePerMonth) {
                // Succès du transfert des fees
                executedMonths++;
                
                uint256 nextDate = currentMonthIndex + 1 < totalMonths 
                    ? startDate + ((currentMonthIndex + 1) * SECONDS_PER_MONTH) 
                    : 0;
                
                emit MonthlyPaymentExecuted(
                    currentMonthIndex + 1, // 1-indexed pour l'affichage
                    payee,
                    monthlyAmount,
                    protocolFeePerMonth,
                    nextDate
                );
                
                // Si toutes les périodes sont terminées
                if (currentMonthIndex + 1 == totalMonths) {
                    emit RecurringPaymentCompleted(
                        payee,
                        executedMonths,
                        monthlyAmount * executedMonths
                    );
                }
            } catch {
                // Échec du transfert des fees (rare, mais possible)
                emit MonthlyPaymentFailed(
                    currentMonthIndex + 1,
                    payer,
                    "Protocol fee transfer failed"
                );
            }
        } catch Error(string memory reason) {
            // Échec du transfert (balance insuffisante, etc.)
            emit MonthlyPaymentFailed(
                currentMonthIndex + 1,
                payer,
                reason
            );
        } catch {
            // Échec générique
            emit MonthlyPaymentFailed(
                currentMonthIndex + 1,
                payer,
                "Transfer failed"
            );
        }
        
        // 🆕 On continue quand même, le mois est marqué comme traité
        // Le keeper passera au mois suivant automatiquement
    }
    
    // ============================================================
    // CANCEL
    // ============================================================
    
    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(!cancelled, "Already cancelled");
        
        // 🆕 Calculer combien de mois il reste
        uint256 monthsSinceStart = block.timestamp >= startDate 
            ? (block.timestamp - startDate) / SECONDS_PER_MONTH 
            : 0;
        uint256 monthsRemaining = monthsSinceStart < totalMonths 
            ? totalMonths - monthsSinceStart 
            : 0;
        
        require(monthsRemaining > 0, "No remaining payments to cancel");
        
        cancelled = true;
        
        emit RecurringPaymentCancelled(payer, executedMonths, monthsRemaining);
    }
    
    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================
    
    function getPaymentDetails() external view returns (
        address _payer,
        address _payee,
        address _tokenAddress,
        uint256 _monthlyAmount,
        uint256 _protocolFeePerMonth,
        uint256 _startDate,
        uint256 _totalMonths,
        uint256 _dayOfMonth,
        uint256 _executedMonths,
        bool _cancelled,
        uint256 _nextPaymentDate,
        bool _canExecute,
        bool _isCompleted
    ) {
        uint256 monthsSinceStart = block.timestamp >= startDate 
            ? (block.timestamp - startDate) / SECONDS_PER_MONTH 
            : 0;
        
        uint256 currentMonthIndex = monthsSinceStart;
        uint256 nextDate = 0;
        bool canExec = false;
        
        if (!cancelled && currentMonthIndex < totalMonths) {
            nextDate = startDate + (currentMonthIndex * SECONDS_PER_MONTH);
            canExec = block.timestamp >= nextDate && !monthExecuted[currentMonthIndex];
        }
        
        bool completed = cancelled || currentMonthIndex >= totalMonths;

        return (
            payer,
            payee,
            tokenAddress,
            monthlyAmount,
            protocolFeePerMonth,
            startDate,
            totalMonths,
            dayOfMonth,
            executedMonths,
            cancelled,
            nextDate,
            canExec,
            completed
        );
    }
    
    function calculateTotalRequired(uint256 _monthlyAmount, uint256 _totalMonths) 
        external 
        pure 
        returns (
            uint256 protocolFeePerMonth,
            uint256 totalPerMonth,
            uint256 totalRequired
        ) 
    {
        protocolFeePerMonth = (_monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        totalPerMonth = _monthlyAmount + protocolFeePerMonth;
        totalRequired = totalPerMonth * _totalMonths;
    }
    
    function getCurrentAllowance() external view returns (uint256) {
        return IERC20(tokenAddress).allowance(payer, address(this));
    }
    
    function isAllowanceSufficient() external view returns (bool sufficient, uint256 required, uint256 current) {
        uint256 monthsSinceStart = block.timestamp >= startDate 
            ? (block.timestamp - startDate) / SECONDS_PER_MONTH 
            : 0;
        uint256 remainingMonths = monthsSinceStart < totalMonths 
            ? totalMonths - monthsSinceStart 
            : 0;
        uint256 totalNeeded = (monthlyAmount + protocolFeePerMonth) * remainingMonths;
        uint256 currentAllowance = IERC20(tokenAddress).allowance(payer, address(this));
        
        return (currentAllowance >= totalNeeded, totalNeeded, currentAllowance);
    }
    
    function timeUntilNextPayment() external view returns (uint256) {
        if (cancelled) return 0;
        
        uint256 monthsSinceStart = block.timestamp >= startDate 
            ? (block.timestamp - startDate) / SECONDS_PER_MONTH 
            : 0;
        
        if (monthsSinceStart >= totalMonths) return 0;
        
        uint256 nextDate = startDate + (monthsSinceStart * SECONDS_PER_MONTH);
        
        if (block.timestamp >= nextDate) return 0;
        
        return nextDate - block.timestamp;
    }
    
    function getStatus() external view returns (
        string memory status,
        uint256 monthsExecuted,
        uint256 monthsRemaining,
        uint256 amountPaid,
        uint256 monthsFailed
    ) {
        uint256 monthsSinceStart = block.timestamp >= startDate 
            ? (block.timestamp - startDate) / SECONDS_PER_MONTH 
            : 0;
        
        if (cancelled) {
            uint256 remaining = monthsSinceStart < totalMonths 
                ? totalMonths - monthsSinceStart 
                : 0;
            return (
                "cancelled",
                executedMonths,
                remaining,
                monthlyAmount * executedMonths,
                monthsSinceStart - executedMonths // Mois échoués
            );
        }
        
        if (monthsSinceStart >= totalMonths) {
            return (
                "completed",
                executedMonths,
                0,
                monthlyAmount * executedMonths,
                totalMonths - executedMonths // Mois échoués
            );
        }
        
        uint256 remaining = totalMonths - monthsSinceStart;
        return (
            "active",
            executedMonths,
            remaining,
            monthlyAmount * executedMonths,
            monthsSinceStart - executedMonths // Mois échoués
        );
    }
}
