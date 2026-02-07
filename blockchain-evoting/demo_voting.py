# -*- coding: utf-8 -*-
"""
同态加密投票系统演示脚本
Homomorphic Voting System Demo

这个脚本演示完整的投票流程（不需要区块链）：
1. 生成密钥对
2. 模拟多个选民投票
3. 同态计票
4. 验证结果
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import json
import hashlib
from crypto.paillier import PaillierCrypto
from crypto.merkle import MerkleTree


def print_separator(title):
    """打印分隔线"""
    print("\n" + "-" * 60)
    print(f"  {title}")
    print("-" * 60)


def main():
    print_separator("同态加密投票系统演示")

    # ============ 步骤 1: 初始化 ============
    print_separator("步骤 1: 生成 Paillier 密钥对")

    print("正在生成 2048 位密钥对（这可能需要几秒钟）...")
    crypto = PaillierCrypto.generate_keypair(key_size=2048)

    # 序列化公钥（这是会分发给选民的）
    public_key_data = crypto.serialize_public_key()
    print(f"✓ 公钥生成成功")
    print(f"  公钥 n 的长度: {len(public_key_data['n'])} 位数字")

    # ============ 步骤 2: 设置选举 ============
    print_separator("步骤 2: 设置选举")

    candidates = ["Alice", "Bob", "Charlie"]
    num_candidates = len(candidates)

    print(f"选举标题: 2026 年度最佳员工评选")
    print(f"候选人列表:")
    for i, name in enumerate(candidates):
        print(f"  [{i}] {name}")

    # ============ 步骤 3: 模拟投票 ============
    print_separator("步骤 3: 模拟选民投票")

    # 模拟 10 个选民的投票
    voters = [
        {"address": "0x1111111111111111111111111111111111111111", "vote": 0},  # Alice
        {"address": "0x2222222222222222222222222222222222222222", "vote": 1},  # Bob
        {"address": "0x3333333333333333333333333333333333333333", "vote": 0},  # Alice
        {"address": "0x4444444444444444444444444444444444444444", "vote": 2},  # Charlie
        {"address": "0x5555555555555555555555555555555555555555", "vote": 0},  # Alice
        {"address": "0x6666666666666666666666666666666666666666", "vote": 1},  # Bob
        {"address": "0x7777777777777777777777777777777777777777", "vote": 0},  # Alice
        {"address": "0x8888888888888888888888888888888888888888", "vote": 2},  # Charlie
        {"address": "0x9999999999999999999999999999999999999999", "vote": 1},  # Bob
        {"address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "vote": 0},  # Alice
    ]

    encrypted_votes = []
    commitments = []

    print(f"\n正在处理 {len(voters)} 张选票...\n")

    for i, voter in enumerate(voters):
        # 1. 使用 one-hot 编码加密投票
        encrypted = crypto.encrypt_vote_onehot(voter["vote"], num_candidates)

        # 2. 序列化加密投票
        serialized = crypto.serialize_vote(encrypted)

        # 3. 计算承诺哈希（这是存储在链上的）
        commitment = '0x' + hashlib.sha256(json.dumps(serialized).encode()).hexdigest()

        encrypted_votes.append(encrypted)
        commitments.append(commitment)

        print(f"  选民 {i+1}: {voter['address'][:10]}...")
        print(f"    投给: {candidates[voter['vote']]}")
        print(f"    承诺: {commitment[:18]}...")

    # ============ 步骤 4: 构建 Merkle 树 ============
    print_separator("步骤 4: 构建 Merkle 树")

    merkle_tree = MerkleTree()
    commitment_bytes = [bytes.fromhex(c[2:]) for c in commitments]
    merkle_tree.build(commitment_bytes)
    merkle_root = '0x' + merkle_tree.get_root_hex()

    print(f"✓ Merkle 树构建完成")
    print(f"  叶子节点数: {len(commitments)}")
    print(f"  Merkle 根: {merkle_root[:18]}...")

    # 演示 Merkle 证明
    print(f"\n验证第 1 个选民的投票是否被记录:")
    proof = merkle_tree.get_proof(0)
    is_valid = MerkleTree.verify_proof(commitment_bytes[0], proof, merkle_tree.get_root())
    print(f"  证明路径长度: {len(proof)}")
    print(f"  验证结果: {'✓ 通过' if is_valid else '✗ 失败'}")

    # ============ 步骤 5: 同态计票 ============
    print_separator("步骤 5: 同态计票（核心功能）")

    print("正在执行同态累加...")
    print("（注意：此过程不解密任何单张选票！）\n")

    # 使用同态加法累加所有投票
    results = crypto.homomorphic_tally(encrypted_votes, num_candidates)

    print("✓ 计票完成！\n")

    # ============ 步骤 6: 显示结果 ============
    print_separator("步骤 6: 选举结果")

    total_votes = sum(results)
    print(f"总投票数: {total_votes}\n")

    # 按得票数排序
    sorted_results = sorted(
        [(candidates[i], results[i]) for i in range(num_candidates)],
        key=lambda x: x[1],
        reverse=True
    )

    print("候选人排名:")
    for rank, (name, votes) in enumerate(sorted_results, 1):
        percentage = (votes / total_votes) * 100
        bar = "█" * int(percentage / 5)
        print(f"  {rank}. {name}: {votes} 票 ({percentage:.1f}%) {bar}")

    winner = sorted_results[0][0]
    print(f"\n🏆 获胜者: {winner}")

    # ============ 步骤 7: 验证结果 ============
    print_separator("步骤 7: 验证计票正确性")

    # 手动统计预期结果
    expected = [0] * num_candidates
    for voter in voters:
        expected[voter["vote"]] += 1

    print("预期结果 vs 同态计票结果:")
    all_match = True
    for i, name in enumerate(candidates):
        match = "✓" if expected[i] == results[i] else "✗"
        if expected[i] != results[i]:
            all_match = False
        print(f"  {name}: 预期 {expected[i]} 票, 实际 {results[i]} 票 {match}")

    print(f"\n验证结果: {'✓ 所有结果匹配！' if all_match else '✗ 结果不匹配！'}")

    # ============ 总结 ============
    print_separator("演示完成")

    print("""
关键点总结:

1. 投票隐私: 每张选票都使用 Paillier 加密，
   计票过程中从未解密任何单张选票。

2. 同态加法: E(a) + E(b) = E(a+b)
   我们可以在加密状态下累加所有投票。

3. 可验证性: Merkle 树允许每个选民验证
   自己的投票是否被正确记录。

4. 链上存储: 只有承诺哈希存储在区块链上，
   加密投票存储在链下数据库中。
""")


if __name__ == "__main__":
    main()
