// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RecurringPaymentETH
 * @notice Paiements mensuels récurrents en ETH (pré-funding)
 * @dev Contrairement à l'ERC20 (transferFrom), l'ETH nécessite de bloquer la trésorerie
 *      ✅ Trésorerie bloquée (pré-funding total)
 *      ✅ Annulation possible -> remboursement du restant au payer
 *      ✅ Exécution mensuelle via keeper : executeMonthlyPayment()
 */
contract RecurringPaymentETH is ReentrancyGuard {
    // ============================================================
    // CONSTANTS
    // ============================================================

    uint256 public constant SECONDS_PER_MONTH = 30 days;

    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179; // 1.79%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    // ============================================================
    // STORAGE
    // ============================================================

    address public payer;
    address public payee;

    uint256 public monthlyAmount;           // Montant EXACT / mois pour le bénéficiaire
    uint256 public protocolFeePerMonth;     // Fee / mois
    uint256 public startDate;               // Timestamp de début (doit être > now)
    uint256 public totalMonths;             // 1..12
    uint256 public dayOfMonth;              // 1..28 (stocké pour cohérence UI)
    uint256 public executedMonths;
    bool public cancelled;

    address public immutable protocolOwner;

    mapping(uint256 => bool) public monthExecuted; // 0-indexed

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyPayer() {
        require(msg.sender == payer, "Only payer");
        _;
    }

    modifier onlyProtocolOwner() {
        require(msg.sender == protocolOwner, "Only protocol owner");
        _;
    }

    // ============================================================
    // EVENTS (mêmes noms / style que ERC20 pour cohérence)
    // ============================================================

    event RecurringPaymentCreated(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress, // pour ETH : address(0)
        uint256 monthlyAmount,
        uint256 protocolFeePerMonth,
        uint256 startDate,
        uint256 totalMonths,
        uint256 dayOfMonth
    );

    event MonthlyPaymentExecuted(
        uint256 indexed monthNumber, // 1-indexed
        address indexed payee,
        uint256 amount,
        uint256 protocolFee,
        uint256 nextDate
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
        uint256 _monthlyAmount,
        uint256 _startDate,
        uint256 _totalMonths,
        uint256 _dayOfMonth,
        address _protocolOwner
    ) payable {
        require(_payer != address(0), "Invalid payer");
        require(_payee != address(0), "Invalid payee");
        require(_monthlyAmount > 0, "Monthly amount must be > 0");
        require(_startDate > block.timestamp, "Start date must be in future");
        require(_totalMonths >= 1 && _totalMonths <= 12, "Total months must be 1-12");
        require(_dayOfMonth >= 1 && _dayOfMonth <= 28, "Day of month must be 1-28");
        require(_protocolOwner != address(0), "Invalid protocol owner");

        uint256 feePerMonth = (_monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalPerMonth = _monthlyAmount + feePerMonth;
        uint256 totalRequired = totalPerMonth * _totalMonths;

        require(msg.value == totalRequired, "Incorrect ETH sent");

        payer = _payer;
        payee = _payee;
        monthlyAmount = _monthlyAmount;
        protocolFeePerMonth = feePerMonth;
        startDate = _startDate;
        totalMonths = _totalMonths;
        dayOfMonth = _dayOfMonth;
        protocolOwner = _protocolOwner;

        emit RecurringPaymentCreated(
            _payer,
            _payee,
            address(0),
            _monthlyAmount,
            feePerMonth,
            _startDate,
            _totalMonths,
            _dayOfMonth
        );
    }

    // ============================================================
    // CORE
    // ============================================================

    function executeMonthlyPayment() public nonReentrant {
        require(!cancelled, "Payment cancelled");
        require(block.timestamp >= startDate, "Payment not started yet");

        uint256 monthsSinceStart = (block.timestamp - startDate) / SECONDS_PER_MONTH;
        uint256 currentMonthIndex = monthsSinceStart; // 0-indexed

        require(currentMonthIndex < totalMonths, "All payment periods completed");
        require(!monthExecuted[currentMonthIndex], "This month already executed");

        // Vérifier solde (devrait toujours être OK avec pré-funding)
        uint256 requiredForThisMonth = monthlyAmount + protocolFeePerMonth;
        require(address(this).balance >= requiredForThisMonth, "Insufficient contract balance");

        // Exécuter transfert bénéficiaire
        (bool okPayee, ) = payable(payee).call{value: monthlyAmount}("");
        if (!okPayee) {
            emit MonthlyPaymentFailed(currentMonthIndex + 1, payer, "Payee transfer failed");
            return; // on NE marque PAS exécuté -> keeper/admin peut retenter
        }

        // Exécuter fee
        (bool okFee, ) = payable(PROTOCOL_WALLET).call{value: protocolFeePerMonth}("");
        if (!okFee) {
            // rollback "propre" impossible après transfert payee,
            // mais ce cas est extrêmement rare (PROTOCOL_WALLET EOA).
            emit MonthlyPaymentFailed(currentMonthIndex + 1, payer, "Protocol fee transfer failed");
            // on marque quand même exécuté pour ne pas bloquer le flux
            monthExecuted[currentMonthIndex] = true;
            executedMonths++;
            return;
        }

        // Succès complet
        monthExecuted[currentMonthIndex] = true;
        executedMonths++;

        uint256 nextDate = (currentMonthIndex + 1 < totalMonths)
            ? startDate + ((currentMonthIndex + 1) * SECONDS_PER_MONTH)
            : 0;

        emit MonthlyPaymentExecuted(
            currentMonthIndex + 1,
            payee,
            monthlyAmount,
            protocolFeePerMonth,
            nextDate
        );

        if (currentMonthIndex + 1 == totalMonths) {
            emit RecurringPaymentCompleted(payee, executedMonths, monthlyAmount * executedMonths);
        }
    }

    // ============================================================
    // CANCEL
    // ============================================================

    function cancel() external nonReentrant onlyPayer {
        require(!cancelled, "Already cancelled");
        cancelled = true;

        uint256 monthsRemaining = totalMonths - executedMonths;

        emit RecurringPaymentCancelled(payer, executedMonths, monthsRemaining);

        // Rembourse le restant au payer
        uint256 refund = address(this).balance;
        if (refund > 0) {
            (bool ok, ) = payable(payer).call{value: refund}("");
            require(ok, "Refund failed");
        }
    }

    // ============================================================
    // VIEW HELPERS (compat / debug)
    // ============================================================

    function getPaymentDetails()
        external
        view
        returns (
            address _payer,
            address _payee,
            uint256 _monthlyAmount,
            uint256 _protocolFeePerMonth,
            uint256 _startDate,
            uint256 _totalMonths,
            uint256 _dayOfMonth,
            uint256 _executedMonths,
            bool _cancelled
        )
    {
        return (
            payer,
            payee,
            monthlyAmount,
            protocolFeePerMonth,
            startDate,
            totalMonths,
            dayOfMonth,
            executedMonths,
            cancelled
        );
    }

    function calculateTotalRequired(uint256 _monthlyAmount, uint256 _totalMonths)
        external
        pure
        returns (uint256 protocolFeePerMonthOut, uint256 totalPerMonth, uint256 totalRequired)
    {
        protocolFeePerMonthOut = (_monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        totalPerMonth = _monthlyAmount + protocolFeePerMonthOut;
        totalRequired = totalPerMonth * _totalMonths;
    }

    function timeUntilNextPayment() external view returns (uint256) {
        if (cancelled) return 0;
        if (block.timestamp < startDate) return startDate - block.timestamp;

        uint256 monthsSinceStart = (block.timestamp - startDate) / SECONDS_PER_MONTH;
        if (monthsSinceStart >= totalMonths) return 0;

        uint256 nextDate = startDate + (monthsSinceStart * SECONDS_PER_MONTH);
        if (block.timestamp >= nextDate) return 0;

        return nextDate - block.timestamp;
    }

    function getStatus()
        external
        view
        returns (
            bool isCancelled,
            bool isCompleted,
            uint256 monthsDone,
            uint256 monthsTotal
        )
    {
        isCancelled = cancelled;
        isCompleted = (executedMonths >= totalMonths);
        monthsDone = executedMonths;
        monthsTotal = totalMonths;
    }

    // ============================================================
    // ADMIN FALLBACK (keeper secours)
    // ============================================================

    function adminExecutePayment() external onlyProtocolOwner {
        executeMonthlyPayment();
    }

    receive() external payable {}
}
