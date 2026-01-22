// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ScheduledPayment_V2.sol";
import "./ScheduledPaymentERC20.sol";
import "./RecurringPaymentERC20.sol";

contract PaymentFactory_Core {
    using SafeERC20 for IERC20;

    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179;
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_MONTH = 30 * 24 * 60 * 60;

    event PaymentCreatedETH(address indexed payer,address indexed payee,address paymentContract,uint256 releaseTime,uint256 amountToPayee,uint256 protocolFee,uint256 totalSent,bool cancellable);
    event PaymentCreatedERC20(address indexed payer,address indexed payee,address indexed tokenAddress,address paymentContract,uint256 releaseTime,uint256 amountToPayee,uint256 protocolFee,bool cancellable);
    event RecurringPaymentCreatedERC20(address indexed payer,address indexed payee,address indexed tokenAddress,address paymentContract,uint256 monthlyAmount,uint256 protocolFeePerMonth,uint256 startDate,uint256 totalMonths);

    function createPaymentETH(address _payee,uint256 _amountToPayee,uint256 _releaseTime,bool _cancellable) external payable returns (address) {
        require(_amountToPayee > 0);
        require(_payee != address(0));
        require(_releaseTime > block.timestamp);
        uint256 protocolFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = _amountToPayee + protocolFee;
        require(msg.value == totalRequired);
        ScheduledPayment newPayment = new ScheduledPayment{value: msg.value}(
            msg.sender,
            _payee,
            _amountToPayee,
            _releaseTime,
            _cancellable,
            PROTOCOL_WALLET,
            FEE_BASIS_POINTS
        );
        emit PaymentCreatedETH(msg.sender,_payee,address(newPayment),_releaseTime,_amountToPayee,protocolFee,msg.value,_cancellable);
        return address(newPayment);
    }

    function createPaymentERC20(address _payee,address _tokenAddress,uint256 _amountToPayee,uint256 _releaseTime,bool _cancellable) external returns (address) {
        require(_amountToPayee > 0);
        require(_payee != address(0));
        require(_tokenAddress != address(0));
        require(_releaseTime > block.timestamp);
        uint256 protocolFee = (_amountToPayee * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = _amountToPayee + protocolFee;
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), totalRequired);
        ScheduledPaymentERC20 newPayment = new ScheduledPaymentERC20(
            msg.sender,
            _payee,
            _tokenAddress,
            _amountToPayee,
            _releaseTime,
            _cancellable,
            PROTOCOL_WALLET,
            FEE_BASIS_POINTS
        );
        IERC20(_tokenAddress).safeTransfer(address(newPayment), totalRequired);
        emit PaymentCreatedERC20(msg.sender,_payee,_tokenAddress,address(newPayment),_releaseTime,_amountToPayee,protocolFee,_cancellable);
        return address(newPayment);
    }

    function createRecurringPaymentERC20(address _payee,address _tokenAddress,uint256 _monthlyAmount,uint256 _startDate,uint256 _totalMonths,uint256 _dayOfMonth) external returns (address) {
        require(_payee != address(0));
        require(_tokenAddress != address(0));
        require(_monthlyAmount > 0);
        require(_startDate > block.timestamp);
        require(_totalMonths >= 1 && _totalMonths <= 12);
        require(_dayOfMonth >= 1 && _dayOfMonth <= 28);
        uint256 protocolFeePerMonth = (_monthlyAmount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
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
            FEE_BASIS_POINTS,
            SECONDS_PER_MONTH
        );
        emit RecurringPaymentCreatedERC20(msg.sender,_payee,_tokenAddress,address(newRecurringPayment),_monthlyAmount,protocolFeePerMonth,_startDate,_totalMonths);
        return address(newRecurringPayment);
    }
}
