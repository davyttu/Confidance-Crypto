// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./InstantPayment.sol";
import "./InstantPaymentERC20.sol";

/**
 * @title PaymentFactory_Instant
 * @notice Factory dédiée aux paiements instantanés (single + batch)
 * @dev Aucun stockage, aucune dépendance keeper
 *      Exécution immédiate des transferts
 */
contract PaymentFactory_Instant {
    using SafeERC20 for IERC20;

    // ============================================================
    // EVENTS
    // ============================================================

    event InstantPaymentCreatedETH(
        address indexed payer,
        address indexed payee,
        address paymentContract,
        uint256 amount,
        uint256 timestamp
    );

    event InstantPaymentCreatedERC20(
        address indexed payer,
        address indexed payee,
        address indexed tokenAddress,
        address paymentContract,
        uint256 amount,
        uint256 timestamp
    );

    event InstantBatchPaymentCreatedETH(
        address indexed payer,
        uint256 beneficiariesCount,
        uint256 totalAmount,
        uint256 timestamp
    );

    event InstantBatchPaymentCreatedERC20(
        address indexed payer,
        address indexed tokenAddress,
        uint256 beneficiariesCount,
        uint256 totalAmount,
        uint256 timestamp
    );

    // ============================================================
    // SINGLE INSTANT PAYMENT ETH (ORIGINAL LOGIC)
    // ============================================================

    function createInstantPaymentETH(
        address _payee
    ) external payable returns (address) {
        require(_payee != address(0), "Invalid payee");
        require(msg.value > 0, "No funds sent");

        InstantPayment newPayment = new InstantPayment{value: msg.value}(
            msg.sender,
            _payee
        );

        emit InstantPaymentCreatedETH(
            msg.sender,
            _payee,
            address(newPayment),
            msg.value,
            block.timestamp
        );

        return address(newPayment);
    }

    // ============================================================
    // SINGLE INSTANT PAYMENT ERC20 (ORIGINAL LOGIC)
    // ============================================================

    function createInstantPaymentERC20(
        address _payee,
        address _tokenAddress,
        uint256 _amount
    ) external returns (address) {
        require(_payee != address(0), "Invalid payee");
        require(_tokenAddress != address(0), "Invalid token");
        require(_amount > 0, "Amount must be > 0");

        // Étape 1 : Factory reçoit les tokens
        IERC20(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        // Étape 2 : Créer le contrat instant
        InstantPaymentERC20 newPayment = new InstantPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _amount
        );

        // Étape 3 : Transférer les tokens au contrat
        IERC20(_tokenAddress).safeTransfer(
            address(newPayment),
            _amount
        );

        // Étape 4 : Exécuter immédiatement
        newPayment.execute();

        emit InstantPaymentCreatedERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            address(newPayment),
            _amount,
            block.timestamp
        );

        return address(newPayment);
    }

    // ============================================================
    // BATCH INSTANT PAYMENT ETH (NOUVEAU – DIRECT)
    // ============================================================

    function createInstantBatchPaymentETH(
        address[] calldata _payees,
        uint256[] calldata _amounts
    ) external payable {
        require(_payees.length > 0, "No payees");
        require(_payees.length <= 50, "Max 50 payees");
        require(_payees.length == _amounts.length, "Length mismatch");

        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_payees[i] != address(0), "Invalid payee");
            require(_amounts[i] > 0, "Amount must be > 0");
            totalAmount += _amounts[i];
        }

        require(msg.value == totalAmount, "Incorrect total sent");

        for (uint256 i = 0; i < _payees.length; i++) {
            (bool success, ) = payable(_payees[i]).call{
                value: _amounts[i]
            }("");
            require(success, "ETH transfer failed");
        }

        emit InstantBatchPaymentCreatedETH(
            msg.sender,
            _payees.length,
            totalAmount,
            block.timestamp
        );
    }

    // ============================================================
    // BATCH INSTANT PAYMENT ERC20 (NOUVEAU – DIRECT)
    // ============================================================

    function createInstantBatchPaymentERC20(
        address _tokenAddress,
        address[] calldata _payees,
        uint256[] calldata _amounts
    ) external {
        require(_tokenAddress != address(0), "Invalid token");
        require(_payees.length > 0, "No payees");
        require(_payees.length <= 50, "Max 50 payees");
        require(_payees.length == _amounts.length, "Length mismatch");

        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_payees[i] != address(0), "Invalid payee");
            require(_amounts[i] > 0, "Amount must be > 0");
            totalAmount += _amounts[i];
        }

        // Transfer direct payer → beneficiaries
        for (uint256 i = 0; i < _payees.length; i++) {
            IERC20(_tokenAddress).safeTransferFrom(
                msg.sender,
                _payees[i],
                _amounts[i]
            );
        }

        emit InstantBatchPaymentCreatedERC20(
            msg.sender,
            _tokenAddress,
            _payees.length,
            totalAmount,
            block.timestamp
        );
    }
}
