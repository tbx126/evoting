# 区块链电子投票系统 (ZKP)

基于以太坊的安全电子投票系统，采用 ElGamal 同态加密和零知识证明 (Groth16) 保护投票隐私。

## 功能特性

- **投票隐私**: ElGamal 同态加密 (BabyJubJub 曲线)，投票内容始终加密
- **零知识证明**: Groth16 ZKP 验证投票合法性和计票正确性
- **可验证性**: Poseidon 承诺 + Merkle 树证明投票被正确记录
- **区块链存储**: 以太坊智能合约保证数据不可篡改

## 技术栈

- **智能合约**: Solidity 0.8.20 + Hardhat + OpenZeppelin
- **ZKP**: circom 2.2.3 + snarkjs (Groth16)
- **密码学**: ElGamal on BabyJubJub + Poseidon 哈希
- **后端**: Python FastAPI (静态文件服务器)
- **前端**: HTML + JavaScript + ethers.js (直连区块链)
- **网络**: Ethereum Sepolia 测试网 / Hardhat Localhost

## 项目结构

```
├── contracts/               # Solidity 智能合约 (Voting, VoterRegistry, Verifiers)
├── circuits/                # circom ZKP 电路 (vote_proof, tally_proof)
├── crypto/                  # Python ElGamal 实现 (BabyJubJub)
├── frontend/                # 前端页面 + JS ElGamal 库 + ZKP 资源
├── server.py                # FastAPI 静态文件服务器
├── scripts/                 # Hardhat 部署/交互脚本
├── test/                    # 智能合约测试 (33 tests, Groth16)
├── tests/                   # Python ElGamal 测试 (43 tests)
└── start_server.bat         # Windows 一键启动
```

## 快速开始

### 1. 安装依赖

```bash
npm install
pip install -r requirements.txt
```

### 2. 本地开发

```bash
npx hardhat compile
npx hardhat node                              # Terminal 1
npx hardhat run scripts/deploy-local.js --network localhost  # Terminal 2
python -m uvicorn server:app --port 8000  # Terminal 3
```

### 3. 访问页面

- 选民投票页面: http://localhost:8000/
- 管理员控制台: http://localhost:8000/admin

### 4. 部署到 Sepolia

```bash
cp .env.example .env
# 编辑 .env，填入 SEPOLIA_RPC_URL 和 PRIVATE_KEY
npx hardhat run scripts/deploy.js --network sepolia
```

## 使用流程

1. **管理员** 在 /admin 页面添加候选人（至少 2 个）
2. **管理员** 注册选民地址
3. **管理员** 启动选举
4. **选民** 在 / 页面连接 MetaMask，选择候选人投票（自动生成 ZKP）
5. **管理员** 结束选举
6. **管理员** 输入 ElGamal 私钥，计票并上传结果（含 ZKP3 证明）

## 测试

```bash
# 智能合约测试 (33 tests, 含真实 Groth16 证明)
npx hardhat test

# Python ElGamal 测试 (43 tests)
python -m pytest tests/ -v
```

## 安全说明

- 私钥请妥善保管，切勿提交到 Git
- `.env` 和 `frontend/config.js` 已在 `.gitignore` 中排除
- ZKP 资源文件 (WASM/zkey) 已在 `.gitignore` 中排除，需本地构建

## Audit Bundle and Anonymous Vote Verification

This project now supports a commitment-based Merkle audit workflow:

1. Admin side:
   - During tally, the admin page builds a Merkle tree from on-chain vote commitments.
   - The Merkle root is submitted to `updateTallyResults`.
   - An `audit_bundle.json` is exported and cached locally.

2. Voter side:
   - The voter keeps a local receipt containing `candidateId`, `salt`, and `commitment`.
   - The voter page loads `audit_bundle.json` and verifies inclusion locally.
   - Verification does not require address-based lookup.

Merkle rules in this repository:
- Leaf: `leaf = commitment` (no extra leaf hashing)
- Internal node: `keccak256(abi.encodePacked(left, right))`
- Odd layer handling: duplicate the last node
