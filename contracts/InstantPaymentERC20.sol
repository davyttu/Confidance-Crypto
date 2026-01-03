// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title InstantPaymentERC20
 * @notice Paiement instantané ERC20 (USDC/USDT) - 0% fees
 * @dev Le transfert s'exécute immédiatement dans le constructor
 */
contract InstantPaymentERC20 {
    using SafeERC20 for IERC20;
    
    address public immutable payer;
    address public immutable payee;
    address public immutable tokenAddress;
    uint256 public immutable amount;
    uint256 public immutable timestamp;
    bool public executed;
    
    event InstantPaymentExecuted(
        address indexed payer,
        address indexed payee,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @notice Crée et exécute immédiatement le paiement ERC20
     * @param _payer Adresse de l'émetteur
     * @param _payee Adresse du bénéficiaire
     * @param _tokenAddress Adresse du token (USDC/USDT)
     * @param _amount Montant à transférer
     * 
     * @dev Les tokens doivent être transférés à ce contrat AVANT l'appel du constructor
     *      La Factory transfère les tokens à ce contrat, puis ce contrat les transfère au bénéficiaire
     */
    constructor(
        address _payer,
        address _payee,
        address _tokenAddress,
        uint256 _amount
    ) {
        require(_amount > 0, "Amount must be > 0");
        require(_payee != address(0), "Invalid payee");
        require(_payer != address(0), "Invalid payer");
        require(_tokenAddress != address(0), "Invalid token");
        
        payer = _payer;
        payee = _payee;
        tokenAddress = _tokenAddress;
        amount = _amount;
        timestamp = block.timestamp;
        
        // ✅ FIX : Les tokens seront transférés par la Factory APRÈS la création du contrat
        // Le transfert au bénéficiaire se fera via la fonction execute() appelée par la Factory
        executed = false;
    }
    
    /**
     * @notice Exécute le transfert vers le bénéficiaire
     * @dev Doit être appelé par la Factory après avoir transféré les tokens à ce contrat
     */
    function execute() external {
        require(!executed, "Already executed");
        
        // Vérifier que ce contrat a reçu les tokens (de la Factory)
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
        require(balance >= amount, "Insufficient tokens received");
        
        // Transfert immédiat vers payee (0% fees)
        IERC20(tokenAddress).safeTransfer(payee, amount);
        
        executed = true;
        
        emit InstantPaymentExecuted(payer, payee, tokenAddress, amount, block.timestamp);
    }
    
    /**
     * @notice Obtient les détails du paiement
     */
    function getPaymentDetails() external view returns (
        address _payer,
        address _payee,
        address _tokenAddress,
        uint256 _amount,
        uint256 _timestamp,
        bool _executed
    ) {
        return (payer, payee, tokenAddress, amount, timestamp, executed);
    }
}
