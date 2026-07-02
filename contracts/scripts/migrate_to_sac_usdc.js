"use strict";

/**
 * migrate_to_sac_usdc.js
 *
 * Migrates the vault to use Circle's REAL testnet USDC via its
 * Stellar Asset Contract (SAC) — not the open-mint fake we used before.
 *
 * SAC address (deterministic from issuer + asset code + testnet passphrase):
 *   CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
 *
 * Circle testnet USDC issuer:
 *   GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 *
 * Steps:
 *   1. Add admin trustline to USDC:GBBD47 (classic op via Horizon)
 *   2. Buy USDC for admin on testnet SDEX via path-payment (classic op)
 *   3. Upload synth_vault WASM (Soroban)
 *   4. Deploy new vault contract (Soroban)
 *   5. Init vault with SAC address (Soroban)
 *   6. Seed vault: SAC transfer(admin → vault) (Soroban)
 *   7. Update frontend/.env.local
 */

const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");

const SDK = require(path.join(__dirname, "../../frontend/node_modules/@stellar/stellar-sdk"));
const {
  rpc, Contract, TransactionBuilder, Networks, xdr,
  nativeToScVal, BASE_FEE, Keypair, Operation, Address,
  Asset, Horizon, StrKey,
} = SDK;

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL      = "https://soroban-testnet.stellar.org";
const HORIZON_URL  = "https://horizon-testnet.stellar.org";
const NETWORK_PASS = Networks.TESTNET;
const ENV_PATH     = path.join(__dirname, "../../frontend/.env.local");

const ADMIN_SECRET    = "SBWXCYASMFFSHCL5KRJG5BPI3Z2BDOTCRFOPYWIW6EUJYDYAGGSMKF6B";
const TIER_MANAGER_ID = "CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF";

const USDC_ISSUER  = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_ASSET   = new Asset("USDC", USDC_ISSUER);
const SAC_ID       = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

const VAULT_WASM = path.join(__dirname, "../target/wasm32v1-none/release/ztellar_synth_vault.wasm");

// Stellar classic USDC uses 7 decimal places (1 USDC = 10_000_000 units, same as XLM stroops)
const USDC_RAW_PER_UNIT = 10_000_000n; // 7 decimal

// Seed the vault with 500 USDC (enough for ~50 test trades at $10 collateral)
const VAULT_SEED_USDC = 500n;
const VAULT_SEED_RAW  = VAULT_SEED_USDC * USDC_RAW_PER_UNIT; // 5_000_000_000

// Faucet gives 100 USDC per claim
const FAUCET_USDC = 100n;

const VAULT_WASM_PATH = VAULT_WASM;

// ── Soroban helpers ───────────────────────────────────────────────────────────

const sorobanServer = new rpc.Server(RPC_URL, { allowHttp: false });
const horizonServer = new Horizon.Server(HORIZON_URL);
const kp = Keypair.fromSecret(ADMIN_SECRET);

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

// Soroban RPC submit + poll
async function sorobanSend(tx, label) {
  process.stdout.write(`  [${label}] sim... `);
  const sim = await sorobanServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Sim failed (${label}): ${sim.error}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const submit = await sorobanServer.sendTransaction(prepared);
  if (submit.status === "ERROR") throw new Error(`Submit (${label}): ${JSON.stringify(submit.errorResult)}`);
  process.stdout.write(`OK  tx: ${submit.hash.slice(0, 12)}… polling`);
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await sorobanServer.getTransaction(submit.hash);
    process.stdout.write(".");
    if (s.status === rpc.Api.GetTransactionStatus.SUCCESS) { console.log(" ✅"); return s; }
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)  { console.log(" ❌"); throw new Error(`TX failed (${label})`); }
  }
  throw new Error(`Timeout (${label})`);
}

// Classic Horizon submit
async function classicSend(tx, label) {
  process.stdout.write(`  [${label}] submitting... `);
  tx.sign(kp);
  try {
    const result = await horizonServer.submitTransaction(tx);
    console.log(`✅  hash: ${result.hash.slice(0, 12)}…`);
    return result;
  } catch (e) {
    const detail = e.response?.data?.extras?.result_codes ?? e.message;
    throw new Error(`Classic TX failed (${label}): ${JSON.stringify(detail)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const admin = kp.publicKey();
  console.log("=".repeat(60));
  console.log("  Ztellar Edge → Migrate to Circle Testnet USDC SAC");
  console.log("=".repeat(60));
  console.log("Admin:       ", admin);
  console.log("SAC address: ", SAC_ID);
  console.log("USDC issuer: ", USDC_ISSUER);
  console.log();

  // Load admin account from Horizon for classic ops
  const horizonAcct = await horizonServer.loadAccount(admin);
  const hasTrustline = horizonAcct.balances.some(
    (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
  );
  const existingUSDC = hasTrustline
    ? parseFloat(horizonAcct.balances.find((b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER).balance)
    : 0;
  console.log(`Admin USDC balance: ${existingUSDC} (trustline: ${hasTrustline})`);
  console.log();

  // ── 1. Add trustline if needed ─────────────────────────────────────────────
  if (!hasTrustline) {
    console.log("==> [1/6] Adding admin trustline to USDC:GBBD47…");
    const trustTx = new TransactionBuilder(horizonAcct, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASS,
    })
      .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
      .setTimeout(180)
      .build();
    await classicSend(trustTx, "add-trustline");
    console.log();
  } else {
    console.log("==> [1/6] Admin already has USDC trustline — skipping.");
    console.log();
  }

  // ── 2. Buy USDC on testnet SDEX ──────────────────────────────────────────
  const neededUSDC = Number(VAULT_SEED_USDC) + Number(FAUCET_USDC) * 10; // 500 seed + 1000 for faucet fills
  if (existingUSDC < neededUSDC) {
    const wantUsdc = neededUSDC - existingUSDC;
    console.log(`==> [2/6] Buying ${wantUsdc.toFixed(2)} USDC on testnet SDEX (XLM → USDC path payment)…`);
    // Reload account after trustline op
    await new Promise((r) => setTimeout(r, 4000));
    const freshAcct = await horizonServer.loadAccount(admin);
    const pathTx = new TransactionBuilder(freshAcct, {
      fee: "1000000",
      networkPassphrase: NETWORK_PASS,
    })
      .addOperation(Operation.pathPaymentStrictReceive({
        sendAsset:   Asset.native(),
        sendMax:     "5000",                       // spend up to 5000 XLM
        destination: admin,
        destAsset:   USDC_ASSET,
        destAmount:  wantUsdc.toFixed(2),
        path:        [],
      }))
      .setTimeout(180)
      .build();
    try {
      await classicSend(pathTx, "buy-usdc-sdex");
      console.log(`  ✅ Acquired ~${wantUsdc.toFixed(2)} USDC on SDEX`);
    } catch (e) {
      console.log("  ⚠️  SDEX path payment failed:", e.message);
      console.log("  → Testnet SDEX may lack liquidity. Checking current balance…");
      const reloaded = await horizonServer.loadAccount(admin);
      const nowUsdc = parseFloat(
        reloaded.balances.find((b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER)?.balance ?? "0"
      );
      if (nowUsdc < 10) {
        console.log("  ❌ Admin has <10 USDC. Options:");
        console.log("     a) Send USDC from your Freighter wallet to:", admin);
        console.log(`        (need at least ${neededUSDC} USDC)`);
        console.log("     b) Get testnet USDC from Stellar testnet DEX via Freighter or StellarX");
        console.log("  Aborting. Re-run after funding the admin account.");
        process.exit(1);
      }
      console.log(`  → Proceeding with current balance: ${nowUsdc} USDC`);
    }
    console.log();
  } else {
    console.log(`==> [2/6] Admin has sufficient USDC (${existingUSDC.toFixed(2)}) — skipping buy.`);
    console.log();
  }

  // ── 3. Upload vault WASM (Soroban) ────────────────────────────────────────
  console.log("==> [3/6] Uploading synth_vault WASM…");
  const wasmBytes = fs.readFileSync(VAULT_WASM_PATH);
  const wasmHash  = crypto.createHash("sha256").update(wasmBytes).digest();
  const sorobanAcct = await sorobanServer.getAccount(admin);
  const uploadTx = new TransactionBuilder(sorobanAcct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(300).build();
  await sorobanSend(uploadTx, "upload-vault");
  console.log();

  // ── 4. Deploy vault contract (Soroban) ────────────────────────────────────
  console.log("==> [4/6] Deploying vault contract…");
  const vaultSalt = crypto.randomBytes(32);
  const vaultId   = computeContractId(admin, vaultSalt);
  console.log("  Vault ID:", vaultId);
  const sorobanAcct2 = await sorobanServer.getAccount(admin);
  const deployTx = new TransactionBuilder(sorobanAcct2, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.createCustomContract({
      address:  new Address(admin),
      wasmHash: wasmHash,
      salt:     vaultSalt,
    }))
    .setTimeout(300).build();
  await sorobanSend(deployTx, "deploy-vault");
  console.log();

  // ── 5. Init vault with SAC address ────────────────────────────────────────
  console.log("==> [5/6] Initializing vault with SAC address…");
  await new Promise((r) => setTimeout(r, 6000));
  const sorobanAcct3 = await sorobanServer.getAccount(admin);
  const vaultContract = new Contract(vaultId);
  const initTx = new TransactionBuilder(sorobanAcct3, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(vaultContract.call(
      "init",
      nativeToScVal(admin,          { type: "address" }),
      nativeToScVal(TIER_MANAGER_ID, { type: "address" }),
      nativeToScVal(SAC_ID,          { type: "address" }),
    ))
    .setTimeout(300).build();
  await sorobanSend(initTx, "init-vault");
  console.log();

  // ── 6. Seed vault: SAC transfer(admin → vault) ────────────────────────────
  console.log(`==> [6/6] Seeding vault with ${VAULT_SEED_USDC} USDC via SAC transfer…`);
  await new Promise((r) => setTimeout(r, 6000));
  const sorobanAcct4 = await sorobanServer.getAccount(admin);
  const sacContract  = new Contract(SAC_ID);
  const seedTx = new TransactionBuilder(sorobanAcct4, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(sacContract.call(
      "transfer",
      nativeToScVal(admin,   { type: "address" }),
      nativeToScVal(vaultId, { type: "address" }),
      nativeToScVal(VAULT_SEED_RAW, { type: "i128" }),
    ))
    .setTimeout(300).build();
  await sorobanSend(seedTx, "seed-vault");
  console.log();

  // ── Update .env.local ──────────────────────────────────────────────────────
  console.log("==> Updating frontend/.env.local…");
  let env = fs.readFileSync(ENV_PATH, "utf8");
  const setVar = (key, val) => {
    if (env.includes(`${key}=`)) {
      env = env.replace(new RegExp(`^${key}=.*`, "m"), `${key}=${val}`);
    } else {
      env += `\n${key}=${val}`;
    }
  };
  setVar("NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID", vaultId);
  setVar("NEXT_PUBLIC_USDC_CONTRACT_ID", SAC_ID);
  fs.writeFileSync(ENV_PATH, env);
  console.log("  ✅ .env.local updated");
  console.log();

  console.log("=".repeat(60));
  console.log("✅  MIGRATION TO CIRCLE SAC USDC COMPLETE");
  console.log("=".repeat(60));
  console.log();
  console.log("New vault:     ", vaultId);
  console.log("USDC (SAC):   ", SAC_ID);
  console.log("USDC issuer:  ", USDC_ISSUER);
  console.log();
  console.log("Next steps:");
  console.log("  1. Restart Next.js dev server (env changed)");
  console.log("  2. Faucet now uses SAC transfer — admin must hold USDC");
  console.log("  3. Users need a trustline to USDC:GBBD47 to use the faucet");
}

main().catch((e) => { console.error("❌ Fatal:", e.message); process.exit(1); });
