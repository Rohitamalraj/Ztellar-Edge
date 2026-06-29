"use strict";

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const {
  rpc, Contract, TransactionBuilder, Networks, xdr,
  nativeToScVal, BASE_FEE, Keypair, Operation, Address, StrKey,
} = require(path.join(__dirname, "../../frontend/node_modules/@stellar/stellar-sdk"));

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL      = "https://soroban-testnet.stellar.org";
const NETWORK_PASS = Networks.TESTNET;
const ENV_PATH     = path.join(__dirname, "../../frontend/.env.local");

const ADMIN_SECRET    = "SBWXCYASMFFSHCL5KRJG5BPI3Z2BDOTCRFOPYWIW6EUJYDYAGGSMKF6B";
const TIER_MANAGER_ID = "CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF";

const TOKEN_WASM = path.join(__dirname, "../target/wasm32v1-none/release/ztellar_synth_token.wasm");
const VAULT_WASM = path.join(__dirname, "../target/wasm32v1-none/release/ztellar_synth_vault.wasm");

// ── Deterministic contract ID (same formula as redeploy_verifier.js) ─────────

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

// ── RPC helper ────────────────────────────────────────────────────────────────

const server = new rpc.Server(RPC_URL, { allowHttp: false });
const kp     = Keypair.fromSecret(ADMIN_SECRET);

async function sendAndConfirm(tx, label) {
  process.stdout.write(`  [${label}] sim... `);
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Sim failed (${label}): ${sim.error}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const submit = await server.sendTransaction(prepared);
  if (submit.status === "ERROR") throw new Error(`Submit (${label}): ${JSON.stringify(submit.errorResult)}`);
  process.stdout.write(`OK  tx: ${submit.hash.slice(0, 12)}… polling`);
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await server.getTransaction(submit.hash);
    process.stdout.write(".");
    if (s.status === rpc.Api.GetTransactionStatus.SUCCESS) { console.log(" ✅"); return s; }
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)  { console.log(" ❌"); throw new Error(`TX failed (${label}): ${JSON.stringify(s.resultXdr)}`); }
  }
  throw new Error(`Timeout (${label})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const admin = kp.publicKey();
  console.log("Admin:", admin);
  console.log("TierManager:", TIER_MANAGER_ID);
  console.log();

  // Fetch account ONCE — build() increments seq in-place; never re-fetch between TXs
  const acct = await server.getAccount(admin);

  // ── 1. Upload token WASM ───────────────────────────────────────────────────
  console.log("==> [1/8] Uploading synth_token WASM...");
  const tokenWasmBytes = fs.readFileSync(TOKEN_WASM);
  const tokenWasmHash  = crypto.createHash("sha256").update(tokenWasmBytes).digest();
  const uploadTokenTx  = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.uploadContractWasm({ wasm: tokenWasmBytes }))
    .setTimeout(300).build();
  await sendAndConfirm(uploadTokenTx, "upload-token");
  console.log();

  // ── 2. Upload vault WASM ───────────────────────────────────────────────────
  console.log("==> [2/8] Uploading synth_vault WASM...");
  const vaultWasmBytes = fs.readFileSync(VAULT_WASM);
  const vaultWasmHash  = crypto.createHash("sha256").update(vaultWasmBytes).digest();
  const uploadVaultTx  = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.uploadContractWasm({ wasm: vaultWasmBytes }))
    .setTimeout(300).build();
  await sendAndConfirm(uploadVaultTx, "upload-vault");
  console.log();

  // ── 3. Deploy TUSDC contract (compute ID first, deterministically) ─────────
  console.log("==> [3/8] Deploying TUSDC token contract...");
  const tusdcSalt = crypto.randomBytes(32);
  const tusdcId   = computeContractId(admin, tusdcSalt);
  console.log("  TUSDC ID:", tusdcId);
  const deployTusdcTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.createCustomContract({
      address:  new Address(admin),
      wasmHash: tokenWasmHash,
      salt:     tusdcSalt,
    }))
    .setTimeout(300).build();
  await sendAndConfirm(deployTusdcTx, "deploy-tusdc");
  console.log();

  // ── 4. Deploy vault contract ───────────────────────────────────────────────
  console.log("==> [4/8] Deploying vault contract...");
  const vaultSalt = crypto.randomBytes(32);
  const vaultId   = computeContractId(admin, vaultSalt);
  console.log("  Vault ID:", vaultId);
  const deployVaultTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.createCustomContract({
      address:  new Address(admin),
      wasmHash: vaultWasmHash,
      salt:     vaultSalt,
    }))
    .setTimeout(300).build();
  await sendAndConfirm(deployVaultTx, "deploy-vault");
  console.log();

  // ── 5. Init TUSDC ──────────────────────────────────────────────────────────
  console.log("==> [5/8] Initializing TUSDC (vault =", vaultId, ")...");
  await new Promise((r) => setTimeout(r, 6000)); // let RPC propagate
  const tusdcContract = new Contract(tusdcId);
  const initTusdcTx   = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(tusdcContract.call(
      "init",
      nativeToScVal(admin,      { type: "address" }),
      nativeToScVal(vaultId,    { type: "address" }),
      nativeToScVal("Test USDC", { type: "string"  }),
      nativeToScVal("TUSDC",    { type: "string"  }),
      nativeToScVal(6,          { type: "u32"     }),
    ))
    .setTimeout(300).build();
  await sendAndConfirm(initTusdcTx, "init-tusdc");
  console.log();

  // ── 6. Init vault ──────────────────────────────────────────────────────────
  console.log("==> [6/8] Initializing vault...");
  const vaultContract = new Contract(vaultId);
  const initVaultTx   = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(vaultContract.call(
      "init",
      nativeToScVal(admin,          { type: "address" }),
      nativeToScVal(TIER_MANAGER_ID, { type: "address" }),
      nativeToScVal(tusdcId,        { type: "address" }),
    ))
    .setTimeout(300).build();
  await sendAndConfirm(initVaultTx, "init-vault");
  console.log();

  // ── 7. Mint 500,000 TUSDC into vault as PnL float ─────────────────────────
  console.log("==> [7/8] Minting 500,000 TUSDC into vault as PnL float...");
  const VAULT_FLOAT = BigInt(500_000) * BigInt(1_000_000);
  const mintVaultTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(tusdcContract.call(
      "admin_mint",
      nativeToScVal(vaultId,     { type: "address" }),
      nativeToScVal(VAULT_FLOAT, { type: "i128"    }),
    ))
    .setTimeout(300).build();
  await sendAndConfirm(mintVaultTx, "mint-vault-float");
  console.log();

  // ── 8. Mint 1,000 TUSDC to admin for testing ──────────────────────────────
  console.log("==> [8/8] Minting 1,000 TUSDC to admin for testing...");
  const ADMIN_AMOUNT = BigInt(1_000) * BigInt(1_000_000);
  const mintAdminTx  = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(tusdcContract.call(
      "admin_mint",
      nativeToScVal(admin,        { type: "address" }),
      nativeToScVal(ADMIN_AMOUNT, { type: "i128"    }),
    ))
    .setTimeout(300).build();
  await sendAndConfirm(mintAdminTx, "mint-admin");
  console.log();

  // ── Update .env.local ──────────────────────────────────────────────────────
  console.log("==> Updating frontend/.env.local...");
  let env = fs.readFileSync(ENV_PATH, "utf8");
  // Update vault ID
  if (env.includes("NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=")) {
    env = env.replace(/^NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=.*/m, `NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=${vaultId}`);
  } else {
    env += `\nNEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=${vaultId}`;
  }
  // Add or update USDC contract ID
  if (env.includes("NEXT_PUBLIC_USDC_CONTRACT_ID=")) {
    env = env.replace(/^NEXT_PUBLIC_USDC_CONTRACT_ID=.*/m, `NEXT_PUBLIC_USDC_CONTRACT_ID=${tusdcId}`);
  } else {
    env += `\nNEXT_PUBLIC_USDC_CONTRACT_ID=${tusdcId}`;
  }
  // Add ADMIN_SECRET for server-side faucet (no NEXT_PUBLIC_ prefix = server-side only)
  if (!env.includes("ADMIN_SECRET=")) {
    env += `\nADMIN_SECRET=${ADMIN_SECRET}`;
  }
  fs.writeFileSync(ENV_PATH, env);
  console.log("  ✅ .env.local updated");
  console.log();

  console.log("=".repeat(60));
  console.log("✅  DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log();
  console.log("TUSDC contract: ", tusdcId);
  console.log("Vault contract: ", vaultId);
  console.log();
  console.log("Restart the Next.js dev server to pick up the new contract IDs.");
}

main().catch((err) => {
  console.error("\n❌  DEPLOY FAILED:", err.message || err);
  process.exit(1);
});
