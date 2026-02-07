/**
 * 完整投票流程演示
 * Full Voting Demo on Sepolia
 *
 * 运行: npx hardhat run scripts/full-demo.js --network sepolia
 */

const hre = require("hardhat");

// 从 .env 读取合约地址（由 deploy.js 自动写入）
const CONTRACTS = {
  VoterRegistry: process.env.VOTER_REGISTRY_ADDRESS,
  Voting: process.env.VOTING_CONTRACT_ADDRESS
};

async function main() {
  console.log("=".repeat(60));
  console.log("  Sepolia 测试网 - 完整投票流程演示");
  console.log("=".repeat(60));

  const [admin] = await hre.ethers.getSigners();
  console.log("\n管理员账户:", admin.address);

  // 连接到合约
  const VoterRegistry = await hre.ethers.getContractFactory("VoterRegistry");
  const voterRegistry = VoterRegistry.attach(CONTRACTS.VoterRegistry);

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = Voting.attach(CONTRACTS.Voting);

  // 获取当前状态
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
    console.log("✓ 选民注册成功");
    console.log("  交易哈希:", tx.hash);
  } else {
    console.log("✓ 当前账户已注册为选民");
  }

  // ============ 步骤 2: 启动选举 ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 2: 启动选举");
  console.log("-".repeat(60));

  if (currentStatus === 0) {
    console.log("正在启动选举...");
    const tx = await voting.startElection();
    await tx.wait();
    console.log("✓ 选举已启动");
    console.log("  交易哈希:", tx.hash);
    currentStatus = 1;
  } else if (currentStatus === 1) {
    console.log("✓ 选举已经在进行中");
  } else {
    console.log("⚠️ 选举已结束，无法继续演示投票");
  }

  // ============ 步骤 3: 投票 ============
  console.log("\n" + "-".repeat(60));
  console.log("步骤 3: 投票");
  console.log("-".repeat(60));

  const hasVoted = await voterRegistry.hasVoted(admin.address);
  if (!hasVoted && currentStatus === 1) {
    // 生成承诺哈希（模拟加密投票）
    // 在实际应用中，这应该是 SHA256(encrypted_vote)
    const voteData = "vote_for_alice_" + Date.now();
    const commitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(voteData));

    console.log("投票信息:");
    console.log("  选择候选人: Alice (ID: 0)");
    console.log("  承诺哈希:", commitment);

    console.log("\n正在提交投票...");
    const tx = await voting.castVote(commitment);
    await tx.wait();
    console.log("✓ 投票成功！");
    console.log("  交易哈希:", tx.hash);
    console.log("  Etherscan:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
  } else if (hasVoted) {
    console.log("✓ 当前账户已投票");
  } else {
    console.log("⚠️ 无法投票（选举未在进行中）");
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
  console.log("\n选民统计:");
  console.log("  已注册选民:", totalVoters.toString());

  // 获取投票记录
  const voteRecord = await voting.getVoteRecord(admin.address);
  if (voteRecord.commitment !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("\n你的投票记录:");
    console.log("  承诺哈希:", voteRecord.commitment);
    console.log("  投票时间:", new Date(Number(voteRecord.timestamp) * 1000).toLocaleString());
  }

  console.log("\n" + "=".repeat(60));
  console.log("  演示完成！");
  console.log("=".repeat(60));

  console.log(`
下一步操作:
  1. 结束选举: npx hardhat run scripts/end-election.js --network sepolia
  2. 上传计票结果: npx hardhat run scripts/tally.js --network sepolia
  3. 查看状态: npx hardhat run scripts/status.js --network sepolia

查看合约:
  VoterRegistry: https://sepolia.etherscan.io/address/${CONTRACTS.VoterRegistry}
  Voting: https://sepolia.etherscan.io/address/${CONTRACTS.Voting}
  `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });
