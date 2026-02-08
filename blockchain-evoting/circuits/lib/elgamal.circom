pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/babyjub.circom";
include "../../node_modules/circomlib/circuits/escalarmulany.circom";
include "../../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

/**
 * ElGamal encryption verification on BabyJubJub curve.
 *
 * Verifies that (C1, C2) is a valid ElGamal encryption of message point M
 * under public key PK with randomness r:
 *   C1 = r * G
 *   C2 = M + r * PK
 *
 * BabyJubJub Generator (Base8 from circomlib):
 *   Gx = 5299619240641551281634865583518297030282874472190772894086521144482721001553
 *   Gy = 16950150798460657717958625567821834550301663161624707787222815936182638968203
 */

// BabyJubJub Base8 generator coordinates
// These match circomlib's Base8 point
function getGeneratorX() {
    return 5299619240641551281634865583518297030282874472190772894086521144482721001553;
}

function getGeneratorY() {
    return 16950150798460657717958625567821834550301663161624707787222815936182638968203;
}

/**
 * ScalarMulGenerator: Compute s * G using fixed-base scalar multiplication.
 * Uses EscalarMulFix from circomlib with the BabyJubJub Base8 generator.
 */
template ScalarMulGenerator() {
    signal input scalar[254]; // scalar in binary (LSB first)
    signal output out[2];     // resulting point (x, y)

    component mulFix = EscalarMulFix(254, [getGeneratorX(), getGeneratorY()]);
    for (var i = 0; i < 254; i++) {
        mulFix.e[i] <== scalar[i];
    }
    out[0] <== mulFix.out[0];
    out[1] <== mulFix.out[1];
}

/**
 * Num2BitsBE_254: Convert a field element to 254-bit binary (LSB first).
 * Wrapper around Num2Bits for clarity.
 */
template Num2Bits_254() {
    signal input in;
    signal output out[254];

    component n2b = Num2Bits(254);
    n2b.in <== in;
    for (var i = 0; i < 254; i++) {
        out[i] <== n2b.out[i];
    }
}

/**
 * ElGamalVerifyEncryption: Verify a single ElGamal ciphertext.
 *
 * Inputs:
 *   r       - randomness scalar
 *   pkX,pkY - public key point
 *   msgBit  - message (0 or 1, for voting)
 *   c1X,c1Y - first ciphertext component
 *   c2X,c2Y - second ciphertext component
 *
 * Constraints:
 *   C1 = r * G
 *   C2 = msgBit * G + r * PK
 *
 * Note: msgBit must be 0 or 1 (binary constraint enforced externally).
 */
template ElGamalVerifyEncryption() {
    signal input r;
    signal input pkX;
    signal input pkY;
    signal input msgBit;  // 0 or 1
    signal input c1X;
    signal input c1Y;
    signal input c2X;
    signal input c2Y;

    // Convert r to bits for scalar multiplication
    component rBits = Num2Bits_254();
    rBits.in <== r;

    // Compute C1 = r * G (fixed-base)
    component rG = ScalarMulGenerator();
    for (var i = 0; i < 254; i++) {
        rG.scalar[i] <== rBits.out[i];
    }

    // Verify C1 = r * G
    c1X === rG.out[0];
    c1Y === rG.out[1];

    // Compute r * PK (variable-base)
    component rPK = EscalarMulAny(254);
    for (var i = 0; i < 254; i++) {
        rPK.e[i] <== rBits.out[i];
    }
    rPK.p[0] <== pkX;
    rPK.p[1] <== pkY;

    // C2 should equal msgBit*G + r*PK
    // If msgBit == 0: C2 = r*PK (i.e., 0*G + r*PK)
    // If msgBit == 1: C2 = G + r*PK
    //
    // We compute expected C2 using conditional addition:
    //   expected = r*PK + msgBit * G
    // Since msgBit is 0 or 1, we use a conditional point addition.

    // Compute G point (constant)
    var gX = getGeneratorX();
    var gY = getGeneratorY();

    // Conditional: if msgBit == 1, add G to r*PK
    // mux: select between (0,1) [identity] and G based on msgBit
    signal selectedX;
    signal selectedY;
    selectedX <== msgBit * gX;  // 0 if msgBit=0, gX if msgBit=1
    // For Y: identity is (0,1), so we need: msgBit*gY + (1-msgBit)*1
    selectedY <== msgBit * (gY - 1) + 1;

    // Add selected point to r*PK
    component finalAdd = BabyAdd();
    finalAdd.x1 <== rPK.out[0];
    finalAdd.y1 <== rPK.out[1];
    finalAdd.x2 <== selectedX;
    finalAdd.y2 <== selectedY;

    // Verify C2
    c2X === finalAdd.xout;
    c2Y === finalAdd.yout;
}

/**
 * ElGamalVerifyDecryption: Verify decryption of an ElGamal ciphertext.
 *
 * Given ciphertext (C1, C2), secret key sk, and claimed result m*G:
 *   Verify: PK = sk * G
 *   Verify: resultPoint = C2 - sk * C1
 *
 * Used in tally_proof to verify admin correctly decrypted aggregate ciphertexts.
 */
template ElGamalVerifyDecryption() {
    signal input sk;
    signal input pkX;
    signal input pkY;
    signal input c1X;
    signal input c1Y;
    signal input c2X;
    signal input c2Y;
    signal input resultX;  // expected m*G point x
    signal input resultY;  // expected m*G point y

    // Convert sk to bits
    component skBits = Num2Bits_254();
    skBits.in <== sk;

    // Verify PK = sk * G
    component skG = ScalarMulGenerator();
    for (var i = 0; i < 254; i++) {
        skG.scalar[i] <== skBits.out[i];
    }
    pkX === skG.out[0];
    pkY === skG.out[1];

    // Compute sk * C1
    component skC1 = EscalarMulAny(254);
    for (var i = 0; i < 254; i++) {
        skC1.e[i] <== skBits.out[i];
    }
    skC1.p[0] <== c1X;
    skC1.p[1] <== c1Y;

    // resultPoint should equal C2 - sk*C1
    // Equivalently: C2 = resultPoint + sk*C1
    component verifyAdd = BabyAdd();
    verifyAdd.x1 <== resultX;
    verifyAdd.y1 <== resultY;
    verifyAdd.x2 <== skC1.out[0];
    verifyAdd.y2 <== skC1.out[1];

    c2X === verifyAdd.xout;
    c2Y === verifyAdd.yout;
}
