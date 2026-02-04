// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Helper - 辅助工具合约
 * @notice 用于计算投票承诺哈希
 */
contract Helper {
    /**
     * @notice 计算投票承诺
     * @param _candidateId 候选人ID (0 = tbx_1, 1 = tbx_2)
     * @param _salt 随机盐值 (32字节)
     * @return commitment 承诺哈希
     */
    function computeCommitment(uint256 _candidateId, bytes32 _salt)
        external pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(_candidateId, _salt));
    }
}
