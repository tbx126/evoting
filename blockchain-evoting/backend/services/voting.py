# -*- coding: utf-8 -*-
"""
投票服务模块
Voting Service Module

功能说明：
- 投票承诺生成与验证
- Merkle 树管理
- 投票记录管理
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from typing import List, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from crypto.commitment import CommitmentScheme
from crypto.merkle import MerkleTree
from ..models.vote import VoteRecord


class VotingService:
    """投票服务类"""

    def __init__(self):
        self.merkle_tree = MerkleTree()
        self.commitments: List[bytes] = []

    def create_vote_commitment(
        self, vote: int
    ) -> Tuple[str, str]:
        """
        创建投票承诺

        返回: (承诺哈希hex, 盐值hex)
        """
        commitment, salt = CommitmentScheme.create_commitment(vote)
        return commitment.hex(), salt.hex()

    def verify_commitment(
        self, vote: int, salt_hex: str, commitment_hex: str
    ) -> bool:
        """验证投票承诺"""
        salt = bytes.fromhex(salt_hex)
        commitment = bytes.fromhex(commitment_hex)
        return CommitmentScheme.verify_commitment(vote, salt, commitment)

    def add_commitment(self, commitment_hex: str) -> int:
        """添加承诺到列表，返回索引"""
        commitment = bytes.fromhex(commitment_hex)
        self.commitments.append(commitment)
        return len(self.commitments) - 1

    def build_merkle_tree(self) -> Optional[str]:
        """构建 Merkle 树，返回根哈希"""
        if not self.commitments:
            return None
        self.merkle_tree.build(self.commitments)
        return self.merkle_tree.get_root_hex()

    def get_merkle_proof(self, index: int) -> List[Tuple[str, str]]:
        """获取 Merkle 证明"""
        return self.merkle_tree.get_proof_hex(index)
