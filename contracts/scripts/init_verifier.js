/**
 * Initialize the ZK Verifier Soroban contract with the Groth16 verification key.
 *
 * Reads circuits/keys/verification_key.json, converts all BLS12-381 G1/G2 points
 * to raw bytes, then calls zk_verifier::init(admin, vk, tier_manager).
 *
 * Usage: node scripts/init_verifier.js
 * Run from the contracts/ directory.
 */

const fs = require("fs");
const path = require("path");
const {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  xdr,
  nativeToScVal,
  BASE_FEE,
  Keypair,
} = require("@stellar/stellar-sdk");

// ── Config ───────────────────────────────────────────────────────────────────
const NETWORK = "testnet";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const ZK_VERIFIER_ID = "CCXWUFODL5BLHM4IIFGCUVLLTTWFKG7CO4S2A6EYWHO3YKT4EPRPCA23";
const TIER_MANAGER_ID = "CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF";
// Run: ADMIN_SECRET=S... node scripts/init_verifier.js
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  console.error("Error: ADMIN_SECRET env var required (stellar keys secret deploy-admin)");
  process.exit(1);
}

const VK_PATH = path.join(__dirname, "../../circuits/keys/verification_key.json");

// ── BLS12-381 byte conversion ────────────────────────────────────────────────
// BLS12-381 Fp: 48 bytes big-endian
// G1 affine: x (48 bytes) || y (48 bytes) = 96 bytes
// G2 affine: x_c0 (48 bytes) || x_c1 (48 bytes) || y_c0 (48 bytes) || y_c1 (48 bytes) = 192 bytes
//
// snarkjs G2 format: [[x_c1, x_c0], [y_c1, y_c0], ["1","0"]]  (c1 first, then c0)
// Soroban Fp2 format: c0 (48 bytes) || c1 (48 bytes)            (c0 first, then c1)

const FP_BYTES = 48;
const G1_BYTES = 96;
const G2_BYTES = 192;

function decimalToBytes(dec, length) {
  let n = BigInt(dec);
  const buf = Buffer.alloc(length);
  for (let i = length - 1; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

function g1ToBuffer(point) {
  // point = ["x_dec", "y_dec", "1"]
  const x = decimalToBytes(point[0], FP_BYTES);
  const y = decimalToBytes(point[1], FP_BYTES);
  return Buffer.concat([x, y]); // 96 bytes
}

function g2ToBuffer(point) {
  // snarkjs: point = [[x_c1, x_c0], [y_c1, y_c0], ["1","0"]]  (c1=imaginary at [0], c0=real at [1])
  // Soroban Bls12381G2Affine = X_c1 || X_c0 || Y_c1 || Y_c0 (imaginary first — matches ZCash/blst)
  const x_c1 = decimalToBytes(point[0][0], FP_BYTES);
  const x_c0 = decimalToBytes(point[0][1], FP_BYTES);
  const y_c1 = decimalToBytes(point[1][0], FP_BYTES);
  const y_c0 = decimalToBytes(point[1][1], FP_BYTES);
  return Buffer.concat([x_c1, x_c0, y_c1, y_c0]); // 192 bytes: c1 first
}

// ── XDR helpers ──────────────────────────────────────────────────────────────

function bufToScBytes(buf) {
  return xdr.ScVal.scvBytes(buf);
}

function makeG1ScVal(buf) {
  return bufToScBytes(buf);
}

function makeG2ScVal(buf) {
  return bufToScBytes(buf);
}

function makeVkScVal(vk) {
  // VerificationKey struct: alpha (G1), beta (G2), gamma (G2), delta (G2), ic (Vec<G1>)
  const icEntries = vk.IC.map((pt) => makeG1ScVal(g1ToBuffer(pt)));
  const icVec = xdr.ScVal.scvVec(icEntries);

  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("alpha"),
      val: makeG1ScVal(g1ToBuffer(vk.vk_alpha_1)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("beta"),
      val: makeG2ScVal(g2ToBuffer(vk.vk_beta_2)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("delta"),
      val: makeG2ScVal(g2ToBuffer(vk.vk_delta_2)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("gamma"),
      val: makeG2ScVal(g2ToBuffer(vk.vk_gamma_2)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("ic"),
      val: icVec,
    }),
  ]);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
  const adminAddress = adminKeypair.publicKey();
  console.log("Admin:", adminAddress);
  console.log("ZK Verifier:", ZK_VERIFIER_ID);
  console.log("Tier Manager:", TIER_MANAGER_ID);

  // Load verification key
  console.log("\nLoading verification key from:", VK_PATH);
  const vk = JSON.parse(fs.readFileSync(VK_PATH, "utf8"));
  console.log("Protocol:", vk.protocol, "| Curve:", vk.curve, "| nPublic:", vk.nPublic);
  console.log("IC length:", vk.IC.length, "(expected", vk.nPublic + 1, ")");

  // Validate
  if (vk.protocol !== "groth16") throw new Error("Expected groth16 protocol");
  if (vk.curve !== "bls12381") throw new Error("Expected bls12381 curve");
  if (vk.IC.length !== vk.nPublic + 1) throw new Error("IC length mismatch");

  // Convert VK to ScVal
  console.log("\nConverting VK to Soroban ScVal...");
  const vkScVal = makeVkScVal(vk);

  // Build transaction
  const server = new rpc.Server(RPC_URL, { allowHttp: false });
  const sourceAccount = await server.getAccount(adminAddress);

  const contract = new Contract(ZK_VERIFIER_ID);
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "init",
        nativeToScVal(adminAddress, { type: "address" }),
        vkScVal,
        nativeToScVal(TIER_MANAGER_ID, { type: "address" })
      )
    )
    .setTimeout(180)
    .build();

  // Simulate
  console.log("Simulating transaction...");
  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    console.error("Simulation failed:", simResult.error);
    process.exit(1);
  }
  console.log("Simulation OK. Fee:", simResult.minResourceFee, "stroops");

  // Prepare + sign
  const preparedTx = rpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(adminKeypair);

  // Submit
  console.log("Submitting transaction...");
  const result = await server.sendTransaction(preparedTx);
  if (result.status === "ERROR") {
    console.error("Submission error:", JSON.stringify(result.errorResult));
    process.exit(1);
  }

  // Poll
  const hash = result.hash;
  console.log("Tx hash:", hash);
  console.log("Polling for confirmation...");
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const txResult = await server.getTransaction(hash);
    if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log("\n✅ ZK Verifier initialized successfully!");
      console.log("Explorer:", `https://stellar.expert/explorer/testnet/tx/${hash}`);
      return;
    }
    if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
      console.error("Transaction failed:", JSON.stringify(txResult.resultXdr));
      process.exit(1);
    }
    process.stdout.write(".");
  }
  console.error("\nTimeout waiting for confirmation");
  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
