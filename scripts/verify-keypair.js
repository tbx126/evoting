/**
 * 手动验证 ElGamal 密钥对的脚本
 * 用法: node scripts/verify-keypair.js
 */

const circomlibjs = require("circomlibjs");

async function verifyKeypair() {
  console.log("=".repeat(60));
  console.log("  ElGamal 密钥对验证工具");
  console.log("=".repeat(60));

  const babyJub = await circomlibjs.buildBabyjub();
  const F = babyJub.F;

  // BabyJubJub 生成元 (Base8)
  const G = [
    F.e(5299619240641551281634865583518297030282874472190772894086521144482721001553n),
    F.e(16950150798460657717958625567821834550301663161624707787222815936182638968203n)
  ];

  console.log("\n1. 生成元 G (Base8):");
  console.log("   G.x =", F.toObject(G[0]).toString());
  console.log("   G.y =", F.toObject(G[1]).toString());

  // 验证 G 在曲线上
  const onCurve = babyJub.inCurve(G);
  console.log("   G 在曲线上?", onCurve ? "✓" : "✗");

  // 测试私钥
  const sk = "12345678901234567890";
  console.log("\n2. 私钥 (开发环境):");
  console.log("   sk =", sk);

  // 计算公钥
  const pk = babyJub.mulPointEscalar(G, BigInt(sk));
  console.log("\n3. 公钥 PK = sk × G:");
  console.log("   PK.x =", F.toObject(pk[0]).toString());
  console.log("   PK.y =", F.toObject(pk[1]).toString());

  // 验证 PK 在曲线上
  const pkOnCurve = babyJub.inCurve(pk);
  console.log("   PK 在曲线上?", pkOnCurve ? "✓" : "✗");

  // 验证与合约中的 PK 一致
  const expectedPKX = "9870005005847011608331577223206232445694836345907703061632808185432752199579";
  const expectedPKY = "1280814412998859969632801946500753365965706410586298946647253329966634969700";

  const pkX = F.toObject(pk[0]).toString();
  const pkY = F.toObject(pk[1]).toString();

  console.log("\n4. 与预期值对比:");
  console.log("   PK.x 匹配?", pkX === expectedPKX ? "✓" : "✗");
  console.log("   PK.y 匹配?", pkY === expectedPKY ? "✓" : "✗");

  // 测试加密/解密
  console.log("\n5. 测试加密/解密:");
  const message = 1n; // 投票给候选人 1
  const randomness = 999n;

  // 加密: (C1, C2) = (r×G, m×G + r×PK)
  const C1 = babyJub.mulPointEscalar(G, randomness);
  const mG = babyJub.mulPointEscalar(G, message);
  const rPK = babyJub.mulPointEscalar(pk, randomness);
  const C2 = babyJub.addPoint(mG, rPK);

  console.log("   明文 m =", message.toString());
  console.log("   密文 C1.x =", F.toObject(C1[0]).toString().slice(0, 20) + "...");
  console.log("   密文 C2.x =", F.toObject(C2[0]).toString().slice(0, 20) + "...");

  // 解密: m×G = C2 - sk×C1
  const skC1 = babyJub.mulPointEscalar(C1, BigInt(sk));
  const negSkC1 = [skC1[0], F.neg(skC1[1])]; // 取负点
  const decryptedMG = babyJub.addPoint(C2, negSkC1);

  console.log("   解密得 m×G.x =", F.toObject(decryptedMG[0]).toString().slice(0, 20) + "...");

  // 验证解密结果 (比较完整点坐标)
  const mGx = F.toObject(mG[0]).toString();
  const mGy = F.toObject(mG[1]).toString();
  const decMGx = F.toObject(decryptedMG[0]).toString();
  const decMGy = F.toObject(decryptedMG[1]).toString();
  console.log("   解密正确?", (mGx === decMGx && mGy === decMGy) ? "✓" : "✗");

  console.log("\n" + "=".repeat(60));
  console.log("  验证完成!");
  console.log("=".repeat(60));
}

verifyKeypair().catch(console.error);
