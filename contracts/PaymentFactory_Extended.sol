// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BatchScheduledPayment_V2.sol";
import "./InstantPayment.sol";
import "./InstantPaymentERC20.sol";

contract PaymentFactory_Extended {
    using SafeERC20 for IERC20;

    address public constant PROTOCOL_WALLET = 0xa34eDf91Cc494450000Eef08e6563062B2F115a9;
    uint256 public constant FEE_BASIS_POINTS = 179;
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    event BatchPaymentCreatedETH(address indexed payer,address paymentContract,uint256 beneficiariesCount,uint256 totalToBeneficiaries,uint256 protocolFee,uint256 totalSent,uint256 releaseTime,bool cancellable);
    event InstantPaymentCreatedETH(address indexed payer,address indexed payee,address paymentContract,uint256 amount,uint256 timestamp);
    event InstantPaymentCreatedERC20(address indexed payer,address indexed payee,address indexed tokenAddress,address paymentContract,uint256 amount,uint256 timestamp);

    function createBatchPaymentETH(address[] memory _payees,uint256[] memory _amounts,uint256 _releaseTime,bool _cancellable) external payable returns (address) {
        require(_payees.length > 0);
        require(_payees.length <= 50);
        require(_payees.length == _amounts.length);
        require(_releaseTime > block.timestamp);
        uint256 totalToBeneficiaries = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] > 0);
            require(_payees[i] != address(0));
            totalToBeneficiaries += _amounts[i];
        }
        uint256 protocolFee = (totalToBeneficiaries * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 totalRequired = totalToBeneficiaries + protocolFee;
        require(msg.value == totalRequired);
        BatchScheduledPayment batchPayment = new BatchScheduledPayment{value: msg.value}(
            msg.sender,
            _payees,
            _amounts,
            _releaseTime,
            _cancellable,
            FEE_BASIS_POINTS
        );
        emit BatchPaymentCreatedETH(msg.sender,address(batchPayment),_payees.length,totalToBeneficiaries,protocolFee,msg.value,_releaseTime,_cancellable);
        return address(batchPayment);
    }

    function createInstantPaymentETH(address _payee) external payable returns (address) {
        require(_payee != address(0));
        require(msg.value > 0);
        InstantPayment newPayment = new InstantPayment{value: msg.value}(msg.sender,_payee);
        emit InstantPaymentCreatedETH(msg.sender,_payee,address(newPayment),msg.value,block.timestamp);
        return address(newPayment);
    }

    function createInstantPaymentERC20(address _payee,address _tokenAddress,uint256 _amount) external returns (address) {
        require(_payee != address(0));
        require(_tokenAddress != address(0));
        require(_amount > 0);
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
        InstantPaymentERC20 newPayment = new InstantPaymentERC20(msg.sender,_payee,_tokenAddress,_amount);
        IERC20(_tokenAddress).safeTransfer(address(newPayment), _amount);
        newPayment.execute();
        emit InstantPaymentCreatedERC20(msg.sender,_payee,_tokenAddress,address(newPayment),_amount,block.timestamp);
        return address(newPayment);
    }
}
