// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBatchScheduledPayment {
    function releaseTime() external view returns (uint256);
    function released() external view returns (bool);
    function cancelled() external view returns (bool);
}

/**
 * @title BatchScheduledPaymentResolver
 * @notice Resolver pour automatiser les batch payments (Gelato/Chainlink)
 */
contract BatchScheduledPaymentResolver {
    address public target;

    constructor(address _target) {
        target = _target;
    }

    /**
     * @notice Vérifie si le batch payment peut être exécuté
     * @return canExec Si true, le keeper peut appeler release()
     * @return execPayload Payload pour appeler release()
     */
    function checker() external view returns (bool canExec, bytes memory execPayload) {
        IBatchScheduledPayment bp = IBatchScheduledPayment(target);
        
        if (!bp.released() && 
            !bp.cancelled() && 
            block.timestamp >= bp.releaseTime()) {
            
            bytes4 selector = bytes4(keccak256("release()"));
            execPayload = abi.encodeWithSelector(selector);
            canExec = true;
        } else {
            canExec = false;
            execPayload = bytes("");
        }
    }
}
