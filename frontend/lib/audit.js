/**
 * Audit helper utilities for commitment-based Merkle audit proofs.
 *
 * Leaf rule:
 *   leaf = commitment (bytes32), no extra hashing
 *
 * Internal node rule:
 *   node = keccak256(abi.encodePacked(left, right))
 *
 * Odd layer rule:
 *   duplicate the last node
 */
const AuditLib = (() => {
  function getEthers() {
    if (typeof globalThis !== "undefined" && globalThis.ethers) {
      return globalThis.ethers;
    }
    if (typeof require !== "undefined") {
      // Node.js test/runtime fallback
      // eslint-disable-next-line global-require
      return require("ethers");
    }
    throw new Error("ethers is required but not available");
  }

  function normalizeBytes32(value) {
    if (typeof value !== "string") {
      throw new Error("bytes32 value must be a hex string");
    }
    let hex = value.toLowerCase();
    if (!hex.startsWith("0x")) {
      hex = `0x${hex}`;
    }
    if (!/^0x[0-9a-f]+$/.test(hex)) {
      throw new Error(`invalid hex string: ${value}`);
    }
    const body = hex.slice(2);
    if (body.length > 64) {
      throw new Error(`hex too long for bytes32: ${value}`);
    }
    return `0x${body.padStart(64, "0")}`;
  }

  function hashPair(left, right) {
    const ethers = getEthers();
    return ethers.keccak256(
      ethers.solidityPacked(["bytes32", "bytes32"], [normalizeBytes32(left), normalizeBytes32(right)])
    );
  }

  function buildMerkleTree(leaves) {
    if (!Array.isArray(leaves) || leaves.length === 0) {
      throw new Error("buildMerkleTree requires at least one leaf");
    }

    const normalizedLeaves = leaves.map(normalizeBytes32);
    const layers = [normalizedLeaves];

    while (layers[layers.length - 1].length > 1) {
      const prev = layers[layers.length - 1];
      const next = [];
      for (let i = 0; i < prev.length; i += 2) {
        const left = prev[i];
        const right = i + 1 < prev.length ? prev[i + 1] : prev[i];
        next.push(hashPair(left, right));
      }
      layers.push(next);
    }

    return {
      leaves: normalizedLeaves,
      layers,
      root: layers[layers.length - 1][0],
    };
  }

  function getProof(layers, index) {
    if (!Array.isArray(layers) || layers.length === 0) {
      throw new Error("invalid merkle layers");
    }
    if (!Number.isInteger(index) || index < 0 || index >= layers[0].length) {
      throw new Error("invalid leaf index");
    }

    const proof = [];
    let cursor = index;
    for (let level = 0; level < layers.length - 1; level++) {
      const nodes = layers[level];
      const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
      proof.push(siblingIndex < nodes.length ? nodes[siblingIndex] : nodes[cursor]);
      cursor = Math.floor(cursor / 2);
    }
    return proof;
  }

  function verifyProof(leaf, proof, root, index) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("invalid index");
    }
    let computed = normalizeBytes32(leaf);
    let cursor = index;
    for (const siblingRaw of proof || []) {
      const sibling = normalizeBytes32(siblingRaw);
      if (cursor % 2 === 0) {
        computed = hashPair(computed, sibling);
      } else {
        computed = hashPair(sibling, computed);
      }
      cursor = Math.floor(cursor / 2);
    }
    return computed === normalizeBytes32(root);
  }

  function electionKey(chainId, votingAddress) {
    const id = Number(chainId);
    if (!Number.isFinite(id)) {
      throw new Error("invalid chainId");
    }
    return `${id}:${String(votingAddress).toLowerCase()}`;
  }

  function createAuditBundle(votes, meta = {}) {
    if (!Array.isArray(votes) || votes.length === 0) {
      throw new Error("createAuditBundle requires at least one vote entry");
    }

    const leaves = votes.map((v) => normalizeBytes32(v.commitment));
    const tree = buildMerkleTree(leaves);
    const entries = votes.map((v, i) => ({
      index: i,
      commitment: tree.leaves[i],
      proof: getProof(tree.layers, i),
      txHash: v.txHash || null,
      blockNumber: v.blockNumber ?? null,
      logIndex: v.logIndex ?? null,
    }));

    return {
      version: 1,
      leafRule: "leaf=commitment(bytes32), no extra hashing",
      nodeRule: "keccak256(abi.encodePacked(left,right))",
      oddRule: "duplicate_last",
      generatedAt: new Date().toISOString(),
      root: tree.root,
      totalLeaves: tree.leaves.length,
      electionId: meta.electionId || null,
      chainId: meta.chainId ?? null,
      votingAddress: meta.votingAddress || null,
      entries,
    };
  }

  function findEntriesByCommitment(bundle, commitment) {
    if (!bundle || !Array.isArray(bundle.entries)) {
      return [];
    }
    const normalized = normalizeBytes32(commitment);
    return bundle.entries.filter((e) => normalizeBytes32(e.commitment) === normalized);
  }

  function verifyEntry(bundle, entry) {
    return verifyProof(entry.commitment, entry.proof, bundle.root, entry.index);
  }

  return {
    normalizeBytes32,
    hashPair,
    buildMerkleTree,
    getProof,
    verifyProof,
    electionKey,
    createAuditBundle,
    findEntriesByCommitment,
    verifyEntry,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = AuditLib;
}

if (typeof globalThis !== "undefined") {
  globalThis.AuditLib = AuditLib;
}
