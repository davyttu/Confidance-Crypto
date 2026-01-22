// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RecurringPaymentERC20.sol";

/**
 * @title PaymentFactory_Recurring
 * @notice Factory dédiée AUX paiements récurrents ERC20 (USDC/USDT)
 * @dev
 *  - Single: createRecurringPaymentERC20 (signature identique au front actuel)
 *  - Batch: createBatchRecurringPaymentERC20 (création multiple en une transaction)
 *  - Admin fallback:
 *      - adminExecutePayment(): appelle executeMonthlyPayment() sur un contrat recurring
 *      - adminCancel(): tentative "best-effort" (voir note ci-dessous)
 *
 * NOTE IMPORTANTE (adminCancel):
 *  - Dans RecurringPaymentERC20.sol actuel: cancel() est réservé au payer.
 *  - Donc un adminCancel "force cancel" n'est PAS possible sans modifier/dupliquer le contrat recurring.
 *  - Ici, adminCancel() tente d'appeler adminCancel() (si un jour tu ajoutes cette fonction)
 *    sinon tente cancel(), et retourne true/false sans casser le flow.
 */
contract PaymentFactory_Recurring {
    // ============================================================
    // CONSTANTS (alignés avec tes autres contrats)
    // ============================================================

    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BPS_PARTICULAR = 179; // 1.79%
    uint256 public constant FEE_BPS_PRO = 156; // 1.56%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    // Durée d'un "mois" (prod: 30 days, test: 300s)
    uint256 public secondsPerMonth;

    // ============================================================
    // OWNER (wallet de déploiement)
    // ============================================================

    address public immutable FACTORY_OWNER;
    mapping(address => bool) public isProWallet;

    modifier onlyOwner() {
        require(msg.sender == FACTORY_OWNER, "Not owner");
        _;
    }

    constructor(uint256 _secondsPerMonth) {
        require(_secondsPerMonth > 0, "Invalid secondsPerMonth");
        FACTORY_OWNER = msg.sender;
        secondsPerMonth = _secondsPerMonth;
    }

    event ProWalletUpdated(address indexed wallet, bool isPro);

    function setProWallet(address wallet, bool isPro) external onlyOwner {
        require(wallet != address(0), "Invalid wallet");
        isProWallet[wallet] = isPro;
        emit ProWalletUpdated(wallet, isPro);
    }

    function setProWallets(address[] calldata wallets, bool isPro) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            address wallet = wallets[i];
            require(wallet != address(0), "Invalid wallet");
            isProWallet[wallet] = isPro;
            emit ProWalletUpdated(wallet, isPro);
        }
    }

    function _feeBpsFor(address payer) internal view returns (uint256) {
        return isProWallet[payer] ? FEE_BPS_PRO : FEE_BPS_PARTICULAR;
    }

    // ============================================================
    // EVENTS (repris de ta factory actuelle)
    // ============================================================

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

    event BatchRecurringPaymentCreatedERC20(
        address indexed payer,
        address indexed tokenAddress,
        uint256 count,
        uint256 startDate,
        uint256 totalMonths
    );

    event AdminExecuted(address indexed admin, address indexed paymentContract);
    event AdminCancelAttempt(address indexed admin, address indexed paymentContract, bool success);

    // ============================================================
    // SINGLE RECURRING ERC20 (SIGNATURE IDENTIQUE FRONT)
    // ============================================================

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

        uint256 feeBps = _feeBpsFor(msg.sender);

        // Calculer les fees par mois (utilisé dans l'event)
        uint256 protocolFeePerMonth = (_monthlyAmount * feeBps) / BASIS_POINTS_DENOMINATOR;

        // Déployer le contrat récurrent (le prélèvement mensuel se fait via transferFrom inside)
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
            feeBps,
            secondsPerMonth
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
    // SINGLE RECURRING ERC20 (V2 - FIRST MONTH AMOUNT OPTIONAL)
    // ============================================================

    function createRecurringPaymentERC20_V2(
        address _payee,
        address _tokenAddress,
        uint256 _monthlyAmount,
        uint256 _firstMonthAmount,
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

        // Si = 0 => même montant que monthlyAmount
        if (_firstMonthAmount > 0) {
            require(_firstMonthAmount > 0, "First month amount must be > 0");
        }

        uint256 feeBps = _feeBpsFor(msg.sender);

        // Calculer les fees par mois (utilisé dans l'event)
        uint256 protocolFeePerMonth = (_monthlyAmount * feeBps) / BASIS_POINTS_DENOMINATOR;

        RecurringPaymentERC20 newRecurringPayment = new RecurringPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _monthlyAmount,
            _firstMonthAmount,
            _startDate,
            _totalMonths,
            _dayOfMonth,
            PROTOCOL_WALLET,
            feeBps,
            secondsPerMonth
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
    // BATCH RECURRING ERC20 (création multiple en 1 tx)
    // ============================================================

    function createBatchRecurringPaymentERC20(
        address _tokenAddress,
        address[] calldata _payees,
        uint256[] calldata _monthlyAmounts,
        uint256 _startDate,
        uint256 _totalMonths,
        uint256 _dayOfMonth
    ) external returns (address[] memory) {
        require(_tokenAddress != address(0), "Invalid token");
        require(_payees.length > 0, "No payees");
        require(_payees.length <= 50, "Max 50 payees");
        require(_payees.length == _monthlyAmounts.length, "Length mismatch");
        require(_startDate > block.timestamp, "Start date must be in future");
        require(_totalMonths >= 1 && _totalMonths <= 12, "Total months must be 1-12");
        require(_dayOfMonth >= 1 && _dayOfMonth <= 28, "Day of month must be 1-28");

        address[] memory payments = new address[](_payees.length);

        uint256 feeBps = _feeBpsFor(msg.sender);

        for (uint256 i = 0; i < _payees.length; i++) {
            require(_payees[i] != address(0), "Invalid payee");
            require(_monthlyAmounts[i] > 0, "Monthly amount must be > 0");

            RecurringPaymentERC20 p = new RecurringPaymentERC20(
                msg.sender,
                _payees[i],
                _tokenAddress,
                _monthlyAmounts[i],
                0,
                _startDate,
                _totalMonths,
                _dayOfMonth,
                PROTOCOL_WALLET,
                feeBps,
            secondsPerMonth
            );

            payments[i] = address(p);

            // Event par payment (utile pour indexer côté DB)
            uint256 protocolFeePerMonth = (_monthlyAmounts[i] * feeBps) / BASIS_POINTS_DENOMINATOR;
            emit RecurringPaymentCreatedERC20(
                msg.sender,
                _payees[i],
                _tokenAddress,
                address(p),
                _monthlyAmounts[i],
                protocolFeePerMonth,
                _startDate,
                _totalMonths
            );
        }

        emit BatchRecurringPaymentCreatedERC20(msg.sender, _tokenAddress, _payees.length, _startDate, _totalMonths);

        return payments;
    }

    // ============================================================
    // ADMIN FALLBACK
    // ============================================================

    /**
     * @notice Déclenche manuellement un prélèvement mensuel si le keeper a raté
     * @dev executeMonthlyPayment() est public dans RecurringPaymentERC20, donc ok
     */
    function adminExecutePayment(address paymentContract) external onlyOwner {
        require(paymentContract != address(0), "Invalid payment");

        (bool ok, ) = paymentContract.call(abi.encodeWithSignature("executeMonthlyPayment()"));
        require(ok, "executeMonthlyPayment failed");

        emit AdminExecuted(msg.sender, paymentContract);
    }

    /**
     * @notice Tentative "best-effort" d'annulation (voir note en haut)
     * @return success true si une des deux signatures a réussi
     */
    function adminCancel(address paymentContract) external onlyOwner returns (bool success) {
        require(paymentContract != address(0), "Invalid payment");

        // 1) si un jour tu ajoutes un adminCancel() sur une V2 de RecurringPaymentERC20
        (bool ok1, ) = paymentContract.call(abi.encodeWithSignature("adminCancel()"));
        if (ok1) {
            emit AdminCancelAttempt(msg.sender, paymentContract, true);
            return true;
        }

        // 2) fallback: cancel() (mais dans ton contrat actuel, seul payer peut l'appeler)
        (bool ok2, ) = paymentContract.call(abi.encodeWithSignature("cancel()"));

        emit AdminCancelAttempt(msg.sender, paymentContract, ok2);
        return ok2;
    }

    // ============================================================
    // HELPERS (pour UI / front)
    // ============================================================

    function previewFeePerMonth(uint256 monthlyAmount, address payer) external view returns (uint256) {
        uint256 feeBps = _feeBpsFor(payer);
        return (monthlyAmount * feeBps) / BASIS_POINTS_DENOMINATOR;
    }
}
