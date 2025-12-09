// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InstantPayment
 * @notice Paiement instantané ETH (0% fees)
 * @dev Le transfert s'exécute immédiatement dans le constructor
 */
contract InstantPayment {
    address public immutable payer;
    address public immutable payee;
    uint256 public immutable amount;
    uint256 public immutable timestamp;
    bool public executed;
    
    event InstantPaymentExecuted(
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @notice Crée et exécute immédiatement le paiement
     * @param _payer Adresse de l'émetteur
     * @param _payee Adresse du bénéficiaire
     */
    constructor(
        address _payer,
        address _payee
    ) payable {
        require(msg.value > 0, "Amount must be > 0");
        require(_payee != address(0), "Invalid payee");
        require(_payer != address(0), "Invalid payer");
        
        payer = _payer;
        payee = _payee;
        amount = msg.value;
        timestamp = block.timestamp;
        
        // Transfert immédiat (0% fees)
        (bool success, ) = payable(_payee).call{value: msg.value}("");
        require(success, "Transfer failed");
        
        executed = true;
        
        emit InstantPaymentExecuted(_payer, _payee, msg.value, block.timestamp);
    }
    
    /**
     * @notice Obtient les détails du paiement
     */
    function getPaymentDetails() external view returns (
        address _payer,
        address _payee,
        uint256 _amount,
        uint256 _timestamp,
        bool _executed
    ) {
        return (payer, payee, amount, timestamp, executed);
    }
}
