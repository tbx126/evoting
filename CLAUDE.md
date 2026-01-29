# 区块链电子投票系统 - AI 开发上下文
# Blockchain E-Voting System - AI Development Context

> 本文档为 AI 助手提供项目架构、技术栈和开发指南，帮助快速理解代码库并提供精准的技术支持。

---

## 项目概览

**项目名称**: 区块链电子投票系统 (Blockchain E-Voting System)
**版本**: 1.0.0
**目标**: 基于以太坊的安全、隐私保护的电子投票平台

### 核心特性

1. **投票隐私保护**: 使用 Paillier 同态加密，在加密状态下计票
2. **防篡改机制**: Commit-Reveal 承诺方案，防止投票结果被预先泄露
3. **可验证性**: Merkle 树证明，确保每张选票被正确记录
4. **区块链存储**: 以太坊智能合约，保证数据不可篡改

---

## 技术架构

### 技术栈

```yaml
区块链层:
  - Solidity: ^0.8.20
  - Hardhat: 智能合约开发框架
  - OpenZeppelin: 安全合约库
  - 目标网络: Ethereum Sepolia Testnet

后端层:
  - 语言: Python 3.9+
  - Web框架: FastAPI 0.109.0
  - 异步运行时: Uvicorn
  - 数据库: SQLite (通过 SQLAlchemy ORM)
  - 区块链交互: Web3.py 6.14.0

密码学层:
  - Paillier 同态加密: phe 1.5.0
  - 哈希与签名: pycryptodome 3.20.0
  - Merkle 树: 自定义实现

前端层:
  - 纯 HTML + Vanilla JavaScript
  - CSS 样式
  - Web3.js (与区块链交互)

认证系统:
  - JWT Token: python-jose
  - 密码哈希: passlib with bcrypt
```

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (Frontend)                       │
│  HTML + JS + CSS                                             │
│  - 用户界面                                                   │
│  - MetaMask 集成                                             │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP API / Web3 RPC
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端服务 (FastAPI)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 认证模块     │  │ 投票模块     │  │ 验证模块     │      │
│  │ /auth/*      │  │ /vote/*      │  │ /verify/*    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────┐      │
│  │         服务层 (Services)                         │      │
│  │  - AuthService: 用户认证                          │      │
│  │  - VotingService: 投票逻辑                        │      │
│  │  - BlockchainService: 合约交互                    │      │
│  └──────────────────────────────────────────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────┐      │
│  │         密码学模块 (Crypto)                       │      │
│  │  - Paillier 同态加密                              │      │
│  │  - Merkle 树构建与验证                            │      │
│  │  - 承诺方案 (Commitment Scheme)                   │      │
│  └──────────────────────────────────────────────────┘      │
└────────────┬────────────────────────────────────────────────┘
             │ Web3.py
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  以太坊区块链 (Ethereum)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Voting.sol   │  │VoterRegistry │  │MerkleVerifier│      │
│  │ 主投票合约   │  │选民注册合约   │  │Merkle验证    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 项目结构详解

```
blockchain-evoting/
├── contracts/              # Solidity 智能合约
│   ├── Voting.sol          # 主投票合约（选举创建、投票、计票）
│   ├── VoterRegistry.sol   # 选民注册合约（身份管理）
│   └── MerkleVerifier.sol  # Merkle 树验证合约
│
├── crypto/                 # 密码学核心模块
│   ├── paillier.py         # Paillier 同态加密实现
│   ├── merkle.py           # Merkle 树构建与证明生成
│   └── commitment.py       # Commit-Reveal 承诺方案
│
├── backend/                # FastAPI 后端服务
│   ├── main.py             # FastAPI 应用入口
│   ├── config.py           # 配置管理（环境变量加载）
│   ├── database.py         # SQLAlchemy 数据库连接
│   │
│   ├── models/             # 数据库模型
│   │   ├── user.py         # 用户模型
│   │   └── vote.py         # 投票记录模型
│   │
│   ├── api/                # API 路由层
│   │   ├── auth.py         # 认证端点（注册/登录）
│   │   ├── voting.py       # 投票端点（提交/查询）
│   │   └── verify.py       # 验证端点（Merkle 证明）
│   │
│   └── services/           # 业务逻辑层
│       ├── auth.py         # 认证服务
│       ├── voting.py       # 投票服务
│       └── blockchain.py   # 区块链交互服务
│
├── frontend/               # 前端页面
│   ├── index.html          # 主页面
│   ├── css/                # 样式文件
│   └── js/                 # JavaScript 脚本
│
├── scripts/                # 部署与工具脚本
│   └── deploy.py           # 智能合约部署脚本
│
├── tests/                  # 测试文件
│   └── test_crypto.py      # 密码学模块测试
│
├── package.json            # Node.js 依赖（Hardhat）
├── requirements.txt        # Python 依赖
├── hardhat.config.js       # Hardhat 配置（未在列表中看到，但应存在）
└── .env                    # 环境变量（私钥、RPC URL 等）
```

---

## 核心模块详解

### 1. 智能合约层 (Solidity)

#### Voting.sol - 主投票合约

**关键功能**:
- `createElection()`: 管理员创建选举
- `addCandidate()`: 添加候选人
- `castVote()`: 选民提交投票承诺（Commit 阶段）
- `revealVote()`: 选举结束后揭示投票（Reveal 阶段）
- `updateMerkleRoot()`: 更新投票的 Merkle 根哈希

**状态机**:
```
Created → Active → Ended → Tallied
  ↓         ↓        ↓
添加候选人  投票    揭示投票
```

**关键数据结构**:
- `Election`: 选举元数据（标题、时间、状态、候选人数、总票数）
- `Candidate`: 候选人信息（ID、名称、得票数）
- `VoteRecord`: 投票记录（承诺哈希、时间戳、是否揭示）

**安全机制**:
- `onlyAdmin`: 仅管理员可创建选举
- `electionActive`: 仅在选举活跃期间可投票
- 重复投票检查：`require(voteRecords[...].commitment == bytes32(0))`

#### VoterRegistry.sol - 选民注册合约

**功能**: 管理合法选民地址白名单

#### MerkleVerifier.sol - Merkle 验证合约

**功能**: 验证投票是否被正确记录在 Merkle 树中

---

### 2. 密码学模块 (Python)

#### paillier.py - 同态加密

**核心类**: `PaillierCrypto`

**关键方法**:
```python
# 生成密钥对
crypto = PaillierCrypto.generate_keypair(key_size=2048)

# 加密投票
encrypted_vote = crypto.encrypt(candidate_id)

# 同态加法（核心特性）
total = crypto.add_encrypted([enc_vote1, enc_vote2, enc_vote3])

# 解密结果
result = crypto.decrypt(total)
```

**应用场景**:
- 选民投票时加密候选人 ID
- 计票时直接累加加密投票（无需解密单张选票）
- 最终解密总票数

**安全优势**:
- 计票过程中无人知道单张选票内容
- 只有持有私钥的选举管理员可解密最终结果

#### merkle.py - Merkle 树

**功能**:
- 构建投票承诺的 Merkle 树
- 生成每张选票的 Merkle 证明
- 验证证明有效性

**用途**:
- 选民可以验证自己的投票被正确记录
- 防止选票被篡改或删除

#### commitment.py - 承诺方案

**Commit-Reveal 流程**:
1. **Commit 阶段**（投票期间）:
   ```python
   commitment = hash(candidate_id + salt)
   # 将 commitment 提交到区块链
   ```
2. **Reveal 阶段**（选举结束后）:
   ```python
   # 公开 candidate_id 和 salt
   # 智能合约验证: hash(candidate_id + salt) == commitment
   ```

**防止作弊**:
- 投票期间无人知道投票内容（因为只提交了哈希）
- 选举结束后才能揭示，防止提前泄露结果

---

### 3. 后端服务 (FastAPI)

#### API 端点

**认证模块** (`/auth`):
```python
POST /auth/register  # 用户注册
POST /auth/login     # 用户登录（返回JWT）
```

**投票模块** (`/vote`):
```python
POST /vote/commitment  # 提交投票承诺
GET  /vote/results     # 获取选举结果
POST /vote/reveal      # 揭示投票（选举结束后）
```

**验证模块** (`/verify`):
```python
POST /verify/commitment  # 验证投票承诺的 Merkle 证明
```

#### 服务层架构

**BlockchainService**:
- 使用 Web3.py 与以太坊交互
- 调用智能合约方法
- 监听区块链事件

**VotingService**:
- 协调密码学模块和区块链服务
- 处理投票业务逻辑

**AuthService**:
- JWT Token 生成与验证
- 密码哈希（bcrypt）

---

## 关键工作流程

### 完整投票流程

```
1. 选举创建阶段
   管理员 → POST /admin/election/create
         → Voting.createElection()
         → 添加候选人
         → Voting.addCandidate()
         → 启动选举
         → Voting.startElection()

2. 投票阶段
   选民 → 选择候选人 (candidate_id)
        → 生成随机盐值 (salt)
        → 计算承诺 commitment = hash(candidate_id + salt)
        → 使用 Paillier 加密 candidate_id
        → POST /vote/commitment
        → Voting.castVote(commitment)
        → 后端构建 Merkle 树
        → Voting.updateMerkleRoot()

3. 选举结束
   管理员 → Voting.endElection()

4. 揭示阶段
   选民 → POST /vote/reveal (公开 candidate_id 和 salt)
        → Voting.revealVote()
        → 验证 hash(candidate_id + salt) == commitment
        → 候选人票数 +1

5. 验证阶段
   选民 → POST /verify/commitment (获取 Merkle 证明)
        → MerkleVerifier.verify()
        → 确认投票已记录
```

---

## 安全考量

### 已实现的安全措施

1. **投票隐私**:
   - Paillier 同态加密保护投票内容
   - 只有管理员私钥可解密最终结果

2. **防篡改**:
   - 区块链不可篡改特性
   - Merkle 树验证投票完整性

3. **防重复投票**:
   - 智能合约检查 `voteRecords[voter]`
   - 每个地址只能投一票

4. **防提前泄露**:
   - Commit-Reveal 机制
   - 投票期间只提交哈希，无法推断投票内容

5. **身份认证**:
   - JWT Token 身份验证
   - 以太坊地址作为投票身份

### 潜在风险与改进建议

**风险**:
1. **密钥管理**: 管理员私钥若泄露，可解密所有投票
2. **中心化问题**: 后端服务器故障影响投票
3. **Gas 费用**: 大规模选举可能产生高昂交易成本

**改进方向**:
1. 使用多签钱包管理管理员权限
2. 实现去中心化存储（IPFS）
3. Layer 2 方案降低 Gas 费用（如 Polygon）

---

## 开发指南

### 环境配置

**必需工具**:
- Node.js 16+ (Hardhat)
- Python 3.9+
- Metamask 钱包
- Infura 或 Alchemy API Key（连接 Sepolia 测试网）

**环境变量** (`.env`):
```bash
# 以太坊配置
PRIVATE_KEY=0x...              # 部署账户私钥
RPC_URL=https://sepolia.infura.io/v3/...
CONTRACT_ADDRESS=0x...         # 已部署合约地址

# 后端配置
DATABASE_URL=sqlite:///./voting.db
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
```

### 快速启动

```bash
# 1. 安装依赖
npm install
pip install -r blockchain-evoting/requirements.txt

# 2. 编译合约
npm run compile

# 3. 部署合约（Sepolia 测试网）
npm run deploy:sepolia

# 4. 启动后端
cd blockchain-evoting/backend
uvicorn main:app --reload --port 8000

# 5. 访问前端
# 在浏览器打开 frontend/index.html
```

### 测试

```bash
# 智能合约测试
npm run test

# Python 模块测试
cd blockchain-evoting
python -m pytest tests/ -v
```

---

## AI 助手工作指南

### 代码修改建议

**修改智能合约时**:
1. 先检查 OpenZeppelin 是否有现成方案
2. 添加完善的 NatSpec 注释（`@notice`, `@param`, `@return`）
3. 考虑 Gas 优化（使用 `calldata` 而非 `memory`）
4. 添加事件日志（`emit` 关键事件）

**修改后端代码时**:
1. 遵循 FastAPI 最佳实践（依赖注入、异步处理）
2. 使用类型提示（Type Hints）
3. 添加中文和英文双语注释
4. 捕获并处理区块链交互异常（网络错误、交易失败）

**修改密码学模块时**:
1. 确保加密参数安全（密钥长度至少 2048 位）
2. 添加输入验证（防止空值、负数）
3. 编写单元测试验证加密解密正确性

### 常见问题排查

**问题**: 合约部署失败
- 检查 `.env` 中的私钥和 RPC URL
- 确保账户有足够 Sepolia ETH（从水龙头获取）
- 检查 Hardhat 网络配置

**问题**: Web3.py 连接失败
- 验证 RPC URL 可访问性
- 检查合约地址是否正确
- 查看后端日志中的错误信息

**问题**: Paillier 加密速度慢
- 降低密钥长度（开发环境可用 1024 位）
- 考虑批量加密优化

---

## 贡献指南

**代码风格**:
- Python: PEP 8
- Solidity: Solidity Style Guide
- JavaScript: Airbnb JavaScript Style Guide

**提交规范**:
- 使用 Conventional Commits 格式
- 中文和英文混合注释

**测试覆盖率**:
- 智能合约关键函数需 100% 测试覆盖
- 后端 API 需集成测试

---

## 相关资源

**文档链接**:
- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [Solidity by Example](https://solidity-by-example.org/)
- [Web3.py 文档](https://web3py.readthedocs.io/)
- [Paillier 加密原理](https://en.wikipedia.org/wiki/Paillier_cryptosystem)

**工具链**:
- [Hardhat](https://hardhat.org/) - 智能合约开发环境
- [Sepolia Faucet](https://sepoliafaucet.com/) - 测试网 ETH 水龙头
- [Etherscan Sepolia](https://sepolia.etherscan.io/) - 区块浏览器

---

## 版本历史

- **v1.0.0** (2024-01): 初始版本
  - 基础投票功能
  - Paillier 同态加密
  - Commit-Reveal 承诺方案
  - Merkle 树验证

---

## 联系方式

如有技术问题或改进建议，请通过项目 Issue 系统反馈。

---

**最后更新**: 2026-01-29
**文档版本**: 1.0.0
