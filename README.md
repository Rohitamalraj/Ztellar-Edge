# Ztellar Edge — Privacy-Preserving Synthetic Stock Trading on Stellar

> **Prove your tier. Guard your identity. Trade with edge.**
>
> The first synthetic stock trading protocol on Stellar where KYC eligibility is enforced by a zero-knowledge proof — and your leverage cap is determined by a cryptographic tier that reveals nothing about who you are.

---

## The Problem in One Sentence

Billions of people hold stablecoins on Stellar's real-money rails — but they can't access leveraged synthetic equity exposure without either surrendering their identity to a custodian or posting 150% overcollateral to a protocol that treats everyone as equally untrusted.

---

## Why This Matters — Market Context

| Metric | Value |
|---|---|
| Stellar payment volume (Q1 2026) | **$5.5B+** processed on the network |
| Tokenized Real World Assets on Stellar | **$2B+** — Circle, institutional partners, sovereign deployments |
| Web3 identity & reputation market (2025) | **$1.20B** → projected **$12.80B by 2034** (28.9% CAGR) |
| People locked out of US equity markets | **4.3B+** — no brokerage access across Latin America, Africa, Southeast Asia |
| Synthetic stock demand in Stellar corridors | Persistent — remittance users already hold USDC and want equity exposure |

Stellar is not a niche chain. MoneyGram, Circle, and sovereign partners process real-money payments across the corridors where people need better financial tools. These users already hold stablecoins. Synthetic equity exposure on those rails is a natural next product. The infrastructure to serve them now exists — **Protocol 25 added native BLS12-381 host functions to Soroban**, making on-chain ZK proof verification affordable for the first time.

Without those host functions, full elliptic curve pairing math in pure Wasm would cost prohibitively many compute units. With them, an entire ZK-proven compliance gate fits inside a single Soroban transaction.

---

## Three Layers of the Problem

### 1. Full KYC or Nothing

Existing access-controlled DeFi requires users to either submit full PII (passport, address, face scan) to a custodian, or be locked out entirely. There is no middle path that grants calibrated access while preserving privacy. Legitimate, low-risk, privacy-conscious users are forced to choose between exposure and exclusion.

### 2. Overcollateralization Is a Blunt Instrument

Without any signal about who a user is, protocols default to 150%+ collateral requirements for 1× exposure. This:
- Discriminates against legitimate users who have established history elsewhere
- Prevents the credit-based access that exists in traditional finance
- Makes leverage products inaccessible to users in emerging markets who cannot post 3× their position in collateral

### 3. On-Chain Reputation Is a Surveillance Vector

The few protocols that have attempted reputation systems expose the score publicly:

| Approach | Problem |
|---|---|
| On-chain credit scores (Spectral, Cred) | Fully public — any observer reconstructs your financial history |
| Centralized KYC gates | Require PII, create honeypot databases, must be trusted by user |
| Collateral-only models | Ignore reputation entirely — good and bad actors post the same margin |
| Soulbound tokens / POAPs | Prove identity but reveal it publicly — privacy is the casualty |

None of these preserve privacy while enabling differentiated, risk-calibrated access.

---

## The Solution — Ztellar Edge

Ztellar Edge is a two-layer system built natively on Stellar and Soroban.

**Layer 1 — ZK-Verified Access Gate**

Users generate a Groth16 zero-knowledge proof in their browser. The proof attests:
- They belong to a specific tier (1–4) based on wallet behavior scoring
- Their tier has not expired
- Their proof cannot be replayed (nullifier prevents reuse)
- Their personal data — wallet history, balance, raw score — never leaves their device

Only four values are ever posted on-chain: a tier number, a nullifier, an expiry timestamp, and a wallet commitment. The inputs stay private.

**Layer 2 — Synthetic Trading with Tier-Gated Leverage**

Based on the verified tier, users open synthetic long or short positions on 12 assets. Leverage caps are enforced atomically by the SynthVault Soroban contract — not by an admin:

| Tier | Label | Max Leverage | Collateral Required |
|---|---|---|---|
| 1 | Basic | 1× | 100% |
| 2 | Verified | 2× | 60% |
| 3 | Trusted | 5× | 30% |
| 4 | Premium | 10× | 15% |

---

## What Makes Ztellar Edge Unique

| Feature | Synthetix / GMX | Traditional KYC (Onfido) | Spectral / Cred | **Ztellar Edge** |
|---|---|---|---|---|
| Privacy-preserving compliance | ❌ | ❌ Stores full PII | ❌ Score is public | ✅ ZK — only tier revealed |
| On-chain leverage enforcement | Fixed collateral | Off-chain only | Soft signals only | ✅ Hard caps enforced by contract |
| Replay protection | — | Credential theft risk | — | ✅ Cryptographic nullifier |
| Financial product layer | ✅ | ❌ | ❌ No trading | ✅ Full synthetic trading |
| Native Stellar integration | ❌ EVM only | ❌ | ❌ | ✅ Soroban · Freighter · SAC USDC |
| Systematic Investment Plans | ❌ | ❌ | ❌ | ✅ On-chain SIP Soroban contract |

Most projects do identity *or* privacy *or* trading. Ztellar Edge does all three in a single coherent product, natively on Stellar's real-money rails, targeting the exact users Stellar already serves.

---

## How Stellar's Protocol Features Are Used

### BLS12-381 Native Host Functions (Protocol 25)

Protocol 25 added native BLS12-381 elliptic curve operations as Soroban host functions:

| Host Function | Usage in Ztellar Edge |
|---|---|
| `bls12_381_g1_add` / `bls12_381_g1_mul` | Compute `vk_x = Σ vk_ic[i] × public_signals[i]` during proof verification |
| `bls12_381_g2_add` / `bls12_381_g2_mul` | G2 point operations during verifying key computation |
| `bls12_381_pairing` | Core Groth16 check: `e(πA, πB) = e(α, β) · e(vk_x, γ) · e(πC, δ)` |

**Key encoding detail:** Soroban BLS12-381 G2 affine points use `c1 (imaginary) || c0 (real)` byte ordering — opposite of the snarkjs default. The frontend serializer in `lib/stellar.ts` handles this swap explicitly before building the `ScVal`. Getting this wrong causes a silent WasmVm panic in `pairing_check`.

### Soroban Smart Contracts

Five production Soroban contracts coordinate the full system:

| Contract | Role |
|---|---|
| `zk_verifier` | Calls `bls12_381_pairing` to verify Groth16 proof; writes tier to `tier_manager` on success |
| `tier_manager` | Stores `wallet → (tier, expiry, nullifier)`; exposes `get_max_leverage()` |
| `synth_vault` | Reads tier, enforces leverage cap atomically, opens/closes positions, settles PnL in USDC |
| `synth_token` | SEP-0041 fungible token × 3 deployments (sAAPL, sTSLA, sNVDA) |
| `synth_sip` | Systematic Investment Plans — calls `vault.open_position` on a user-configured schedule |

### Stellar Asset Contract (SAC) — Circle Testnet USDC

All settlement is in USDC via the Stellar Asset Contract. The vault pulls USDC from the user when a position opens, and returns USDC (collateral ± PnL) when it closes:

```
Issuer:   GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
SAC:      CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
Decimals: 7  (1 USDC = 10,000,000 units)
```

### Freighter Wallet + Soroban Auth Tree

Ztellar Edge is pure Stellar-native — no MetaMask, no bridges, no EVM. Freighter handles all transaction signing. Soroban's `assembleTransaction` builds the complete cross-contract authorization tree, so a single Freighter popup covers multi-hop calls:

```
sip.invest()
  └→ vault.open_position()
       └→ usdc.transfer()
```
One user click. One signature. Three contracts.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                            │
│                                                                     │
│  Next.js 14 · TypeScript · Tailwind CSS                             │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Freighter Wallet  │  │ snarkjs           │  │ stellar-sdk      │  │
│  │ @stellar/         │  │ Groth16 fullProve │  │ Soroban RPC      │  │
│  │ freighter-api     │  │ (in-browser WASM) │  │ assembleTransaction│ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │  POST /api/score         │ proof ScVals        │ signed tx
          ▼                          ▼                      ▼
┌─────────────────┐     ┌────────────────────────────────────────────┐
│ Next.js API     │     │             Stellar Testnet (Soroban)      │
│                 │     │                                             │
│ /api/score      │     │  ┌────────────────┐   ┌─────────────────┐ │
│ · Stellar Horizon     │  │  zk_verifier   │──►│  tier_manager   │ │
│   reads tx_count│     │  │                │   │                 │ │
│   xlm_balance   │     │  │ bls12_381_     │   │ wallet → tier   │ │
│   account_age   │     │  │ pairing()      │   │ expiry          │ │
│   counterparties│     │  │                │   │ nullifier set   │ │
│ · Computes score│     │  └────────────────┘   └────────┬────────┘ │
│ · Signs with    │     │                                 │          │
│   Baby Jubjub   │     │  ┌──────────────────────────────▼───────┐  │
│                 │     │  │           synth_vault                 │  │
│ /api/prices     │     │  │                                       │  │
│ · Coinbase +    │────►│  │ open_position(asset, dir, lev, col)  │  │
│   Yahoo Finance │     │  │ close_position(position_id)          │  │
│ · Pushes to     │     │  │ set_prices([price0..price11])        │  │
│   vault every   │     │  │                                       │  │
│   60 seconds    │     │  └──────────────┬────────────────────────┘  │
│   via ADMIN_    │     │                 │                            │
│   SECRET key    │     │  ┌──────────────▼────────────────────────┐  │
│                 │     │  │           synth_sip                    │  │
└─────────────────┘     │  │                                        │  │
                        │  │ create_sip(asset, amount, period)     │  │
                        │  │ invest(sip_id) → vault.open_position  │  │
                        │  │               → usdc.transfer         │  │
                        │  └────────────────────────────────────────┘  │
                        │                                              │
                        │  Circle USDC (SAC)                          │
                        │  CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4W..  │
                        └──────────────────────────────────────────────┘
```

---

## Full Trade Flow

### Phase 1 — Identity: ZK Proof → On-Chain Tier

```
1. User connects Freighter
   → freighter-api.getPublicKey() → Stellar AccountID (G...)

2. Frontend calls /api/score
   → Reads Stellar Horizon: tx_count, xlm_balance, account_age, unique_counterparties
   → Computes tier_score (0–100) via weighted formula
   → Signs { score, wallet, expiry } with Baby Jubjub EdDSA key (server-side only)
   → Returns { score, sig_r, sig_s, expiry }

3. Browser loads ZK circuit artifacts
   → /public/circuits/tier_proof.wasm  (573 constraints, Groth16)
   → /public/circuits/tier_proof.zkey

4. snarkjs.groth16.fullProve()
   Private inputs (stay in browser):  wallet_secret, score, sig_r, sig_s, sig_pk
   Public outputs (posted on-chain):  tier, nullifier, expiry, wallet_commitment

5. Proof serialized for Soroban
   → G2 point bytes swapped: c1||c0 ordering (Soroban BLS12-381 convention)
   → Proof + public signals packed as ScVals
   → Freighter signs, transaction submitted

6. On-chain verification in zk_verifier
   → Nullifier checked against nullifier_set (anti-replay)
   → bls12_381_pairing() called with proof + baked-in verifying key
   → If valid: tier_manager.set_tier(wallet, tier, expiry, nullifier)
   → TierVerified event emitted
```

**Wallet Score Formula:**

```
score = (tx_count_norm     × 0.30)
      + (xlm_balance_norm  × 0.25)
      + (account_age_norm  × 0.25)
      + (counterparty_norm × 0.20)

score = clamp(score × 100, 0, 100)
```

**Tier Thresholds:**

```
Score  0–24  → Tier 1 (Basic)    →  1× max leverage
Score 25–49  → Tier 2 (Verified) →  2× max leverage
Score 50–74  → Tier 3 (Trusted)  →  5× max leverage
Score 75–100 → Tier 4 (Premium)  → 10× max leverage
```

---

### Phase 2 — Trade: Open and Close Synthetic Positions

**Open:**
```
1. User selects asset (e.g. sNVDA), direction (LONG/SHORT), leverage, collateral USDC
2. vault.open_position(asset_id, direction, leverage, collateral_usdc)
   → Reads tier_manager.get_max_leverage(caller) — enforced atomically, not by UI
   → Reads on-chain price from set_prices storage (pushed every 60s by price oracle)
   → Calculates synth_qty = (collateral × leverage) / price
   → Pulls USDC from user to vault via SAC transfer
   → Stores Position { id, wallet, asset, direction, entry_price,
                       leverage, collateral, synth_qty, opened_at }
   → Returns position_id; TX hash surfaced in success toast with Stellar Expert link
```

**PnL Calculation (live, every 2s):**
```
pnl = (current_price - entry_price) / entry_price × leverage × collateral
pnl = -pnl  if direction == SHORT
```

**Close:**
```
vault.close_position(position_id)
→ Calculates realized PnL at current on-chain price
→ Deletes position from contract storage
→ Returns USDC (collateral + PnL) to user wallet
→ Trade captured in localStorage (trade history) before TX fires
   key: zte_trade_history_${wallet}
```

---

### Phase 3 — SIP: Systematic Investment Plans

The `synth_sip` Soroban contract enforces recurring investment schedules into vault positions:

```rust
// Create a plan: invest 50 USDC weekly into sNVDA
create_sip(user, asset_id: 2, amount: 500_000_000, period: 604800)
// Returns: sip_id (u64)

// Each invest() call (when ledger.timestamp >= next_due):
invest(sip_id)
→ sip.invest → vault.open_position → usdc.transfer
→ All sub-calls covered by one Freighter signature (Soroban auth tree)
→ sip.next_due += period
→ sip.count++, sip.total_invested += amount
```

**SIP Data Structure:**
```
Sip {
  id:              u64
  user:            Address
  asset:           u32       // 0=sAAPL, 1=sTSLA, 2=sNVDA, ...
  amount:          i128      // USDC per installment (7 decimals)
  period:          u64       // seconds between installments
  next_due:        u64       // ledger timestamp — invest() reverts if too early
  count:           u32       // total installments completed
  total_invested:  i128      // cumulative USDC invested
  active:          bool
}
```

---

## ZK Circuit — `tier_proof.circom`

**Toolchain:** Circom 2.0 → snarkjs Groth16 → BLS12-381 on-chain verification  
**Constraints:** 573  
**Trusted setup:** Powers of Tau ceremony (artifacts in `circuits/ptau/`)  
**Browser proving:** WASM + zkey loaded from `/public/circuits/` — no server round trip

**Private inputs (never leave the browser):**

| Signal | Description |
|---|---|
| `wallet_secret` | Salted hash of wallet address — user-side entropy |
| `score` | Behavior score from oracle (0–100) |
| `sig_r`, `sig_s` | Baby Jubjub EdDSA signature from KYC oracle |
| `sig_pk_x`, `sig_pk_y` | Oracle's public key |

**Public outputs (posted on-chain):**

| Signal | Description |
|---|---|
| `tier` | u8: 1–4, derived from score thresholds in-circuit |
| `nullifier` | `Poseidon(wallet_secret, 1)` — prevents proof replay |
| `expiry` | Unix timestamp: proof validity window |
| `wallet_commitment` | `Poseidon(wallet_address, wallet_secret)` — binds proof to wallet |

**Circuit logic:**
```circom
// 1. Verify oracle signed the credential — no score leaves the browser
BabyJubjubVerifier(sig_r, sig_s, sig_pk, Poseidon(score, wallet, expiry)) === 1

// 2. Compute nullifier — proves uniqueness without revealing wallet_secret
nullifier <== Poseidon(wallet_secret, 1)

// 3. Bind proof to wallet address
wallet_commitment <== Poseidon(wallet_address, wallet_secret)

// 4. Derive tier from score with in-circuit range checks
tier <== TierFromScore(score)

// 5. Score range enforced in circuit (0–100 only)
score in [0, 100]
```

**Circuit artifacts:**

| File | Purpose |
|---|---|
| `circuits/tier_proof.circom` | Circuit definition |
| `frontend/public/circuits/tier_proof.wasm` | Browser WASM prover — intentionally committed |
| `frontend/public/circuits/tier_proof.zkey` | Proving key (trusted setup) — intentionally committed |
| `circuits/keys/verification_key.json` | Verifying key → loaded into `zk_verifier` at deploy time |

---

## Deployed Contracts — Stellar Testnet

> Last deployed: July 2026 · Network: Stellar Testnet

### Core Infrastructure

| Contract | Address |
|---|---|
| ZK Verifier | [`CAO4EYDG7B5OXUUONZWY6AAUGYQPZD66D2E5NPMKCBIYRO2D6ZEO3HX7`](https://stellar.expert/explorer/testnet/contract/CAO4EYDG7B5OXUUONZWY6AAUGYQPZD66D2E5NPMKCBIYRO2D6ZEO3HX7) |
| Tier Manager | [`CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF`](https://stellar.expert/explorer/testnet/contract/CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF) |
| Synth Vault | [`CDQANGYCMZQKYSR6GQAXR7FEF3PALRMEDR65ONKSSJGAVDI23DM5YNQM`](https://stellar.expert/explorer/testnet/contract/CDQANGYCMZQKYSR6GQAXR7FEF3PALRMEDR65ONKSSJGAVDI23DM5YNQM) |
| Synth SIP | [`CAQKC2LHNM7SCEK7FR6K2ET2JOBLDIXN27JQUMEZKJT7LLK75HL42QJT`](https://stellar.expert/explorer/testnet/contract/CAQKC2LHNM7SCEK7FR6K2ET2JOBLDIXN27JQUMEZKJT7LLK75HL42QJT) |
| Circle USDC (SAC) | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |

### Synthetic Token Contracts (SEP-0041)

| Symbol | Underlying | Address |
|---|---|---|
| sAAPL | Apple Inc. | [`CCJ2FSS234EZB7LE2JZLLRZXEVDX4QIN2GMK7EDA5XXNCNPYSQYOGYXX`](https://stellar.expert/explorer/testnet/contract/CCJ2FSS234EZB7LE2JZLLRZXEVDX4QIN2GMK7EDA5XXNCNPYSQYOGYXX) |
| sTSLA | Tesla Inc. | [`CD4HYGTAL7EZRYCGAPIXILCFZDN4RYLGJN4SYYIVHY56OAFWDVADDQZ4`](https://stellar.expert/explorer/testnet/contract/CD4HYGTAL7EZRYCGAPIXILCFZDN4RYLGJN4SYYIVHY56OAFWDVADDQZ4) |
| sNVDA | NVIDIA Corp. | [`CBHBEHJD2GSHSQY2MVJ464KZDL3QOZWZBQABP2VSFVRJQ4BUBXVJLTTK`](https://stellar.expert/explorer/testnet/contract/CBHBEHJD2GSHSQY2MVJ464KZDL3QOZWZBQABP2VSFVRJQ4BUBXVJLTTK) |
| sMSFT · sAMZN · sGOOG · sMETA · sNFLX · sAMD · sJPM · sSPY · sPFE | Various | Tracked as vault position entries (asset IDs 3–11) |

---

## Repository Structure

```
Ztellar-Edge/
│
├── circuits/                          # ZK circuit — Circom 2
│   ├── tier_proof.circom              # KYC tier attestation (573 constraints, Groth16)
│   ├── scripts/
│   │   ├── compile.js                 # circom → .wasm + .r1cs
│   │   └── setup.js                   # Powers of Tau → .zkey + verification_key.json
│   ├── keys/
│   │   └── verification_key.json      # Exported verifying key (→ zk_verifier init)
│   └── ptau/                          # Powers of Tau ceremony artifacts
│
├── contracts/                         # Soroban workspace (Rust)
│   ├── Cargo.toml                     # Workspace root
│   ├── rust-toolchain.toml            # Pinned toolchain for wasm32v1-none
│   ├── zk_verifier/
│   │   └── src/lib.rs                 # BLS12-381 Groth16 verifier → tier_manager
│   ├── tier_manager/
│   │   └── src/lib.rs                 # wallet → (tier, expiry, nullifier) storage
│   ├── synth_vault/
│   │   └── src/lib.rs                 # 12-asset vault, leverage enforcement, USDC settle
│   ├── synth_token/
│   │   └── src/lib.rs                 # SEP-0041 fungible token (sAAPL / sTSLA / sNVDA)
│   ├── synth_sip/
│   │   └── src/lib.rs                 # SIP — recurring vault.open_position calls
│   ├── scripts/
│   │   ├── deploy.js                  # Deploy full suite; writes frontend/.env.local
│   │   ├── deploy_sip.js              # Deploy SIP contract standalone
│   │   └── init_prices.js             # Initialize vault price oracle
│   └── target/
│       └── wasm32v1-none/release/     # Compiled WASM artifacts
│
└── frontend/                          # Next.js 14 dApp
    ├── app/
    │   ├── page.tsx                   # Landing page
    │   ├── trade/page.tsx             # Trade dashboard — open/close positions
    │   ├── portfolio/page.tsx         # Portfolio — open positions, SIPs, trade history
    │   ├── sip/page.tsx               # SIP management
    │   ├── prove/page.tsx             # ZK proof generation flow (4-step)
    │   └── api/
    │       ├── score/route.ts         # Wallet behavior scoring via Stellar Horizon
    │       └── prices/route.ts        # Price oracle → vault.set_prices every 60s
    ├── components/
    │   ├── app/app-nav.tsx            # Navigation (Trade · Portfolio · SIP · Prove)
    │   ├── landing/                   # Animated landing sections
    │   └── ui/                        # Shared UI primitives (shadcn/ui)
    ├── hooks/
    │   ├── use-positions.ts           # Open positions, close, PnL polling
    │   ├── use-sip.ts                 # SIP CRUD + invest
    │   ├── use-tier.ts                # Tier query and expiry display
    │   └── use-prices.ts              # Live price polling (2s interval)
    ├── lib/
    │   ├── stellar.ts                 # All Soroban tx builders + BLS12-381 serializer
    │   ├── contracts.ts               # Contract address registry
    │   ├── zk.ts                      # snarkjs in-browser proof generation wrapper
    │   └── trade-history.ts           # localStorage closed trade persistence
    └── public/
        └── circuits/
            ├── tier_proof.wasm        # Browser WASM prover (intentionally committed)
            └── tier_proof.zkey        # Proving key (intentionally committed)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Rust · Soroban SDK · `wasm32v1-none` target |
| ZK proofs | Circom 2.0 · snarkjs (Groth16 in browser) · Baby Jubjub EdDSA |
| On-chain ZK verification | Stellar BLS12-381 host functions (`bls12_381_pairing`) |
| Frontend | Next.js 14 · React 18 · TypeScript · Tailwind CSS |
| Wallet | Freighter (`@stellar/freighter-api`) |
| Stellar SDK | `@stellar/stellar-sdk` |
| Price oracle | Next.js API route · Coinbase Data API · Yahoo Finance |
| Settlement token | Circle Testnet USDC · Stellar Asset Contract (SAC, 7 decimals) |
| Testnet | Stellar Testnet · Soroban RPC · Stellar Expert |

---

## Local Setup

### Prerequisites

- Node.js 20+
- Rust with `wasm32v1-none` target:
  ```bash
  rustup target add wasm32v1-none
  ```
- [Freighter](https://freighter.app) browser extension → Settings → Enable Testnet
- Stellar testnet wallet funded with XLM via [Stellar Friendbot](https://friendbot.stellar.org)
- Testnet USDC from [Circle's faucet](https://faucet.circle.com)

### Install and Run

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

The price oracle runs as a Next.js API route — no separate process needed.

### Environment

**`frontend/.env.local`** is written automatically by the deploy script. For local dev against the already-deployed contracts, use:

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID=CAO4EYDG7B5OXUUONZWY6AAUGYQPZD66D2E5NPMKCBIYRO2D6ZEO3HX7
NEXT_PUBLIC_TIER_MANAGER_CONTRACT_ID=CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF
NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=CDQANGYCMZQKYSR6GQAXR7FEF3PALRMEDR65ONKSSJGAVDI23DM5YNQM
NEXT_PUBLIC_SYNTH_AAPL_CONTRACT_ID=CCJ2FSS234EZB7LE2JZLLRZXEVDX4QIN2GMK7EDA5XXNCNPYSQYOGYXX
NEXT_PUBLIC_SYNTH_TSLA_CONTRACT_ID=CD4HYGTAL7EZRYCGAPIXILCFZDN4RYLGJN4SYYIVHY56OAFWDVADDQZ4
NEXT_PUBLIC_SYNTH_NVDA_CONTRACT_ID=CBHBEHJD2GSHSQY2MVJ464KZDL3QOZWZBQABP2VSFVRJQ4BUBXVJLTTK
NEXT_PUBLIC_USDC_CONTRACT_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
NEXT_PUBLIC_SYNTH_SIP_CONTRACT_ID=CAQKC2LHNM7SCEK7FR6K2ET2JOBLDIXN27JQUMEZKJT7LLK75HL42QJT

# Server-side only — NEVER prefix with NEXT_PUBLIC_
ADMIN_SECRET=<vault admin keypair for price oracle>
```

> `ADMIN_SECRET` is used exclusively in the `/api/prices` server-side route to push price updates to the vault. It never reaches the client.

### Rebuild Contracts (only if modifying Rust)

The full cargo path is required — `cargo` is not in the default shell `PATH` on Windows:

```bash
/c/Users/<you>/.cargo/bin/cargo build \
  --target wasm32v1-none \
  --release \
  -p ztellar-synth-vault
```

Build contracts in dependency order: `synth_token` → `synth_vault` → `synth_sip` (SIP imports vault WASM at compile time via `contractimport!`).

---

## End-to-End Test Flow

**1. Connect wallet**
Navigate to the app. Click "Connect Freighter" → approve popup → your Stellar address appears in the nav.

**2. Get testnet USDC**
Visit [Circle faucet](https://faucet.circle.com), enter your Stellar testnet address, receive 10 USDC. It appears in your Freighter balance.

**3. Prove Identity** → `/prove`
- "Checking wallet activity..." — Horizon API reads your account (1–2s)
- "Generating ZK proof..." — snarkjs Groth16 runs in-browser (5–15s)
- "Submitting to Stellar..." — Freighter popup → approve
- Tier badge appears in nav with your tier (1–4) and expiry

**4. Open a position** → `/trade`
- Select asset (e.g. sNVDA), LONG or SHORT
- Enter USDC collateral amount
- Drag leverage slider — capped by your on-chain tier
- "Open Position" → Freighter popup → approve
- Success toast shows TX hash with Stellar Expert link

**5. View portfolio** → `/portfolio`
- Open positions with live unrealized PnL (updates every 2s)
- Active SIPs with next-due countdown
- Realized P&L from closed trade history

**6. Create a SIP** → `/sip`
- Select asset, USDC amount, frequency (1 min testnet / daily / weekly / monthly)
- "Create SIP" → Freighter → approve
- Card appears showing `next_due` time and "Invest Now" button
- "Invest Now" (active when `next_due ≤ now`) → Freighter → one signature covers the full `sip → vault → usdc` chain

**7. Close a position** → `/portfolio` or `/trade`
- "Close" on any open position → Freighter → approve
- Realized PnL shown in toast
- Trade appended to history in Portfolio page

---

## Circuit Regeneration (Advanced)

Only needed if you modify `tier_proof.circom`:

```bash
cd circuits
node scripts/compile.js       # circom → .wasm + .r1cs
node scripts/setup.js         # ptau ceremony → .zkey + verification_key.json
```

After regeneration:
1. Copy `tier_proof.wasm` and `tier_proof.zkey` → `frontend/public/circuits/`
2. Update `circuits/keys/verification_key.json`
3. Redeploy `zk_verifier` — its verifying key is baked in at `init()` time
4. Update `NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID` in `frontend/.env.local`

---

## Acknowledgements

- [Stellar Development Foundation](https://stellar.org/) — Soroban, BLS12-381 host functions, Protocol 25, Freighter wallet, SEP-0041
- [iden3](https://iden3.io/) — circom, snarkjs, Baby Jubjub EdDSA curve
- [Circle](https://www.circle.com/) — Testnet USDC and the Stellar Asset Contract
- [Stellar Expert](https://stellar.expert/) — Testnet contract explorer and transaction lookup

---

## License

MIT

---

*Built for [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks) · Submission deadline: June 29, 2026*
