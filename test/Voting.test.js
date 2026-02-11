/**
 * 智能合约测试文件 (ZKP 版本 - 真实零知识证明)
 * Smart Contract Tests for E-Voting System with Real ZKP Proofs
 *
 * 运行方法: npx hardhat test
 * 注意: 首次运行需生成 ZKP 证明，可能需要 30-60 秒
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const path = require("path");

// BabyJubJub constants
const GENERATOR_X = 5299619240641551281634865583518297030282874472190772894086521144482721001553n;
const GENERATOR_Y = 16950150798460657717958625567821834550301663161624707787222815936182638968203n;

// Circuit file paths
const VOTE_WASM = path.join(__dirname, "../build/vote_proof_js/vote_proof.wasm");
const VOTE_ZKEY = path.join(__dirname, "../build/vote_proof_final.zkey");
const TALLY_WASM = path.join(__dirname, "../build/tally_proof_js/tally_proof.wasm");
const TALLY_ZKEY = path.join(__dirname, "../build/tally_proof_final.zkey");

const NUM_CANDIDATES = 3;
const ADMIN_SK = 12345678901234567890n;

describe("区块链电子投票系统 (ZKP 版本)", function () {
  this.timeout(180000);

  let babyJub, poseidon, F;
  let adminPk, adminPkStr;

  // Pre-generated proof data
  let vote1Data, vote2Data, vote3Data;
  let tallyData;

  // Contract instances
  let voterRegistry, voting, voteVerifier, tallyVerifier, merkleVerifier;
  let admin, voter1, voter2, voter3, nonVoter;

  // ─── Crypto Helpers ─────────────────────────────────────

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

  // ─── Vote Proof Generation ──────────────────────────────

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

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput, VOTE_WASM, VOTE_ZKEY
    );

    const calldataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const [proofA, proofB, proofC] = JSON.parse("[" + calldataStr + "]");

    return {
      candidateId,
      ciphertexts,
      commitment,
      ciphertextHash,
      commitmentBytes32: bigintToBytes32(commitment),
      ciphertextHashBytes32: bigintToBytes32(ciphertextHash),
      proofA,
      proofB,
      proofC,
      encryptedVoteArray: ctComponents.map(x => x.toString()),
    };
  }

  // ─── Tally Proof Generation ─────────────────────────────

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

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput, TALLY_WASM, TALLY_ZKEY
    );

    const calldataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const [proofA, proofB, proofC, pubSignals] = JSON.parse("[" + calldataStr + "]");

    return { results, totalVotes, proofA, proofB, proofC, pubSignals };
  }

  // ─── Setup ──────────────────────────────────────────────

  before(async function () {
    const circomlibjs = require("circomlibjs");
    babyJub = await circomlibjs.buildBabyjub();
    poseidon = await circomlibjs.buildPoseidon();
    F = babyJub.F;

    adminPk = scalarMul(ADMIN_SK, getG());
    adminPkStr = [fromF(adminPk[0]).toString(), fromF(adminPk[1]).toString()];

    console.log("    Generating ZKP proofs...");
    vote1Data = await generateVoteData(0, 1);
    console.log("    + Vote proof 1 (candidate 0)");
    vote2Data = await generateVoteData(1, 2);
    console.log("    + Vote proof 2 (candidate 1)");
    vote3Data = await generateVoteData(0, 3);
    console.log("    + Vote proof 3 (candidate 0)");

    tallyData = await generateTallyData([vote1Data, vote2Data, vote3Data]);
    console.log("    + Tally proof (results: [" + tallyData.results + "])");
  });

  beforeEach(async function () {
    [admin, voter1, voter2, voter3, nonVoter] = await ethers.getSigners();

    const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
    voterRegistry = await VoterRegistry.deploy();
    await voterRegistry.waitForDeployment();

    const VoteVerifier = await ethers.getContractFactory("VoteVerifier");
    voteVerifier = await VoteVerifier.deploy();
    await voteVerifier.waitForDeployment();

    const TallyVerifier = await ethers.getContractFactory("TallyVerifier");
    tallyVerifier = await TallyVerifier.deploy();
    await tallyVerifier.waitForDeployment();

    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy(
      await voterRegistry.getAddress(),
      "测试选举", "这是一个测试选举",
      await voteVerifier.getAddress(),
      await tallyVerifier.getAddress(),
      adminPkStr
    );
    await voting.waitForDeployment();

    const MerkleVerifier = await ethers.getContractFactory("MerkleVerifier");
    merkleVerifier = await MerkleVerifier.deploy();
    await merkleVerifier.waitForDeployment();

    await voterRegistry.setVotingContract(await voting.getAddress());
  });

  async function castRealVote(voterSigner, voteData) {
    return voting.connect(voterSigner).castVote(
      voteData.commitmentBytes32,
      voteData.ciphertextHashBytes32,
      voteData.proofA, voteData.proofB, voteData.proofC,
      voteData.encryptedVoteArray
    );
  }

  // ============ VoterRegistry Tests ============
  describe("VoterRegistry 合约", function () {
    it("应该正确设置管理员", async function () {
      expect(await voterRegistry.admin()).to.equal(admin.address);
    });

    it("管理员应该能注册选民", async function () {
      await voterRegistry.registerVoter(voter1.address);
      expect(await voterRegistry.isRegistered(voter1.address)).to.be.true;
    });

    it("非管理员不能注册选民", async function () {
      await expect(
        voterRegistry.connect(voter1).registerVoter(voter2.address)
      ).to.be.revertedWith("VoterRegistry: caller is not admin");
    });

    it("不能重复注册同一选民", async function () {
      await voterRegistry.registerVoter(voter1.address);
      await expect(
        voterRegistry.registerVoter(voter1.address)
      ).to.be.revertedWith("VoterRegistry: already registered");
    });

    it("应该能批量注册选民", async function () {
      await voterRegistry.registerVotersBatch([
        voter1.address, voter2.address, voter3.address
      ]);
      expect(await voterRegistry.isRegistered(voter1.address)).to.be.true;
      expect(await voterRegistry.isRegistered(voter2.address)).to.be.true;
      expect(await voterRegistry.isRegistered(voter3.address)).to.be.true;
      expect(await voterRegistry.totalVoters()).to.equal(3);
    });

    it("应该能转移管理员权限", async function () {
      await voterRegistry.transferAdmin(voter1.address);
      expect(await voterRegistry.admin()).to.equal(voter1.address);
    });
  });

  // ============ Voting Contract Tests ============
  describe("Voting 合约", function () {
    beforeEach(async function () {
      await voterRegistry.registerVotersBatch([
        voter1.address, voter2.address, voter3.address
      ]);
    });

    describe("选举设置", function () {
      it("应该正确初始化选举信息", async function () {
        const info = await voting.getElectionInfo();
        expect(info._title).to.equal("测试选举");
        expect(info._description).to.equal("这是一个测试选举");
        expect(info._status).to.equal(0);
      });

      it("应该存储 ElGamal 公钥", async function () {
        const pk = await voting.getElgamalPK();
        expect(pk[0].toString()).to.equal(adminPkStr[0]);
        expect(pk[1].toString()).to.equal(adminPkStr[1]);
      });

      it("应该存储验证器地址", async function () {
        expect(await voting.voteVerifier()).to.equal(await voteVerifier.getAddress());
        expect(await voting.tallyVerifier()).to.equal(await tallyVerifier.getAddress());
      });

      it("管理员应该能添加候选人", async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        expect(await voting.candidateCount()).to.equal(2);
      });

      it("非管理员不能添加候选人", async function () {
        await expect(
          voting.connect(voter1).addCandidate("Alice")
        ).to.be.revertedWith("Voting: not admin");
      });

      it("选举开始后不能添加候选人", async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.startElection();
        await expect(voting.addCandidate("Charlie")).to.be.revertedWith("Voting: invalid status");
      });
    });

    describe("选举流程", function () {
      beforeEach(async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.addCandidate("Charlie");
      });

      it("需要至少 2 个候选人才能开始选举", async function () {
        const Voting = await ethers.getContractFactory("Voting");
        const newVoting = await Voting.deploy(
          await voterRegistry.getAddress(), "新选举", "描述",
          await voteVerifier.getAddress(), await tallyVerifier.getAddress(), adminPkStr
        );
        await newVoting.addCandidate("Only One");
        await expect(newVoting.startElection()).to.be.revertedWith("Voting: need at least 2 candidates");
      });

      it("管理员应该能启动选举", async function () {
        await voting.startElection();
        const info = await voting.getElectionInfo();
        expect(info._status).to.equal(1);
      });

      it("管理员应该能结束选举", async function () {
        await voting.startElection();
        await voting.endElection();
        const info = await voting.getElectionInfo();
        expect(info._status).to.equal(2);
      });
    });

    describe("投票功能 (ZKP)", function () {
      beforeEach(async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.addCandidate("Charlie");
        await voting.startElection();
      });

      it("已注册选民应该能投票 (含 ZKP proof)", async function () {
        await castRealVote(voter1, vote1Data);
        const record = await voting.getVoteRecord(voter1.address);
        expect(record.commitment).to.equal(vote1Data.commitmentBytes32);
        expect(await voting.totalVotes()).to.equal(1);
      });

      it("应该存储 ciphertextHash", async function () {
        await castRealVote(voter1, vote1Data);
        const record = await voting.getVoteRecord(voter1.address);
        expect(record.ciphertextHash).to.equal(vote1Data.ciphertextHashBytes32);
      });

      it("应该发出 EncryptedVoteCast 事件", async function () {
        await expect(castRealVote(voter1, vote1Data))
          .to.emit(voting, "EncryptedVoteCast");
      });

      it("未注册选民不能投票", async function () {
        // Fails at registration check before proof verification
        await expect(castRealVote(nonVoter, vote1Data))
          .to.be.revertedWith("Voting: not registered");
      });

      it("选民不能重复投票", async function () {
        await castRealVote(voter1, vote1Data);
        // Second vote fails at hasVoted check before proof verification
        await expect(castRealVote(voter1, vote2Data))
          .to.be.revertedWith("Voting: already voted");
      });

      it("选举未开始时不能投票", async function () {
        const Voting = await ethers.getContractFactory("Voting");
        const newVoting = await Voting.deploy(
          await voterRegistry.getAddress(), "新选举", "描述",
          await voteVerifier.getAddress(), await tallyVerifier.getAddress(), adminPkStr
        );
        await voterRegistry.setVotingContract(await newVoting.getAddress());
        await newVoting.addCandidate("A");
        await newVoting.addCandidate("B");
        // Fails at electionActive modifier before proof verification
        await expect(
          newVoting.connect(voter1).castVote(
            vote1Data.commitmentBytes32, vote1Data.ciphertextHashBytes32,
            vote1Data.proofA, vote1Data.proofB, vote1Data.proofC,
            vote1Data.encryptedVoteArray
          )
        ).to.be.revertedWith("Voting: not active");
      });

      it("应该正确记录多个投票", async function () {
        await castRealVote(voter1, vote1Data);
        await castRealVote(voter2, vote2Data);
        await castRealVote(voter3, vote3Data);
        expect(await voting.totalVotes()).to.equal(3);
        expect(await voting.getCommitmentsCount()).to.equal(3);
      });
    });

    describe("计票功能 (ZKP)", function () {
      beforeEach(async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.addCandidate("Charlie");
        await voting.startElection();
        await castRealVote(voter1, vote1Data);
        await castRealVote(voter2, vote2Data);
        await castRealVote(voter3, vote3Data);
        await voting.endElection();
      });

      it("管理员应该能上传计票结果 (含 ZKP3 proof)", async function () {
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));
        await voting.updateTallyResults(
          tallyData.results, merkleRoot,
          tallyData.proofA, tallyData.proofB, tallyData.proofC,
          tallyData.pubSignals
        );

        const info = await voting.getElectionInfo();
        expect(info._status).to.equal(3);

        const alice = await voting.getCandidate(0);
        expect(alice.voteCount).to.equal(2);
        const bob = await voting.getCandidate(1);
        expect(bob.voteCount).to.equal(1);
        const charlie = await voting.getCandidate(2);
        expect(charlie.voteCount).to.equal(0);
      });

      it("计票结果总数必须匹配投票数", async function () {
        const wrongResults = [1, 1, 0]; // Total 2, but 3 votes cast
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));
        await expect(
          voting.updateTallyResults(
            wrongResults, merkleRoot,
            tallyData.proofA, tallyData.proofB, tallyData.proofC,
            tallyData.pubSignals
          )
        ).to.be.revertedWith("Voting: vote count mismatch");
      });

      it("ZKP3 公开输入中的 PK 必须匹配合约存储", async function () {
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));
        const badPubSignals = [...tallyData.pubSignals];
        badPubSignals[0] = "999";
        await expect(
          voting.updateTallyResults(
            tallyData.results, merkleRoot,
            tallyData.proofA, tallyData.proofB, tallyData.proofC,
            badPubSignals
          )
        ).to.be.revertedWith("Voting: PK mismatch X");
      });

      it("ZKP3 公开输入中的 totalVotes 必须匹配", async function () {
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));
        const badPubSignals = [...tallyData.pubSignals];
        badPubSignals[20] = "999";
        await expect(
          voting.updateTallyResults(
            tallyData.results, merkleRoot,
            tallyData.proofA, tallyData.proofB, tallyData.proofC,
            badPubSignals
          )
        ).to.be.revertedWith("Voting: total votes mismatch");
      });

      it("非管理员不能上传计票结果", async function () {
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));
        await expect(
          voting.connect(voter1).updateTallyResults(
            tallyData.results, merkleRoot,
            tallyData.proofA, tallyData.proofB, tallyData.proofC,
            tallyData.pubSignals
          )
        ).to.be.revertedWith("Voting: not admin");
      });
    });

    describe("查询功能", function () {
      beforeEach(async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.addCandidate("Charlie");
      });

      it("应该能获取所有候选人", async function () {
        const candidates = await voting.getAllCandidates();
        expect(candidates.length).to.equal(3);
        expect(candidates[0].name).to.equal("Alice");
      });

      it("应该能获取选举信息", async function () {
        const info = await voting.getElectionInfo();
        expect(info._title).to.equal("测试选举");
        expect(info._candidateCount).to.equal(3);
      });

      it("应该能获取 ElGamal 公钥", async function () {
        const pk = await voting.getElgamalPK();
        expect(pk.length).to.equal(2);
      });
    });
  });

  // ============ MerkleVerifier Tests ============
  describe("MerkleVerifier 合约", function () {
    it("应该正确验证 Merkle 证明", async function () {
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
      const root = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "bytes32"], [leaf1, leaf2])
      );
      expect(await merkleVerifier.verify([leaf2], root, leaf1, 0)).to.be.true;
    });

    it("应该拒绝无效的 Merkle 证明", async function () {
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
      const fakeLeaf = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const root = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "bytes32"], [leaf1, leaf2])
      );
      expect(await merkleVerifier.verify([leaf2], root, fakeLeaf, 0)).to.be.false;
    });
  });

  // ============ Full Flow Test ============
  describe("完整投票流程 (ZKP 版本)", function () {
    it("应该完成从创建到计票的完整流程", async function () {
      await voterRegistry.registerVotersBatch([
        voter1.address, voter2.address, voter3.address
      ]);

      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.addCandidate("Charlie");
      await voting.startElection();

      await castRealVote(voter1, vote1Data);
      await castRealVote(voter2, vote2Data);
      await castRealVote(voter3, vote3Data);

      await voting.endElection();

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("final_merkle"));
      await voting.updateTallyResults(
        tallyData.results, merkleRoot,
        tallyData.proofA, tallyData.proofB, tallyData.proofC,
        tallyData.pubSignals
      );

      const info = await voting.getElectionInfo();
      expect(info._status).to.equal(3);
      expect(info._totalVotes).to.equal(3);

      const alice = await voting.getCandidate(0);
      const bob = await voting.getCandidate(1);
      const charlie = await voting.getCandidate(2);
      expect(alice.voteCount).to.equal(2);
      expect(bob.voteCount).to.equal(1);
      expect(charlie.voteCount).to.equal(0);
    });
  });
});
