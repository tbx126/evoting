# -*- coding: utf-8 -*-
"""
Merkle 树模块
Merkle Tree Module

功能说明：
- 构建投票记录的 Merkle 树，提供可审计性
- 生成和验证 Merkle 证明，选民可验证自己的投票已被记录
- 根哈希存储在区块链上，确保数据完整性
"""

import hashlib
from typing import List, Optional, Tuple


class MerkleTree:
    """
    Merkle 树实现类

    主要方法：
    - build: 从数据列表构建树
    - get_root: 获取根哈希
    - get_proof: 获取某个叶子节点的证明路径
    - verify_proof: 验证证明的有效性
    """

    def __init__(self):
        """初始化空的 Merkle 树"""
        self.leaves: List[bytes] = []  # 叶子节点列表
        self.tree: List[List[bytes]] = []  # 完整树结构

    @staticmethod
    def hash_data(data: bytes) -> bytes:
        """
        计算数据的 SHA-256 哈希

        参数:
            data: 要哈希的字节数据

        返回:
            32字节的哈希值
        """
        return hashlib.sha256(data).digest()

    @staticmethod
    def hash_pair(left: bytes, right: bytes) -> bytes:
        """
        计算两个节点的父节点哈希

        参数:
            left: 左子节点哈希
            right: 右子节点哈希

        返回:
            父节点哈希值
        """
        return hashlib.sha256(left + right).digest()

    def build(self, data_list: List[bytes]) -> bytes:
        """
        从数据列表构建 Merkle 树

        参数:
            data_list: 原始数据列表（如投票记录）

        返回:
            Merkle 根哈希

        说明:
            如果数据数量为奇数，最后一个节点会复制自身配对
        """
        if not data_list:
            raise ValueError("数据列表不能为空")

        # 计算所有叶子节点的哈希
        self.leaves = [self.hash_data(data) for data in data_list]
        self.tree = [self.leaves.copy()]

        # 逐层向上构建树
        current_level = self.leaves.copy()
        while len(current_level) > 1:
            next_level = []
            # 如果当前层节点数为奇数，复制最后一个节点
            if len(current_level) % 2 == 1:
                current_level.append(current_level[-1])

            # 两两配对计算父节点
            for i in range(0, len(current_level), 2):
                parent = self.hash_pair(current_level[i], current_level[i + 1])
                next_level.append(parent)

            self.tree.append(next_level)
            current_level = next_level

        return self.get_root()

    def get_root(self) -> Optional[bytes]:
        """
        获取 Merkle 根哈希

        返回:
            根哈希值，树为空时返回 None
        """
        if not self.tree:
            return None
        return self.tree[-1][0] if self.tree[-1] else None

    def get_root_hex(self) -> Optional[str]:
        """
        获取十六进制格式的根哈希

        返回:
            根哈希的十六进制字符串
        """
        root = self.get_root()
        return root.hex() if root else None

    def get_proof(self, index: int) -> List[Tuple[bytes, str]]:
        """
        获取指定叶子节点的 Merkle 证明路径

        参数:
            index: 叶子节点索引

        返回:
            证明路径列表，每个元素为 (哈希值, 方向)
            方向为 'L' 表示兄弟节点在左边，'R' 表示在右边

        异常:
            IndexError: 索引超出范围时抛出
        """
        if index < 0 or index >= len(self.leaves):
            raise IndexError(f"索引 {index} 超出范围 [0, {len(self.leaves)})")

        proof = []
        current_index = index

        # 从叶子层向上遍历
        for level in range(len(self.tree) - 1):
            level_nodes = self.tree[level]

            # 处理奇数节点情况
            if len(level_nodes) % 2 == 1 and current_index == len(level_nodes) - 1:
                # 最后一个节点与自身配对，无需添加证明
                current_index = current_index // 2
                continue

            # 确定兄弟节点位置
            if current_index % 2 == 0:
                # 当前节点在左边，兄弟在右边
                sibling_index = current_index + 1
                direction = 'R'
            else:
                # 当前节点在右边，兄弟在左边
                sibling_index = current_index - 1
                direction = 'L'

            if sibling_index < len(level_nodes):
                proof.append((level_nodes[sibling_index], direction))

            current_index = current_index // 2

        return proof

    @staticmethod
    def verify_proof(
        leaf_data: bytes,
        proof: List[Tuple[bytes, str]],
        root: bytes
    ) -> bool:
        """
        验证 Merkle 证明

        参数:
            leaf_data: 原始叶子数据
            proof: 证明路径
            root: 期望的根哈希

        返回:
            验证通过返回 True，否则返回 False
        """
        current_hash = MerkleTree.hash_data(leaf_data)

        for sibling_hash, direction in proof:
            if direction == 'L':
                # 兄弟在左边
                current_hash = MerkleTree.hash_pair(sibling_hash, current_hash)
            else:
                # 兄弟在右边
                current_hash = MerkleTree.hash_pair(current_hash, sibling_hash)

        return current_hash == root

    def get_proof_hex(self, index: int) -> List[Tuple[str, str]]:
        """
        获取十六进制格式的证明路径

        参数:
            index: 叶子节点索引

        返回:
            证明路径列表，哈希值为十六进制字符串
        """
        proof = self.get_proof(index)
        return [(h.hex(), d) for h, d in proof]
