# -*- coding: utf-8 -*-
"""
密码学模块测试
Cryptographic Module Tests
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import unittest
from crypto.paillier import PaillierCrypto
from crypto.merkle import MerkleTree
from crypto.commitment import CommitmentScheme


class TestPaillier(unittest.TestCase):
    """Paillier 加密测试"""

    def test_encrypt_decrypt(self):
        """测试加密解密"""
        crypto = PaillierCrypto.generate_keypair(512)
        original = 42
        encrypted = crypto.encrypt(original)
        decrypted = crypto.decrypt(encrypted)
        self.assertEqual(original, decrypted)

    def test_homomorphic_add(self):
        """测试同态加法"""
        crypto = PaillierCrypto.generate_keypair(512)
        a, b = 10, 20
        enc_a = crypto.encrypt(a)
        enc_b = crypto.encrypt(b)
        enc_sum = crypto.add_encrypted([enc_a, enc_b])
        self.assertEqual(a + b, crypto.decrypt(enc_sum))


class TestMerkle(unittest.TestCase):
    """Merkle 树测试"""

    def test_build_tree(self):
        """测试构建树"""
        tree = MerkleTree()
        data = [b'vote1', b'vote2', b'vote3']
        root = tree.build(data)
        self.assertIsNotNone(root)

    def test_proof_verification(self):
        """测试证明生成与验证"""
        tree = MerkleTree()
        data = [b'vote1', b'vote2', b'vote3', b'vote4']
        root = tree.build(data)

        # 获取证明并验证
        proof = tree.get_proof(1)  # vote2 的证明
        self.assertTrue(tree.verify_proof(data[1], proof, root))

        # 错误数据应验证失败
        self.assertFalse(tree.verify_proof(b'fake', proof, root))


class TestCommitment(unittest.TestCase):
    """承诺方案测试"""

    def test_create_commitment(self):
        """测试创建承诺"""
        scheme = CommitmentScheme()
        vote = 1
        commitment, salt = scheme.create_commitment(vote)
        self.assertIsNotNone(commitment)
        self.assertIsNotNone(salt)

    def test_verify_commitment(self):
        """测试验证承诺"""
        scheme = CommitmentScheme()
        vote = 2
        commitment, salt = scheme.create_commitment(vote)

        # 正确验证
        self.assertTrue(scheme.verify(vote, salt, commitment))

        # 错误投票值应验证失败
        self.assertFalse(scheme.verify(3, salt, commitment))

        # 错误盐值应验证失败
        self.assertFalse(scheme.verify(vote, 'wrong_salt', commitment))


if __name__ == '__main__':
    unittest.main()
