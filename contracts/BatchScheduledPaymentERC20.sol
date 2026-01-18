// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BatchScheduledPaymentERC20
 * @notice Paiement programmé unique pour PLUSIEURS bénéficiaires en ERC20
 * @dev Nouvelle logique : bénéficiaires reçoivent montants EXACTS, fees additives
 * 
 * Use case : Payroll d'entreprise, distribution airdrop, paiements multiples en tokens
 * 
 * Exemple :
 * - totalRequired = 1.0179 USDC
 * - Bénéficiaires : [0.5 USDC, 0.3 USDC, 0.2 USDC] = 1.0 USDC total
 * - Fees : 0.0179 USDC (variable)
 * - Chaque bénéficiaire reçoit son montant EXACT
 * 
 * WORKFLOW FACTORY-INTERMEDIARY:
 * 1. Factory: transferFrom(user → factory, totalRequired)
 * 2. Factory: new BatchScheduledPaymentERC20(...) ← Constructor s'exécute
 * 3. Factory: transfer(factory → contract, totalRequired)
 * 
 * ⚠️ Le constructor NE DOIT PAS vérifier balanceOf car les tokens
 *    arrivent APRÈS sa création (étape 3)
 */
contract BatchScheduledPaymentERC20 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============================================================
    // STORAGE
    // ============================================================
    
    address public payer;
    address public tokenAddress;
    address[] public payees;
    uint256[] public amounts;
    uint256 public releaseTime;
    
    bool public released;
    bool public cancelled;
    bool public cancellable;
    
    // Calculs fees V2
    uint256 public totalToBeneficiaries; // Somme des montants exacts
    uint256 public protocolFee;          // Fees additionnels (variable)
    uint256 public feeBps;
    
    address public immutable protocolOwner;
    
    // Constantes
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    
    // ============================================================
    // EVENTS
    // ============================================================
    
    event BatchPaymentCreated(
        address indexed payer,
        address indexed tokenAddress,
        uint256 beneficiariesCount,
        uint256 totalToBeneficiaries,
        uint256 protocolFee,
        uint256 releaseTime
    );
    
    event BatchPaymentReleased(
        address indexed executor,
        address indexed tokenAddress,
        uint256 beneficiariesPaid,
        uint256 totalPaid,
        uint256 protocolFeeCollected
    );
    
    event BatchPaymentCancelled(
        address indexed payer,
        address indexed tokenAddress,
        uint256 refundAmount
    );
    
    // ============================================================
    // CONSTRUCTOR
    // ============================================================
    
    /**
     * @notice Crée un paiement batch programmé ERC20
     * @param _payer Adresse de celui qui crée le paiement
     * @param _tokenAddress Adresse du token ERC20
     * @param _payees Liste des adresses bénéficiaires (max 50)
     * @param _amounts Montants EXACTS que chaque bénéficiaire recevra
     * @param _releaseTime Timestamp de libération
     * @param _cancellable Si true, payer peut annuler avant releaseTime
     * @param _protocolOwner Adresse du protocole (pour fonctions admin)
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
        address _tokenAddress,
        address[] memory _payees,
        uint256[] memory _amounts,
        uint256 _releaseTime,
        bool _cancellable,
        address _protocolOwner,
        uint256 _feeBps
    ) {
        // Validations
        require(_payees.length > 0, "No payees");
        require(_payees.length <= 50, "Max 50 payees");
        require(_payees.length == _amounts.length, "Arrays length mismatch");
        require(_payer != address(0), "Invalid payer");
        require(_tokenAddress != address(0), "Invalid token");
        require(_releaseTime > block.timestamp, "Release time must be in future");
        require(_protocolOwner != address(0), "Invalid protocol owner");
        
        // Vérifier que tous les montants sont > 0
        uint256 totalBenef = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] > 0, "Amount must be > 0");
            require(_payees[i] != address(0), "Invalid payee address");
            totalBenef += _amounts[i];
        }
        
        require(_feeBps <= BASIS_POINTS_DENOMINATOR, "Invalid fee bps");

        // Calculer les fees (nouvelle logique V2)
        totalToBeneficiaries = totalBenef;
        protocolFee = (totalToBeneficiaries * _feeBps) / BASIS_POINTS_DENOMINATOR;
        
        // Stocker
        payer = _payer;
        tokenAddress = _tokenAddress;
        payees = _payees;
        amounts = _amounts;
        releaseTime = _releaseTime;
        cancellable = _cancellable;
        released = false;
        cancelled = false;
        protocolOwner = _protocolOwner;
        feeBps = _feeBps;
        
        // ✅ FIX : SUPPRIMÉ la vérification balanceOf
        // Les tokens arrivent via Factory.safeTransfer() après new BatchScheduledPaymentERC20()
        
        emit BatchPaymentCreated(
            _payer,
            _tokenAddress,
            _payees.length,
            totalToBeneficiaries,
            protocolFee,
            _releaseTime
        );
    }
    
    // ============================================================
    // RELEASE
    // ============================================================
    
    /**
     * @notice Libère les fonds à tous les bénéficiaires
     * @dev Peut être appelé par n'importe qui après releaseTime
     *      Chaque bénéficiaire reçoit son montant EXACT en tokens ERC20
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
        
        // Transférer à chaque bénéficiaire (montant exact)
        for (uint256 i = 0; i < payees.length; i++) {
            IERC20(tokenAddress).safeTransfer(payees[i], amounts[i]);
        }
        
        // Transférer les fees au protocole
        IERC20(tokenAddress).safeTransfer(PROTOCOL_WALLET, protocolFee);
        
        emit BatchPaymentReleased(
            msg.sender,
            tokenAddress,
            payees.length,
            totalToBeneficiaries,
            protocolFee
        );
    }
    
    // ============================================================
    // CANCEL
    // ============================================================
    
    /**
     * @notice Annule le paiement et rembourse le payer
     * @dev Seulement si cancellable = true et avant releaseTime
     *      Remboursement INTÉGRAL (totalToBeneficiaries + fees)
     */
    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(cancellable, "Not cancellable");
        require(!released, "Already released");
        require(!cancelled, "Already cancelled");
        require(block.timestamp < releaseTime, "Too late to cancel");
        
        cancelled = true;
        
        // Remboursement TOTAL en tokens (pas de fees si annulé)
        uint256 refundAmount = totalToBeneficiaries + protocolFee;
        IERC20(tokenAddress).safeTransfer(payer, refundAmount);
        
        emit BatchPaymentCancelled(payer, tokenAddress, refundAmount);
    }
    
    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================
    
    /**
     * @notice Obtient les détails complets du paiement
     */
    function getPaymentDetails() external view returns (
        address _payer,
        address _tokenAddress,
        uint256 _beneficiariesCount,
        uint256 _totalToBeneficiaries,
        uint256 _protocolFee,
        uint256 _totalLocked,
        uint256 _releaseTime,
        bool _released,
        bool _cancelled,
        bool _cancellable,
        bool _canBeReleased,
        bool _canBeCancelled
    ) {
        return (
            payer,
            tokenAddress,
            payees.length,
            totalToBeneficiaries,
            protocolFee,
            totalToBeneficiaries + protocolFee,
            releaseTime,
            released,
            cancelled,
            cancellable,
            !released && !cancelled && block.timestamp >= releaseTime,
            cancellable && !released && !cancelled && block.timestamp < releaseTime
        );
    }
    
    /**
     * @notice Liste tous les bénéficiaires et montants
     */
    function getAllPayees() external view returns (
        address[] memory _payees,
        uint256[] memory _amounts
    ) {
        return (payees, amounts);
    }
    
    /**
     * @notice Obtient un bénéficiaire spécifique
     */
    function getPayee(uint256 index) external view returns (
        address payee,
        uint256 amount,
        bool paid
    ) {
        require(index < payees.length, "Index out of bounds");
        return (
            payees[index],
            amounts[index],
            released // Tous payés en même temps
        );
    }
    
    /**
     * @notice Compte de bénéficiaires
     */
    function getPayeesCount() external view returns (uint256) {
        return payees.length;
    }
    
    /**
     * @notice Vérifie si une adresse est bénéficiaire
     */
    function isPayee(address _address) external view returns (bool) {
        for (uint256 i = 0; i < payees.length; i++) {
            if (payees[i] == _address) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @notice Statut complet du paiement
     */
    function getStatus() external view returns (
        string memory status,
        uint256 timeUntilRelease,
        bool canExecute,
        bool canCancel
    ) {
        if (cancelled) {
            return ("cancelled", 0, false, false);
        }
        if (released) {
            return ("released", 0, false, false);
        }
        
        if (block.timestamp >= releaseTime) {
            return ("ready", 0, true, false);
        }
        
        uint256 timeLeft = releaseTime - block.timestamp;
        bool canCancelNow = cancellable && block.timestamp < releaseTime;
        
        return ("pending", timeLeft, false, canCancelNow);
    }
    
    /**
     * @notice Obtient le solde actuel du contrat en tokens
     */
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
