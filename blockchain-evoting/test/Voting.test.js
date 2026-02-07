/**
 * 智能合约测试文件
 * Smart Contract Tests for E-Voting System
 *
 * 运行方法: npx hardhat test
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("区块链电子投票系统", function () {
  let voterRegistry;
  let voting;
  let merkleVerifier;
  let admin;
  let voter1;
  let voter2;
  let voter3;
  let nonVoter;

  // 在每个测试前部署合约
  beforeEach(async function () {
    [admin, voter1, voter2, voter3, nonVoter] = await ethers.getSigners();

    // 部署 VoterRegistry
    const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
    voterRegistry = await VoterRegistry.deploy();
    await voterRegistry.waitForDeployment();

    // 部署 Voting
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy(
      await voterRegistry.getAddress(),
      "测试选举",
      "这是一个测试选举"
    );
    await voting.waitForDeployment();

    // 部署 MerkleVerifier
    const MerkleVerifier = await ethers.getContractFactory("MerkleVerifier");
    merkleVerifier = await MerkleVerifier.deploy();
    await merkleVerifier.waitForDeployment();

    // 关联合约
    await voterRegistry.setVotingContract(await voting.getAddress());
  });

  // ============ VoterRegistry 测试 ============
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
        voter1.address,
        voter2.address,
        voter3.address
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

  // ============ Voting 合约测试 ============
  describe("Voting 合约", function () {
    beforeEach(async function () {
      // 注册选民
      await voterRegistry.registerVotersBatch([
        voter1.address,
        voter2.address,
        voter3.address
      ]);
    });

    describe("选举设置", function () {
      it("应该正确初始化选举信息", async function () {
        const info = await voting.getElectionInfo();
        expect(info._title).to.equal("测试选举");
        expect(info._description).to.equal("这是一个测试选举");
        expect(info._status).to.equal(0); // Created
      });

      it("管理员应该能添加候选人", async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");

        expect(await voting.candidateCount()).to.equal(2);

        const alice = await voting.getCandidate(0);
        expect(alice.name).to.equal("Alice");

        const bob = await voting.getCandidate(1);
        expect(bob.name).to.equal("Bob");
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

        await expect(voting.addCandidate("Charlie")).to.be.revertedWith(
          "Voting: invalid status"
        );
      });
    });

    describe("选举流程", function () {
      beforeEach(async function () {
        // 添加候选人
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.addCandidate("Charlie");
      });

      it("需要至少 2 个候选人才能开始选举", async function () {
        // 部署新的 Voting 合约
        const Voting = await ethers.getContractFactory("Voting");
        const newVoting = await Voting.deploy(
          await voterRegistry.getAddress(),
          "新选举",
          "描述"
        );
        await newVoting.waitForDeployment();

        // 只添加 1 个候选人
        await newVoting.addCandidate("Only One");

        await expect(newVoting.startElection()).to.be.revertedWith(
          "Voting: need at least 2 candidates"
        );
      });

      it("管理员应该能启动选举", async function () {
        await voting.startElection();
        const info = await voting.getElectionInfo();
        expect(info._status).to.equal(1); // Active
      });

      it("管理员应该能结束选举", async function () {
        await voting.startElection();
        await voting.endElection();
        const info = await voting.getElectionInfo();
        expect(info._status).to.equal(2); // Ended
      });
    });

    describe("投票功能", function () {
      beforeEach(async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.addCandidate("Charlie");
        await voting.startElection();
      });

      it("已注册选民应该能投票", async function () {
        const commitment = ethers.keccak256(ethers.toUtf8Bytes("vote1"));

        await voting.connect(voter1).castVote(commitment);

        const record = await voting.getVoteRecord(voter1.address);
        expect(record.commitment).to.equal(commitment);
        expect(await voting.totalVotes()).to.equal(1);
      });

      it("未注册选民不能投票", async function () {
        const commitment = ethers.keccak256(ethers.toUtf8Bytes("vote"));

        await expect(
          voting.connect(nonVoter).castVote(commitment)
        ).to.be.revertedWith("Voting: not registered");
      });

      it("选民不能重复投票", async function () {
        const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
        const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));

        await voting.connect(voter1).castVote(commitment1);

        await expect(
          voting.connect(voter1).castVote(commitment2)
        ).to.be.revertedWith("Voting: already voted");
      });

      it("选举未开始时不能投票", async function () {
        // 部署新合约（未启动选举）
        const Voting = await ethers.getContractFactory("Voting");
        const newVoting = await Voting.deploy(
          await voterRegistry.getAddress(),
          "新选举",
          "描述"
        );
        await newVoting.waitForDeployment();
        await voterRegistry.setVotingContract(await newVoting.getAddress());

        await newVoting.addCandidate("A");
        await newVoting.addCandidate("B");
        // 不启动选举

        const commitment = ethers.keccak256(ethers.toUtf8Bytes("vote"));
        await expect(
          newVoting.connect(voter1).castVote(commitment)
        ).to.be.revertedWith("Voting: not active");
      });

      it("应该正确记录多个投票", async function () {
        const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
        const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
        const commitment3 = ethers.keccak256(ethers.toUtf8Bytes("vote3"));

        await voting.connect(voter1).castVote(commitment1);
        await voting.connect(voter2).castVote(commitment2);
        await voting.connect(voter3).castVote(commitment3);

        expect(await voting.totalVotes()).to.equal(3);
        expect(await voting.getCommitmentsCount()).to.equal(3);
      });
    });

    describe("计票功能", function () {
      beforeEach(async function () {
        await voting.addCandidate("Alice");
        await voting.addCandidate("Bob");
        await voting.addCandidate("Charlie");
        await voting.startElection();

        // 模拟投票
        const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
        const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
        const commitment3 = ethers.keccak256(ethers.toUtf8Bytes("vote3"));

        await voting.connect(voter1).castVote(commitment1);
        await voting.connect(voter2).castVote(commitment2);
        await voting.connect(voter3).castVote(commitment3);

        await voting.endElection();
      });

      it("管理员应该能上传计票结果", async function () {
        const results = [2, 1, 0]; // Alice: 2, Bob: 1, Charlie: 0
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));

        await voting.updateTallyResults(results, merkleRoot);

        const info = await voting.getElectionInfo();
        expect(info._status).to.equal(3); // Tallied

        const alice = await voting.getCandidate(0);
        expect(alice.voteCount).to.equal(2);

        const bob = await voting.getCandidate(1);
        expect(bob.voteCount).to.equal(1);
      });

      it("计票结果总数必须匹配投票数", async function () {
        const wrongResults = [1, 1, 0]; // 总数 2，但实际投票 3
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));

        await expect(
          voting.updateTallyResults(wrongResults, merkleRoot)
        ).to.be.revertedWith("Voting: vote count mismatch");
      });

      it("非管理员不能上传计票结果", async function () {
        const results = [2, 1, 0];
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));

        await expect(
          voting.connect(voter1).updateTallyResults(results, merkleRoot)
        ).to.be.revertedWith("Voting: not admin");
      });

      it("选举未结束时不能计票", async function () {
        // 部署新合约并启动选举（但不结束）
        const Voting = await ethers.getContractFactory("Voting");
        const newVoting = await Voting.deploy(
          await voterRegistry.getAddress(),
          "新选举",
          "描述"
        );
        await newVoting.waitForDeployment();

        await newVoting.addCandidate("A");
        await newVoting.addCandidate("B");
        await newVoting.startElection();
        // 不结束选举

        const results = [0, 0];
        const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("merkle"));

        await expect(
          newVoting.updateTallyResults(results, merkleRoot)
        ).to.be.revertedWith("Voting: invalid status");
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
        expect(candidates[1].name).to.equal("Bob");
        expect(candidates[2].name).to.equal("Charlie");
      });

      it("应该能获取选举信息", async function () {
        const info = await voting.getElectionInfo();
        expect(info._title).to.equal("测试选举");
        expect(info._candidateCount).to.equal(3);
      });
    });
  });

  // ============ MerkleVerifier 测试 ============
  describe("MerkleVerifier 合约", function () {
    it("应该正确验证 Merkle 证明", async function () {
      // 构建简单的 Merkle 树 (2 个叶子)
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));

      // 计算根: hash(leaf1 + leaf2)
      const root = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "bytes32"], [leaf1, leaf2])
      );

      // 验证 leaf1 的证明 (index=0, 在左边)
      const proof = [leaf2];
      const index = 0; // leaf1 的索引是 0

      const isValid = await merkleVerifier.verify(proof, root, leaf1, index);
      expect(isValid).to.be.true;
    });

    it("应该拒绝无效的 Merkle 证明", async function () {
      const leaf1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      const leaf2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
      const fakeLeaf = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      const root = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "bytes32"], [leaf1, leaf2])
      );

      const proof = [leaf2];
      const index = 0;

      // 使用错误的叶子节点
      const isValid = await merkleVerifier.verify(
        proof,
        root,
        fakeLeaf,
        index
      );
      expect(isValid).to.be.false;
    });
  });

  // ============ 完整流程测试 ============
  describe("完整投票流程", function () {
    it("应该完成从创建到计票的完整流程", async function () {
      // 1. 注册选民
      await voterRegistry.registerVotersBatch([
        voter1.address,
        voter2.address,
        voter3.address
      ]);
      console.log("    ✓ 选民注册完成");

      // 2. 添加候选人
      await voting.addCandidate("Alice");
      await voting.addCandidate("Bob");
      await voting.addCandidate("Charlie");
      console.log("    ✓ 候选人添加完成");

      // 3. 启动选举
      await voting.startElection();
      console.log("    ✓ 选举已启动");

      // 4. 投票
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("alice_vote"));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("bob_vote"));
      const commitment3 = ethers.keccak256(ethers.toUtf8Bytes("alice_vote2"));

      await voting.connect(voter1).castVote(commitment1);
      await voting.connect(voter2).castVote(commitment2);
      await voting.connect(voter3).castVote(commitment3);
      console.log("    ✓ 投票完成 (3 票)");

      // 5. 结束选举
      await voting.endElection();
      console.log("    ✓ 选举已结束");

      // 6. 上传计票结果 (Alice: 2, Bob: 1, Charlie: 0)
      const results = [2, 1, 0];
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("final_merkle"));
      await voting.updateTallyResults(results, merkleRoot);
      console.log("    ✓ 计票结果已上传");

      // 7. 验证最终结果
      const info = await voting.getElectionInfo();
      expect(info._status).to.equal(3); // Tallied
      expect(info._totalVotes).to.equal(3);

      const alice = await voting.getCandidate(0);
      const bob = await voting.getCandidate(1);
      const charlie = await voting.getCandidate(2);

      expect(alice.voteCount).to.equal(2);
      expect(bob.voteCount).to.equal(1);
      expect(charlie.voteCount).to.equal(0);

      console.log("    ✓ 最终结果验证通过");
      console.log(`      Alice: ${alice.voteCount} 票`);
      console.log(`      Bob: ${bob.voteCount} 票`);
      console.log(`      Charlie: ${charlie.voteCount} 票`);
    });
  });
});
