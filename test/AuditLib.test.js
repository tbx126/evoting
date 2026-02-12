const { expect } = require("chai");
const { ethers } = require("ethers");
const AuditLib = require("../frontend/lib/audit.js");

describe("AuditLib (commitment merkle)", function () {
  function hex32(seed) {
    return ethers.keccak256(ethers.toUtf8Bytes(seed));
  }

  it("builds merkle tree and verifies all leaves", function () {
    const leaves = [hex32("a"), hex32("b"), hex32("c"), hex32("d"), hex32("e")];
    const tree = AuditLib.buildMerkleTree(leaves);
    expect(tree.root).to.match(/^0x[0-9a-f]{64}$/);

    for (let i = 0; i < leaves.length; i++) {
      const proof = AuditLib.getProof(tree.layers, i);
      const ok = AuditLib.verifyProof(leaves[i], proof, tree.root, i);
      expect(ok).to.equal(true);
    }
  });

  it("rejects wrong leaf/proof combinations", function () {
    const leaves = [hex32("v1"), hex32("v2"), hex32("v3")];
    const tree = AuditLib.buildMerkleTree(leaves);
    const proof0 = AuditLib.getProof(tree.layers, 0);

    const badLeaf = hex32("tampered");
    const ok = AuditLib.verifyProof(badLeaf, proof0, tree.root, 0);
    expect(ok).to.equal(false);
  });

  it("creates audit bundle with proof entries", function () {
    const votes = [
      { commitment: hex32("c1"), txHash: "0x01", blockNumber: 1, logIndex: 0 },
      { commitment: hex32("c2"), txHash: "0x02", blockNumber: 1, logIndex: 1 },
      { commitment: hex32("c3"), txHash: "0x03", blockNumber: 2, logIndex: 0 },
    ];

    const bundle = AuditLib.createAuditBundle(votes, {
      chainId: 31337,
      electionId: "31337:0xabc",
      votingAddress: "0xabc",
    });

    expect(bundle.totalLeaves).to.equal(3);
    expect(bundle.entries.length).to.equal(3);
    for (const entry of bundle.entries) {
      const ok = AuditLib.verifyEntry(bundle, entry);
      expect(ok).to.equal(true);
    }

    const matches = AuditLib.findEntriesByCommitment(bundle, votes[1].commitment);
    expect(matches.length).to.equal(1);
    expect(matches[0].txHash).to.equal("0x02");
  });
});

