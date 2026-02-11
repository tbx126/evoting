/**
 * 注册选民脚本
 * Register Voter Script
 *
 * 用法:
 *   设置环境变量 VOTER_ADDRESS 然后运行:
 *   set VOTER_ADDRESS=0x1234... && npx hardhat run scripts/register-voter.js --network sepolia
 *
 *   或者直接修改下面的 VOTER_TO_REGISTER 变量
 */

const hre = require("hardhat");

// ========== 配置 ==========
// 方式1: 直接在这里填写要注册的选民地址
const VOTER_TO_REGISTER = process.env.VOTER_ADDRESS || "0x0000000000000000000000000000000000000000";

// 从 .env 读取合约地址（由 deploy.js 自动写入）
const VOTER_REGISTRY_ADDRESS = process.env.VOTER_REGISTRY_ADDRESS;

async function main() {
  console.log("=".repeat(60));
  console.log("  选民注册");
  console.log("=".repeat(60));

  const [admin] = await hre.ethers.getSigners();
  console.log("\n管理员账户:", admin.address);

  // 检查要注册的地址
  if (VOTER_TO_REGISTER === "0x0000000000000000000000000000000000000000") {
    console.log("\n❌ 请设置要注册的选民地址！");
    console.log("\n方式1: 修改脚本中的 VOTER_TO_REGISTER 变量");
    console.log("方式2: 设置环境变量后运行:");
    console.log("  Windows: set VOTER_ADDRESS=0x你的地址 && npx hardhat run scripts/register-voter.js --network sepolia");
    console.log("  Linux/Mac: VOTER_ADDRESS=0x你的地址 npx hardhat run scripts/register-voter.js --network sepolia");
    return;
  }

  console.log("要注册的选民:", VOTER_TO_REGISTER);

  // 连接到合约
  const VoterRegistry = await hre.ethers.getContractFactory("VoterRegistry");
  const voterRegistry = VoterRegistry.attach(VOTER_REGISTRY_ADDRESS);

  // 检查是否已注册
  const isRegistered = await voterRegistry.isRegistered(VOTER_TO_REGISTER);
  if (isRegistered) {
    console.log("\n⚠️ 该地址已经注册为选民");
    return;
  }

  // 注册选民
  console.log("\n正在注册选民...");
  const tx = await voterRegistry.registerVoter(VOTER_TO_REGISTER);
  console.log("交易已发送:", tx.hash);

  console.log("等待确认...");
  await tx.wait();

  console.log("\n✅ 选民注册成功！");
  console.log("  地址:", VOTER_TO_REGISTER);
  console.log("  交易:", `https://sepolia.etherscan.io/tx/${tx.hash}`);

  // 显示当前选民总数
  const totalVoters = await voterRegistry.totalVoters();
  console.log("\n当前已注册选民总数:", totalVoters.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });
