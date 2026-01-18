// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./ScheduledPayment_V2.sol";
import "./ScheduledPaymentERC20.sol";
import "./BatchScheduledPayment_V2.sol";
import "./BatchScheduledPaymentERC20.sol";

/**
 * @title PaymentFactory V2 (SCHEDULED ONLY)
 * @notice Factory pour créer des paiements programmés (SANS récurrents)
 * @dev Support : Single ETH, Single ERC20, Batch ETH, Batch ERC20
 *      Nouvelle logique : bénéficiaires reçoivent montants EXACTS
 */
contract PaymentFactory_Scheduled {
    using SafeERC20 for IERC20;

    // ============================================================
    // CONSTANTS
    // ============================================================

    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BPS_PARTICULAR = 179; // 1.79%
    uint256 public constant FEE_BPS_PRO = 156; // 1.56%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    // ============================================================
    // OWNER + PRO ALLOWLIST
    // ============================================================

    address public immutable FACTORY_OWNER;
    mapping(address => bool) public isProWallet;

    event ProWalletUpdated(address indexed wallet, bool isPro);

    modifier onlyOwner() {
        require(msg.sender == FACTORY_OWNER, "Not owner");
        _;
    }

    constructor() {
        FACTORY_OWNER = msg.sender;
    }

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
        address paymentContract,
        address indexed tokenAddress,
        uint256 beneficiariesCount,
        uint256 totalToBeneficiaries,
        uint256 protocolFee,
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
     *      Frontend calcule : totalRequired = amountToPayee * (10000 + feeBps) / 10000
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

        uint256 feeBps = _feeBpsFor(msg.sender);

        // Calculer total requis
        uint256 protocolFee = (_amountToPayee * feeBps) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = _amountToPayee + protocolFee;
        require(msg.value == totalRequired, "Incorrect amount sent");

        // Déployer
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(
            msg.sender,
            _payee,
            _amountToPayee,
            _releaseTime,
            _cancellable,
            PROTOCOL_WALLET,
            feeBps
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

        uint256 feeBps = _feeBpsFor(msg.sender);

        // Calculer total
        uint256 protocolFee = (_amountToPayee * feeBps) / BASIS_POINTS_DENOMINATOR;
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
            feeBps
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
     *      Frontend calcule : totalRequired = totalBenef * (10000 + feeBps) / 10000
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

        uint256 feeBps = _feeBpsFor(msg.sender);

        // Calculer total
        uint256 totalToBeneficiaries = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] > 0, "Amount must be > 0");
            require(_payees[i] != address(0), "Invalid payee");
            totalToBeneficiaries += _amounts[i];
        }

        uint256 protocolFee = (totalToBeneficiaries * feeBps) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = totalToBeneficiaries + protocolFee;
        require(msg.value == totalRequired, "Incorrect total sent");

        // Déployer
        BatchScheduledPayment batchPayment = new BatchScheduledPayment{value: msg.value}(
            msg.sender,
            _payees,
            _amounts,
            _releaseTime,
            _cancellable,
            feeBps
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
    // BATCH PAYMENT ERC20  ✅ (AJOUT)
    // ============================================================

    /**
     * @notice Crée un paiement batch ERC20 (multi-bénéficiaires) via BatchScheduledPaymentERC20
     * @param _tokenAddress Adresse du token (USDC/USDT)
     * @param _payees Liste des bénéficiaires (max 50)
     * @param _amounts Montants EXACTS pour chaque bénéficiaire
     * @param _releaseTime Timestamp
     * @param _cancellable Si annulable
     * @return Adresse du contrat batch ERC20
     *
     * @dev Utilisateur doit approuver : somme(_amounts) + fees
     *      Workflow factory-intermediary identique aux contrats ERC20 V2
     */
    function createBatchPaymentERC20(
        address _tokenAddress,
        address[] memory _payees,
        uint256[] memory _amounts,
        uint256 _releaseTime,
        bool _cancellable
    ) external returns (address) {
        require(_tokenAddress != address(0), "Invalid token");
        require(_payees.length > 0, "No payees");
        require(_payees.length <= 50, "Max 50 payees");
        require(_payees.length == _amounts.length, "Length mismatch");
        require(_releaseTime > block.timestamp, "Release time must be in future");

        uint256 feeBps = _feeBpsFor(msg.sender);

        uint256 totalToBeneficiaries = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] > 0, "Amount must be > 0");
            require(_payees[i] != address(0), "Invalid payee");
            totalToBeneficiaries += _amounts[i];
        }

        uint256 protocolFee = (totalToBeneficiaries * feeBps) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = totalToBeneficiaries + protocolFee;

        // ✅ 1) Factory reçoit les tokens
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), totalRequired);

        // ✅ 2) Déployer le contrat batch ERC20 (tokens transférés APRES)
        BatchScheduledPaymentERC20 batchPayment = new BatchScheduledPaymentERC20(
            msg.sender,
            _tokenAddress,
            _payees,
            _amounts,
            _releaseTime,
            _cancellable,
            PROTOCOL_WALLET,
            feeBps
        );

        // ✅ 3) Factory transfère les tokens au contrat batch
        IERC20(_tokenAddress).safeTransfer(address(batchPayment), totalRequired);

        emit BatchPaymentCreatedERC20(
            msg.sender,
            address(batchPayment),
            _tokenAddress,
            _payees.length,
            totalToBeneficiaries,
            protocolFee,
            _releaseTime,
            _cancellable
        );

        return address(batchPayment);
    }

    // ============================================================
    // HELPERS (TEMPORAIREMENT DÉSACTIVÉES POUR RÉDUIRE LA TAILLE)
    // ============================================================
    // Ces fonctions peuvent être réintroduites plus tard via un upgrade
    // Le frontend peut calculer les fees : fee = amount * feeBps / 10000
}
