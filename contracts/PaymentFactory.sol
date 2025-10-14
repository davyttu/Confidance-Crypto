// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ScheduledPayment.sol";

contract PaymentFactory {
    event PaymentCreated(
        address indexed payer,
        address indexed payee,
        address paymentContract,
        uint256 releaseTime,
        uint256 amount
    );

    function createPayment(address _payee, uint256 _releaseTime) external payable {
        require(msg.value > 0, "No funds sent");

        // ✅ Appel du constructeur avec seulement 2 paramètres
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(_payee, _releaseTime);

        emit PaymentCreated(
            msg.sender,
            _payee,
            address(newPayment),
            _releaseTime,
            msg.value
        );
    }
}
