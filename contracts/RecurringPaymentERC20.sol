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
 *
 *  V2 StrictSkip:
 *   - Conserve le SKIP même pour le premier mois
 *   - Le skip est cohérent grâce à un curseur nextMonthToProcess
 */
contract RecurringPaymentERC20 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    address public immutable protocolOwner;

    modifier onlyProtocol() {
        require(msg.sender == protocolOwner, "Not protocol");
        _;
    }

    // ============================================================
    // STORAGE
    // ============================================================

    address public payer;
    address public payee;
    address public tokenAddress;

    uint256 public monthlyAmount;
    // 0 = même montant que monthlyAmount
    uint256 public firstMonthAmount;
    uint256 public protocolFeePerMonth;
    // fee du premier mois si firstMonthAmount > 0, sinon = protocolFeePerMonth
    uint256 public firstProtocolFee;
    uint256 public startDate;
    uint256 public totalMonths;
    uint256 public dayOfMonth;
    uint256 public executedMonths;

    uint256 public totalPaid;

    bool public cancelled;

    mapping(uint256 => bool) public monthExecuted;

    uint256 public nextMonthToProcess;
    uint256 public feeBps;

    // Constantes
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
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
        uint256 _firstMonthAmount,
        uint256 _startDate,
        uint256 _totalMonths,
        uint256 _dayOfMonth,
        address _protocolOwner,
        uint256 _feeBps
    ) {
        require(_payer != address(0), "Invalid payer");
        require(_payee != address(0), "Invalid payee");
        require(_tokenAddress != address(0), "Invalid token");
        require(_monthlyAmount > 0, "Monthly amount must be > 0");
        require(_startDate > block.timestamp, "Start date must be in future");
        require(_totalMonths >= 1 && _totalMonths <= 12, "Total months must be 1-12");
        require(_dayOfMonth >= 1 && _dayOfMonth <= 28, "Day of month must be 1-28");
        require(_protocolOwner != address(0), "Invalid protocol owner");

        payer = _payer;
        payee = _payee;
        tokenAddress = _tokenAddress;

        require(_feeBps <= BASIS_POINTS_DENOMINATOR, "Invalid fee bps");

        monthlyAmount = _monthlyAmount;
        protocolFeePerMonth =
            (_monthlyAmount * _feeBps) / BASIS_POINTS_DENOMINATOR;

        firstMonthAmount = _firstMonthAmount;
        if (_firstMonthAmount > 0) {
            firstProtocolFee =
                (_firstMonthAmount * _feeBps) / BASIS_POINTS_DENOMINATOR;
        } else {
            firstProtocolFee = protocolFeePerMonth;
        }

        startDate = _startDate;
        totalMonths = _totalMonths;
        dayOfMonth = _dayOfMonth;

        protocolOwner = _protocolOwner;
        feeBps = _feeBps;

        nextMonthToProcess = 0;
        totalPaid = 0;

        emit RecurringPaymentCreated(
            payer,
            payee,
            tokenAddress,
            monthlyAmount,
            protocolFeePerMonth,
            startDate,
            totalMonths,
            dayOfMonth
        );
    }

    // ============================================================
    // CORE EXECUTION (STRICT SKIP)
    // ============================================================

    function executeMonthlyPayment() public nonReentrant {
        require(!cancelled, "Payment cancelled");
        require(block.timestamp >= startDate, "Payment not started yet");
        require(nextMonthToProcess < totalMonths, "All payment periods completed");

        uint256 currentMonthIndex = nextMonthToProcess;
        require(!monthExecuted[currentMonthIndex], "This month already executed");

        uint256 scheduledDate =
            startDate + (currentMonthIndex * SECONDS_PER_MONTH);
        require(block.timestamp >= scheduledDate, "Too early for this payment");

        // Montant & fee (mois 1 peut être différent)
        uint256 amountToPay =
            (currentMonthIndex == 0 && firstMonthAmount > 0)
                ? firstMonthAmount
                : monthlyAmount;

        uint256 feeToPay =
            (currentMonthIndex == 0 && firstMonthAmount > 0)
                ? firstProtocolFee
                : protocolFeePerMonth;

        // ================================
        // ✅ PATCH: PRE-CHECK + REQUIRE
        // ================================
        uint256 totalDebit = amountToPay + feeToPay;

        if (IERC20(tokenAddress).balanceOf(payer) < totalDebit) {
            emit MonthlyPaymentFailed(
                currentMonthIndex + 1,
                payer,
                "Insufficient balance"
            );

            // ❗ Si le mois 1 échoue : arrêt définitif
            if (currentMonthIndex == 0) {
                monthExecuted[currentMonthIndex] = true;
                nextMonthToProcess = currentMonthIndex + 1;
                cancelled = true;
                emit RecurringPaymentCancelled(payer, executedMonths, totalMonths - nextMonthToProcess);
                return;
            }

            // Strict skip conservé
            monthExecuted[currentMonthIndex] = true;
            nextMonthToProcess++;
            return;
        }

        if (IERC20(tokenAddress).allowance(payer, address(this)) < totalDebit) {
            emit MonthlyPaymentFailed(
                currentMonthIndex + 1,
                payer,
                "Insufficient allowance"
            );

            // ❗ Si le mois 1 échoue : arrêt définitif
            if (currentMonthIndex == 0) {
                monthExecuted[currentMonthIndex] = true;
                nextMonthToProcess = currentMonthIndex + 1;
                cancelled = true;
                emit RecurringPaymentCancelled(payer, executedMonths, totalMonths - nextMonthToProcess);
                return;
            }

            // Strict skip conservé
            monthExecuted[currentMonthIndex] = true;
            nextMonthToProcess++;
            return;
        }

        require(
            IERC20(tokenAddress).allowance(payer, address(this)) >= totalDebit,
            "ALLOWANCE_TOO_LOW"
        );
        // ================================

        // ✅ FIX CRITIQUE : Faire les transferts AVANT de marquer le mois comme exécuté
        // Utiliser SafeERC20 pour éviter les échecs silencieux
        // Utiliser une fonction externe helper pour permettre l'utilisation de try/catch
        try this._executeTransfers(payer, payee, amountToPay, feeToPay) {
            // ✅ TOUS les transferts réussis : marquer le mois comme exécuté
            monthExecuted[currentMonthIndex] = true;
            nextMonthToProcess = currentMonthIndex + 1;
            _onSuccess(currentMonthIndex, amountToPay, feeToPay);
        } catch Error(string memory reason) {
            // Transfert échoué : skip strict (le mois est perdu)
            emit MonthlyPaymentFailed(
                currentMonthIndex + 1,
                payer,
                string.concat("Transfer failed: ", reason)
            );

            // ❗ Si le mois 1 échoue : arrêt définitif
            if (currentMonthIndex == 0) {
                monthExecuted[currentMonthIndex] = true;
                nextMonthToProcess = currentMonthIndex + 1;
                cancelled = true;
                emit RecurringPaymentCancelled(payer, executedMonths, totalMonths - nextMonthToProcess);
                return;
            }

            monthExecuted[currentMonthIndex] = true;
            nextMonthToProcess = currentMonthIndex + 1;
        } catch {
            // Transfert échoué (erreur non-string) : skip strict
            emit MonthlyPaymentFailed(
                currentMonthIndex + 1,
                payer,
                "Transfer failed (unknown error)"
            );

            // ❗ Si le mois 1 échoue : arrêt définitif
            if (currentMonthIndex == 0) {
                monthExecuted[currentMonthIndex] = true;
                nextMonthToProcess = currentMonthIndex + 1;
                cancelled = true;
                emit RecurringPaymentCancelled(payer, executedMonths, totalMonths - nextMonthToProcess);
                return;
            }

            monthExecuted[currentMonthIndex] = true;
            nextMonthToProcess = currentMonthIndex + 1;
        }
    }

    // ============================================================
    // INTERNAL HELPERS
    // ============================================================
    
    /**
     * @notice Exécute tous les transferts de manière atomique
     * @dev Cette fonction est external pour être appelée via this._executeTransfers() dans un try/catch
     *      Si un transfert échoue, toute la transaction est revertée dans le try/catch
     *      Cela permet de gérer l'échec avec skip strict au lieu de revert toute la transaction
     */
    function _executeTransfers(
        address _payer,
        address _payee,
        uint256 _monthlyAmount,
        uint256 _protocolFeePerMonth
    ) external {
        // Vérifier que l'appel vient du contrat lui-même
        require(msg.sender == address(this), "Only self");
        
        IERC20 token = IERC20(tokenAddress);
        
        // Transfert vers le bénéficiaire
        token.safeTransferFrom(_payer, _payee, _monthlyAmount);
        
        // Transfert de la fee protocol (si > 0)
        // Si ce transfert échoue, le premier transfert sera aussi reverté car on est dans la même transaction
        if (_protocolFeePerMonth > 0) {
            token.safeTransferFrom(_payer, PROTOCOL_WALLET, _protocolFeePerMonth);
        }
    }

    function _onSuccess(uint256 monthIndex, uint256 amountPaid_, uint256 protocolFeePaid_) internal {
        executedMonths++;
        totalPaid += amountPaid_;

        uint256 nextDate =
            (nextMonthToProcess < totalMonths)
                ? startDate + (nextMonthToProcess * SECONDS_PER_MONTH)
                : 0;

        emit MonthlyPaymentExecuted(
            monthIndex + 1,
            payee,
            amountPaid_,
            protocolFeePaid_,
            nextDate
        );

        if (nextMonthToProcess == totalMonths) {
            emit RecurringPaymentCompleted(
                payee,
                executedMonths,
                totalPaid
            );
        }
    }

    // ============================================================
    // CANCEL
    // ============================================================

    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(!cancelled, "Already cancelled");

        uint256 monthsRemaining =
            nextMonthToProcess < totalMonths
                ? totalMonths - nextMonthToProcess
                : 0;

        require(monthsRemaining > 0, "No remaining payments to cancel");

        cancelled = true;

        emit RecurringPaymentCancelled(
            payer,
            executedMonths,
            monthsRemaining
        );
    }

    // ============================================================
    // VIEW HELPERS
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
        uint256 nextDate = 0;
        bool canExec = false;

        if (!cancelled && nextMonthToProcess < totalMonths) {
            nextDate = startDate + (nextMonthToProcess * SECONDS_PER_MONTH);
            canExec =
                block.timestamp >= nextDate &&
                !monthExecuted[nextMonthToProcess];
        }

        bool completed = cancelled || nextMonthToProcess >= totalMonths;

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

    function calculateTotalRequired(
        uint256 _monthlyAmount,
        uint256 _totalMonths
    )
        external
        view
        returns (
            uint256 protocolFeePerMonth_,
            uint256 totalPerMonth,
            uint256 totalRequired
        )
    {
        protocolFeePerMonth_ =
            (_monthlyAmount * feeBps) /
            BASIS_POINTS_DENOMINATOR;
        totalPerMonth = _monthlyAmount + protocolFeePerMonth_;
        totalRequired = totalPerMonth * _totalMonths;
    }

    function getCurrentAllowance() external view returns (uint256) {
        return IERC20(tokenAddress).allowance(payer, address(this));
    }

    function isAllowanceSufficient()
        external
        view
        returns (bool sufficient, uint256 required, uint256 current)
    {
        uint256 remainingMonths =
            nextMonthToProcess < totalMonths
                ? totalMonths - nextMonthToProcess
                : 0;

        uint256 totalNeeded =
            (monthlyAmount + protocolFeePerMonth) * remainingMonths;
        uint256 currentAllowance =
            IERC20(tokenAddress).allowance(payer, address(this));

        return (currentAllowance >= totalNeeded, totalNeeded, currentAllowance);
    }

    function timeUntilNextPayment() external view returns (uint256) {
        if (cancelled) return 0;
        if (nextMonthToProcess >= totalMonths) return 0;

        uint256 nextDate =
            startDate + (nextMonthToProcess * SECONDS_PER_MONTH);

        if (block.timestamp >= nextDate) return 0;
        return nextDate - block.timestamp;
    }

    function getStatus()
        external
        view
        returns (
            string memory status,
            uint256 monthsExecuted,
            uint256 monthsRemaining,
            uint256 amountPaid,
            uint256 monthsFailed
        )
    {
        if (cancelled) {
            uint256 remaining =
                nextMonthToProcess < totalMonths
                    ? totalMonths - nextMonthToProcess
                    : 0;

            uint256 failed =
                nextMonthToProcess > executedMonths
                    ? nextMonthToProcess - executedMonths
                    : 0;

            return (
                "cancelled",
                executedMonths,
                remaining,
                totalPaid,
                failed
            );
        }

        if (nextMonthToProcess >= totalMonths) {
            uint256 failedAll =
                totalMonths > executedMonths
                    ? totalMonths - executedMonths
                    : 0;

            return (
                "completed",
                executedMonths,
                0,
                totalPaid,
                failedAll
            );
        }

        uint256 remainingActive = totalMonths - nextMonthToProcess;
        uint256 failedActive =
            nextMonthToProcess > executedMonths
                ? nextMonthToProcess - executedMonths
                : 0;

        return (
            "active",
            executedMonths,
            remainingActive,
            totalPaid,
            failedActive
        );
    }

    // ============================================================
    // ADMIN
    // ============================================================

    function adminExecutePayment() external onlyProtocol {
        executeMonthlyPayment();
    }
}
