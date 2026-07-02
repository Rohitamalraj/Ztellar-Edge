"use strict";

/**
 * deploy_sip.js
 *
 * Builds and deploys the synth_sip Soroban contract, initialises it with the
 * vault address, then writes NEXT_PUBLIC_SYNTH_SIP_CONTRACT_ID to .env.local.
 *
 * Run from the contracts/ directory:
 *   node scripts/deploy_sip.js
 */

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const SDK = require(path.join(__dirname, "../../frontend/node_modules/@stellar/stellar-sdk"));
const {
  rpc, Contract, TransactionBuilder, Networks, BASE_FEE,
  nativeToScVal, Operation, Address, Keypair, StrKey, xdr,
} = SDK;

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL      = "https://soroban-testnet.stellar.org";
const NETWORK_PASS = Networks.TESTNET;
const ENV_PATH     = path.join(__dirname, "../../frontend/.env.local");

const ADMIN_SECRET = "SBWXCYASMFFSHCL5KRJG5BPI3Z2BDOTCRFOPYWIW6EUJYDYAGGSMKF6B";

const SIP_WASM = path.join(
  __dirname,
  "../target/wasm32v1-none/release/ztellar_synth_sip.wasm"
);

// ── Read current .env.local for vault ID ──────────────────────────────────────

function readEnvVar(key) {
  const env = fs.readFileSync(ENV_PATH, "utf8");
  const match = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function setEnvVar(key, val) {
  let env = fs.readFileSync(ENV_PATH, "utf8");
  if (env.match(new RegExp(`^${key}=`, "m"))) {
    env = env.replace(new RegExp(`^${key}=.*`, "m"), `${key}=${val}`);
  } else {
    env += `\n${key}=${val}`;
  }
  fs.writeFileSync(ENV_PATH, env);
}

// ── Soroban helpers ───────────────────────────────────────────────────────────

const server = new rpc.Server(RPC_URL, { allowHttp: false });
const kp     = Keypair.fromSecret(ADMIN_SECRET);

function computeContractId(adminPubKey, salt) {
  const networkId = crypto.createHash("sha256").update(NETWORK_PASS).digest();
  const preimage  = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(adminPubKey).toScAddress(),
          salt,
        })
      ),
    })
  );
  return StrKey.encodeContract(
    crypto.createHash("sha256").update(preimage.toXDR()).digest()
  );
}

async function sorobanSend(tx, label) {
  process.stdout.write(`  [${label}] sim... `);
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Sim (${label}): ${sim.error}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const submit = await server.sendTransaction(prepared);
  if (submit.status === "ERROR") throw new Error(`Submit (${label}): ${JSON.stringify(submit.errorResult)}`);
  process.stdout.write(`OK tx:${submit.hash.slice(0, 10)}… polling`);
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await server.getTransaction(submit.hash);
    process.stdout.write(".");
    if (s.status === rpc.Api.GetTransactionStatus.SUCCESS) { console.log(" ✅"); return s; }
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)  { console.log(" ❌"); throw new Error(`TX failed (${label})`); }
  }
  throw new Error(`Timeout (${label})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const admin   = kp.publicKey();
  const vaultId = readEnvVar("NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID");
  if (!vaultId) {
    console.error("❌ NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID not found in .env.local");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("  Ztellar Edge → Deploy synth_sip contract");
  console.log("=".repeat(60));
  console.log("Admin:", admin);
  console.log("Vault:", vaultId);
  console.log();

  // ── 1. Verify WASM exists ─────────────────────────────────────────────────
  console.log("==> [1/4] Checking synth_sip WASM…");
  if (!fs.existsSync(SIP_WASM)) {
    console.error("  ❌ WASM not found:", SIP_WASM);
    console.error("     Build first: cargo build -p ztellar-synth-sip --target wasm32v1-none --release");
    process.exit(1);
  }
  console.log("  ✅ WASM found:", SIP_WASM);
  console.log();

  // ── 2. Upload WASM ────────────────────────────────────────────────────────
  console.log("==> [2/4] Uploading synth_sip WASM…");
  const wasmBytes = fs.readFileSync(SIP_WASM);
  const wasmHash  = crypto.createHash("sha256").update(wasmBytes).digest();
  const acct1 = await server.getAccount(admin);
  const uploadTx = new TransactionBuilder(acct1, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(300).build();
  await sorobanSend(uploadTx, "upload-sip");
  console.log();

  // ── 3. Deploy SIP contract ────────────────────────────────────────────────
  console.log("==> [3/4] Deploying synth_sip contract…");
  const sipSalt = crypto.randomBytes(32);
  const sipId   = computeContractId(admin, sipSalt);
  console.log("  SIP contract ID:", sipId);
  const acct2 = await server.getAccount(admin);
  const deployTx = new TransactionBuilder(acct2, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.createCustomContract({
      address:  new Address(admin),
      wasmHash: wasmHash,
      salt:     sipSalt,
    }))
    .setTimeout(300).build();
  await sorobanSend(deployTx, "deploy-sip");
  console.log();

  // ── 4. Init SIP contract ─────────────────────────────────────────────────
  console.log("==> [4/4] Initialising SIP contract…");
  await new Promise((r) => setTimeout(r, 6000));
  const acct3 = await server.getAccount(admin);
  const sipContract = new Contract(sipId);
  const initTx = new TransactionBuilder(acct3, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(sipContract.call(
      "init",
      nativeToScVal(admin,   { type: "address" }),
      nativeToScVal(vaultId, { type: "address" }),
    ))
    .setTimeout(300).build();
  await sorobanSend(initTx, "init-sip");
  console.log();

  // ── Update .env.local ─────────────────────────────────────────────────────
  console.log("==> Updating frontend/.env.local…");
  setEnvVar("NEXT_PUBLIC_SYNTH_SIP_CONTRACT_ID", sipId);
  console.log("  ✅ NEXT_PUBLIC_SYNTH_SIP_CONTRACT_ID =", sipId);
  console.log();

  console.log("=".repeat(60));
  console.log("✅  SIP CONTRACT DEPLOYED");
  console.log("=".repeat(60));
  console.log("Restart Next.js dev server to pick up the new env var.");
}

main().catch((e) => { console.error("❌ Fatal:", e.message); process.exit(1); });
