# -*- coding: utf-8 -*-
"""
承诺-揭示方案模块
Commitment-Reveal Scheme Module

功能说明：
- 实现投票承诺机制，选民先提交承诺，后揭示投票
- 承诺 = hash(vote || salt)，防止投票被篡改
- 提供简化的零知识验证：选民可证明自己投了票而不泄露具体内容
"""

import hashlib
import secrets
from typing import Tuple, Optional


class CommitmentScheme:
    """
    承诺-揭示方案实现类

    主要方法：
    - create_commitment: 创建投票承诺
    - verify_commitment: 验证承诺与揭示值是否匹配
    - generate_vote_proof: 生成投票证明（简化ZKP）
    - verify_vote_proof: 验证投票证明
    """

    @staticmethod
    def generate_salt(length: int = 32) -> bytes:
        """
        生成随机盐值

        参数:
            length: 盐值长度（字节）

        返回:
            随机字节串
        """
        return secrets.token_bytes(length)

    @staticmethod
    def create_commitment(vote: int, salt: bytes = None) -> Tuple[bytes, bytes]:
        """
        创建投票承诺

        参数:
            vote: 投票选项（整数）
            salt: 盐值（可选，不提供则自动生成）

        返回:
            (承诺哈希, 盐值) 元组
        """
        if salt is None:
            salt = CommitmentScheme.generate_salt()

        # 承诺 = SHA256(vote || salt)
        data = vote.to_bytes(4, 'big') + salt
        commitment = hashlib.sha256(data).digest()

        return commitment, salt

    @staticmethod
    def verify_commitment(vote: int, salt: bytes, commitment: bytes) -> bool:
        """
        验证承诺与揭示值是否匹配

        参数:
            vote: 揭示的投票选项
            salt: 揭示的盐值
            commitment: 原始承诺哈希

        返回:
            匹配返回 True，否则返回 False
        """
        data = vote.to_bytes(4, 'big') + salt
        expected = hashlib.sha256(data).digest()
        return expected == commitment

    @staticmethod
    def generate_vote_proof(
        voter_address: str,
        vote: int,
        salt: bytes,
        election_id: int
    ) -> Tuple[bytes, bytes]:
        """
        生成投票证明（简化零知识证明）

        参数:
            voter_address: 选民钱包地址
            vote: 投票选项
            salt: 承诺盐值
            election_id: 选举ID

        返回:
            (证明哈希, 验证密钥) 元组

        说明:
            证明 = hash(address || election_id || commitment)
            验证密钥 = hash(salt || address)
            选民可用验证密钥证明投票存在，而不泄露具体投票内容
        """
        # 计算承诺
        commitment, _ = CommitmentScheme.create_commitment(vote, salt)

        # 生成证明哈希
        proof_data = (
            voter_address.encode() +
            election_id.to_bytes(4, 'big') +
            commitment
        )
        proof = hashlib.sha256(proof_data).digest()

        # 生成验证密钥
        verify_key = hashlib.sha256(salt + voter_address.encode()).digest()

        return proof, verify_key

    @staticmethod
    def verify_vote_proof(
        voter_address: str,
        election_id: int,
        commitment: bytes,
        expected_proof: bytes
    ) -> bool:
        """
        验证投票证明

        参数:
            voter_address: 选民钱包地址
            election_id: 选举ID
            commitment: 投票承诺
            expected_proof: 期望的证明哈希

        返回:
            验证通过返回 True，否则返回 False
        """
        proof_data = (
            voter_address.encode() +
            election_id.to_bytes(4, 'big') +
            commitment
        )
        computed_proof = hashlib.sha256(proof_data).digest()
        return computed_proof == expected_proof

    @staticmethod
    def commitment_to_hex(commitment: bytes) -> str:
        """将承诺转换为十六进制字符串"""
        return commitment.hex()

    @staticmethod
    def hex_to_commitment(hex_str: str) -> bytes:
        """将十六进制字符串转换为承诺"""
        return bytes.fromhex(hex_str)
