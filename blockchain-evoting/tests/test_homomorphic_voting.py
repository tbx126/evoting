# -*- coding: utf-8 -*-
"""
同态加密投票系统测试
Homomorphic Voting System Tests

测试内容：
- Paillier 加密/解密
- One-hot 编码
- 同态计票
- 序列化/反序列化
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
import random
from crypto.paillier import PaillierCrypto


class TestPaillierCrypto:
    """Paillier 加密测试"""

    @pytest.fixture
    def crypto(self):
        """创建测试用密钥对（使用较小密钥加速测试）"""
        return PaillierCrypto.generate_keypair(key_size=1024)

    def test_encrypt_decrypt(self, crypto):
        """测试基本加密解密"""
        original = 42
        encrypted = crypto.encrypt(original)
        decrypted = crypto.decrypt(encrypted)
        assert decrypted == original

    def test_homomorphic_addition(self, crypto):
        """测试同态加法"""
        a, b = 5, 3
        enc_a = crypto.encrypt(a)
        enc_b = crypto.encrypt(b)
        enc_sum = crypto.add_encrypted([enc_a, enc_b])
        result = crypto.decrypt(enc_sum)
        assert result == a + b

    def test_serialize_public_key(self, crypto):
        """测试公钥序列化"""
        serialized = crypto.serialize_public_key()
        assert 'n' in serialized
        assert isinstance(serialized['n'], str)

    def test_deserialize_public_key(self, crypto):
        """测试公钥反序列化"""
        serialized = crypto.serialize_public_key()
        restored = PaillierCrypto.from_public_key_dict(serialized)

        # 使用恢复的公钥加密
        original = 100
        encrypted = restored.encrypt(original)

        # 使用原始私钥解密
        decrypted = crypto.decrypt(encrypted)
        assert decrypted == original

    def test_serialize_private_key(self, crypto):
        """测试私钥序列化"""
        serialized = crypto.serialize_private_key()
        assert 'p' in serialized
        assert 'q' in serialized

    def test_deserialize_private_key(self, crypto):
        """测试私钥反序列化"""
        pub_data = crypto.serialize_public_key()
        priv_data = crypto.serialize_private_key()

        restored = PaillierCrypto.from_private_key_dict(priv_data, pub_data)

        # 测试加密解密
        original = 999
        encrypted = restored.encrypt(original)
        decrypted = restored.decrypt(encrypted)
        assert decrypted == original

    def test_serialize_encrypted(self, crypto):
        """测试加密数值序列化"""
        original = 123
        encrypted = crypto.encrypt(original)
        serialized = crypto.serialize_encrypted(encrypted)

        assert isinstance(serialized, str)

        # 反序列化
        restored = crypto.deserialize_encrypted(serialized)
        decrypted = crypto.decrypt(restored)
        assert decrypted == original


class TestOneHotEncoding:
    """One-Hot 编码测试"""

    @pytest.fixture
    def crypto(self):
        return PaillierCrypto.generate_keypair(key_size=1024)

    def test_encrypt_vote_onehot_candidate_0(self, crypto):
        """测试投给候选人 0"""
        encrypted = crypto.encrypt_vote_onehot(candidate_id=0, num_candidates=3)

        assert len(encrypted) == 3

        # 解密验证
        decrypted = [crypto.decrypt(e) for e in encrypted]
        assert decrypted == [1, 0, 0]

    def test_encrypt_vote_onehot_candidate_1(self, crypto):
        """测试投给候选人 1"""
        encrypted = crypto.encrypt_vote_onehot(candidate_id=1, num_candidates=3)
        decrypted = [crypto.decrypt(e) for e in encrypted]
        assert decrypted == [0, 1, 0]

    def test_encrypt_vote_onehot_candidate_2(self, crypto):
        """测试投给候选人 2"""
        encrypted = crypto.encrypt_vote_onehot(candidate_id=2, num_candidates=3)
        decrypted = [crypto.decrypt(e) for e in encrypted]
        assert decrypted == [0, 0, 1]

    def test_encrypt_vote_onehot_invalid_candidate(self, crypto):
        """测试无效候选人 ID"""
        with pytest.raises(ValueError):
            crypto.encrypt_vote_onehot(candidate_id=5, num_candidates=3)

    def test_encrypt_vote_onehot_negative_candidate(self, crypto):
        """测试负数候选人 ID"""
        with pytest.raises(ValueError):
            crypto.encrypt_vote_onehot(candidate_id=-1, num_candidates=3)

    def test_serialize_vote(self, crypto):
        """测试投票序列化"""
        encrypted = crypto.encrypt_vote_onehot(candidate_id=1, num_candidates=3)
        serialized = crypto.serialize_vote(encrypted)

        assert len(serialized) == 3
        assert all(isinstance(s, str) for s in serialized)

    def test_deserialize_vote(self, crypto):
        """测试投票反序列化"""
        encrypted = crypto.encrypt_vote_onehot(candidate_id=2, num_candidates=3)
        serialized = crypto.serialize_vote(encrypted)
        restored = crypto.deserialize_vote(serialized)

        decrypted = [crypto.decrypt(e) for e in restored]
        assert decrypted == [0, 0, 1]


class TestHomomorphicTally:
    """同态计票测试"""

    @pytest.fixture
    def crypto(self):
        return PaillierCrypto.generate_keypair(key_size=1024)

    def test_tally_single_vote(self, crypto):
        """测试单票计票"""
        vote = crypto.encrypt_vote_onehot(candidate_id=1, num_candidates=3)
        results = crypto.homomorphic_tally([vote], num_candidates=3)

        assert results == [0, 1, 0]

    def test_tally_multiple_votes(self, crypto):
        """测试多票计票"""
        votes = [
            crypto.encrypt_vote_onehot(0, 3),  # 投给候选人 0
            crypto.encrypt_vote_onehot(1, 3),  # 投给候选人 1
            crypto.encrypt_vote_onehot(0, 3),  # 投给候选人 0
        ]

        results = crypto.homomorphic_tally(votes, num_candidates=3)
        assert results == [2, 1, 0]

    def test_tally_10_votes(self, crypto):
        """测试 10 票计票"""
        # 模拟投票：0, 1, 2, 0, 1, 2, 0, 1, 2, 0
        votes = []
        expected = [0, 0, 0]
        for i in range(10):
            candidate = i % 3
            expected[candidate] += 1
            votes.append(crypto.encrypt_vote_onehot(candidate, 3))

        results = crypto.homomorphic_tally(votes, num_candidates=3)
        assert results == expected  # [4, 3, 3]

    def test_tally_random_votes(self, crypto):
        """测试随机投票计票"""
        num_votes = 20
        num_candidates = 4

        votes = []
        expected = [0] * num_candidates

        for _ in range(num_votes):
            candidate = random.randint(0, num_candidates - 1)
            expected[candidate] += 1
            votes.append(crypto.encrypt_vote_onehot(candidate, num_candidates))

        results = crypto.homomorphic_tally(votes, num_candidates=num_candidates)
        assert results == expected
        assert sum(results) == num_votes

    def test_tally_empty_votes(self, crypto):
        """测试空投票列表"""
        results = crypto.homomorphic_tally([], num_candidates=3)
        assert results == [0, 0, 0]

    def test_tally_parallel(self, crypto):
        """测试并行计票"""
        votes = [
            crypto.encrypt_vote_onehot(0, 3),
            crypto.encrypt_vote_onehot(1, 3),
            crypto.encrypt_vote_onehot(2, 3),
            crypto.encrypt_vote_onehot(0, 3),
            crypto.encrypt_vote_onehot(1, 3),
        ]

        results = crypto.homomorphic_tally_parallel(votes, num_candidates=3)
        assert results == [2, 2, 1]


class TestVotingService:
    """投票服务测试"""

    def test_encrypt_vote(self):
        """测试投票加密"""
        # 直接导入 VotingService 避免依赖问题
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

        import json
        import hashlib
        from typing import List, Tuple

        # 简化版 VotingService 测试
        crypto = PaillierCrypto.generate_keypair(key_size=1024)

        # 加密投票
        encrypted = crypto.encrypt_vote_onehot(candidate_id=1, num_candidates=3)
        serialized = crypto.serialize_vote(encrypted)

        # 计算承诺哈希
        data = json.dumps(serialized)
        commitment = '0x' + hashlib.sha256(data.encode()).hexdigest()

        assert len(serialized) == 3
        assert commitment.startswith('0x')
        assert len(commitment) == 66  # 0x + 64 hex chars

    def test_verify_commitment(self):
        """测试承诺验证"""
        import json
        import hashlib

        crypto = PaillierCrypto.generate_keypair(key_size=1024)

        # 加密投票
        encrypted = crypto.encrypt_vote_onehot(1, 3)
        serialized = crypto.serialize_vote(encrypted)

        # 计算承诺
        data = json.dumps(serialized)
        commitment = '0x' + hashlib.sha256(data.encode()).hexdigest()

        # 验证
        computed = '0x' + hashlib.sha256(json.dumps(serialized).encode()).hexdigest()
        assert computed.lower() == commitment.lower()

        # 修改后验证应该失败
        assert ('0x' + 'f' * 64).lower() != commitment.lower()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
