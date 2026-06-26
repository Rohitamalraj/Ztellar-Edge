#!/usr/bin/env bash
# Ztellar Edge — Testnet Deployment Script
# Prerequisites: stellar CLI, jq, cargo installed
# Usage: bash deploy.sh [network]  (default: testnet)

set -euo pipefail

NETWORK="${1:-testnet}"
HORIZON_URL="https://horizon-testnet.stellar.org"
SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"

# ── Identity setup ──────────────────────────────────────────────────────────
echo "==> Setting up deployment identity..."
stellar keys generate --overwrite deploy-admin --network "$NETWORK" 2>/dev/null || true
ADMIN_ADDR=$(stellar keys address deploy-admin)
echo "Admin address: $ADMIN_ADDR"

# Fund via Friendbot on testnet
if [ "$NETWORK" = "testnet" ]; then
  echo "==> Funding via Friendbot..."
  curl -s "https://friendbot.stellar.org?addr=$ADMIN_ADDR" | jq -r '.hash' || true
  sleep 3
fi

# ── Build contracts ─────────────────────────────────────────────────────────
echo "==> Building contracts..."
cd "$(dirname "$0")/.."

# Build tier_manager first (zk_verifier and synth_vault depend on its .wasm)
cargo build -p ztellar-tier-manager \
  --target wasm32-unknown-unknown \
  --release 2>&1 | tail -5

cargo build -p ztellar-zk-verifier \
  --target wasm32-unknown-unknown \
  --release 2>&1 | tail -5

cargo build -p ztellar-synth-vault \
  --target wasm32-unknown-unknown \
  --release 2>&1 | tail -5

cargo build -p ztellar-synth-token \
  --target wasm32-unknown-unknown \
  --release 2>&1 | tail -5

echo "==> Build complete."

# ── Upload contracts ────────────────────────────────────────────────────────
upload_contract() {
  local name="$1"
  local wasm="$2"
  echo "==> Uploading $name..."
  stellar contract upload \
    --network "$NETWORK" \
    --source deploy-admin \
    --wasm "$wasm" 2>&1 | tail -3
}

upload_contract "tier_manager" \
  "tier_manager/target/wasm32-unknown-unknown/release/ztellar_tier_manager.wasm"

upload_contract "zk_verifier" \
  "zk_verifier/target/wasm32-unknown-unknown/release/ztellar_zk_verifier.wasm"

upload_contract "synth_vault" \
  "synth_vault/target/wasm32-unknown-unknown/release/ztellar_synth_vault.wasm"

upload_contract "synth_token" \
  "synth_token/target/wasm32-unknown-unknown/release/ztellar_synth_token.wasm"

# ── Deploy tier_manager ─────────────────────────────────────────────────────
echo "==> Deploying tier_manager..."
# Placeholder verifier address — updated after zk_verifier deploy
PLACEHOLDER="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

TM_ID=$(stellar contract deploy \
  --network "$NETWORK" \
  --source deploy-admin \
  --wasm "tier_manager/target/wasm32-unknown-unknown/release/ztellar_tier_manager.wasm" \
  -- \
  --admin "$ADMIN_ADDR" \
  --verifier "$PLACEHOLDER" 2>&1 | tail -1)

echo "tier_manager contract ID: $TM_ID"

# ── Deploy zk_verifier ──────────────────────────────────────────────────────
echo "==> Deploying zk_verifier..."
echo "  NOTE: You must supply the actual Groth16 VK bytes after circuit setup."
echo "  Run: stellar contract invoke --id $TM_ID -- init <vk args>"
echo "  Skipping zk_verifier deploy until circuit/VK is ready."

# ── Deploy synth_token contracts ────────────────────────────────────────────
echo "==> Deploying synth tokens (sAAPL, sTSLA, sNVDA)..."

PLACEHOLDER_VAULT="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

deploy_token() {
  local sym="$1"
  local name_str="$2"
  local id
  id=$(stellar contract deploy \
    --network "$NETWORK" \
    --source deploy-admin \
    --wasm "synth_token/target/wasm32-unknown-unknown/release/ztellar_synth_token.wasm" \
    -- \
    --admin "$ADMIN_ADDR" \
    --vault "$PLACEHOLDER_VAULT" \
    --name "$name_str" \
    --symbol "$sym" \
    --decimals 6 2>&1 | tail -1)
  echo "$sym contract ID: $id"
  echo "$sym=$id" >> deployed_contracts.env
}

rm -f deployed_contracts.env
echo "ADMIN=$ADMIN_ADDR" >> deployed_contracts.env
echo "TIER_MANAGER=$TM_ID" >> deployed_contracts.env
echo "NETWORK=$NETWORK" >> deployed_contracts.env

deploy_token "sAAPL" "Synthetic Apple"
deploy_token "sTSLA" "Synthetic Tesla"
deploy_token "sNVDA" "Synthetic NVIDIA"

echo ""
echo "==> Deployment complete! Contract IDs written to deployed_contracts.env"
cat deployed_contracts.env
echo ""
echo "Next steps:"
echo "  1. Run circuits/scripts/setup.sh to generate the Groth16 VK"
echo "  2. Run scripts/init_verifier.sh to upload VK and init zk_verifier"
echo "  3. Update frontend/.env.local with the contract IDs above"
