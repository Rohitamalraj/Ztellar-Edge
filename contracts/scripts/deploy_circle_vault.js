"use strict";

/**
 * deploy_circle_vault.js
 *
 * Deploys a new synth_vault that uses Circle's testnet USDC as collateral.
 * Circle USDC contract (testnet): CAUGJT4GREIY3WHOUUU5RIUDGSPVREF5CDCYJOWMHOVT2GWQT5JEETGJ
 *
 * Steps:
 *   1. Upload synth_vault WASM
 *   2. Deploy new vault contract
 *   3. Init vault (admin, tier_manager, circle_usdc)
 *   4. Attempt to mint 100,000 USDC into vault as float (open mint on Circle testnet USDC)
 *   5. Update frontend/.env.local
 */

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
const CIRCLE_USDC_ID  = "CAUGJT4GREIY3WHOUUU5RIUDGSPVREF5CDCYJOWMHOVT2GWQT5JEETGJ";

const VAULT_WASM = path.join(__dirname, "../target/wasm32v1-none/release/ztellar_synth_vault.wasm");

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)  { console.log(" ❌"); throw new Error(`TX failed (${label})`); }
  }
  throw new Error(`Timeout (${label})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const admin = kp.publicKey();
  console.log("Admin:        ", admin);
  console.log("TierManager:  ", TIER_MANAGER_ID);
  console.log("Circle USDC:  ", CIRCLE_USDC_ID);
  console.log();

  const acct = await server.getAccount(admin);

  // ── 1. Upload vault WASM ───────────────────────────────────────────────────
  console.log("==> [1/4] Uploading synth_vault WASM...");
  const vaultWasmBytes = fs.readFileSync(VAULT_WASM);
  const vaultWasmHash  = crypto.createHash("sha256").update(vaultWasmBytes).digest();
  const uploadTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.uploadContractWasm({ wasm: vaultWasmBytes }))
    .setTimeout(300).build();
  await sendAndConfirm(uploadTx, "upload-vault");
  console.log();

  // ── 2. Deploy vault contract ───────────────────────────────────────────────
  console.log("==> [2/4] Deploying vault contract...");
  const vaultSalt = crypto.randomBytes(32);
  const vaultId   = computeContractId(admin, vaultSalt);
  console.log("  Vault ID:", vaultId);
  const deployTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.createCustomContract({
      address:  new Address(admin),
      wasmHash: vaultWasmHash,
      salt:     vaultSalt,
    }))
    .setTimeout(300).build();
  await sendAndConfirm(deployTx, "deploy-vault");
  console.log();

  // ── 3. Init vault with Circle USDC ────────────────────────────────────────
  console.log("==> [3/4] Initializing vault with Circle USDC...");
  await new Promise((r) => setTimeout(r, 6000));
  const vaultContract = new Contract(vaultId);
  const initTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(vaultContract.call(
      "init",
      nativeToScVal(admin,          { type: "address" }),
      nativeToScVal(TIER_MANAGER_ID, { type: "address" }),
      nativeToScVal(CIRCLE_USDC_ID, { type: "address" }),
    ))
    .setTimeout(300).build();
  await sendAndConfirm(initTx, "init-vault");
  console.log();

  // ── 4. Try to mint float into vault ───────────────────────────────────────
  // Circle testnet USDC has open minting — mint(amount, to) signature
  console.log("==> [4/4] Minting 100,000 USDC into vault as PnL float...");
  try {
    const usdcContract = new Contract(CIRCLE_USDC_ID);
    const VAULT_FLOAT  = BigInt(100_000) * BigInt(1_000_000); // 100,000 USDC
    const mintTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
      .addOperation(usdcContract.call(
        "mint",
        nativeToScVal(VAULT_FLOAT, { type: "i128"    }),
        nativeToScVal(vaultId,     { type: "address" }),
      ))
      .setTimeout(300).build();
    await sendAndConfirm(mintTx, "mint-vault-float");
  } catch (err) {
    console.log("  ⚠️  Vault float mint failed (Circle may restrict minting):", err.message);
    console.log("  → Users will fund vault by depositing their own USDC.");
  }
  console.log();

  // ── Update .env.local ──────────────────────────────────────────────────────
  console.log("==> Updating frontend/.env.local...");
  let env = fs.readFileSync(ENV_PATH, "utf8");
  const setVar = (key, val) => {
    if (env.includes(`${key}=`)) {
      env = env.replace(new RegExp(`^${key}=.*`, "m"), `${key}=${val}`);
    } else {
      env += `\n${key}=${val}`;
    }
  };
  setVar("NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID", vaultId);
  setVar("NEXT_PUBLIC_USDC_CONTRACT_ID", CIRCLE_USDC_ID);
  fs.writeFileSync(ENV_PATH, env);
  console.log("  ✅ .env.local updated");
  console.log();

  console.log("=".repeat(60));
  console.log("✅  MIGRATION TO CIRCLE USDC COMPLETE");
  console.log("=".repeat(60));
  console.log();
  console.log("Vault:       ", vaultId);
  console.log("Circle USDC: ", CIRCLE_USDC_ID);
  console.log();
  console.log("Restart the Next.js dev server to pick up new contract IDs.");
}

main().catch((err) => {
  console.error("\n❌  DEPLOY FAILED:", err.message || err);
  process.exit(1);
});
