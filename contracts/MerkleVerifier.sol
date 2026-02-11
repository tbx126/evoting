// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MerkleVerifier - Merkle 证明验证合约
 * @notice 验证投票记录的 Merkle 证明，确保数据完整性
 * @dev 链上验证 Merkle 证明，配合链下 Merkle 树使用
 */
contract MerkleVerifier {
    // ============ 事件 ============

    event ProofVerified(bytes32 indexed root, bytes32 leaf, bool valid);

    // ============ 核心验证函数 ============

    /**
     * @notice 验证 Merkle 证明
     * @param _proof 证明路径数组
     * @param _root Merkle 根哈希
     * @param _leaf 叶子节点哈希
     * @param _index 叶子节点索引
     * @return 验证是否通过
     */
    function verify(
        bytes32[] calldata _proof,
        bytes32 _root,
        bytes32 _leaf,
        uint256 _index
    ) external pure returns (bool) {
        return _verify(_proof, _root, _leaf, _index);
    }

    /**
     * @notice 内部验证函数
     */
    function _verify(
        bytes32[] calldata _proof,
        bytes32 _root,
        bytes32 _leaf,
        uint256 _index
    ) internal pure returns (bool) {
        bytes32 computedHash = _leaf;

        for (uint256 i = 0; i < _proof.length; i++) {
            bytes32 proofElement = _proof[i];

            if (_index % 2 == 0) {
                // 当前节点在左边
                computedHash = keccak256(
                    abi.encodePacked(computedHash, proofElement)
                );
            } else {
                // 当前节点在右边
                computedHash = keccak256(
                    abi.encodePacked(proofElement, computedHash)
                );
            }
            _index = _index / 2;
        }

        return computedHash == _root;
    }

    /**
     * @notice 计算叶子节点哈希
     * @param _data 原始数据
     */
    function hashLeaf(bytes calldata _data) external pure returns (bytes32) {
        return keccak256(_data);
    }

    /**
     * @notice 计算两个节点的父节点哈希
     */
    function hashPair(bytes32 _a, bytes32 _b) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_a, _b));
    }
}
