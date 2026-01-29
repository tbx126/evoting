# -*- coding: utf-8 -*-
"""
Paillier 同态加密模块
Paillier Homomorphic Encryption Module

功能说明：
- 支持加法同态运算，允许在加密状态下进行投票计数
- 加密后的选票可以直接相加，解密后得到总票数
- 保护选民隐私，计票过程无需解密单张选票
"""

from phe import paillier
from typing import Tuple, List
import json


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
