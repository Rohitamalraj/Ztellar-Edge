/**
 * Offline proof verification — decode bytes from Soroban diagnostic log
 * and check if snarkjs considers the proof valid.
 *
 * Usage: node scripts/verify_test.js
 */
"use strict";

const path = require("path");
const fs   = require("fs");

async function main() {
  // snarkjs is ESM; use require for its CJS build
  const { groth16 } = require(
    path.join(__dirname, "../node_modules/snarkjs/build/main.cjs")
  );

  // ── Bytes from the Soroban diagnostic event log ─────────────────────────────
  // proof.a → G1 (96 bytes = x||y, 48 each)
  const proof_a_hex =
    "1627acd7cbc843b7f2c2222f6d641bd5fd165da6d1eb9cb5f396aed1a6bc0676" +
    "c5f3e4010f86f4f5935bafd3eee1b53812e0a95cb8b45f9087116be831436a9" +
    "1fdbd264d588b09babf71928006f8069fa7141d3df0fc24f5426ef94caa1e8c58";

  // proof.b → G2 (192 bytes = x_c1||x_c0||y_c1||y_c0, 48 each)
  // Our encoder puts x_c1 first (per Soroban format), so:
  //   bytes 0-47   = x_c1 (imaginary part of X) = pi_b[0][1] in snarkjs JSON
  //   bytes 48-95  = x_c0 (real part of X)      = pi_b[0][0]
  //   bytes 96-143 = y_c1 (imaginary part of Y) = pi_b[1][1]
  //   bytes 144-191= y_c0 (real part of Y)      = pi_b[1][0]
  const proof_b_hex =
    "0f4f85a8c090b21e0c7732ddac9d95e7f162bea0fc78c7ee8c1a83e1e004f82" +
    "82e546680e62495d07f93c15616c909ac198083b6c7c30ffd40aa642e67b0609" +
    "730620ff36f9beca732271cdf8e996c152fd31291a39e22928adff04cb663ee8" +
    "715f6f7b7e63b2c44c6cfe3da63eb0703df9d9b1cc85f756beba519ed3073d07" +
    "77fce6b40ba8a5844ecb25730da8707a113424a370cbf863dcfe1610d78998b6" +
    "ec531845dce54f46c602620159fd7cee9079bc856d7bc9af2ca7b18e1b3b01225";

  // proof.c → G1 (96 bytes = x||y, 48 each)
  const proof_c_hex =
    "0dc4a035ebe22ff158ee56355423ca9293cfef2940c14a9a1b06958de711962" +
    "1de3161a50602149ad4cf2820b9f3cf950a6d28ee44cde28ecdb11f31b20139b" +
    "0ce3f003fc7d752d6141f55adb9a7e1b93bd7fc23a9a655b12a00a84b36de4633";

  // ── Decode bytes → BigInt decimals ───────────────────────────────────────────
  const hex = s => s.replace(/\s/g, "");

  const a_hex  = hex(proof_a_hex);
  const b_hex  = hex(proof_b_hex);
  const c_hex  = hex(proof_c_hex);

  console.log("proof_a bytes:", a_hex.length / 2, "(expect 96)");
  console.log("proof_b bytes:", b_hex.length / 2, "(expect 192)");
  console.log("proof_c bytes:", c_hex.length / 2, "(expect 96)");

  // G1: [x_dec, y_dec, "1"]
  const g1_x_a = BigInt("0x" + a_hex.slice(0, 96)).toString();
  const g1_y_a = BigInt("0x" + a_hex.slice(96, 192)).toString();

  const g1_x_c = BigInt("0x" + c_hex.slice(0, 96)).toString();
  const g1_y_c = BigInt("0x" + c_hex.slice(96, 192)).toString();

  // G2: bytes are x_c1||x_c0||y_c1||y_c0 (our encoding)
  // snarkjs JSON format: [[c0, c1], [c0, c1], [1,0]]  (real first)
  const b_x_c1 = BigInt("0x" + b_hex.slice(0,   96)).toString();  // imaginary
  const b_x_c0 = BigInt("0x" + b_hex.slice(96,  192)).toString(); // real
  const b_y_c1 = BigInt("0x" + b_hex.slice(192, 288)).toString(); // imaginary
  const b_y_c0 = BigInt("0x" + b_hex.slice(288, 384)).toString(); // real

  const proof = {
    pi_a: [g1_x_a, g1_y_a, "1"],
    pi_b: [
      [b_x_c0, b_x_c1],   // snarkjs: [c0, c1] — real first
      [b_y_c0, b_y_c1],
      ["1", "0"],
    ],
    pi_c: [g1_x_c, g1_y_c, "1"],
    protocol: "groth16",
    curve:    "bls12381",
  };

  // ── Public signals from the log ──────────────────────────────────────────────
  const publicSignals = [
    "48007385967942527346778338139069371969243177142879859579501995666967893873612",
    "9065268470945396307285002682659007301053924803476516296272028517862137663247",
    "2",
    "27685205176238845137267950734433487539889310273444285880169061637269506119988",
    "1785260157",
  ];

  // ── Load VK and verify ───────────────────────────────────────────────────────
  const vk = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../circuits/keys/verification_key.json"),
      "utf8"
    )
  );

  console.log("\nVK nPublic:", vk.nPublic, "  IC.length:", vk.IC.length);
  console.log("publicSignals count:", publicSignals.length);
  console.log("\nRunning snarkjs.groth16.verify ...");

  const valid = await groth16.verify(vk, publicSignals, proof);
  console.log("\n══════════════════════════════════════");
  console.log("Proof valid (snarkjs):", valid);
  console.log("══════════════════════════════════════");

  if (!valid) {
    console.log("\n⚠ snarkjs also rejects the proof.");
    console.log("Trying with SWAPPED c0/c1 (in case our encoding is backwards)...");

    const proof_swapped = {
      pi_a: proof.pi_a,
      pi_b: [
        [b_x_c1, b_x_c0],   // swap: c1 first in JSON
        [b_y_c1, b_y_c0],
        ["1", "0"],
      ],
      pi_c: proof.pi_c,
      protocol: "groth16",
      curve: "bls12381",
    };
    const valid2 = await groth16.verify(vk, publicSignals, proof_swapped);
    console.log("Proof valid (swapped c0/c1 in JSON):", valid2);
  }
}

main().catch(err => { console.error("❌", err); process.exit(1); });
