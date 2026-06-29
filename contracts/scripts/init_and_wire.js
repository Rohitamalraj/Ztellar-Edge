/**
 * Initialize an already-deployed ZK_VERIFIER contract with the correct VK,
 * then wire it into TierManager. Run this if redeploy_verifier.js deployed
 * the contract but timed out before finishing init/set_verifier.
 *
 * Usage (from contracts/):
 *   ADMIN_SECRET=S... VERIFIER_ID=C... node scripts/init_and_wire.js
 */
"use strict";

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const {
  rpc, Contract, TransactionBuilder, Networks, xdr,
  nativeToScVal, BASE_FEE, Keypair,
} = require(path.join(__dirname, "../../frontend/node_modules/@stellar/stellar-sdk"));

const RPC_URL      = "https://soroban-testnet.stellar.org";
const NETWORK_PASS = Networks.TESTNET;
const TIER_MANAGER = "CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF";
const VK_PATH      = path.join(__dirname, "../../circuits/keys/verification_key.json");
const ENV_PATH     = path.join(__dirname, "../../frontend/.env.local");

const ADMIN_SECRET  = process.env.ADMIN_SECRET;
const VERIFIER_ID   = process.env.VERIFIER_ID;
if (!ADMIN_SECRET) { console.error("Set ADMIN_SECRET=S..."); process.exit(1); }
if (!VERIFIER_ID)  { console.error("Set VERIFIER_ID=C... (the already-deployed contract)"); process.exit(1); }

// ── BLS12-381 encoding (CORRECTED) ───────────────────────────────────────────
// ffjavascript/snarkjs Fp2 JSON: [c0, c1] — c0 (real) at [0], c1 (imaginary) at [1]
// Soroban/blst G2 binary: X_c1 || X_c0 || Y_c1 || Y_c0 (imaginary FIRST)
function decimalToBytes(dec, len) {
  let n = BigInt(dec);
  const b = Buffer.alloc(len);
  for (let i = len - 1; i >= 0; i--) { b[i] = Number(n & 0xffn); n >>= 8n; }
  return b;
}
const FP = 48;
const g1 = pt => Buffer.concat([decimalToBytes(pt[0], FP), decimalToBytes(pt[1], FP)]);
const g2 = pt => Buffer.concat([
  decimalToBytes(pt[0][1], FP), // x_c1 (imaginary, index [1]) → FIRST
  decimalToBytes(pt[0][0], FP), // x_c0 (real, index [0])
  decimalToBytes(pt[1][1], FP), // y_c1 (imaginary, index [1])
  decimalToBytes(pt[1][0], FP), // y_c0 (real, index [0])
]);

function makeVkScVal(vk) {
  const icVec = xdr.ScVal.scvVec(vk.IC.map(pt => xdr.ScVal.scvBytes(g1(pt))));
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("alpha"), val: xdr.ScVal.scvBytes(g1(vk.vk_alpha_1)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("beta"),  val: xdr.ScVal.scvBytes(g2(vk.vk_beta_2))  }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("delta"), val: xdr.ScVal.scvBytes(g2(vk.vk_delta_2)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("gamma"), val: xdr.ScVal.scvBytes(g2(vk.vk_gamma_2)) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("ic"),    val: icVec }),
  ]);
}

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

async function main() {
  const kp     = Keypair.fromSecret(ADMIN_SECRET);
  const admin  = kp.publicKey();
  const server = new rpc.Server(RPC_URL, { allowHttp: false });

  console.log("Admin:      ", admin);
  console.log("Verifier:   ", VERIFIER_ID);
  console.log("TierManager:", TIER_MANAGER);
  console.log("");

  const vk = JSON.parse(fs.readFileSync(VK_PATH, "utf8"));
  console.log(`VK: IC.length=${vk.IC.length}  nPublic=${vk.nPublic}  curve=${vk.curve}`);

  const vkScVal  = makeVkScVal(vk);
  const contract = new Contract(VERIFIER_ID);

  console.log("\n==> [1/2] Calling init...");
  let acct = await server.getAccount(admin);
  const initTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(contract.call(
      "init",
      nativeToScVal(admin, { type: "address" }),
      vkScVal,
      nativeToScVal(TIER_MANAGER, { type: "address" })
    ))
    .setTimeout(300).build();

  await sendAndConfirm(server, initTx, kp, "init");
  console.log("");

  console.log("==> [2/2] Calling TierManager.set_verifier...");
  const tm = new Contract(TIER_MANAGER);
  acct = await server.getAccount(admin);
  const setTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(tm.call("set_verifier", nativeToScVal(VERIFIER_ID, { type: "address" })))
    .setTimeout(180).build();

  await sendAndConfirm(server, setTx, kp, "set_verifier");
  console.log("");

  console.log("==> Updating .env.local...");
  let env = fs.readFileSync(ENV_PATH, "utf8");
  env = env.replace(/^NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID=.*/m, `NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID=${VERIFIER_ID}`);
  fs.writeFileSync(ENV_PATH, env);
  console.log("  ✅ .env.local updated");

  console.log("\n✅ Done! New ZK_VERIFIER:", VERIFIER_ID);
}

main().catch(err => { console.error("\n❌", err.message || err); process.exit(1); });
