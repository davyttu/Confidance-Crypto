// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ScheduledPayment.sol";

contract PaymentFactory {
    address public platformWallet;
    uint256 public feePercent = 179;
    uint256 public constant FEE_DENOMINATOR = 10000;

    mapping(address => address[]) public userPayments;

    event PaymentCreated(address indexed user, address paymentContract);
    event UserRegistered(address indexed user);

    constructor(address _platformWallet) {
        platformWallet = _platformWallet;
    }

    function createPayment(
        address _recipient,
        uint256 _releaseTime,
        bool _isCancelable,
        bool _isDefinitive
    ) external payable returns (address) {
        require(msg.value > 0, "No funds sent");

        if (userPayments[msg.sender].length == 0) {
            emit UserRegistered(msg.sender);
        }

        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(
            payable(msg.sender),
            payable(_recipient),
            _releaseTime,
            _isCancelable,
            _isDefinitive,
            platformWallet,
            feePercent
        );

        userPayments[msg.sender].push(address(newPayment));
        emit PaymentCreated(msg.sender, address(newPayment));
        return address(newPayment);
    }

    function getUserPayments(address _user) external view returns (address[] memory) {
        return userPayments[_user];
    }

    function setPlatformWallet(address _newWallet) external {
        require(msg.sender == platformWallet, "Only platform wallet");
        platformWallet = _newWallet;
    }

    function setFeePercent(uint256 _newFee) external {
        require(msg.sender == platformWallet, "Only platform wallet");
        feePercent = _newFee;
    }

    receive() external payable {}
}
