// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ScheduledPaymentERC20 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public payer;
    address public payee;
    address public tokenAddress;
    uint256 public amount;
    uint256 public releaseTime;
    bool public released;
    bool public cancelled;
    bool public cancellable;

    // Wallet protocole qui reçoit les fees (1.79%)
    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant PROTOCOL_FEE_BASIS_POINTS = 179; // 1.79%

    event Released(address indexed payee, uint256 recipientAmount, uint256 protocolFee);
    event Cancelled(address indexed payer, uint256 refundAmount);

    constructor(
        address _payer,      // ✅ AJOUTÉ
        address _payee,
        address _tokenAddress,
        uint256 _amount,
        uint256 _releaseTime,
        bool _cancellable
    ) {
        require(_payee != address(0), "Invalid payee");
        require(_payer != address(0), "Invalid payer");  // ✅ AJOUTÉ
        require(_tokenAddress != address(0), "Invalid token");
        require(_amount > 0, "Amount must be > 0");
        require(_releaseTime > block.timestamp, "Release time must be in future");

        payer = _payer;      // ✅ MODIFIÉ (était msg.sender)
        payee = _payee;
        tokenAddress = _tokenAddress;
        amount = _amount;
        releaseTime = _releaseTime;
        cancellable = _cancellable;
        released = false;
        cancelled = false;

        IERC20(_tokenAddress).safeTransferFrom(_payer, address(this), _amount);  // ✅ MODIFIÉ (était msg.sender)
    }

    function release() external nonReentrant {
        require(!released, "Already released");
        require(!cancelled, "Payment cancelled");
        require(block.timestamp >= releaseTime, "Too early");

        released = true;

        // Calculer les fees (1.79%)
        uint256 protocolFee = (amount * PROTOCOL_FEE_BASIS_POINTS) / 10000;
        uint256 recipientAmount = amount - protocolFee;

        // Transférer au bénéficiaire
        IERC20(tokenAddress).safeTransfer(payee, recipientAmount);

        // Transférer les fees au protocole
        IERC20(tokenAddress).safeTransfer(PROTOCOL_WALLET, protocolFee);

        emit Released(payee, recipientAmount, protocolFee);
    }

    function cancel() external nonReentrant {
        require(msg.sender == payer, "Only payer can cancel");
        require(cancellable, "Payment not cancellable");
        require(!released, "Already released");
        require(!cancelled, "Already cancelled");
        require(block.timestamp < releaseTime, "Too late to cancel");

        cancelled = true;

        // Rembourser le montant total au payer (pas de fees si annulé)
        IERC20(tokenAddress).safeTransfer(payer, amount);

        emit Cancelled(payer, amount);
    }

    // Fonction pour obtenir les montants calculés
    function getAmounts() external view returns (
        uint256 totalAmount,
        uint256 protocolFee,
        uint256 recipientAmount
    ) {
        totalAmount = amount;
        protocolFee = (amount * PROTOCOL_FEE_BASIS_POINTS) / 10000;
        recipientAmount = amount - protocolFee;
    }
}