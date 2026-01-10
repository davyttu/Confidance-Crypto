// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ScheduledPaymentERC20 V2 - FIXED
 * @notice Paiement programmé ERC20 avec logique V2 (fees additives)
 * @dev Bénéficiaire reçoit montant EXACT, fees séparés
 * 
 * 🔧 FIX : Suppression de la vérification balanceOf dans constructor
 * 
 * WORKFLOW FACTORY-INTERMEDIARY:
 * 1. Factory: transferFrom(user → factory, totalRequired)
 * 2. Factory: new ScheduledPaymentERC20(...) ← Constructor s'exécute
 * 3. Factory: transfer(factory → contract, totalRequired)
 * 
 * ⚠️ Le constructor NE DOIT PAS vérifier balanceOf car les tokens
 *    arrivent APRÈS sa création (étape 3)
 */
contract ScheduledPaymentERC20 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    address public immutable protocolOwner;

    // ============================================================
    // STORAGE
    // ============================================================

    address public payer;
    address public payee;
    address public tokenAddress;
    uint256 public amountToPayee;    // Montant EXACT pour bénéficiaire
    uint256 public protocolFee;       // Fees (1.79%)
    uint256 public releaseTime;
    
    bool public released;
    bool public cancelled;
    bool public cancellable;

    // Constantes
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179; // 1.79%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    // ============================================================
    // EVENTS
    // ============================================================

    event PaymentCreated(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress,
        uint256 amountToPayee,
        uint256 protocolFee,
        uint256 releaseTime
    );

    event Released(
        address indexed payee, 
        uint256 amountToPayee, 
        uint256 protocolFee
    );
    
    event Cancelled(
        address indexed payer, 
        uint256 refundAmount
    );

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    /**
     * @notice Crée un paiement ERC20 programmé
     * @param _payer Adresse de celui qui crée le paiement
     * @param _payee Bénéficiaire
     * @param _tokenAddress Adresse du token ERC20
     * @param _amountToPayee Montant EXACT que le bénéficiaire recevra
     * @param _releaseTime Timestamp de libération
     * @param _cancellable Si annulable
     * 
     * @dev Pattern Factory-Intermediary :
     *      - Factory reçoit tokens AVANT création (étape 1)
     *      - Constructor s'exécute SANS les tokens (étape 2)
     *      - Factory transfère tokens APRÈS création (étape 3)
     *      
     *      ❌ NE PAS vérifier balanceOf ici, tokens arrivent après !
     */
    constructor(
        address _payer,
        address _payee,
        address _tokenAddress,
        uint256 _amountToPayee,
        uint256 _releaseTime,
        bool _cancellable,
        address _protocolOwner
    ) {
        require(_payee != address(0), "Invalid payee");
        require(_payer != address(0), "Invalid payer");
        require(_tokenAddress != address(0), "Invalid token");
        require(_amountToPayee > 0, "Amount must be > 0");
        require(_releaseTime > block.timestamp, "Release time must be in future");

        // Calculer les fees
        uint256 calculatedFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;

        // Stocker
        payer = _payer;
        payee = _payee;
        tokenAddress = _tokenAddress;
        amountToPayee = _amountToPayee;
        protocolFee = calculatedFee;
        releaseTime = _releaseTime;
        cancellable = _cancellable;
        released = false;
        cancelled = false;
        protocolOwner = _protocolOwner;

        // ✅ FIX : SUPPRIMÉ la vérification balanceOf
        // Ancienne version (BUGGÉE) :
        // uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        // require(balance >= totalRequired, "Insufficient tokens received");
        //
        // Problème : balance = 0 à ce moment car Factory transfère APRÈS
        // Les tokens arrivent via Factory.safeTransfer() après new ScheduledPaymentERC20()

        emit PaymentCreated(
            _payer,
            _payee,
            _tokenAddress,
            _amountToPayee,
            calculatedFee,
            _releaseTime
        );
    }

    // ============================================================
    // RELEASE
    // ============================================================

    /**
     * @notice Libère les fonds au bénéficiaire
     * @dev Peut être appelé par n'importe qui après releaseTime
     */
    function release() external nonReentrant {
        _release();
    }
    
    /**
     * @notice Fonction interne pour libérer les fonds
     * @dev Utilisée par release() et adminExecutePayment()
     */
    function _release() internal {
        require(!released, "Already released");
        require(!cancelled, "Payment cancelled");
        require(block.timestamp >= releaseTime, "Too early");

        released = true;

        // Transférer au bénéficiaire (montant exact)
        IERC20(tokenAddress).safeTransfer(payee, amountToPayee);

        // Transférer les fees au protocole
        IERC20(tokenAddress).safeTransfer(PROTOCOL_WALLET, protocolFee);

        emit Released(payee, amountToPayee, protocolFee);
    }

    // ============================================================
    // CANCEL
    // ============================================================

    /**
     * @notice Annule le paiement et rembourse le payer
     * @dev Remboursement INTÉGRAL (amountToPayee + protocolFee)
     */
    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(cancellable, "Payment not cancellable");
        require(!released, "Already released");
        require(!cancelled, "Already cancelled");
        require(block.timestamp < releaseTime, "Too late to cancel");

        cancelled = true;

        // Remboursement total
        uint256 refundAmount = amountToPayee + protocolFee;
        IERC20(tokenAddress).safeTransfer(payer, refundAmount);

        emit Cancelled(payer, refundAmount);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    function getAmounts() external view returns (
        uint256 _amountToPayee,
        uint256 _protocolFee,
        uint256 _totalLocked
    ) {
        return (
            amountToPayee,
            protocolFee,
            amountToPayee + protocolFee
        );
    }

    function getStatus() external view returns (
        bool isReleased,
        bool isCancelled,
        bool isCancellable,
        bool canBeReleased,
        bool canBeCancelled
    ) {
        isReleased = released;
        isCancelled = cancelled;
        isCancellable = cancellable;
        canBeReleased = !released && !cancelled && block.timestamp >= releaseTime;
        canBeCancelled = cancellable && !released && !cancelled && block.timestamp < releaseTime;
    }

    function getPaymentDetails() external view returns (
        address _payer,
        address _payee,
        address _tokenAddress,
        uint256 _amountToPayee,
        uint256 _protocolFee,
        uint256 _totalLocked,
        uint256 _releaseTime,
        bool _released,
        bool _cancelled,
        bool _cancellable
    ) {
        return (
            payer,
            payee,
            tokenAddress,
            amountToPayee,
            protocolFee,
            amountToPayee + protocolFee,
            releaseTime,
            released,
            cancelled,
            cancellable
        );
    }

    function timeUntilRelease() external view returns (uint256) {
        if (block.timestamp >= releaseTime) {
            return 0;
        }
        return releaseTime - block.timestamp;
    }

    function getBalance() external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }
    
    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================
    
    modifier onlyProtocol() {
        require(msg.sender == protocolOwner, "Not protocol");
        _;
    }
    
    /**
     * @notice Secours protocole : exécute le paiement si le keeper ne l'a pas fait
     * @dev Appelle la fonction _release() interne
     */
    function adminExecutePayment() external onlyProtocol {
        _release();
    }
}