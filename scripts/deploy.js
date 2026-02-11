/**
 * 智能合约部署脚本 (ZKP 版本)
 * Deploy Script for E-Voting Smart Contracts with ZKP Verification
 *
 * 使用方法:
 *   本地: npx hardhat run scripts/deploy.js --network localhost
 *   测试网: npx hardhat run scripts/deploy.js --network sepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// 默认开发用 ElGamal 私钥 (仅用于测试/开发, 生产环境应使用安全生成的密钥)
const DEFAULT_ADMIN_SK = "12345678901234567890";

async function computeElGamalPK(sk) {
  const circomlibjs = require("circomlibjs");
  const babyJub = await circomlibjs.buildBabyjub();
  const F = babyJub.F;
  const G = [
    F.e(5299619240641551281634865583518297030282874472190772894086521144482721001553n),
    F.e(16950150798460657717958625567821834550301663161624707787222815936182638968203n)
  ];
  const pk = babyJub.mulPointEscalar(G, BigInt(sk));
  return [F.toObject(pk[0]).toString(), F.toObject(pk[1]).toString()];
}

async function main() {
  console.log("=".repeat(60));
  console.log("  区块链电子投票系统 - 智能合约部署 (ZKP 版本)");
  console.log("=".repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("\n部署账户:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.formatEther(balance), "ETH");

  // 从环境变量加载 ElGamal 公钥，或从私钥计算
  let elgamalPKX, elgamalPKY;
  if (process.env.ELGAMAL_PK_X && process.env.ELGAMAL_PK_Y) {
    elgamalPKX = process.env.ELGAMAL_PK_X;
    elgamalPKY = process.env.ELGAMAL_PK_Y;
    console.log("\n使用环境变量中的 ElGamal 公钥");
  } else {
    const sk = process.env.ELGAMAL_SK || DEFAULT_ADMIN_SK;
    console.log("\n从私钥计算 ElGamal 公钥 (sk =", sk, ")...");
    [elgamalPKX, elgamalPKY] = await computeElGamalPK(sk);
  }
  console.log("ElGamal 公钥:");
  console.log("  PK.x:", elgamalPKX);
  console.log("  PK.y:", elgamalPKY);

  // ============ 步骤 1: 部署 VoterRegistry ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 1: 部署 VoterRegistry 合约");
  console.log("-".repeat(60));

  const VoterRegistry = await hre.ethers.getContractFactory("VoterRegistry");
  const voterRegistry = await VoterRegistry.deploy();
  await voterRegistry.waitForDeployment();

  const voterRegistryAddress = await voterRegistry.getAddress();
  console.log("VoterRegistry 部署成功");
  console.log("  地址:", voterRegistryAddress);

  // ============ 步骤 2: 部署 VoteVerifier ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 2: 部署 VoteVerifier 合约 (ZKP1+ZKP2)");
  console.log("-".repeat(60));

  const VoteVerifier = await hre.ethers.getContractFactory("VoteVerifier");
  const voteVerifier = await VoteVerifier.deploy();
  await voteVerifier.waitForDeployment();

  const voteVerifierAddress = await voteVerifier.getAddress();
  console.log("VoteVerifier 部署成功");
  console.log("  地址:", voteVerifierAddress);

  // ============ 步骤 3: 部署 TallyVerifier ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 3: 部署 TallyVerifier 合约 (ZKP3)");
  console.log("-".repeat(60));

  const TallyVerifier = await hre.ethers.getContractFactory("TallyVerifier");
  const tallyVerifier = await TallyVerifier.deploy();
  await tallyVerifier.waitForDeployment();

  const tallyVerifierAddress = await tallyVerifier.getAddress();
  console.log("TallyVerifier 部署成功");
  console.log("  地址:", tallyVerifierAddress);

  // ============ 步骤 4: 部署 Voting ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 4: 部署 Voting 合约 (ZKP 版本)");
  console.log("-".repeat(60));

  const electionTitle = "2026 年度最佳员工评选";
  const electionDescription = "使用零知识证明保护投票隐私";

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(
    voterRegistryAddress,
    electionTitle,
    electionDescription,
    voteVerifierAddress,
    tallyVerifierAddress,
    [elgamalPKX, elgamalPKY]
  );
  await voting.waitForDeployment();

  const votingAddress = await voting.getAddress();
  console.log("Voting 合约部署成功");
  console.log("  地址:", votingAddress);
  console.log("  标题:", electionTitle);

  // ============ 步骤 5: 部署 MerkleVerifier ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 5: 部署 MerkleVerifier 合约");
  console.log("-".repeat(60));

  const MerkleVerifier = await hre.ethers.getContractFactory("MerkleVerifier");
  const merkleVerifier = await MerkleVerifier.deploy();
  await merkleVerifier.waitForDeployment();

  const merkleVerifierAddress = await merkleVerifier.getAddress();
  console.log("MerkleVerifier 部署成功");
  console.log("  地址:", merkleVerifierAddress);

  // ============ 步骤 6: 关联合约 ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 6: 关联 VoterRegistry 和 Voting 合约");
  console.log("-".repeat(60));

  const tx = await voterRegistry.setVotingContract(votingAddress);
  await tx.wait();
  console.log("VoterRegistry.setVotingContract() 调用成功");

  // ============ 步骤 7: 保存合约地址 ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 7: 保存合约地址到 .env 和 frontend/config.js");
  console.log("-".repeat(60));

  // 更新 .env 文件
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf8");
  } catch (e) {
    // .env may not exist yet
  }

  // 移除旧的合约地址配置
  envContent = envContent.replace(/\n# ============ 合约地址[\s\S]*?(?=\n# ====|$)/, "");
  envContent = envContent.replace(/^VOTING_CONTRACT_ADDRESS=.*\n?/gm, "");
  envContent = envContent.replace(/^VOTER_REGISTRY_ADDRESS=.*\n?/gm, "");
  envContent = envContent.replace(/^MERKLE_VERIFIER_ADDRESS=.*\n?/gm, "");
  envContent = envContent.replace(/^VOTE_VERIFIER_ADDRESS=.*\n?/gm, "");
  envContent = envContent.replace(/^TALLY_VERIFIER_ADDRESS=.*\n?/gm, "");

  if (!envContent.endsWith("\n")) envContent += "\n";

  envContent += `
# ============ 合约地址 (由 deploy.js 自动生成) ============
VOTING_CONTRACT_ADDRESS=${votingAddress}
VOTER_REGISTRY_ADDRESS=${voterRegistryAddress}
MERKLE_VERIFIER_ADDRESS=${merkleVerifierAddress}
VOTE_VERIFIER_ADDRESS=${voteVerifierAddress}
TALLY_VERIFIER_ADDRESS=${tallyVerifierAddress}
`;

  fs.writeFileSync(envPath, envContent);
  console.log("合约地址已写入 .env");

  // 判断网络
  const networkName = hre.network.name;
  let networkConfig;
  if (networkName === "localhost" || networkName === "hardhat") {
    networkConfig = `{
    name: "Localhost",
    chainId: 31337,
    chainIdHex: "0x7a69",
    rpcUrl: "http://127.0.0.1:8545"
  }`;
  } else {
    networkConfig = `{
    name: "Sepolia",
    chainId: 11155111,
    chainIdHex: "0xaa36a7",
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io"
  }`;
  }

  // 生成 frontend/config.js
  const configContent = `// 合约配置 (由 deploy.js 自动生成，请勿手动修改)
// Generated by deploy.js - Do not edit manually
const CONTRACT_CONFIG = {
  VOTING_ADDRESS: "${votingAddress}",
  VOTER_REGISTRY_ADDRESS: "${voterRegistryAddress}",
  MERKLE_VERIFIER_ADDRESS: "${merkleVerifierAddress}",
  VOTE_VERIFIER_ADDRESS: "${voteVerifierAddress}",
  TALLY_VERIFIER_ADDRESS: "${tallyVerifierAddress}",
  NETWORK: ${networkConfig},
  // ElGamal 公钥 (BabyJubJub 点)
  ELGAMAL_PK: {
    x: "${elgamalPKX}",
    y: "${elgamalPKY}"
  },
  // ZKP 资源路径
  ZKP: {
    VOTE_PROOF_WASM: "zk/vote_proof.wasm",
    VOTE_PROOF_ZKEY: "zk/vote_proof_final.zkey",
    TALLY_PROOF_WASM: "zk/tally_proof.wasm",
    TALLY_PROOF_ZKEY: "zk/tally_proof_final.zkey"
  }
};
`;

  const configPath = path.resolve(__dirname, "../frontend/config.js");
  fs.writeFileSync(configPath, configContent);
  console.log("frontend/config.js 已生成");

  // ============ 部署总结 ============
  console.log("\n" + "=".repeat(60));
  console.log("  部署完成！合约地址汇总");
  console.log("=".repeat(60));
  console.log("\nVoterRegistry: ", voterRegistryAddress);
  console.log("VoteVerifier:  ", voteVerifierAddress);
  console.log("TallyVerifier: ", tallyVerifierAddress);
  console.log("Voting:        ", votingAddress);
  console.log("MerkleVerifier:", merkleVerifierAddress);

  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      VoterRegistry: voterRegistryAddress,
      VoteVerifier: voteVerifierAddress,
      TallyVerifier: tallyVerifierAddress,
      Voting: votingAddress,
      MerkleVerifier: merkleVerifierAddress
    },
    election: {
      title: electionTitle,
      description: electionDescription
    },
    elgamalPK: {
      x: elgamalPKX,
      y: elgamalPKY
    }
  };

  console.log("\n部署信息 (JSON):");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
