/**
 * 完整投票流程演示 (ZKP 版本)
 * Full Voting Demo on Sepolia with Real ZKP Proofs
 *
 * 运行: npx hardhat run scripts/full-demo.js --network sepolia
 */

const hre = require("hardhat");
const snarkjs = require("snarkjs");
const path = require("path");

// Circuit file paths
const VOTE_WASM = path.join(__dirname, "../build/vote_proof_js/vote_proof.wasm");
const VOTE_ZKEY = path.join(__dirname, "../build/vote_proof_final.zkey");

const NUM_CANDIDATES = 3;

// 从 .env 读取合约地址（由 deploy.js 自动写入）
const CONTRACTS = {
  VoterRegistry: process.env.VOTER_REGISTRY_ADDRESS,
  Voting: process.env.VOTING_CONTRACT_ADDRESS
};

// ─── ElGamal + ZKP Helpers ─────────────────────────────────

let babyJub, poseidon, F;

async function initCrypto() {
  const circomlibjs = require("circomlibjs");
  babyJub = await circomlibjs.buildBabyjub();
  poseidon = await circomlibjs.buildPoseidon();
  F = babyJub.F;
}

function toF(bi) { return F.e(bi); }
function fromF(fe) { return F.toObject(fe); }

function elgamalEncrypt(m, pk, r) {
  const GX = 5299619240641551281634865583518297030282874472190772894086521144482721001553n;
  const GY = 16950150798460657717958625567821834550301663161624707787222815936182638968203n;
  const G = [toF(GX), toF(GY)];
  const c1 = babyJub.mulPointEscalar(G, r);
  const mG = (m === 0n) ? [F.zero, F.one] : babyJub.mulPointEscalar(G, m);
  const rPK = babyJub.mulPointEscalar(pk, r);
  const c2 = babyJub.addPoint(mG, rPK);
  return { c1, c2 };
}

function poseidonHash(inputs) {
  const hash = poseidon(inputs.map(x => toF(BigInt(x))));
  return fromF(hash);
}

function bigintToBytes32(bi) {
  return "0x" + bi.toString(16).padStart(64, "0");
}

function randomBigInt() {
  const bytes = require("crypto").randomBytes(31);
  let r = 0n;
  for (const b of bytes) r = (r << 8n) | BigInt(b);
  return r;
}

async function generateVoteProof(candidateId, pk) {
  const salt = randomBigInt();
  const randomness = [];
  const ciphertexts = [];

  for (let i = 0; i < NUM_CANDIDATES; i++) {
    const r = randomBigInt();
    randomness.push(r);
    ciphertexts.push(elgamalEncrypt(i === candidateId ? 1n : 0n, pk, r));
  }

  const commitment = poseidonHash([candidateId, salt]);
  const ctComponents = [];
  for (const ct of ciphertexts) {
    ctComponents.push(fromF(ct.c1[0]));
    ctComponents.push(fromF(ct.c1[1]));
    ctComponents.push(fromF(ct.c2[0]));
    ctComponents.push(fromF(ct.c2[1]));
  }
  const ciphertextHash = poseidonHash(ctComponents);

  const pkBI = [fromF(pk[0]), fromF(pk[1])];
  const witnessInput = {
    commitment: commitment.toString(),
    ciphertextHash: ciphertextHash.toString(),
    pkX: pkBI[0].toString(),
    pkY: pkBI[1].toString(),
    candidateId: candidateId.toString(),
    salt: salt.toString(),
    r: randomness.map(r => r.toString()),
    c1X: ciphertexts.map(ct => fromF(ct.c1[0]).toString()),
    c1Y: ciphertexts.map(ct => fromF(ct.c1[1]).toString()),
    c2X: ciphertexts.map(ct => fromF(ct.c2[0]).toString()),
    c2Y: ciphertexts.map(ct => fromF(ct.c2[1]).toString()),
  };

  console.log("  Generating ZKP proof (this may take a moment)...");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witnessInput, VOTE_WASM, VOTE_ZKEY
  );

  const calldataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [proofA, proofB, proofC] = JSON.parse("[" + calldataStr + "]");

  return {
    commitmentBytes32: bigintToBytes32(commitment),
    ciphertextHashBytes32: bigintToBytes32(ciphertextHash),
    proofA, proofB, proofC,
    encryptedVoteArray: ctComponents.map(x => x.toString()),
    salt,
  };
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Sepolia 测试网 - 完整投票流程演示 (ZKP)");
  console.log("=".repeat(60));

  await initCrypto();

  const [admin] = await hre.ethers.getSigners();
  console.log("\n管理员账户:", admin.address);

  const VoterRegistry = await hre.ethers.getContractFactory("VoterRegistry");
  const voterRegistry = VoterRegistry.attach(CONTRACTS.VoterRegistry);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = Voting.attach(CONTRACTS.Voting);

  // 读取 ElGamal 公钥
  const pkRaw = await voting.getElgamalPK();
  const pk = [toF(pkRaw[0]), toF(pkRaw[1])];
  console.log("ElGamal PK loaded from contract");

  let info = await voting.getElectionInfo();
  let currentStatus = Number(info._status);
  const statusNames = ["Created", "Active", "Ended", "Tallied"];
  console.log("当前选举状态:", statusNames[currentStatus]);

  // ============ 步骤 1: 注册选民 ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 1: 注册选民");
  console.log("-".repeat(60));

  const isRegistered = await voterRegistry.isRegistered(admin.address);
  if (!isRegistered) {
    console.log("正在注册当前账户为选民...");
    const tx = await voterRegistry.registerVoter(admin.address);
    await tx.wait();
    console.log("  交易哈希:", tx.hash);
  } else {
    console.log("当前账户已注册为选民");
  }

  // ============ 步骤 2: 启动选举 ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 2: 启动选举");
  console.log("-".repeat(60));

  if (currentStatus === 0) {
    const tx = await voting.startElection();
    await tx.wait();
    console.log("选举已启动");
    currentStatus = 1;
  } else if (currentStatus === 1) {
    console.log("选举已在进行中");
  } else {
    console.log("选举已结束");
  }

  // ============ 步骤 3: 投票 (ZKP) ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 3: 投票 (ZKP 零知识证明)");
  console.log("-".repeat(60));

  const hasVoted = await voterRegistry.hasVoted(admin.address);
  if (!hasVoted && currentStatus === 1) {
    const candidateId = 0; // Vote for Alice
    console.log("  选择候选人: ID", candidateId);

    const voteData = await generateVoteProof(candidateId, pk);
    console.log("  ZKP proof generated");
    console.log("  Commitment:", voteData.commitmentBytes32.slice(0, 20) + "...");

    console.log("  正在提交投票到链上...");
    const tx = await voting.castVote(
      voteData.commitmentBytes32,
      voteData.ciphertextHashBytes32,
      voteData.proofA, voteData.proofB, voteData.proofC,
      voteData.encryptedVoteArray
    );
    await tx.wait();
    console.log("  投票成功！");
    console.log("  交易哈希:", tx.hash);
    console.log("  Etherscan:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    console.log("\n  请保存 salt (用于事后验证):", voteData.salt.toString());
  } else if (hasVoted) {
    console.log("当前账户已投票");
  } else {
    console.log("无法投票（选举未在进行中）");
  }

  // ============ 步骤 4: 查看最终状态 ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 4: 查看最终状态");
  console.log("-".repeat(60));

  info = await voting.getElectionInfo();
  console.log("\n选举信息:");
  console.log("  标题:", info._title);
  console.log("  状态:", statusNames[Number(info._status)]);
  console.log("  总投票数:", info._totalVotes.toString());

  const totalVoters = await voterRegistry.totalVoters();
  console.log("  已注册选民:", totalVoters.toString());

  console.log("\n" + "=".repeat(60));
  console.log("  演示完成！");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });
