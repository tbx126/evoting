/**
 * BabyJubJub ElGamal 加密库 (浏览器端)
 * ElGamal encryption on BabyJubJub using circomlibjs for curve operations.
 *
 * 依赖: circomlibjs (通过 CDN 或 npm 加载)
 *
 * 使用:
 *   const elgamal = await ElGamalLib.init();
 *   const { sk, pk } = elgamal.generateKeypair();
 *   const ct = elgamal.encrypt(1n, pk);
 *   const m = elgamal.decrypt(ct, sk);
 */

const ElGamalLib = (() => {
  let babyJub;
  let poseidon;
  let F; // Finite field

  // BabyJubJub Base8 generator (same as circomlib)
  const GENERATOR_X = 5299619240641551281634865583518297030282874472190772894086521144482721001553n;
  const GENERATOR_Y = 16950150798460657717958625567821834550301663161624707787222815936182638968203n;

  // Subgroup order
  const SUBGROUP_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;

  /**
   * Initialize the library (must be called before use).
   * Loads BabyJubJub and Poseidon from circomlibjs.
   */
  async function init() {
    const circomlibjs = window.circomlibjs || globalThis.circomlibjs;
    if (!circomlibjs) {
      throw new Error("circomlibjs not loaded. Include it via CDN or npm.");
    }

    babyJub = await circomlibjs.buildBabyjub();
    poseidon = await circomlibjs.buildPoseidon();
    F = babyJub.F;

    return api;
  }

  // ─── Helper: convert BigInt to F element and back ─────────

  function toF(bigint) {
    return F.e(bigint);
  }

  function fromF(fElement) {
    return F.toObject(fElement);
  }

  // ─── Point operations using circomlibjs babyJub ───────────

  function getGenerator() {
    return [toF(GENERATOR_X), toF(GENERATOR_Y)];
  }

  function getIdentity() {
    return [F.zero, F.one];
  }

  function pointAdd(p1, p2) {
    return babyJub.addPoint(p1, p2);
  }

  function pointNeg(p) {
    // -(x, y) = (-x, y) on twisted Edwards
    return [F.neg(p[0]), p[1]];
  }

  function pointSub(p1, p2) {
    return pointAdd(p1, pointNeg(p2));
  }

  function scalarMul(scalar, point) {
    return babyJub.mulPointEscalar(point, scalar);
  }

  function pointEq(p1, p2) {
    return F.eq(p1[0], p2[0]) && F.eq(p1[1], p2[1]);
  }

  function pointToBI(p) {
    return [fromF(p[0]), fromF(p[1])];
  }

  // ─── Random field element ─────────────────────────────────

  function randomFieldElement() {
    // Generate 32 random bytes and reduce mod SUBGROUP_ORDER
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let r = 0n;
    for (let i = 0; i < 32; i++) {
      r = (r << 8n) | BigInt(bytes[i]);
    }
    r = (r % (SUBGROUP_ORDER - 1n)) + 1n; // r in [1, order-1]
    return r;
  }

  // ─── Key generation ───────────────────────────────────────

  function generateKeypair() {
    const sk = randomFieldElement();
    const G = getGenerator();
    const pk = scalarMul(sk, G);
    return { sk, pk };
  }

  function pkFromBigInts(pkX, pkY) {
    return [toF(BigInt(pkX)), toF(BigInt(pkY))];
  }

  // ─── ElGamal Encryption ───────────────────────────────────

  /**
   * Encrypt integer message m under public key pk.
   * E(m, r) = (r*G, m*G + r*PK)
   */
  function encrypt(m, pk, r = null) {
    if (r === null) r = randomFieldElement();
    const G = getGenerator();
    const c1 = scalarMul(r, G);                      // r * G
    const rPK = scalarMul(r, pk);                     // r * PK
    const mG = scalarMul(BigInt(m), G);               // m * G
    const c2 = pointAdd(mG, rPK);                     // m*G + r*PK
    return { c1, c2, r };
  }

  /**
   * Decrypt ciphertext to recover m*G point.
   * m*G = C2 - sk * C1
   */
  function decryptToPoint(ct, sk) {
    const skC1 = scalarMul(sk, ct.c1);  // sk * C1
    return pointSub(ct.c2, skC1);       // C2 - sk*C1
  }

  /**
   * Decrypt ciphertext to recover integer m.
   * Uses baby-step giant-step.
   */
  function decrypt(ct, sk, maxValue = 10000) {
    const mG = decryptToPoint(ct, sk);
    return solveDLog(mG, maxValue);
  }

  // ─── Baby-step Giant-step DLog solver ─────────────────────

  function solveDLog(point, maxValue = 10000) {
    const identity = getIdentity();
    if (pointEq(point, identity)) return 0;

    const G = getGenerator();
    const stepSize = Math.ceil(Math.sqrt(maxValue)) + 1;

    // Baby steps: j*G for j = 0..stepSize-1
    const babySteps = new Map();
    let current = identity;
    for (let j = 0; j < stepSize; j++) {
      const key = fromF(current[0]).toString() + "," + fromF(current[1]).toString();
      babySteps.set(key, j);
      current = pointAdd(current, G);
    }

    // Giant step: -stepSize * G
    const giantStep = pointNeg(scalarMul(BigInt(stepSize), G));

    // Search
    current = point;
    for (let i = 0; i <= stepSize; i++) {
      const key = fromF(current[0]).toString() + "," + fromF(current[1]).toString();
      if (babySteps.has(key)) {
        const m = i * stepSize + babySteps.get(key);
        if (m <= maxValue) return m;
      }
      current = pointAdd(current, giantStep);
    }

    throw new Error(`Discrete log not found in range [0, ${maxValue}]`);
  }

  // ─── One-hot vote encryption ──────────────────────────────

  /**
   * Encrypt a vote as one-hot vector.
   * Returns { ciphertexts, randomness }
   */
  function encryptVoteOneHot(candidateId, numCandidates, pk) {
    const randomness = [];
    const ciphertexts = [];

    for (let i = 0; i < numCandidates; i++) {
      const m = i === candidateId ? 1 : 0;
      const r = randomFieldElement();
      randomness.push(r);
      ciphertexts.push(encrypt(m, pk, r));
    }

    return { ciphertexts, randomness };
  }

  // ─── Homomorphic operations ───────────────────────────────

  /**
   * Homomorphically add a list of ciphertexts.
   * E(a) + E(b) = (C1_a + C1_b, C2_a + C2_b) = E(a+b)
   */
  function homomorphicAdd(ctList) {
    if (ctList.length === 0) throw new Error("Empty ciphertext list");

    let resultC1 = ctList[0].c1;
    let resultC2 = ctList[0].c2;

    for (let i = 1; i < ctList.length; i++) {
      resultC1 = pointAdd(resultC1, ctList[i].c1);
      resultC2 = pointAdd(resultC2, ctList[i].c2);
    }

    return { c1: resultC1, c2: resultC2 };
  }

  /**
   * Aggregate votes column-wise for tallying.
   * allVotes: array of vote vectors (each is array of ciphertexts)
   */
  function aggregateVotes(allVotes, numCandidates) {
    const aggregated = [];
    for (let j = 0; j < numCandidates; j++) {
      const column = allVotes.map(vote => vote[j]);
      aggregated.push(homomorphicAdd(column));
    }
    return aggregated;
  }

  // ─── Poseidon hashing ─────────────────────────────────────

  /**
   * Compute Poseidon hash of inputs (BigInt array).
   * Returns a BigInt.
   */
  function poseidonHash(inputs) {
    const hash = poseidon(inputs.map(x => toF(BigInt(x))));
    return fromF(hash);
  }

  /**
   * Compute commitment = Poseidon(candidateId, salt).
   */
  function computeCommitment(candidateId, salt) {
    return poseidonHash([BigInt(candidateId), salt]);
  }

  /**
   * Compute ciphertext hash = Poseidon(c1x[0],c1y[0],c2x[0],c2y[0], ...).
   */
  function computeCiphertextHash(ciphertexts) {
    const inputs = [];
    for (const ct of ciphertexts) {
      inputs.push(fromF(ct.c1[0]));
      inputs.push(fromF(ct.c1[1]));
      inputs.push(fromF(ct.c2[0]));
      inputs.push(fromF(ct.c2[1]));
    }
    return poseidonHash(inputs);
  }

  // ─── Serialization for contract interaction ───────────────

  /**
   * Convert ciphertexts to flat uint256 array for contract event.
   * Format: [c1x_0, c1y_0, c2x_0, c2y_0, c1x_1, ...]
   */
  function ciphertextsToUint256Array(ciphertexts) {
    const arr = [];
    for (const ct of ciphertexts) {
      arr.push(fromF(ct.c1[0]));
      arr.push(fromF(ct.c1[1]));
      arr.push(fromF(ct.c2[0]));
      arr.push(fromF(ct.c2[1]));
    }
    return arr;
  }

  /**
   * Reconstruct ciphertexts from flat uint256 array.
   */
  function uint256ArrayToCiphertexts(arr, numCandidates) {
    const cts = [];
    for (let i = 0; i < numCandidates; i++) {
      const offset = i * 4;
      cts.push({
        c1: [toF(arr[offset]), toF(arr[offset + 1])],
        c2: [toF(arr[offset + 2]), toF(arr[offset + 3])]
      });
    }
    return cts;
  }

  // ─── ZKP witness preparation ──────────────────────────────

  /**
   * Prepare witness inputs for vote_proof circuit.
   */
  function prepareVoteWitness(candidateId, numCandidates, salt, pk, ciphertexts, randomness) {
    const pkBI = pointToBI(pk);
    const commitment = computeCommitment(candidateId, salt);
    const ciphertextHash = computeCiphertextHash(ciphertexts);

    const c1X = ciphertexts.map(ct => fromF(ct.c1[0]).toString());
    const c1Y = ciphertexts.map(ct => fromF(ct.c1[1]).toString());
    const c2X = ciphertexts.map(ct => fromF(ct.c2[0]).toString());
    const c2Y = ciphertexts.map(ct => fromF(ct.c2[1]).toString());
    const rStrings = randomness.map(r => r.toString());

    return {
      // Circuit inputs
      input: {
        commitment: commitment.toString(),
        ciphertextHash: ciphertextHash.toString(),
        pkX: pkBI[0].toString(),
        pkY: pkBI[1].toString(),
        candidateId: candidateId.toString(),
        salt: salt.toString(),
        r: rStrings,
        c1X, c1Y, c2X, c2Y
      },
      // Public signals for contract
      commitment,
      ciphertextHash
    };
  }

  /**
   * Prepare witness inputs for tally_proof circuit.
   */
  function prepareTallyWitness(sk, pk, aggregatedCts, resultPoints, totalVotes) {
    const pkBI = pointToBI(pk);
    const numCandidates = aggregatedCts.length;

    const c1TotalX = aggregatedCts.map(ct => fromF(ct.c1[0]).toString());
    const c1TotalY = aggregatedCts.map(ct => fromF(ct.c1[1]).toString());
    const c2TotalX = aggregatedCts.map(ct => fromF(ct.c2[0]).toString());
    const c2TotalY = aggregatedCts.map(ct => fromF(ct.c2[1]).toString());
    const resultPointX = resultPoints.map(p => fromF(p[0]).toString());
    const resultPointY = resultPoints.map(p => fromF(p[1]).toString());

    return {
      pkX: pkBI[0].toString(),
      pkY: pkBI[1].toString(),
      c1TotalX, c1TotalY,
      c2TotalX, c2TotalY,
      resultPointX, resultPointY,
      totalVotes: totalVotes.toString(),
      sk: sk.toString()
    };
  }

  // ─── Public API ───────────────────────────────────────────

  const api = {
    // Constants
    GENERATOR_X,
    GENERATOR_Y,
    SUBGROUP_ORDER,

    // Key management
    generateKeypair,
    pkFromBigInts,

    // Encryption
    encrypt,
    decrypt,
    decryptToPoint,
    encryptVoteOneHot,

    // Homomorphic operations
    homomorphicAdd,
    aggregateVotes,

    // Hashing
    poseidonHash,
    computeCommitment,
    computeCiphertextHash,

    // Serialization
    ciphertextsToUint256Array,
    uint256ArrayToCiphertexts,

    // ZKP witness
    prepareVoteWitness,
    prepareTallyWitness,

    // Utilities
    randomFieldElement,
    solveDLog,
    pointToBI,
    pointEq,
    scalarMul,
    pointAdd,
    pointSub,
    getGenerator,
    getIdentity,
    toF,
    fromF
  };

  return { init };
})();

// Export for Node.js / module environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = ElGamalLib;
}
