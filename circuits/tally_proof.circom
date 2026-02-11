pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "lib/elgamal.circom";

/**
 * TallyProof circuit - Proves ZKP3 (decryption correctness)
 *
 * After homomorphic aggregation of all encrypted votes, the admin
 * decrypts the totals. This circuit proves the decryption was correct
 * without revealing the secret key.
 *
 * For each candidate j, the aggregated ciphertext is (C1_total_j, C2_total_j).
 * The admin claims results[j] votes for candidate j.
 *
 * Proves:
 *   1. PK = sk * G                                    (key ownership)
 *   2. results[j]*G = C2_total_j - sk*C1_total_j      (correct decryption)
 *   3. sum(results) = totalVotes                       (total consistency)
 *
 * Template parameter:
 *   numCandidates - number of candidates
 */
template TallyProof(numCandidates) {
    // ─── Public inputs ──────────────────────────────────
    signal input pkX;                                // Admin public key X
    signal input pkY;                                // Admin public key Y
    signal input c1TotalX[numCandidates];            // Aggregated C1.x per candidate
    signal input c1TotalY[numCandidates];            // Aggregated C1.y per candidate
    signal input c2TotalX[numCandidates];            // Aggregated C2.x per candidate
    signal input c2TotalY[numCandidates];            // Aggregated C2.y per candidate
    signal input resultPointX[numCandidates];        // results[j]*G point X
    signal input resultPointY[numCandidates];        // results[j]*G point Y
    signal input totalVotes;                         // expected total vote count

    // ─── Private inputs ─────────────────────────────────
    signal input sk;                                 // Admin secret key

    // ─── 1 & 2. Verify decryption for each candidate ────
    // ElGamalVerifyDecryption checks:
    //   - PK = sk * G
    //   - resultPoint = C2 - sk*C1 (via C2 = resultPoint + sk*C1)
    //
    // Note: The first component also verifies the PK-sk relationship.
    // Subsequent components will redundantly verify it, which is fine
    // (the constraint system handles this efficiently).

    component decVerify[numCandidates];
    for (var j = 0; j < numCandidates; j++) {
        decVerify[j] = ElGamalVerifyDecryption();
        decVerify[j].sk <== sk;
        decVerify[j].pkX <== pkX;
        decVerify[j].pkY <== pkY;
        decVerify[j].c1X <== c1TotalX[j];
        decVerify[j].c1Y <== c1TotalY[j];
        decVerify[j].c2X <== c2TotalX[j];
        decVerify[j].c2Y <== c2TotalY[j];
        decVerify[j].resultX <== resultPointX[j];
        decVerify[j].resultY <== resultPointY[j];
    }

    // ─── 3. Verify total votes sum ──────────────────────
    // We need to verify that the result points correspond to the claimed
    // integer results AND that they sum correctly.
    //
    // Since results are public as curve points (results[j]*G), the contract
    // can verify the sum by checking:
    //   resultPoint[0] + resultPoint[1] + ... = totalVotes * G
    //
    // We verify this in the circuit by adding all result points and
    // comparing to totalVotes * G.

    // Sum all result points
    signal sumX[numCandidates];
    signal sumY[numCandidates];

    // Start with first result point
    sumX[0] <== resultPointX[0];
    sumY[0] <== resultPointY[0];

    // Accumulate remaining points
    component pointSum[numCandidates - 1];
    for (var j = 1; j < numCandidates; j++) {
        pointSum[j-1] = BabyAdd();
        pointSum[j-1].x1 <== sumX[j-1];
        pointSum[j-1].y1 <== sumY[j-1];
        pointSum[j-1].x2 <== resultPointX[j];
        pointSum[j-1].y2 <== resultPointY[j];
        sumX[j] <== pointSum[j-1].xout;
        sumY[j] <== pointSum[j-1].yout;
    }

    // Compute totalVotes * G
    component tvBits = Num2Bits(32);  // up to ~4 billion votes
    tvBits.in <== totalVotes;

    // Pad to 254 bits for EscalarMulFix
    component tvG = EscalarMulFix(254, [getGeneratorX(), getGeneratorY()]);
    for (var i = 0; i < 32; i++) {
        tvG.e[i] <== tvBits.out[i];
    }
    for (var i = 32; i < 254; i++) {
        tvG.e[i] <== 0;
    }

    // Verify sum of result points = totalVotes * G
    sumX[numCandidates - 1] === tvG.out[0];
    sumY[numCandidates - 1] === tvG.out[1];
}

// Instantiate for 3 candidates (matching vote_proof)
component main {public [pkX, pkY, c1TotalX, c1TotalY, c2TotalX, c2TotalY, resultPointX, resultPointY, totalVotes]} = TallyProof(3);
