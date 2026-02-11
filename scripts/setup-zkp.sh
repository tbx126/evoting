#!/bin/bash
# ZKP 电路编译和可信设置脚本
# Compiles circom circuits, runs Groth16 trusted setup, and exports Solidity verifiers.
#
# Prerequisites:
#   - circom 2.0+ compiler installed (cargo install --git https://github.com/iden3/circom.git)
#   - snarkjs installed (npm install snarkjs)
#   - Powers of Tau file downloaded (see below)
#
# Usage:
#   bash scripts/setup-zkp.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
CIRCUITS_DIR="$PROJECT_DIR/circuits"
CONTRACTS_DIR="$PROJECT_DIR/contracts"
FRONTEND_ZK_DIR="$PROJECT_DIR/frontend/zk"
PTAU_FILE="$BUILD_DIR/pot16_final.ptau"

echo "=============================="
echo " ZKP Circuit Setup Script"
echo "=============================="
echo ""

# Create directories
mkdir -p "$BUILD_DIR"
mkdir -p "$FRONTEND_ZK_DIR"

# Step 0: Check prerequisites
echo "[0/7] Checking prerequisites..."

if ! command -v circom &> /dev/null; then
    echo "ERROR: circom not found. Install with: cargo install --git https://github.com/iden3/circom.git"
    exit 1
fi
echo "  circom: $(circom --version)"

if ! npx snarkjs --version &> /dev/null 2>&1; then
    echo "ERROR: snarkjs not found. Install with: npm install snarkjs"
    exit 1
fi
echo "  snarkjs: available"

# Step 1: Download Powers of Tau (if not present)
echo ""
echo "[1/7] Checking Powers of Tau file..."
if [ ! -f "$PTAU_FILE" ]; then
    echo "  Downloading powersOfTau28_hez_final_16.ptau (~45MB)..."
    curl -L -o "$PTAU_FILE" \
        "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau"
    echo "  Downloaded."
else
    echo "  Already exists."
fi

# Step 2: Compile vote_proof circuit
echo ""
echo "[2/7] Compiling vote_proof circuit..."
circom "$CIRCUITS_DIR/vote_proof.circom" \
    --r1cs --wasm --sym \
    -o "$BUILD_DIR" \
    -l "$PROJECT_DIR/node_modules"
echo "  vote_proof compiled. R1CS constraints:"
npx snarkjs r1cs info "$BUILD_DIR/vote_proof.r1cs"

# Step 3: Compile tally_proof circuit
echo ""
echo "[3/7] Compiling tally_proof circuit..."
circom "$CIRCUITS_DIR/tally_proof.circom" \
    --r1cs --wasm --sym \
    -o "$BUILD_DIR" \
    -l "$PROJECT_DIR/node_modules"
echo "  tally_proof compiled. R1CS constraints:"
npx snarkjs r1cs info "$BUILD_DIR/tally_proof.r1cs"

# Step 4: Groth16 setup for vote_proof
echo ""
echo "[4/7] Running Groth16 setup for vote_proof..."
npx snarkjs groth16 setup \
    "$BUILD_DIR/vote_proof.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/vote_proof_0.zkey"

# Contribute to the ceremony (simplified for development)
echo "  Contributing to ceremony..."
echo "random-entropy-vote-proof" | npx snarkjs zkey contribute \
    "$BUILD_DIR/vote_proof_0.zkey" \
    "$BUILD_DIR/vote_proof_final.zkey" \
    --name="development-contribution"

# Export verification key
npx snarkjs zkey export verificationkey \
    "$BUILD_DIR/vote_proof_final.zkey" \
    "$BUILD_DIR/vote_proof_verification_key.json"

echo "  vote_proof setup complete."

# Step 5: Groth16 setup for tally_proof
echo ""
echo "[5/7] Running Groth16 setup for tally_proof..."
npx snarkjs groth16 setup \
    "$BUILD_DIR/tally_proof.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/tally_proof_0.zkey"

echo "  Contributing to ceremony..."
echo "random-entropy-tally-proof" | npx snarkjs zkey contribute \
    "$BUILD_DIR/tally_proof_0.zkey" \
    "$BUILD_DIR/tally_proof_final.zkey" \
    --name="development-contribution"

npx snarkjs zkey export verificationkey \
    "$BUILD_DIR/tally_proof_final.zkey" \
    "$BUILD_DIR/tally_proof_verification_key.json"

echo "  tally_proof setup complete."

# Step 6: Export Solidity verifiers
echo ""
echo "[6/7] Exporting Solidity verifiers..."

npx snarkjs zkey export solidityverifier \
    "$BUILD_DIR/vote_proof_final.zkey" \
    "$CONTRACTS_DIR/VoteVerifier.sol"
echo "  VoteVerifier.sol exported."

npx snarkjs zkey export solidityverifier \
    "$BUILD_DIR/tally_proof_final.zkey" \
    "$CONTRACTS_DIR/TallyVerifier.sol"
echo "  TallyVerifier.sol exported."

# Rename contract names in generated files (snarkjs names them all "Groth16Verifier")
# We need unique names for each verifier
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS sed
    sed -i '' 's/contract Groth16Verifier/contract VoteVerifier/g' "$CONTRACTS_DIR/VoteVerifier.sol"
    sed -i '' 's/contract Groth16Verifier/contract TallyVerifier/g' "$CONTRACTS_DIR/TallyVerifier.sol"
else
    # Linux/Windows sed
    sed -i 's/contract Groth16Verifier/contract VoteVerifier/g' "$CONTRACTS_DIR/VoteVerifier.sol"
    sed -i 's/contract Groth16Verifier/contract TallyVerifier/g' "$CONTRACTS_DIR/TallyVerifier.sol"
fi
echo "  Contract names updated."

# Step 7: Copy WASM and zkey files to frontend
echo ""
echo "[7/7] Copying ZKP resources to frontend..."

cp "$BUILD_DIR/vote_proof_js/vote_proof.wasm" "$FRONTEND_ZK_DIR/"
cp "$BUILD_DIR/vote_proof_final.zkey" "$FRONTEND_ZK_DIR/"
cp "$BUILD_DIR/tally_proof_js/tally_proof.wasm" "$FRONTEND_ZK_DIR/"
cp "$BUILD_DIR/tally_proof_final.zkey" "$FRONTEND_ZK_DIR/"

echo "  Copied to frontend/zk/"

echo ""
echo "=============================="
echo " Setup Complete!"
echo "=============================="
echo ""
echo "Generated files:"
echo "  Circuits:   $BUILD_DIR/vote_proof.r1cs, tally_proof.r1cs"
echo "  Contracts:  $CONTRACTS_DIR/VoteVerifier.sol, TallyVerifier.sol"
echo "  Frontend:   $FRONTEND_ZK_DIR/vote_proof.wasm, vote_proof_final.zkey"
echo "              $FRONTEND_ZK_DIR/tally_proof.wasm, tally_proof_final.zkey"
echo ""
echo "Next steps:"
echo "  1. npx hardhat compile     # Compile Solidity contracts"
echo "  2. npx hardhat test        # Run tests"
echo "  3. npx hardhat run scripts/deploy.js --network sepolia  # Deploy"
