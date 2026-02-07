# 区块链电子投票系统

基于以太坊的安全电子投票系统，采用同态加密和承诺方案保护投票隐私，部署在 Sepolia 测试网上。

## 功能特性

- **投票隐私**: Paillier 同态加密保护投票内容
- **可验证性**: Merkle 树证明确保投票被正确记录
- **承诺方案**: Commit-Reveal 机制防止投票篡改
- **区块链存储**: 以太坊智能合约保证数据不可篡改

## 技术栈

- **智能合约**: Solidity 0.8.20 + Hardhat + OpenZeppelin
- **后端**: Python FastAPI (静态文件服务器)
- **前端**: HTML + JavaScript + ethers.js (直连区块链)
- **密码学**: Paillier 同态加密 (phe) + Merkle 树 + 承诺方案
- **网络**: Ethereum Sepolia 测试网

## 项目结构

```
blockchain-evoting/
├── contracts/               # Solidity 智能合约
│   ├── Voting.sol           # 主投票合约（选举、投票、计票）
│   ├── VoterRegistry.sol    # 选民注册合约
│   └── MerkleVerifier.sol   # Merkle 树验证合约
├── crypto/                  # 密码学模块 (Python)
│   ├── paillier.py          # Paillier 同态加密
│   ├── merkle.py            # Merkle 树构建与验证
│   └── commitment.py        # Commit-Reveal 承诺方案
├── backend/                 # FastAPI 静态文件服务器
│   └── main.py              # 服务 voting-app.html 和 admin.html
├── frontend/                # 前端页面（直连区块链）
│   ├── voting-app.html      # 选民投票页面
│   ├── admin.html           # 管理员控制台
│   └── config.js            # 合约地址配置（deploy.js 自动生成）
├── scripts/                 # Hardhat 脚本
│   ├── deploy.js            # 合约部署（自动写入地址到 .env 和 config.js）
│   ├── interact.js          # 合约交互 CLI 工具
│   ├── full-demo.js         # 完整投票流程演示
│   ├── register-voter.js    # 注册选民
│   └── status.js            # 查看选举状态
├── test/                    # 智能合约测试 (JavaScript)
│   └── Voting.test.js
├── tests/                   # Python 测试
│   ├── test_crypto.py       # 密码学模块测试
│   └── test_homomorphic_voting.py  # 同态投票测试
├── demo_voting.py           # 同态加密投票离线演示
├── hardhat.config.js        # Hardhat 配置
├── package.json             # Node.js 依赖
├── requirements.txt         # Python 依赖
├── .env.example             # 环境变量模板
└── start_server.bat         # Windows 一键启动服务器
```

## 快速开始

### 1. 安装依赖

```bash
cd blockchain-evoting
npm install
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入：
- `SEPOLIA_RPC_URL` - Infura 或 Alchemy 的 Sepolia RPC URL
- `PRIVATE_KEY` - 部署账户私钥（不带 0x 前缀）

### 3. 编译并部署合约到 Sepolia

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

部署完成后，合约地址会自动写入 `.env` 和 `frontend/config.js`，无需手动修改。

### 4. 启动服务器

```bash
uvicorn backend.main:app --port 8000
```

或使用一键脚本：
```bash
start_server.bat
```

### 5. 访问页面

- 选民投票页面: http://localhost:8000/
- 管理员控制台: http://localhost:8000/admin

## 使用流程

1. **管理员** 在 admin.html 添加候选人（至少 2 个）
2. **管理员** 注册选民地址
3. **管理员** 启动选举
4. **选民** 在 voting-app.html 连接 MetaMask 投票
5. **管理员** 结束选举
6. **管理员** 上传计票结果

## 测试

```bash
# 智能合约测试（27 个测试）
npx hardhat test

# Python 密码学模块测试
python -m pytest tests/ -v

# 同态加密离线演示
python demo_voting.py
```

## Hardhat 脚本

```bash
# 查看选举状态
npx hardhat run scripts/status.js --network sepolia

# 完整投票流程演示
npx hardhat run scripts/full-demo.js --network sepolia

# 注册选民
set VOTER_ADDRESS=0x... && npx hardhat run scripts/register-voter.js --network sepolia

# 交互式 CLI
npx hardhat run scripts/interact.js --network sepolia -- status
npx hardhat run scripts/interact.js --network sepolia -- add-candidates
npx hardhat run scripts/interact.js --network sepolia -- start-election
```

## 安全说明

- 私钥请妥善保管，切勿提交到 Git
- `.env` 和 `frontend/config.js` 已在 `.gitignore` 中排除
- 建议在测试网充分测试后再部署主网
