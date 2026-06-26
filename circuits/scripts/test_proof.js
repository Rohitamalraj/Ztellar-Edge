/**
 * Quick end-to-end test of proof generation + verification.
 * Run: node scripts/test_proof.js
 */

const snarkjs = require("snarkjs");
const path = require("path");
const fs = require("fs");

const BUILD_DIR = path.join(__dirname, "..", "build");
const KEYS_DIR = path.join(__dirname, "..", "keys");

async function testProof(score, expectedTier) {
  const wasmFile = path.join(BUILD_DIR, "tier_proof_js", "tier_proof.wasm");
  const zkeyFile = path.join(KEYS_DIR, "tier_proof_0001.zkey");
  const vkeyFile = path.join(KEYS_DIR, "verification_key.json");

  if (!fs.existsSync(wasmFile)) {
    console.error("WASM not found. Run: bash scripts/compile.sh first.");
    process.exit(1);
  }
  if (!fs.existsSync(zkeyFile)) {
    console.error("zkey not found. Run: bash scripts/setup.sh first.");
    process.exit(1);
  }

  const inputs = {
    wallet_secret: "123456789012345678901234567890123456789",
    score: String(score),
    wallet_address: "987654321098765432109876543210987654321",
    expiry: String(Math.floor(Date.now() / 1000) + 86400 * 30), // 30 days
  };

  console.log(`\nTesting score=${score}, expected tier=${expectedTier}...`);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    wasmFile,
    zkeyFile
  );

  console.log("Public signals:");
  console.log("  nullifier:", publicSignals[0]);
  console.log("  wallet_commitment:", publicSignals[1]);
  console.log("  tier:", publicSignals[2]);
  console.log("  expiry:", publicSignals[3]);

  if (publicSignals[2] !== String(expectedTier)) {
    console.error(`FAIL: expected tier ${expectedTier}, got ${publicSignals[2]}`);
    process.exit(1);
  }

  const vkey = JSON.parse(fs.readFileSync(vkeyFile));
  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!valid) {
    console.error("FAIL: proof verification failed");
    process.exit(1);
  }
  console.log(`PASS: tier=${publicSignals[2]}, proof valid`);
  return { proof, publicSignals };
}

(async () => {
  try {
    await testProof(10, 1);   // Tier 1
    await testProof(30, 2);   // Tier 2
    await testProof(60, 3);   // Tier 3
    await testProof(80, 4);   // Tier 4
    await testProof(24, 1);   // Boundary: 24 → tier 1
    await testProof(25, 2);   // Boundary: 25 → tier 2
    await testProof(74, 3);   // Boundary: 74 → tier 3
    await testProof(75, 4);   // Boundary: 75 → tier 4

    console.log("\nAll tests passed!");
  } catch (e) {
    console.error("Test error:", e.message);
    process.exit(1);
  }
})();
