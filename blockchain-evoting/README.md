# 区块链电子投票系统
# Blockchain E-Voting System

基于以太坊的安全电子投票系统，采用同态加密和承诺方案保护投票隐私。

## 功能特性

- **投票隐私**: Paillier 同态加密保护投票内容
- **可验证性**: Merkle 树证明确保投票被正确记录
- **承诺方案**: Commit-Reveal 机制防止投票篡改
- **区块链存储**: 以太坊智能合约保证数据不可篡改

## 技术栈

- **智能合约**: Solidity 0.8.x
- **后端**: Python FastAPI
- **前端**: HTML + JavaScript
- **区块链**: Ethereum (Sepolia 测试网)

## 项目结构

```
blockchain-evoting/
├── contracts/          # Solidity 智能合约
│   ├── Voting.sol
│   ├── VoterRegistry.sol
│   └── MerkleVerifier.sol
├── crypto/             # 密码学模块
│   ├── paillier.py
│   ├── merkle.py
│   └── commitment.py
├── backend/            # FastAPI 后端
│   ├── main.py
│   ├── api/
│   └── services/
├── frontend/           # 前端页面
│   ├── index.html
│   └── js/
├── scripts/            # 部署脚本
│   └── deploy.py
└── tests/              # 测试文件
    └── test_crypto.py
```

## 安装

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 安装 Node.js 依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入配置
```

## 运行

### 启动后端服务

```bash
cd backend
uvicorn main:app --reload
```

### 部署智能合约

```bash
python scripts/deploy.py --key YOUR_PRIVATE_KEY
```

### 运行测试

```bash
python -m pytest tests/
```

## API 接口

### 认证

- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录

### 投票

- `POST /vote/commitment` - 提交投票承诺
- `GET /vote/results` - 获取投票结果

### 验证

- `POST /verify/commitment` - 验证投票承诺

## 安全说明

- 私钥请妥善保管，切勿泄露
- 生产环境请使用 HTTPS
- 建议在测试网充分测试后再部署主网
