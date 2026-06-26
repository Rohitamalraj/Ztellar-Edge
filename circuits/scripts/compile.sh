#!/usr/bin/env bash
# Compile the TierProof Circom circuit to R1CS + WASM
# Prerequisites: circom 2.x, node, npm
# Usage: bash compile.sh

set -euo pipefail

CIRCUIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$CIRCUIT_DIR/build"

echo "==> Installing circomlib..."
cd "$CIRCUIT_DIR"
npm install --silent

echo "==> Creating output directory..."
mkdir -p "$OUT_DIR"

echo "==> Compiling tier_proof.circom (BLS12-381)..."
circom tier_proof.circom \
  --r1cs \
  --wasm \
  --sym \
  --output "$OUT_DIR" \
  --curve bls12381 \
  --O2

echo ""
echo "Compilation output:"
ls -lh "$OUT_DIR/"

echo ""
echo "==> Constraint count:"
npx snarkjs r1cs info "$OUT_DIR/tier_proof.r1cs" 2>&1 | grep -E "Constraints|Public|Private"

echo ""
echo "==> Done. Run scripts/setup.sh for powers-of-tau + Groth16 setup."
