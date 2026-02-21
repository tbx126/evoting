/**
 * 合约部署脚本 (本地 + Sepolia 通用)
 *
 * 本地: npx hardhat run scripts/deploy.js --network localhost
 * 测试网: npx hardhat run scripts/deploy.js --network sepolia
 *
 * 本地模式额外操作: 添加候选人 张三/李四, 注册前5个测试账户为选民
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEV_SK = "12345678901234567890";

async function computeElGamalPK(sk) {
  const { buildBabyjub } = require("circomlibjs");
  const bjj = await buildBabyjub();
  const F = bjj.F;
  const G = [
    F.e(5299619240641551281634865583518297030282874472190772894086521144482721001553n),
    F.e(16950150798460657717958625567821834550301663161624707787222815936182638968203n),
  ];
  const pk = bjj.mulPointEscalar(G, BigInt(sk));
  return [F.toObject(pk[0]).toString(), F.toObject(pk[1]).toString()];
}

async function main() {
  const isLocal = ["localhost", "hardhat"].includes(hre.network.name);
  console.log("部署网络:", hre.network.name);

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  console.log("部署账户:", deployer.address);

  // ElGamal 公钥
  let pkX, pkY;
  if (process.env.ELGAMAL_PK_X && process.env.ELGAMAL_PK_Y) {
    [pkX, pkY] = [process.env.ELGAMAL_PK_X, process.env.ELGAMAL_PK_Y];
  } else {
    const sk = isLocal ? DEV_SK : (process.env.ELGAMAL_SK || DEV_SK);
    [pkX, pkY] = await computeElGamalPK(sk);
    console.log(`ElGamal PK 计算完成 (sk=${sk.slice(0, 8)}...)`);
  }

  // 部署所有合约
  console.log("\n部署合约...");
  const deploy = async (name, ...args) => {
    const c = await (await hre.ethers.getContractFactory(name)).deploy(...args);
    await c.waitForDeployment();
    const addr = await c.getAddress();
    console.log(`  ${name}: ${addr}`);
    return { contract: c, addr };
  };

  const { contract: registry, addr: regAddr }     = await deploy("VoterRegistry");
  const { addr: voteVerAddr }                      = await deploy("VoteVerifier");
  const { addr: tallyVerAddr }                     = await deploy("TallyVerifier");
  const { contract: voting, addr: votingAddr }     = await deploy("Voting",
    regAddr, "2026年度评选", "零知识证明保护投票隐私", voteVerAddr, tallyVerAddr, [pkX, pkY]);
  const { addr: merkleAddr }                       = await deploy("MerkleVerifier");

  await (await registry.setVotingContract(votingAddr)).wait();

  // 本地模式: 初始化候选人和选民
  if (isLocal) {
    for (const name of ["张三", "李四"]) {
      await (await voting.addCandidate(name)).wait();
    }
    const voters = signers.slice(1, 6).map(s => s.address);
    await (await registry.registerVotersBatch(voters)).wait();
    console.log("\n本地初始化: 2个候选人, 5个选民已注册");
  }

  // 更新 .env
  const envPath = path.resolve(__dirname, "../.env");
  let env = "";
  try { env = fs.readFileSync(envPath, "utf8"); } catch (_) {}
  env = env.replace(/^(VOTING_CONTRACT_ADDRESS|VOTER_REGISTRY_ADDRESS|MERKLE_VERIFIER_ADDRESS|VOTE_VERIFIER_ADDRESS|TALLY_VERIFIER_ADDRESS)=.*\n?/gm, "");
  env = env.replace(/\n# 合约地址[\s\S]*?(?=\n#|$)/, "");
  if (!env.endsWith("\n")) env += "\n";
  env += `\n# 合约地址\nVOTING_CONTRACT_ADDRESS=${votingAddr}\nVOTER_REGISTRY_ADDRESS=${regAddr}\nMERKLE_VERIFIER_ADDRESS=${merkleAddr}\nVOTE_VERIFIER_ADDRESS=${voteVerAddr}\nTALLY_VERIFIER_ADDRESS=${tallyVerAddr}\n`;
  fs.writeFileSync(envPath, env);

  // 生成 frontend/config.js
  const networkCfg = isLocal
    ? `{ name:"Localhost", chainId:31337, chainIdHex:"0x7a69" }`
    : `{ name:"Sepolia", chainId:11155111, chainIdHex:"0xaa36a7", rpcUrl:"https://rpc.sepolia.org", explorerUrl:"https://sepolia.etherscan.io" }`;

  const devLine = isLocal ? `\n  DEV_ADMIN_SK: "${DEV_SK}",` : "";

  fs.writeFileSync(path.resolve(__dirname, "../frontend/config.js"),
`// 合约配置 (由 deploy.js 自动生成)
const CONTRACT_CONFIG = {
  VOTING_ADDRESS: "${votingAddr}",
  VOTER_REGISTRY_ADDRESS: "${regAddr}",
  MERKLE_VERIFIER_ADDRESS: "${merkleAddr}",
  VOTE_VERIFIER_ADDRESS: "${voteVerAddr}",
  TALLY_VERIFIER_ADDRESS: "${tallyVerAddr}",
  NETWORK: ${networkCfg},
  ELGAMAL_PK: { x:"${pkX}", y:"${pkY}" },${devLine}
  ZKP: {
    VOTE_PROOF_WASM: "zk/vote_proof.wasm",
    VOTE_PROOF_ZKEY: "zk/vote_proof_final.zkey",
    TALLY_PROOF_WASM: "zk/tally_proof.wasm",
    TALLY_PROOF_ZKEY: "zk/tally_proof_final.zkey"
  }
};`);

  console.log("\n部署完成:");
  console.log("  Voting:        ", votingAddr);
  console.log("  VoterRegistry: ", regAddr);
  console.log("  VoteVerifier:  ", voteVerAddr);
  console.log("  TallyVerifier: ", tallyVerAddr);
  console.log("  MerkleVerifier:", merkleAddr);

  if (isLocal) {
    console.log("\n启动服务: python -m uvicorn server:app --port 8000");
    console.log("投票页面: http://localhost:8000/");
    console.log("管理页面: http://localhost:8000/admin");
    console.log("ElGamal私钥:", DEV_SK);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error("部署失败:", e); process.exit(1); });
