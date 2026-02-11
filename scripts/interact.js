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
      const candidateIdArg = args[1];
      if (!candidateIdArg) {
        console.log("用法: npx hardhat run scripts/interact.js --network sepolia -- cast-vote <候选人ID>");
        console.log("  注: 现需 ZKP 证明，请使用 full-demo.js 进行完整投票流程");
        return;
      }
      await castVoteZKP(voting, parseInt(candidateIdArg));
      break;

    case "end-election":
      await endElection(voting);
      break;

    case "full-demo":
      await fullDemo(voting, voterRegistry, admin);
      break;

    default:
      console.log(`
可用命令:
  status          - 查看选举状态
  add-candidates  - 添加候选人 (Alice, Bob, Charlie)
  register-voter <地址> - 注册选民
  start-election  - 启动选举
  cast-vote <ID>  - 投票 (需 ZKP, 建议用 full-demo.js)
  end-election    - 结束选举
  full-demo       - 运行完整演示 (建议用 scripts/full-demo.js)

示例:
  npx hardhat run scripts/interact.js --network sepolia -- status
  npx hardhat run scripts/full-demo.js --network sepolia
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
  console.log("\n添加候选人...");

  const candidates = ["Alice", "Bob", "Charlie"];
  for (const name of candidates) {
    console.log(`  添加 ${name}...`);
    const tx = await voting.addCandidate(name);
    await tx.wait();
    console.log(`  ✓ ${name} 添加成功`);
  }

  console.log("\n✓ 所有候选人添加完成");
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

async function castVoteZKP(voting, candidateId) {
  console.log(`\n投票中 (ZKP)...`);
  console.log(`  候选人 ID: ${candidateId}`);
  console.log("  注: ZKP 投票需要 full-demo.js，此命令仅供参考");
  console.log("  请运行: npx hardhat run scripts/full-demo.js --network sepolia");
}

async function endElection(voting) {
  console.log("\n结束选举...");
  const tx = await voting.endElection();
  await tx.wait();
  console.log("✓ 选举已结束");
}

async function fullDemo(voting, voterRegistry, admin) {
  console.log("\n" + "=".repeat(60));
  console.log("  完整投票演示");
  console.log("=".repeat(60));

  // 1. 检查当前状态
  const info = await voting.getElectionInfo();
  const currentStatus = Number(info._status);

  // 2. 如果还没有候选人，添加候选人
  if (Number(info._candidateCount) === 0) {
    console.log("\n步骤 1: 添加候选人");
    await addCandidates(voting);
  } else {
    console.log("\n步骤 1: 候选人已存在，跳过");
  }

  // 3. 注册当前账户为选民
  console.log("\n步骤 2: 注册选民");
  const isRegistered = await voterRegistry.isRegistered(admin.address);
  if (!isRegistered) {
    await registerVoter(voterRegistry, admin.address);
  } else {
    console.log("  当前账户已注册为选民");
  }

  // 4. 启动选举（如果还没启动）
  if (currentStatus === 0) {
    console.log("\n步骤 3: 启动选举");
    await startElection(voting);
  } else {
    console.log("\n步骤 3: 选举已启动，跳过");
  }

  // 5. 投票 (需要 ZKP)
  const hasVoted = await voterRegistry.hasVoted(admin.address);
  if (!hasVoted && currentStatus <= 1) {
    console.log("\n步骤 4: 投票 (ZKP)");
    console.log("  注: ZKP 投票需要使用 scripts/full-demo.js");
    console.log("  请运行: npx hardhat run scripts/full-demo.js --network sepolia");
  } else if (hasVoted) {
    console.log("\n步骤 4: 已投票，跳过");
  }

  // 6. 显示最终状态
  console.log("\n" + "-".repeat(60));
  await showStatus(voting, voterRegistry);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });
