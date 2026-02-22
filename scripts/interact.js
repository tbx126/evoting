/**
 * 与已部署合约交互的脚本
 * Interact with Deployed Contracts
 */

const hre = require("hardhat");

// 从 .env 读取合约地址（由 deploy.js 自动写入）
const CONTRACTS = {
  VoterRegistry: process.env.VOTER_REGISTRY_ADDRESS,
  Voting: process.env.VOTING_CONTRACT_ADDRESS,
  MerkleVerifier: process.env.MERKLE_VERIFIER_ADDRESS
};

async function main() {
  const [admin] = await hre.ethers.getSigners();
  console.log("当前账户:", admin.address);

  // 连接到合约
  const VoterRegistry = await hre.ethers.getContractFactory("VoterRegistry");
  const voterRegistry = VoterRegistry.attach(CONTRACTS.VoterRegistry);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = Voting.attach(CONTRACTS.Voting);

  // 获取命令行参数
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "status":
      await showStatus(voting, voterRegistry);
      break;

    case "add-candidates":
      await addCandidates(voting);
      break;

    case "register-voter":
      const voterAddress = args[1];
      if (!voterAddress) {
        console.log("用法: npx hardhat run scripts/interact.js --network sepolia -- register-voter <地址>");
        return;
      }
      await registerVoter(voterRegistry, voterAddress);
      break;

    case "start-election":
      await startElection(voting);
      break;

    case "cast-vote":
      console.log("投票需在前端页面操作 (ZKP 由浏览器生成): http://localhost:8000/");
      break;

    case "end-election":
      await endElection(voting);
      break;

    default:
      console.log(`
可用命令:
  status                    - 查看选举状态
  add-candidates            - 添加候选人 (张三, 李四)
  register-voter <地址>     - 注册选民
  start-election            - 启动选举
  end-election              - 结束选举

投票和计票请使用前端页面 (http://localhost:8000/)

示例:
  npx hardhat run scripts/interact.js --network localhost -- status
      `);
  }
}

async function showStatus(voting, voterRegistry) {
  console.log("\n" + "=".repeat(60));
  console.log("  选举状态");
  console.log("=".repeat(60));

  const info = await voting.getElectionInfo();
  const statusNames = ["Created", "Active", "Ended", "Tallied"];

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
  }

  const totalVoters = await voterRegistry.totalVoters();
  console.log("\n选民信息:");
  console.log("  已注册选民数:", totalVoters.toString());
}

async function addCandidates(voting) {
  console.log("\n添加候选人 (Alice, Bob)...");
  const tx = await voting.addCandidates("Alice", "Bob");
  await tx.wait();
  console.log("✓ 两位候选人添加完成 (1 笔交易)");
}

async function registerVoter(voterRegistry, voterAddress) {
  console.log(`\n注册选民: ${voterAddress}`);

  // 检查是否已注册
  const isRegistered = await voterRegistry.isRegistered(voterAddress);
  if (isRegistered) {
    console.log("  ⚠️ 该地址已经注册");
    return;
  }

  const tx = await voterRegistry.registerVoter(voterAddress);
  await tx.wait();
  console.log("  ✓ 选民注册成功");
}

async function startElection(voting) {
  console.log("\n启动选举...");
  const tx = await voting.startElection();
  await tx.wait();
  console.log("✓ 选举已启动，选民现在可以投票");
}

async function endElection(voting) {
  console.log("\n结束选举...");
  const tx = await voting.endElection();
  await tx.wait();
  console.log("✓ 选举已结束");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });
