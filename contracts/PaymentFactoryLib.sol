// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library PaymentFactoryLib {
    uint256 public constant FEE_BASIS_POINTS = 179;
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    
    function calculateFee(uint256 amount) internal pure returns (uint256) {
        return (amount * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
    }
    
    function calculateTotal(uint256 amount) internal pure returns (uint256 fee, uint256 total) {
        fee = calculateFee(amount);
        total = amount + fee;
    }
    
    function calculateBatchTotal(uint256[] memory amounts) internal pure returns (uint256 totalBenef, uint256 fee, uint256 total) {
        for (uint256 i = 0; i < amounts.length; i++) {
            totalBenef += amounts[i];
        }
        fee = calculateFee(totalBenef);
        total = totalBenef + fee;
    }
}
