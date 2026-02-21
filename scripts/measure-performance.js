/**
 * Performance Measurement Script
 * Measures gas consumption, proof generation times, and contract deployment costs
 */

const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const path = require("path");
const fs = require("fs");

// BabyJubJub constants
const GENERATOR_X = 5299619240641551281634865583518297030282874472190772894086521144482721001553n;
const GENERATOR_Y = 16950150798460657717958625567821834550301663161624707787222815936182638968203n;

const VOTE_WASM = path.join(__dirname, "../build/vote_proof_js/vote_proof.wasm");
const VOTE_ZKEY = path.join(__dirname, "../build/vote_proof_final.zkey");
const TALLY_WASM = path.join(__dirname, "../build/tally_proof_js/tally_proof.wasm");
const TALLY_ZKEY = path.join(__dirname, "../build/tally_proof_final.zkey");

const NUM_CANDIDATES = 3;
const ADMIN_SK = 12345678901234567890n;

async function main() {
  const circomlibjs = require("circomlibjs");
  const babyJub = await circomlibjs.buildBabyjub();
  const poseidon = await circomlibjs.buildPoseidon();
  const F = babyJub.F;

  function toF(bi) { return F.e(bi); }
  function fromF(fe) { return F.toObject(fe); }
  function getG() { return [toF(GENERATOR_X), toF(GENERATOR_Y)]; }
  function scalarMul(s, p) { return babyJub.mulPointEscalar(p, s); }
  function pointAdd(p1, p2) { return babyJub.addPoint(p1, p2); }
  function pointNeg(p) { return [F.neg(p[0]), p[1]]; }

  function elgamalEncrypt(m, pk, r) {
    const G = getG();
    const c1 = scalarMul(r, G);
    const mG = (m === 0n) ? [F.zero, F.one] : scalarMul(m, G);
    const rPK = scalarMul(r, pk);
    const c2 = pointAdd(mG, rPK);
    return { c1, c2 };
  }

  function poseidonHash(inputs) {
    const hash = poseidon(inputs.map(x => toF(BigInt(x))));
    return fromF(hash);
  }

  function bigintToBytes32(bi) {
    return "0x" + bi.toString(16).padStart(64, "0");
  }

  const adminPk = scalarMul(ADMIN_SK, getG());
  const adminPkStr = [fromF(adminPk[0]).toString(), fromF(adminPk[1]).toString()];

  // ═══════ Vote Data Generation with Timing ═══════
  async function generateVoteData(candidateId, voteIndex) {
    const salt = BigInt("98765432101234567890" + voteIndex);
    const randomness = [];
    const ciphertexts = [];

    for (let i = 0; i < NUM_CANDIDATES; i++) {
      const r = BigInt("1111111111" + voteIndex + "" + i + "222222");
      randomness.push(r);
      const m = (i === candidateId) ? 1n : 0n;
      ciphertexts.push(elgamalEncrypt(m, adminPk, r));
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

    const witnessInput = {
      commitment: commitment.toString(),
      ciphertextHash: ciphertextHash.toString(),
      pkX: fromF(adminPk[0]).toString(),
      pkY: fromF(adminPk[1]).toString(),
      candidateId: candidateId.toString(),
      salt: salt.toString(),
      r: randomness.map(r => r.toString()),
      c1X: ciphertexts.map(ct => fromF(ct.c1[0]).toString()),
      c1Y: ciphertexts.map(ct => fromF(ct.c1[1]).toString()),
      c2X: ciphertexts.map(ct => fromF(ct.c2[0]).toString()),
      c2Y: ciphertexts.map(ct => fromF(ct.c2[1]).toString()),
    };

    const startTime = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput, VOTE_WASM, VOTE_ZKEY
    );
    const proofGenTime = performance.now() - startTime;

    const calldataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const [proofA, proofB, proofC] = JSON.parse("[" + calldataStr + "]");

    return {
      candidateId,
      ciphertexts,
      commitment,
      ciphertextHash,
      commitmentBytes32: bigintToBytes32(commitment),
      ciphertextHashBytes32: bigintToBytes32(ciphertextHash),
      proofA, proofB, proofC,
      encryptedVoteArray: ctComponents.map(x => x.toString()),
      proofGenTime,
    };
  }

  async function generateTallyData(voteDataArray) {
    const aggregated = [];
    for (let j = 0; j < NUM_CANDIDATES; j++) {
      let aggC1 = voteDataArray[0].ciphertexts[j].c1;
      let aggC2 = voteDataArray[0].ciphertexts[j].c2;
      for (let i = 1; i < voteDataArray.length; i++) {
        aggC1 = pointAdd(aggC1, voteDataArray[i].ciphertexts[j].c1);
        aggC2 = pointAdd(aggC2, voteDataArray[i].ciphertexts[j].c2);
      }
      aggregated.push({ c1: aggC1, c2: aggC2 });
    }

    const resultPoints = [];
    for (const agg of aggregated) {
      const skC1 = scalarMul(ADMIN_SK, agg.c1);
      resultPoints.push(pointAdd(agg.c2, pointNeg(skC1)));
    }

    const G = getG();
    const results = [];
    for (const rp of resultPoints) {
      let current = [F.zero, F.one];
      for (let m = 0; m <= voteDataArray.length; m++) {
        if (F.eq(current[0], rp[0]) && F.eq(current[1], rp[1])) {
          results.push(m);
          break;
        }
        current = pointAdd(current, G);
      }
    }
    const totalVotes = results.reduce((a, b) => a + b, 0);

    const witnessInput = {
      pkX: fromF(adminPk[0]).toString(),
      pkY: fromF(adminPk[1]).toString(),
      c1TotalX: aggregated.map(a => fromF(a.c1[0]).toString()),
      c1TotalY: aggregated.map(a => fromF(a.c1[1]).toString()),
      c2TotalX: aggregated.map(a => fromF(a.c2[0]).toString()),
      c2TotalY: aggregated.map(a => fromF(a.c2[1]).toString()),
      resultPointX: resultPoints.map(p => fromF(p[0]).toString()),
      resultPointY: resultPoints.map(p => fromF(p[1]).toString()),
      totalVotes: totalVotes.toString(),
      sk: ADMIN_SK.toString(),
    };

    const startTime = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput, TALLY_WASM, TALLY_ZKEY
    );
    const proofGenTime = performance.now() - startTime;

    const calldataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const [proofA, proofB, proofC, pubSignals] = JSON.parse("[" + calldataStr + "]");

    return { results, totalVotes, proofA, proofB, proofC, pubSignals, proofGenTime };
  }

  // ═══════ Run Measurements ═══════
  console.log("═══════════════════════════════════════════════════════");
  console.log("  PERFORMANCE MEASUREMENT REPORT");
  console.log("═══════════════════════════════════════════════════════\n");

  // --- 1. Contract Deployment Gas ---
  console.log("1. CONTRACT DEPLOYMENT GAS COSTS");
  console.log("─────────────────────────────────");

  const [admin, voter1, voter2, voter3] = await ethers.getSigners();

  const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
  let tx, receipt;

  const voterRegistry = await VoterRegistry.deploy();
  receipt = await voterRegistry.deploymentTransaction().wait();
  console.log(`  VoterRegistry deploy:  ${receipt.gasUsed.toString()} gas`);

  const VoteVerifier = await ethers.getContractFactory("VoteVerifier");
  const voteVerifier = await VoteVerifier.deploy();
  receipt = await voteVerifier.deploymentTransaction().wait();
  console.log(`  VoteVerifier deploy:   ${receipt.gasUsed.toString()} gas`);

  const TallyVerifier = await ethers.getContractFactory("TallyVerifier");
  const tallyVerifier = await TallyVerifier.deploy();
  receipt = await tallyVerifier.deploymentTransaction().wait();
  console.log(`  TallyVerifier deploy:  ${receipt.gasUsed.toString()} gas`);

  const Voting = await ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(
    await voterRegistry.getAddress(),
    "Test Election", "Test Description",
    await voteVerifier.getAddress(),
    await tallyVerifier.getAddress(),
    adminPkStr
  );
  receipt = await voting.deploymentTransaction().wait();
  console.log(`  Voting deploy:         ${receipt.gasUsed.toString()} gas`);

  const MerkleVerifier = await ethers.getContractFactory("MerkleVerifier");
  const merkleVerifier = await MerkleVerifier.deploy();
  receipt = await merkleVerifier.deploymentTransaction().wait();
  console.log(`  MerkleVerifier deploy: ${receipt.gasUsed.toString()} gas`);

  await voterRegistry.setVotingContract(await voting.getAddress());

  // --- 2. Operation Gas ---
  console.log("\n2. OPERATION GAS COSTS");
  console.log("─────────────────────────────────");

  // Register voters
  tx = await voterRegistry.registerVoter(voter1.address);
  receipt = await tx.wait();
  console.log(`  registerVoter (single):    ${receipt.gasUsed.toString()} gas`);

  tx = await voterRegistry.registerVotersBatch([voter2.address, voter3.address]);
  receipt = await tx.wait();
  console.log(`  registerVotersBatch (2):   ${receipt.gasUsed.toString()} gas`);

  // Add candidates
  tx = await voting.addCandidate("Alice");
  receipt = await tx.wait();
  console.log(`  addCandidate:              ${receipt.gasUsed.toString()} gas`);

  await voting.addCandidate("Bob");
  await voting.addCandidate("Charlie");

  // Start election
  tx = await voting.startElection();
  receipt = await tx.wait();
  console.log(`  startElection:             ${receipt.gasUsed.toString()} gas`);

  // --- 3. ZKP Proof Generation Times ---
  console.log("\n3. ZKP PROOF GENERATION TIMES (Node.js)");
  console.log("─────────────────────────────────");

  const voteProofTimes = [];
  console.log("  Generating vote proofs...");

  const vote1 = await generateVoteData(0, 1);
  voteProofTimes.push(vote1.proofGenTime);
  console.log(`  Vote proof 1 (candidate 0): ${vote1.proofGenTime.toFixed(0)} ms`);

  const vote2 = await generateVoteData(1, 2);
  voteProofTimes.push(vote2.proofGenTime);
  console.log(`  Vote proof 2 (candidate 1): ${vote2.proofGenTime.toFixed(0)} ms`);

  const vote3 = await generateVoteData(0, 3);
  voteProofTimes.push(vote3.proofGenTime);
  console.log(`  Vote proof 3 (candidate 0): ${vote3.proofGenTime.toFixed(0)} ms`);

  const avgVoteProofTime = voteProofTimes.reduce((a, b) => a + b, 0) / voteProofTimes.length;
  console.log(`  Average vote proof time:    ${avgVoteProofTime.toFixed(0)} ms`);

  // Tally proof
  console.log("  Generating tally proof...");
  const tally = await generateTallyData([vote1, vote2, vote3]);
  console.log(`  Tally proof (3 votes):      ${tally.proofGenTime.toFixed(0)} ms`);

  // --- 4. castVote Gas ---
  console.log("\n4. VOTE CASTING GAS COSTS (with ZKP verification)");
  console.log("─────────────────────────────────");

  tx = await voting.connect(voter1).castVote(
    vote1.commitmentBytes32, vote1.ciphertextHashBytes32,
    vote1.proofA, vote1.proofB, vote1.proofC,
    vote1.encryptedVoteArray
  );
  receipt = await tx.wait();
  console.log(`  castVote (voter 1):  ${receipt.gasUsed.toString()} gas`);

  tx = await voting.connect(voter2).castVote(
    vote2.commitmentBytes32, vote2.ciphertextHashBytes32,
    vote2.proofA, vote2.proofB, vote2.proofC,
    vote2.encryptedVoteArray
  );
  receipt = await tx.wait();
  console.log(`  castVote (voter 2):  ${receipt.gasUsed.toString()} gas`);

  tx = await voting.connect(voter3).castVote(
    vote3.commitmentBytes32, vote3.ciphertextHashBytes32,
    vote3.proofA, vote3.proofB, vote3.proofC,
    vote3.encryptedVoteArray
  );
  receipt = await tx.wait();
  console.log(`  castVote (voter 3):  ${receipt.gasUsed.toString()} gas`);

  // --- 5. End Election + Tally ---
  console.log("\n5. ELECTION FINALIZATION GAS COSTS");
  console.log("─────────────────────────────────");

  tx = await voting.endElection();
  receipt = await tx.wait();
  console.log(`  endElection:               ${receipt.gasUsed.toString()} gas`);

  const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("final_merkle"));
  tx = await voting.updateTallyResults(
    tally.results, merkleRoot,
    tally.proofA, tally.proofB, tally.proofC,
    tally.pubSignals
  );
  receipt = await tx.wait();
  console.log(`  updateTallyResults:        ${receipt.gasUsed.toString()} gas`);

  // --- 6. Circuit Info ---
  console.log("\n6. CIRCUIT COMPLEXITY");
  console.log("─────────────────────────────────");

  try {
    const voteR1cs = fs.readFileSync(path.join(__dirname, "../build/vote_proof.r1cs"));
    console.log(`  vote_proof.r1cs size:    ${(voteR1cs.length / 1024).toFixed(1)} KB`);
  } catch(e) {}

  try {
    const tallyR1cs = fs.readFileSync(path.join(__dirname, "../build/tally_proof.r1cs"));
    console.log(`  tally_proof.r1cs size:   ${(tallyR1cs.length / 1024).toFixed(1)} KB`);
  } catch(e) {}

  try {
    const voteWasm = fs.readFileSync(VOTE_WASM);
    console.log(`  vote_proof.wasm size:    ${(voteWasm.length / 1024).toFixed(1)} KB`);
  } catch(e) {}

  try {
    const tallyWasm = fs.readFileSync(TALLY_WASM);
    console.log(`  tally_proof.wasm size:   ${(tallyWasm.length / 1024).toFixed(1)} KB`);
  } catch(e) {}

  try {
    const voteZkey = fs.readFileSync(VOTE_ZKEY);
    console.log(`  vote_proof.zkey size:    ${(voteZkey.length / (1024*1024)).toFixed(1)} MB`);
  } catch(e) {}

  try {
    const tallyZkey = fs.readFileSync(TALLY_ZKEY);
    console.log(`  tally_proof.zkey size:   ${(tallyZkey.length / (1024*1024)).toFixed(1)} MB`);
  } catch(e) {}

  // --- 7. Proof verification (snarkjs.groth16.verify) ---
  console.log("\n7. PROOF VERIFICATION TIME (off-chain, snarkjs)");
  console.log("─────────────────────────────────");

  try {
    const vkeyPath = path.join(__dirname, "../build/vote_proof_verification_key.json");
    if (fs.existsSync(vkeyPath)) {
      const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));
      const witnessInput = {
        commitment: vote1.commitment.toString(),
        ciphertextHash: vote1.ciphertextHash.toString(),
        pkX: fromF(adminPk[0]).toString(),
        pkY: fromF(adminPk[1]).toString(),
        candidateId: "0",
        salt: "987654321012345678901",
        r: ["1111111111102222222", "1111111111112222222", "1111111111122222222"],
        c1X: vote1.encryptedVoteArray.filter((_, i) => i % 4 === 0),
        c1Y: vote1.encryptedVoteArray.filter((_, i) => i % 4 === 1),
        c2X: vote1.encryptedVoteArray.filter((_, i) => i % 4 === 2),
        c2Y: vote1.encryptedVoteArray.filter((_, i) => i % 4 === 3),
      };
    }
  } catch(e) {}

  // --- 8. Contract bytecode sizes ---
  console.log("\n8. CONTRACT BYTECODE SIZES");
  console.log("─────────────────────────────────");

  const contractNames = ["Voting", "VoterRegistry", "VoteVerifier", "TallyVerifier", "MerkleVerifier"];
  for (const name of contractNames) {
    try {
      const artifact = require(`../artifacts/contracts/${name}.sol/${name}.json`);
      const bytecodeSize = (artifact.deployedBytecode.length - 2) / 2; // remove 0x, each byte = 2 hex chars
      console.log(`  ${name.padEnd(18)} ${bytecodeSize} bytes (${(bytecodeSize / 1024).toFixed(1)} KB)`);
    } catch(e) {
      console.log(`  ${name}: could not read artifact`);
    }
  }

  // --- 9. Gas cost summary at typical ETH price ---
  console.log("\n9. GAS COST SUMMARY (estimated at 30 gwei gas price, ETH=$2500)");
  console.log("─────────────────────────────────");
  const gasPrice = 30; // gwei
  const ethPrice = 2500; // USD

  function gasToCost(gasUsed) {
    const ethCost = (Number(gasUsed) * gasPrice * 1e-9);
    const usdCost = ethCost * ethPrice;
    return `${ethCost.toFixed(6)} ETH (~$${usdCost.toFixed(2)})`;
  }

  // Re-read some gas values (rough)
  console.log(`  (See operation gas values above for precise costs)`);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  MEASUREMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
