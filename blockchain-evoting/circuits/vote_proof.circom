pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "lib/elgamal.circom";

/**
 * VoteProof circuit - Proves ZKP1 (ballot legality) + ZKP2 (consistency)
 *
 * This circuit proves that:
 *   1. commitment = Poseidon(candidateId, salt)          [ZKP2: consistency]
 *   2. 0 <= candidateId < numCandidates                  [ZKP1: legality]
 *   3. The encrypted vote is a valid one-hot vector:
 *      - ciphertext[candidateId] encrypts 1              [ZKP1+ZKP2]
 *      - ciphertext[j != candidateId] encrypts 0         [ZKP1]
 *   4. ciphertextHash = Poseidon(all ciphertext components) [binding]
 *
 * Template parameter:
 *   numCandidates - number of candidates (fixed at compile time)
 */
template VoteProof(numCandidates) {
    // ─── Public inputs ──────────────────────────────────
    signal input commitment;                         // Poseidon(candidateId, salt)
    signal input ciphertextHash;                     // Poseidon(all c1x,c1y,c2x,c2y)
    signal input pkX;                                // Admin ElGamal public key X
    signal input pkY;                                // Admin ElGamal public key Y

    // ─── Private inputs ─────────────────────────────────
    signal input candidateId;                        // chosen candidate (0-indexed)
    signal input salt;                               // random salt for commitment
    signal input r[numCandidates];                   // ElGamal randomness per position
    signal input c1X[numCandidates];                 // ciphertext C1.x per position
    signal input c1Y[numCandidates];                 // ciphertext C1.y per position
    signal input c2X[numCandidates];                 // ciphertext C2.x per position
    signal input c2Y[numCandidates];                 // ciphertext C2.y per position

    // ─── 1. Verify commitment = Poseidon(candidateId, salt) ───
    component commitHash = Poseidon(2);
    commitHash.inputs[0] <== candidateId;
    commitHash.inputs[1] <== salt;
    commitment === commitHash.out;

    // ─── 2. Range check: 0 <= candidateId < numCandidates ────
    component lt = LessThan(8);  // 8 bits supports up to 255 candidates
    lt.in[0] <== candidateId;
    lt.in[1] <== numCandidates;
    lt.out === 1;

    // ─── 3. Verify each ciphertext position ──────────────────
    // For each position i:
    //   if i == candidateId: msgBit = 1 (encrypts generator G)
    //   if i != candidateId: msgBit = 0 (encrypts identity O)

    // Compute isSelected[i] = (i == candidateId) ? 1 : 0
    component isEqual[numCandidates];
    for (var i = 0; i < numCandidates; i++) {
        isEqual[i] = IsEqual();
        isEqual[i].in[0] <== i;
        isEqual[i].in[1] <== candidateId;
    }

    // Verify each ElGamal ciphertext
    component elgamalVerify[numCandidates];
    for (var i = 0; i < numCandidates; i++) {
        elgamalVerify[i] = ElGamalVerifyEncryption();
        elgamalVerify[i].r <== r[i];
        elgamalVerify[i].pkX <== pkX;
        elgamalVerify[i].pkY <== pkY;
        elgamalVerify[i].msgBit <== isEqual[i].out;  // 1 if selected, 0 otherwise
        elgamalVerify[i].c1X <== c1X[i];
        elgamalVerify[i].c1Y <== c1Y[i];
        elgamalVerify[i].c2X <== c2X[i];
        elgamalVerify[i].c2Y <== c2Y[i];
    }

    // ─── 4. Verify ciphertextHash ────────────────────────────
    // Hash all ciphertext components: c1X[0],c1Y[0],c2X[0],c2Y[0], c1X[1], ...
    // Total inputs = numCandidates * 4
    component ctHash = Poseidon(numCandidates * 4);
    for (var i = 0; i < numCandidates; i++) {
        ctHash.inputs[i * 4 + 0] <== c1X[i];
        ctHash.inputs[i * 4 + 1] <== c1Y[i];
        ctHash.inputs[i * 4 + 2] <== c2X[i];
        ctHash.inputs[i * 4 + 3] <== c2Y[i];
    }
    ciphertextHash === ctHash.out;
}

// Instantiate for 3 candidates (default election size)
component main {public [commitment, ciphertextHash, pkX, pkY]} = VoteProof(3);
