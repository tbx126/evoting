/**
 * 查看选举状态
 * Check Election Status
 */

const hre = require("hardhat");

// 从 .env 读取合约地址（由 deploy.js 自动写入）
const CONTRACTS = {
  VoterRegistry: process.env.VOTER_REGISTRY_ADDRESS,
  Voting: process.env.VOTING_CONTRACT_ADDRESS
};

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("当前账户:", admin.address);

  // 连接到合约
  const VoterRegistry = await hre.ethers.getContractFactory("VoterRegistry");
  const voterRegistry = VoterRegistry.attach(CONTRACTS.VoterRegistry);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = Voting.attach(CONTRACTS.Voting);

  console.log("\n" + "=".repeat(60));
  console.log("  选举状态");
  console.log("=".repeat(60));

  const info = await voting.getElectionInfo();
  const statusNames = ["Created (已创建)", "Active (进行中)", "Ended (已结束)", "Tallied (已计票)"];

  console.log("\n选举信息:");
  console.log("  标题:", info._title);
  console.log("  描述:", info._description);
  console.log("  状态:", statusNames[Number(info._status)]);
  console.log("  候选人数:", info._candidateCount.toString());
  console.log("  总投票数:", info._totalVotes.toString());

  const candidateCount = Number(info._candidateCount);
  if (candidateCount > 0) {
    console.log("\n候选人列表:");
    for (let i = 0; i < candidateCount; i++) {
      const candidate = await voting.getCandidate(i);
      console.log(`  [${i}] ${candidate.name}: ${candidate.voteCount} 票`);
    }
  } else {
    console.log("\n候选人列表: (暂无)");
  }

  // ElGamal 公钥
  try {
    const pk = await voting.getElgamalPK();
    console.log("\nElGamal 公钥 (ZKP):");
    console.log("  PK.x:", pk[0].toString().slice(0, 30) + "...");
    console.log("  PK.y:", pk[1].toString().slice(0, 30) + "...");
  } catch (e) {
    // Contract may not have getElgamalPK
  }

  const totalVoters = await voterRegistry.totalVoters();
  console.log("\n选民信息:");
  console.log("  已注册选民数:", totalVoters.toString());

  // 检查当前账户状态
  const isRegistered = await voterRegistry.isRegistered(admin.address);
  const hasVoted = await voterRegistry.hasVoted(admin.address);
  console.log(`\n当前账户 (${admin.address}):`);
  console.log("  是否已注册:", isRegistered ? "是" : "否");
  console.log("  是否已投票:", hasVoted ? "是" : "否");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });
