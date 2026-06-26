#!/usr/bin/env bash
# Groth16 trusted setup for TierProof circuit (BLS12-381)
# For the hackathon we use a local "powers of tau" ceremony.
# In production this would use a real multi-party ceremony.
# Prerequisites: snarkjs, node

set -euo pipefail

CIRCUIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$CIRCUIT_DIR/build"
PTAU_DIR="$CIRCUIT_DIR/ptau"
KEYS_DIR="$CIRCUIT_DIR/keys"

mkdir -p "$PTAU_DIR" "$KEYS_DIR"

# The circuit has ~50 constraints so 2^12 is well more than enough
POWER=12

echo "==> Phase 1: Powers of Tau (BLS12-381, 2^$POWER)..."
if [ ! -f "$PTAU_DIR/pot${POWER}_0000.ptau" ]; then
  npx snarkjs powersoftau new bls12381 $POWER "$PTAU_DIR/pot${POWER}_0000.ptau" -v
fi

echo "==> Phase 1: Contributing entropy..."
if [ ! -f "$PTAU_DIR/pot${POWER}_0001.ptau" ]; then
  npx snarkjs powersoftau contribute \
    "$PTAU_DIR/pot${POWER}_0000.ptau" \
    "$PTAU_DIR/pot${POWER}_0001.ptau" \
    --name="Ztellar Edge Hackathon" \
    -e="$(date +%s%N | sha256sum | head -c 64)" \
    -v
fi

echo "==> Phase 1: Prepare phase 2..."
if [ ! -f "$PTAU_DIR/pot${POWER}_final.ptau" ]; then
  npx snarkjs powersoftau prepare phase2 \
    "$PTAU_DIR/pot${POWER}_0001.ptau" \
    "$PTAU_DIR/pot${POWER}_final.ptau" \
    -v
fi

echo "==> Phase 2: Groth16 setup..."
npx snarkjs groth16 setup \
  "$BUILD_DIR/tier_proof.r1cs" \
  "$PTAU_DIR/pot${POWER}_final.ptau" \
  "$KEYS_DIR/tier_proof_0000.zkey"

echo "==> Phase 2: Contributing..."
npx snarkjs zkey contribute \
  "$KEYS_DIR/tier_proof_0000.zkey" \
  "$KEYS_DIR/tier_proof_0001.zkey" \
  --name="Ztellar Edge" \
  -e="$(date +%s%N | sha256sum | head -c 64)"

echo "==> Exporting verification key..."
npx snarkjs zkey export verificationkey \
  "$KEYS_DIR/tier_proof_0001.zkey" \
  "$KEYS_DIR/verification_key.json"

echo "==> Exporting Solidity verifier (reference)..."
npx snarkjs zkey export solidityverifier \
  "$KEYS_DIR/tier_proof_0001.zkey" \
  "$KEYS_DIR/verifier_reference.sol" 2>/dev/null || true

echo ""
echo "==> Setup complete!"
echo "  Proving key:      $KEYS_DIR/tier_proof_0001.zkey"
echo "  Verification key: $KEYS_DIR/verification_key.json"
echo ""
echo "Copy the following keys to the frontend:"
echo "  cp $KEYS_DIR/verification_key.json ../frontend/public/zk/"
echo "  cp $BUILD_DIR/tier_proof_js/tier_proof.wasm ../frontend/public/zk/"
echo "  cp $KEYS_DIR/tier_proof_0001.zkey ../frontend/public/zk/"
