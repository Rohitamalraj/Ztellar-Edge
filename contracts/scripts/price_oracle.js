"use strict";

/**
 * price_oracle.js — push live Yahoo Finance prices to the synth_vault on-chain.
 *
 * Usage (run in a terminal during demo):
 *   node scripts/price_oracle.js           # updates every 60s
 *   node scripts/price_oracle.js --once    # single update then exit
 */

const path   = require("path");
const crypto = require("crypto");
const {
  rpc, Contract, TransactionBuilder, Networks, xdr,
  nativeToScVal, BASE_FEE, Keypair,
} = require(path.join(__dirname, "../../frontend/node_modules/@stellar/stellar-sdk"));

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL      = "https://soroban-testnet.stellar.org";
const NETWORK_PASS = Networks.TESTNET;
const ADMIN_SECRET = "SBWXCYASMFFSHCL5KRJG5BPI3Z2BDOTCRFOPYWIW6EUJYDYAGGSMKF6B";
const ENV_PATH     = path.join(__dirname, "../../frontend/.env.local");

// Read vault ID from .env.local at startup
const fs = require("fs");
function readVaultId() {
  const env = fs.readFileSync(ENV_PATH, "utf8");
  const m   = env.match(/^NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=(.+)$/m);
  if (!m) throw new Error("NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID not found in .env.local");
  return m[1].trim();
}

// Asset order must match vault constants (ASSET_AAPL=0 … ASSET_PFE=11)
const TICKERS = ["AAPL","TSLA","NVDA","MSFT","AMZN","GOOG","META","NFLX","AMD","JPM","SPY","PFE"];
const MICRO   = 1_000_000n;
const INTERVAL_MS = 60_000; // 60 seconds

// ── Price fetch ───────────────────────────────────────────────────────────────

async function fetchPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`Yahoo HTTP ${resp.status} for ${ticker}`);
  const data  = await resp.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!price || price <= 0) throw new Error(`Bad price for ${ticker}: ${price}`);
  return price;
}

async function fetchAllPrices() {
  const results = await Promise.allSettled(TICKERS.map(fetchPrice));
  const prices  = [];
  for (let i = 0; i < TICKERS.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      prices.push(r.value);
      process.stdout.write(`  ${TICKERS[i].padEnd(5)} $${r.value.toFixed(2)}\n`);
    } else {
      prices.push(null);
      process.stdout.write(`  ${TICKERS[i].padEnd(5)} ⚠️  ${r.reason?.message}\n`);
    }
  }
  return prices;
}

// ── Oracle TX ─────────────────────────────────────────────────────────────────

const server = new rpc.Server(RPC_URL, { allowHttp: false });
const kp     = Keypair.fromSecret(ADMIN_SECRET);

async function pushPrices(prices, vaultId) {
  const acct = await server.getAccount(kp.publicKey());

  // Build Vec<i128> ScVal for set_prices — use last-known price (0) for failed fetches
  const priceMicros = prices.map((p) =>
    nativeToScVal(p !== null ? BigInt(Math.round(p * 1_000_000)) : 0n, { type: "i128" })
  );
  const pricesVec = xdr.ScVal.scvVec(priceMicros);

  const vault   = new Contract(vaultId);
  const tx      = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: NETWORK_PASS })
    .addOperation(vault.call("set_prices", pricesVec))
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error("set_prices sim error: " + sim.error);

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);

  const submit = await server.sendTransaction(prepared);
  if (submit.status === "ERROR") throw new Error("set_prices submit error: " + JSON.stringify(submit.errorResult));

  process.stdout.write(`  ⏳ tx ${submit.hash.slice(0,12)}… `);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await server.getTransaction(submit.hash);
    if (s.status === rpc.Api.GetTransactionStatus.SUCCESS) { console.log("✅"); return; }
    if (s.status === rpc.Api.GetTransactionStatus.FAILED)  { throw new Error("set_prices TX failed"); }
    process.stdout.write(".");
  }
  throw new Error("set_prices TX timed out");
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function runOnce(vaultId) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`\n[${now}] Fetching prices from Yahoo Finance…`);
  const prices = await fetchAllPrices();
  const valid  = prices.filter(Boolean).length;
  console.log(`  ${valid}/12 prices fetched — pushing to vault ${vaultId.slice(0,8)}…`);
  await pushPrices(prices, vaultId);
}

async function main() {
  const vaultId  = readVaultId();
  const onlyOnce = process.argv.includes("--once");
  console.log("Ztellar Edge — Price Oracle");
  console.log("Vault:  ", vaultId);
  console.log("Admin:  ", kp.publicKey());
  console.log("Interval:", onlyOnce ? "single run" : `${INTERVAL_MS / 1000}s`);

  await runOnce(vaultId);
  if (onlyOnce) return;

  setInterval(() => runOnce(vaultId).catch(console.error), INTERVAL_MS);
}

main().catch((err) => { console.error("Oracle error:", err.message); process.exit(1); });
