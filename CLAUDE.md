# 区块链电子投票系统 - AI 开发上下文
# Blockchain E-Voting System with ZKP - AI Development Context

> 本文档为 AI 助手提供项目架构、技术栈和开发指南，帮助快速理解代码库并提供精准的技术支持。

---

## 项目概览

**项目名称**: 区块链电子投票系统 (Blockchain E-Voting System)
**版本**: 2.0.0
**目标**: 基于以太坊的安全、隐私保护的电子投票平台，使用零知识证明 (ZKP)

### 核心特性

1. **投票隐私保护**: ElGamal 同态加密 (BabyJubJub 曲线)，在加密状态下计票
2. **零知识证明**: Groth16 ZKP 证明投票合法性和计票正确性，无需泄露投票内容
3. **可验证性**: Poseidon 哈希承诺 + Merkle 树证明，确保每张选票被正确记录
4. **区块链存储**: 以太坊智能合约，保证数据不可篡改

---

## 技术架构

### 技术栈

```yaml
区块链层:
  - Solidity: ^0.8.20
  - Hardhat: 智能合约开发框架
  - OpenZeppelin: 安全合约库
  - 目标网络: Ethereum Sepolia Testnet / Hardhat Localhost

ZKP 层:
  - circom 2.2.3: ZKP 电路编写语言
  - snarkjs 0.7.3: Groth16 证明生成与验证
  - circomlib 2.0.5: Poseidon 哈希、BabyJubJub 曲线运算
  - Powers of Tau: powersOfTau28_hez_final_16.ptau

密码学层:
  - ElGamal 加密: BabyJubJub 曲线 (BN254 兼容)
  - Poseidon 哈希: 电路友好的哈希函数
  - 同态加法: 密文直接累加实现加密计票

服务器:
  - Python 3.10+, FastAPI 0.109.0, Uvicorn
  - 仅作为静态文件服务器 (server.py, 无数据库、无 API 路由)

前端层:
  - 纯 HTML + Vanilla JavaScript
  - ethers.js (与区块链交互)
  - snarkjs (浏览器端生成 ZKP)
  - frontend/lib/elgamal.js (BabyJubJub ElGamal 库)
```

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (Frontend)                       │
│  HTML + JS                                                    │
│  - 选民投票页面 (voting-app.html)                              │
│  - 管理员控制台 (admin.html)                                   │
│  - MetaMask 集成                                              │
│  - 浏览器端 ZKP 生成 (snarkjs WASM)                           │
│  - ElGamal 加密 (elgamal.js)                                  │
└────────────┬────────────────────────────────────────────────┘
             │ ethers.js (直连区块链)
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  以太坊区块链 (Ethereum)                      │
│  ┌──────────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Voting.sol           │  │VoteVerifier  │  │TallyVerifier │ │
│  │ 主投票合约           │  │投票ZKP验证   │  │计票ZKP验证   │ │
│  │ (含选民注册逻辑)     │  └──────────────┘  └──────────────┘ │
│  └──────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 项目结构详解

```
├── contracts/               # Solidity 智能合约
│   ├── Voting.sol           # 主投票合约（选举、选民注册、投票、计票）
│   ├── VoteVerifier.sol     # 投票 ZKP Groth16 验证器 (snarkjs 生成)
│   └── TallyVerifier.sol    # 计票 ZKP Groth16 验证器 (snarkjs 生成)
│
├── circuits/                # circom ZKP 电路
│   ├── vote_proof.circom    # 投票证明 (ZKP1: 承诺正确 + ZKP2: one-hot 加密)
│   └── tally_proof.circom   # 计票证明 (ZKP3: 解密与聚合正确)
│
├── crypto/                  # Python 密码学模块
│   └── elgamal.py           # ElGamal on BabyJubJub (纯 Python 实现)
│
├── frontend/                # 前端页面
│   ├── voting-app.html      # 选民投票页面
│   ├── admin.html           # 管理员控制台
│   ├── config.js            # 合约地址配置 (deploy.js 自动生成, gitignored)
│   ├── lib/
│   │   └── elgamal.js       # JS 版 ElGamal (BabyJubJub)
│   └── zk/                  # ZKP 资源 (WASM + zkey, gitignored)
│       ├── vote_proof.wasm
│       ├── vote_proof_final.zkey
│       ├── tally_proof.wasm
│       └── tally_proof_final.zkey
│
├── server.py                # FastAPI 静态文件服务器
├── scripts/                 # Hardhat 脚本
│   └── deploy.js            # 合约部署 (Sepolia / localhost)
│
├── test/                    # 智能合约测试 (JavaScript)
│   ├── Voting.test.js       # 32 个测试，含真实 Groth16 证明
│   └── AuditLib.test.js     # Merkle 审计库测试
│
├── tests/                   # Python 测试
│   └── test_elgamal.py      # 43 个测试，ElGamal 加密/解密/同态
│
├── hardhat.config.js        # Hardhat 配置
├── package.json             # Node.js 依赖
├── requirements.txt         # Python 依赖 (FastAPI + pytest)
├── start_server.bat         # Windows 一键启动服务器
└── .env                     # 环境变量（私钥、RPC URL）
```

---

## 核心模块详解

### 1. 智能合约层 (Solidity)

#### Voting.sol - 主投票合约

**构造函数**:
```solidity
constructor(
    string memory _title,
    string memory _description,
    address _voteVerifier,
    address _tallyVerifier,
    uint256[2] memory _elgamalPK
)
```

**关键功能**:
- `registerVoter(addr)` / `registerVotersBatch(addrs[])`: 注册选民（仅管理员）
- `addCandidates(name0, name1)`: 一次性添加两个候选人（仅 Created 阶段）
- `addCandidate(name)`: 单个添加候选人（仅用于测试异常场景）
- `startElection()`: 启动选举
- `castVote(commitment, ciphertextHash, proof, encryptedVote)`: 提交投票 + ZKP
- `endElection()`: 结束选举
- `updateTallyResults(results, merkleRoot, proof, pubSignals)`: 上传计票结果 + ZKP

**状态机**:
```
Created → Active → Ended → Tallied
  ↓         ↓        ↓        ↓
添加候选人  投票    结束选举  上传结果
```

#### VoteVerifier.sol / TallyVerifier.sol

由 snarkjs 自动生成的 Groth16 验证器合约，验证投票和计票的 ZKP 证明。

### 2. ZKP 电路 (circom)

#### vote_proof.circom (14,590 约束, N=2)
- **ZKP1**: 证明 commitment = Poseidon(candidateId, salt)
- **ZKP2**: 证明加密投票是合法的 one-hot 向量（只投给一个候选人）

#### tally_proof.circom (16,786 约束, N=2)
- **ZKP3**: 证明解密结果正确（同态聚合 + ElGamal 解密）

### 3. 密码学 (ElGamal on BabyJubJub)

**加密**: `(C1, C2) = (r×G, m×G + r×PK)`
**解密**: `m×G = C2 - sk×C1`，然后暴力求解离散对数
**同态加法**: `E(a) ⊕ E(b) = (C1_a + C1_b, C2_a + C2_b) = E(a+b)`

Python 实现: `crypto/elgamal.py`
JavaScript 实现: `frontend/lib/elgamal.js`

---

## 关键工作流程

### 完整投票流程

```
1. 选举创建阶段
   管理员 → 部署合约 (含 ElGamal 公钥)
         → addCandidates("候选人A", "候选人B")
         → startElection()

2. 投票阶段 (前端浏览器)
   选民 → 选择候选人 (candidateId)
        → 生成随机盐 (salt) 和随机数 (r)
        → 计算 commitment = Poseidon(candidateId, salt)
        → ElGamal 加密 one-hot 向量: [E(0), E(1), E(0)]
        → 计算 ciphertextHash = Poseidon(所有密文分量)
        → 生成 ZKP proof (snarkjs, 浏览器 WASM)
        → castVote(commitment, ciphertextHash, proof, encryptedVote)
        → 合约验证 Groth16 proof → 存储

3. 选举结束
   管理员 → endElection()

4. 计票阶段 (管理员)
   管理员 → 从链上读取所有加密投票
         → 同态聚合: ΣE(v_i) per candidate
         → 用私钥 sk 解密: m×G = C2_sum - sk×C1_sum
         → 暴力求解 m (票数)
         → 生成 ZKP3 proof (证明解密正确)
         → updateTallyResults(results, merkleRoot, proof, pubSignals)
         → 合约验证 → 状态变为 Tallied
```

---

## 安全考量

### 已实现的安全措施

1. **投票隐私**: ElGamal 加密 + ZKP (无需揭示投票内容)
2. **投票合法性**: ZKP1+ZKP2 证明 one-hot 编码正确（不能投多票/假票）
3. **计票正确性**: ZKP3 证明解密过程正确
4. **防重复投票**: Voting.sol 内置选民白名单 + 合约状态检查
5. **防篡改**: 区块链不可篡改 + Merkle 树验证完整性

---

## 开发指南

### 环境配置

**必需工具**:
- Node.js 16+ (Hardhat, snarkjs)
- Python 3.10+
- MetaMask 钱包
- circom 2.2.3 (如需重新编译电路)

**环境变量** (`.env`):
```bash
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
PRIVATE_KEY=your-deployer-private-key
```

### 快速启动

```bash
# 1. 安装依赖
npm install
pip install -r requirements.txt

# 2. 编译合约
npx hardhat compile

# 3a. 本地开发 (推荐)
npx hardhat node                              # Terminal 1
npx hardhat run scripts/deploy.js --network localhost  # Terminal 2
python -m uvicorn server:app --port 8000  # Terminal 3

# 3b. 部署到 Sepolia
npx hardhat run scripts/deploy.js --network sepolia
```

### 测试

```bash
# 智能合约测试 (32 个测试，含真实 Groth16 证明)
npx hardhat test

# Python ElGamal 测试 (43 个测试)
python -m pytest tests/ -v
```

---

## AI 助手工作指南

### 代码修改建议

**修改智能合约时**:
1. 先检查 OpenZeppelin 是否有现成方案
2. 添加 NatSpec 注释（`@notice`, `@param`, `@return`）
3. 考虑 Gas 优化（使用 `calldata` 而非 `memory`）
4. 合约必须先检查 PK/totalVotes 再验证 proof（省 gas + 正确错误信息）

**修改 ZKP 电路时**:
1. Poseidon 支持最多 16 个输入 (circomlib t=17)
2. 修改电路后需重新: 编译 → trusted setup → 生成验证器合约
3. 使用 `circom` + `snarkjs` 手动构建（setup-zkp.sh 已删除，电路已固定为 N=2）

**修改密码学模块时**:
1. Python 和 JS 的 ElGamal 实现必须保持一致
2. BabyJubJub 曲线参数不可更改（BN254 兼容）
3. 编写单元测试验证加密解密正确性

### 常见问题排查

**问题**: 合约部署失败
- 检查 `.env` 中的私钥和 RPC URL
- 确保账户有足够 Sepolia ETH

**问题**: ZKP 证明生成失败
- 确保 `frontend/zk/` 下有 WASM 和 zkey 文件
- 检查电路输入是否在 BN254 素数域内

**问题**: Error writing file
- There's a file modification bug in Claude Code. The workaround is: always use complete absolute Windows paths with drive letters and backslashes for ALL file operations.

---

## 相关资源

- [circom 文档](https://docs.circom.io/)
- [snarkjs](https://github.com/iden3/snarkjs)
- [BabyJubJub 曲线规范](https://eips.ethereum.org/EIPS/eip-2494)
- [Poseidon 哈希](https://www.poseidon-hash.info/)
- [Groth16 论文](https://eprint.iacr.org/2016/260.pdf)
- [Hardhat](https://hardhat.org/)
- [FastAPI](https://fastapi.tiangolo.com/)

---

**最后更新**: 2026-02-26
**文档版本**: 2.1.0
