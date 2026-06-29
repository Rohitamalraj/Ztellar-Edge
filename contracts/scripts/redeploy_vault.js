"use strict";

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");
const {
  rpc, Contract, TransactionBuilder, Networks, xdr,
  nativeToScVal, BASE_FEE, Keypair, Operation, Address, StrKey,
} = require(path.join(__dirname, "../../frontend/node_modules/@stellar/stellar-sdk"));

const RPC_URL         = "https://soroban-testnet.stellar.org";
const NETWORK_PASS    = Networks.TESTNET;
const TIER_MANAGER_ID = "CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF";
const WASM_PATH       = path.join(__dirname, "../target/wasm32v1-none/release/ztellar_synth_vault.wasm");
const ENV_PATH        = path.join(__dirname, "../../frontend/.env.local");

const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) { console.error("Set ADMIN_SECRET=S..."); process.exit(1); }

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

  console.log("Admin:       ", admin);
  console.log("TierManager: ", TIER_MANAGER_ID);
  console.log("");

  const wasmBytes = fs.readFileSync(WASM_PATH);
  const wasmHash  = crypto.createHash("sha256").update(wasmBytes).digest();
  console.log(`WASM: ${wasmBytes.length} bytes | SHA256: ${wasmHash.toString("hex").slice(0,16)}…`);
  console.log("");

  // Single account fetch — TransactionBuilder.build() auto-increments seq
  const acct = await server.getAccount(admin);

  // ── 1. Upload WASM ─────────────────────────────────────────────────────────
  console.log("==> [1/3] Uploading WASM...");
  const uploadTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(180).build();
  await sendAndConfirm(server, uploadTx, kp, "upload");
  console.log("");

  // ── 2. Deploy contract ─────────────────────────────────────────────────────
  console.log("==> [2/3] Deploying SynthVault...");
  const salt = crypto.randomBytes(32);
  const newVaultId = computeContractId(admin, salt);
  console.log("  Contract ID:", newVaultId);

  const deployTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(Operation.createCustomContract({
      address: new Address(admin),
      wasmHash,
      salt,
    }))
    .setTimeout(180).build();
  await sendAndConfirm(server, deployTx, kp, "deploy");
  console.log("");

  // ── 3. Init vault with TierManager ────────────────────────────────────────
  // Wait for RPC nodes to propagate the deploy before simulating init
  await new Promise(r => setTimeout(r, 6000));
  console.log("==> [3/3] Initializing vault (12 assets, seeds prices)...");
  const vault = new Contract(newVaultId);
  const initTx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(vault.call(
      "init",
      nativeToScVal(admin, { type: "address" }),
      nativeToScVal(TIER_MANAGER_ID, { type: "address" }),
    ))
    .setTimeout(180).build();
  await sendAndConfirm(server, initTx, kp, "init");
  console.log("");

  // ── Update .env.local ─────────────────────────────────────────────────────
  console.log("==> Updating frontend/.env.local...");
  let env = fs.readFileSync(ENV_PATH, "utf8");
  env = env.replace(
    /^NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=.*/m,
    `NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=${newVaultId}`
  );
  fs.writeFileSync(ENV_PATH, env);
  console.log("  ✅ .env.local updated");
  console.log("");

  console.log("=".repeat(60));
  console.log("✅  VAULT REDEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("New SynthVault:", newVaultId);
  console.log("Supports 12 assets: sAAPL(0) sTSLA(1) sNVDA(2) sMSFT(3)");
  console.log("                    sAMZN(4) sGOOG(5) sMETA(6) sNFLX(7)");
  console.log("                    sAMD(8) sJPM(9) sSPY(10) sPFE(11)");
  console.log("");
  console.log("Restart Next.js dev server after this.");
}

main().catch(err => { console.error("\n❌", err.message || err); process.exit(1); });
