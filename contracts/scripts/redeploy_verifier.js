/**
 * Redeploy ZK Verifier with corrected G2 byte order, then re-init and
 * update TierManager to point to the new verifier address.
 *
 * Root cause: Soroban Bls12381G2Affine encoding is X_c1||X_c0||Y_c1||Y_c0
 * (imaginary component c1 FIRST).  The original scripts had c0||c1 (reversed),
 * causing pairing_check to receive invalid G2 points → WasmVm panic.
 *
 * Usage (from contracts/ directory):
 *   ADMIN_SECRET=S... node scripts/redeploy_verifier.js
 */

"use strict";

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const {
  rpc, Contract, TransactionBuilder, Networks, xdr,
  nativeToScVal, BASE_FEE, Keypair, Operation, Address, StrKey,
} = require(path.join(__dirname, "../../frontend/node_modules/@stellar/stellar-sdk"));

// ── Config ────────────────────────────────────────────────────────────────────
const RPC_URL         = "https://soroban-testnet.stellar.org";
const NETWORK         = "testnet";
const NETWORK_PASS    = Networks.TESTNET;
const TIER_MANAGER_ID = "CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF";
const WASM_PATH       = path.join(__dirname, "../target/wasm32v1-none/release/ztellar_zk_verifier.wasm");
const VK_PATH         = path.join(__dirname, "../../circuits/keys/verification_key.json");
const ENV_PATH        = path.join(__dirname, "../../frontend/.env.local");

const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) { console.error("Error: set ADMIN_SECRET=S..."); process.exit(1); }

// ── BLS12-381 encoding ────────────────────────────────────────────────────────
// ffjavascript/snarkjs Fp2 JSON: [c0, c1] — c0 (real) at index [0], c1 (imaginary) at index [1]
// Soroban Bls12381G2Affine (blst): X_c1 || X_c0 || Y_c1 || Y_c0 — imaginary (c1) FIRST
// So to convert: write index [1] first, index [0] second for each coordinate.

function decimalToBytes(dec, len) {
  let n = BigInt(dec);
  const b = Buffer.alloc(len);
  for (let i = len - 1; i >= 0; i--) { b[i] = Number(n & 0xffn); n >>= 8n; }
  return b;
}
const FP = 48;
const g1 = pt => Buffer.concat([decimalToBytes(pt[0], FP), decimalToBytes(pt[1], FP)]);
const g2 = pt => Buffer.concat([
  decimalToBytes(pt[0][1], FP), // x_c1 (imaginary, index [1]) → FIRST — blst format
  decimalToBytes(pt[0][0], FP), // x_c0 (real, index [0])
  decimalToBytes(pt[1][1], FP), // y_c1 (imaginary, index [1])
  decimalToBytes(pt[1][0], FP), // y_c0 (real, index [0])
]);

function makeVkScVal(vk) {
  const icVec = xdr.ScVal.scvVec(vk.IC.map(pt => xdr.ScVal.scvBytes(g1(pt))));
  return xdr.ScVal.scvMap([   // keys must be lexicographic for Soroban contracttype
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("alpha"), val: xdr.ScVal.scvBytes(g1(vk.vk_alpha_1)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("beta"),  val: xdr.ScVal.scvBytes(g2(vk.vk_beta_2))  }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("delta"), val: xdr.ScVal.scvBytes(g2(vk.vk_delta_2)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("gamma"), val: xdr.ScVal.scvBytes(g2(vk.vk_gamma_2)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("ic"),    val: icVec }),
  ]);
}

// ── Contract ID derivation ────────────────────────────────────────────────────
// Soroban contract IDs are deterministic: SHA256(preimage) where preimage encodes
// the network, deployer address, and salt.  We compute before deploying so we
// know the ID up front.

function computeContractId(adminPublicKey, salt) {
  const networkId = crypto.createHash("sha256").update(NETWORK_PASS).digest();
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(adminPublicKey).toScAddress(),
          salt,
        })
      ),
    })
  );
  return StrKey.encodeContract(crypto.createHash("sha256").update(preimage.toXDR()).digest());
}

// ── RPC helper ────────────────────────────────────────────────────────────────

async function sendAndConfirm(server, tx, kp, label) {
  process.stdout.write(`  [${label}] sim... `);
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Sim failed (${label}): ${sim.error}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);

  const submit = await server.sendTransaction(prepared);
  if (submit.status === "ERROR") throw new Error(`Submit (${label}): ${JSON.stringify(submit.errorResult)}`);
  process.stdout.write(`OK  tx: ${submit.hash.slice(0,12)}… polling`);

  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await server.getTransaction(submit.hash);
    process.stdout.write(".");
    if (s.status === rpc.Api.GetTransactionStatus.SUCCESS) { console.log(" ✅"); return s; }
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)  { console.log(" ❌"); throw new Error(`TX failed (${label}): ${JSON.stringify(s.resultXdr)}`); }
  }
  throw new Error(`Timeout (${label})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const kp     = Keypair.fromSecret(ADMIN_SECRET);
  const admin  = kp.publicKey();
  const server = new rpc.Server(RPC_URL, { allowHttp: false });

  console.log("Admin:        ", admin);
  console.log("TierManager:  ", TIER_MANAGER_ID);
  console.log("");

  // Fetch account ONCE. TransactionBuilder.build() calls acct.incrementSequenceNumber()
  // in-place, so reusing the same object gives us N+1, N+2, N+3, N+4 without any
  // re-fetch. Re-fetching between TXs causes txBadSeq because the RPC can return a
  // stale sequence number immediately after confirming the previous TX.
  const acct = await server.getAccount(admin);

  // ── 1. Upload WASM ─────────────────────────────────────────────────────────
  console.log("==> [1/4] Uploading WASM...");
  const wasmBytes = fs.readFileSync(WASM_PATH);
  const wasmHash  = crypto.createHash("sha256").update(wasmBytes).digest();
  console.log("  size:", wasmBytes.length, "bytes | SHA256:", wasmHash.toString("hex").slice(0,16) + "…");

  const uploadTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(180).build();

  await sendAndConfirm(server, uploadTx, kp, "upload");
  console.log("");

  // ── 2. Deploy contract (compute ID deterministically from salt) ────────────
  console.log("==> [2/4] Deploying new ZK_VERIFIER contract...");
  const salt = crypto.randomBytes(32);

  // Compute the contract ID BEFORE deploying — it's deterministic from deployer+salt
  const newVerifierId = computeContractId(admin, salt);
  console.log("  Computed contract ID:", newVerifierId);

  const deployTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.createCustomContract({
      address: new Address(admin),
      wasmHash,
      salt,
    }))
    .setTimeout(180).build();

  await sendAndConfirm(server, deployTx, kp, "deploy");
  console.log("");

  // ── 3. Initialize with corrected VK ───────────────────────────────────────
  console.log("==> [3/4] Initializing with corrected G2 byte order...");
  const vk = JSON.parse(fs.readFileSync(VK_PATH, "utf8"));
  console.log(`  IC.length=${vk.IC.length}  nPublic=${vk.nPublic}  curve=${vk.curve}`);

  const vkScVal  = makeVkScVal(vk);
  const contract = new Contract(newVerifierId);
  const initTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(contract.call(
      "init",
      nativeToScVal(admin, { type: "address" }),
      vkScVal,
      nativeToScVal(TIER_MANAGER_ID, { type: "address" })
    ))
    .setTimeout(180).build();

  await sendAndConfirm(server, initTx, kp, "init");
  console.log("");

  // ── 4. Update TierManager verifier ────────────────────────────────────────
  console.log("==> [4/4] Updating TierManager.set_verifier...");
  const tm = new Contract(TIER_MANAGER_ID);
  const setTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(tm.call("set_verifier", nativeToScVal(newVerifierId, { type: "address" })))
    .setTimeout(180).build();

  await sendAndConfirm(server, setTx, kp, "set_verifier");
  console.log("");

  // ── Update .env.local ─────────────────────────────────────────────────────
  console.log("==> Updating frontend/.env.local...");
  let env = fs.readFileSync(ENV_PATH, "utf8");
  env = env.replace(
    /^NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID=.*/m,
    `NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID=${newVerifierId}`
  );
  fs.writeFileSync(ENV_PATH, env);
  console.log("  ✅ .env.local updated");
  console.log("");

  console.log("=".repeat(60));
  console.log("✅  REDEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("");
  console.log("New ZK_VERIFIER:", newVerifierId);
  console.log("TierManager (unchanged):", TIER_MANAGER_ID);
  console.log("");
  console.log("Restart the Next.js dev server and test the /prove flow.");
}

main().catch(err => { console.error("\n❌", err.message || err); process.exit(1); });
