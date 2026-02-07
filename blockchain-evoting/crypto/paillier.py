# -*- coding: utf-8 -*-
"""
Paillier 同态加密模块
Paillier Homomorphic Encryption Module

功能说明：
- 支持加法同态运算，允许在加密状态下进行投票计数
- 加密后的选票可以直接相加，解密后得到总票数
- 保护选民隐私，计票过程无需解密单张选票
- 支持密钥和加密数值的序列化/反序列化
- 支持 one-hot 编码投票和同态计票
"""

from phe import paillier
from typing import Tuple, List, Dict, Any, Optional
import json
import base64
from concurrent.futures import ThreadPoolExecutor


class PaillierCrypto:
    """
    Paillier 同态加密类

    主要方法：
    - generate_keypair: 生成公私钥对
    - encrypt: 加密投票数据
    - decrypt: 解密投票结果
    - add_encrypted: 同态加法（加密状态下累加选票）
    """

    def __init__(self, public_key=None, private_key=None):
        """
        初始化加密器

        参数:
            public_key: 公钥（可选，用于加密）
            private_key: 私钥（可选，用于解密）
        """
        self.public_key = public_key
        self.private_key = private_key

    @classmethod
    def generate_keypair(cls, key_size: int = 2048) -> 'PaillierCrypto':
        """
        生成新的密钥对

        参数:
            key_size: 密钥长度（默认2048位，安全性较高）

        返回:
            PaillierCrypto 实例，包含公私钥
        """
        public_key, private_key = paillier.generate_paillier_keypair(
            n_length=key_size
        )
        return cls(public_key, private_key)

    def encrypt(self, value: int) -> paillier.EncryptedNumber:
        """
        加密单个整数值

        参数:
            value: 要加密的整数（如投票选项编号）

        返回:
            加密后的数值对象

        异常:
            ValueError: 公钥未设置时抛出
        """
        if self.public_key is None:
            raise ValueError("公钥未设置，无法加密")
        return self.public_key.encrypt(value)

    def decrypt(self, encrypted_value: paillier.EncryptedNumber) -> int:
        """
        解密加密数值

        参数:
            encrypted_value: 加密的数值对象

        返回:
            解密后的整数

        异常:
            ValueError: 私钥未设置时抛出
        """
        if self.private_key is None:
            raise ValueError("私钥未设置，无法解密")
        return self.private_key.decrypt(encrypted_value)

    def add_encrypted(
        self,
        encrypted_values: List[paillier.EncryptedNumber]
    ) -> paillier.EncryptedNumber:
        """
        同态加法：在加密状态下累加多个值

        参数:
            encrypted_values: 加密数值列表

        返回:
            累加后的加密结果

        说明:
            这是同态加密的核心功能，允许在不解密的情况下
            对选票进行计数，保护投票隐私
        """
        if not encrypted_values:
            raise ValueError("加密值列表不能为空")

        result = encrypted_values[0]
        for enc_val in encrypted_values[1:]:
            result = result + enc_val
        return result

    # ============ 序列化方法 ============

    def serialize_public_key(self) -> Dict[str, str]:
        """
        序列化公钥为 JSON 可存储格式

        返回:
            包含 'n' 的字典
        """
        if self.public_key is None:
            raise ValueError("公钥未设置，无法序列化")
        return {'n': str(self.public_key.n)}

    @classmethod
    def from_public_key_dict(cls, data: Dict[str, str]) -> 'PaillierCrypto':
        """
        从字典反序列化公钥

        参数:
            data: 包含 'n' 的字典

        返回:
            仅包含公钥的 PaillierCrypto 实例
        """
        n = int(data['n'])
        public_key = paillier.PaillierPublicKey(n)
        return cls(public_key=public_key, private_key=None)

    def serialize_private_key(self) -> Dict[str, str]:
        """
        序列化私钥（用于加密存储）

        返回:
            包含 'p', 'q' 的字典
        """
        if self.private_key is None:
            raise ValueError("私钥未设置，无法序列化")
        return {
            'p': str(self.private_key.p),
            'q': str(self.private_key.q)
        }

    @classmethod
    def from_private_key_dict(
        cls,
        private_data: Dict[str, str],
        public_data: Dict[str, str]
    ) -> 'PaillierCrypto':
        """
        从字典反序列化私钥

        参数:
            private_data: 包含 'p', 'q' 的字典
            public_data: 包含 'n' 的字典

        返回:
            包含公私钥的 PaillierCrypto 实例
        """
        n = int(public_data['n'])
        p = int(private_data['p'])
        q = int(private_data['q'])
        public_key = paillier.PaillierPublicKey(n)
        private_key = paillier.PaillierPrivateKey(public_key, p, q)
        return cls(public_key=public_key, private_key=private_key)

    def serialize_encrypted(self, encrypted: paillier.EncryptedNumber) -> str:
        """
        序列化加密数值为 base64 字符串

        参数:
            encrypted: 加密的数值对象

        返回:
            base64 编码的字符串
        """
        data = {
            'ciphertext': str(encrypted.ciphertext()),
            'exponent': encrypted.exponent
        }
        json_str = json.dumps(data)
        return base64.b64encode(json_str.encode()).decode()

    def deserialize_encrypted(self, data: str) -> paillier.EncryptedNumber:
        """
        反序列化加密数值

        参数:
            data: base64 编码的字符串

        返回:
            加密的数值对象
        """
        if self.public_key is None:
            raise ValueError("公钥未设置，无法反序列化加密数值")
        json_str = base64.b64decode(data.encode()).decode()
        obj = json.loads(json_str)
        ciphertext = int(obj['ciphertext'])
        exponent = obj['exponent']
        return paillier.EncryptedNumber(self.public_key, ciphertext, exponent)

    # ============ One-Hot 编码投票 ============

    def encrypt_vote_onehot(
        self,
        candidate_id: int,
        num_candidates: int
    ) -> List[paillier.EncryptedNumber]:
        """
        使用 one-hot 编码加密投票

        参数:
            candidate_id: 候选人 ID (0-indexed)
            num_candidates: 候选人总数

        返回:
            加密的 one-hot 向量，例如投给候选人 1（共 3 人）返回 [E(0), E(1), E(0)]

        异常:
            ValueError: 参数无效时抛出
        """
        if self.public_key is None:
            raise ValueError("公钥未设置，无法加密")
        if candidate_id < 0 or candidate_id >= num_candidates:
            raise ValueError(f"候选人 ID 无效: {candidate_id}，应在 0-{num_candidates-1} 范围内")
        if num_candidates < 2:
            raise ValueError("候选人数量必须至少为 2")

        encrypted_vote = []
        for i in range(num_candidates):
            value = 1 if i == candidate_id else 0
            encrypted_vote.append(self.public_key.encrypt(value))
        return encrypted_vote

    def serialize_vote(self, encrypted_vote: List[paillier.EncryptedNumber]) -> List[str]:
        """
        序列化加密投票向量

        参数:
            encrypted_vote: 加密的 one-hot 向量

        返回:
            base64 编码的字符串列表
        """
        return [self.serialize_encrypted(e) for e in encrypted_vote]

    def deserialize_vote(self, serialized_vote: List[str]) -> List[paillier.EncryptedNumber]:
        """
        反序列化加密投票向量

        参数:
            serialized_vote: base64 编码的字符串列表

        返回:
            加密的 one-hot 向量
        """
        return [self.deserialize_encrypted(s) for s in serialized_vote]

    # ============ 同态计票 ============

    def homomorphic_tally(
        self,
        encrypted_votes: List[List[paillier.EncryptedNumber]],
        num_candidates: int
    ) -> List[int]:
        """
        对所有加密投票进行同态累加并解密

        参数:
            encrypted_votes: 加密投票列表，每个元素是一个 one-hot 加密向量
            num_candidates: 候选人数量

        返回:
            每个候选人的得票数列表

        异常:
            ValueError: 私钥未设置或参数无效时抛出
        """
        if self.private_key is None:
            raise ValueError("私钥未设置，无法解密计票结果")
        if not encrypted_votes:
            return [0] * num_candidates

        # 同态累加每个候选人的票数
        totals = []
        for candidate_idx in range(num_candidates):
            # 收集所有投票中该候选人位置的加密值
            candidate_votes = [vote[candidate_idx] for vote in encrypted_votes]
            # 同态加法
            total_encrypted = self.add_encrypted(candidate_votes)
            totals.append(total_encrypted)

        # 解密最终结果
        results = [self.private_key.decrypt(t) for t in totals]
        return results

    def homomorphic_tally_parallel(
        self,
        encrypted_votes: List[List[paillier.EncryptedNumber]],
        num_candidates: int,
        max_workers: Optional[int] = None
    ) -> List[int]:
        """
        并行同态计票（适用于大量投票）

        参数:
            encrypted_votes: 加密投票列表
            num_candidates: 候选人数量
            max_workers: 最大并行线程数（默认为候选人数量）

        返回:
            每个候选人的得票数列表
        """
        if self.private_key is None:
            raise ValueError("私钥未设置，无法解密计票结果")
        if not encrypted_votes:
            return [0] * num_candidates

        if max_workers is None:
            max_workers = num_candidates

        def sum_candidate(candidate_idx: int) -> paillier.EncryptedNumber:
            candidate_votes = [vote[candidate_idx] for vote in encrypted_votes]
            return self.add_encrypted(candidate_votes)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            totals = list(executor.map(sum_candidate, range(num_candidates)))

        results = [self.private_key.decrypt(t) for t in totals]
        return results
