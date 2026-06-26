# Ztellar Edge — Product Requirements Document

> **Prove your tier. Guard your identity. Trade with edge.**

**Version:** 1.0  
**Date:** June 26, 2026  
**Hackathon:** Stellar Hacks — Real-World ZK  
**Submission Deadline:** June 29, 2026, 12:00 PM PST  
**Prize Pool:** $10,000 in XLM

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Market Context & Statistics](#2-market-context--statistics)
3. [Problem Statement](#3-problem-statement)
4. [Solution Overview](#4-solution-overview)
5. [Why Ztellar Edge is Better](#5-why-ztellar-edge-is-better)
6. [Stellar Ecosystem Integration](#6-stellar-ecosystem-integration)
7. [System Architecture](#7-system-architecture)
8. [Technical Flow](#8-technical-flow)
9. [Smart Contract Specifications](#9-smart-contract-specifications)
10. [ZK Circuit Specifications](#10-zk-circuit-specifications)
11. [Frontend Specifications](#11-frontend-specifications)
12. [Feature Requirements](#12-feature-requirements)
13. [5-Day Sprint Plan](#13-5-day-sprint-plan)
14. [Submission Requirements Checklist](#14-submission-requirements-checklist)
15. [Out of Scope](#15-out-of-scope)

---

## 1. Product Overview

### Name
**Ztellar Edge**

### Tagline
*"Prove your tier. Guard your identity. Trade with edge."*

### One-Line Summary
Ztellar Edge is a privacy-preserving synthetic stock trading platform on Stellar where users prove KYC/risk eligibility with zero-knowledge proofs and receive wallet-behavior-based leverage tiers — without ever revealing personal identity data or raw onchain history.

### Core Value Proposition
| For the user | For the protocol |
|---|---|
| Access leveraged synthetic trading without doxxing yourself | Enforce risk controls without collecting raw identity data |
| Prove eligibility without exposing passport, age, or address | Reduce insolvency risk via tier-gated leverage caps |
| Wallet reputation improves access over time | Remain compliant while preserving user privacy |
| Single proof generation — no repeated KYC flows | Auditable and trustless enforcement on Soroban |

### Project Category
- **ZK Track:** Groth16 circuit (BN254) + Soroban verifier
- **Use Case:** Privacy-preserving compliance + leveraged synthetic trading
- **Stellar Primitives Used:** BN254 pairing ops, Poseidon hash, Soroban smart contracts, SEP-0041 token standard

---

## 2. Market Context & Statistics

### 2.1 Stellar Network (as of 2026)

Stellar is no longer a niche payments chain — it is a production-grade settlement layer with significant institutional traction:

- **$5.5B+ in payment volume** processed in Q1 2026
- **$2B+ in tokenized Real World Assets (RWAs)** on Stellar
- Active deployment from MoneyGram, Circle (USDC), and multiple sovereign and institutional partners
- **Protocol 25 (X-Ray)** and **Protocol 26 (Yardstick)** added native BN254 and Poseidon/Poseidon2 host functions, making ZK proof verification meaningfully cheaper
- Stellar's privacy roadmap explicitly names configurable privacy, confidential tokens, association set providers, and view keys as core infrastructure direction

**What this means for Ztellar Edge:** Stellar's user base is real-money users — remittance senders, stablecoin holders, institutional settlement desks. These are exactly the users who need compliance-safe access to better financial products without surveillance.

### 2.2 Web3 Identity & Reputation Market

The market for onchain identity, KYC, and reputation systems is growing fast:

| Metric | Value |
|---|---|
| Market size (2025) | USD 1.20 Billion |
| Projected size (2034) | USD 12.80 Billion |
| CAGR | ~28.9% |
| Key drivers | DeFi credit expansion, regulatory pressure, institutional onboarding |

Source: Web3 Identity and Reputation / DeFi Credit Scoring market, 2025 industry reports.

This confirms that wallet-reputation-based access control is not a research experiment — it is a fast-growing commercial category. Projects that nail the privacy-preserving verification layer early will have structural positioning.

### 2.3 Synthetic Asset & DeFi Derivatives Market

Synthetic assets — onchain instruments that track real-world assets without custody — are a large and growing space:

- Global DeFi derivatives market has grown significantly, with hundreds of billions in notional value across platforms
- Synthetic stock exposure is a persistent demand from global users who lack access to US markets, especially in Latin America, Africa, and Southeast Asia
- Stellar's real-money user base overlaps strongly with these underserved markets — remittance users who already hold stablecoins are natural candidates for synthetic savings and exposure products

### 2.4 The Intersection

Ztellar Edge sits at the intersection of three trends:

```
Privacy-preserving finance
        ↕
Wallet reputation / KYC access layers     ← Ztellar Edge lives here
        ↕
Synthetic asset trading on real-money rails
```

That intersection is underpopulated. Most privacy tools do not have a financial product on top. Most synthetic trading platforms do not have a compliance layer. Most KYC tools do not preserve privacy. Ztellar Edge combines all three.

---

## 3. Problem Statement

### 3.1 The Core Tension in Onchain Finance

Public blockchains are, by design, transparent. Every transaction, balance, and wallet interaction is visible by default. This creates a fundamental conflict with real-world financial needs:

> **Users need access to financial products. Protocols need risk controls. Neither side wants to sacrifice privacy or compliance.**

### 3.2 Problem 1 — Privacy Loss During Access Control

Traditional DeFi and even many "compliance-aware" protocols require users to:

- Submit full KYC documents (passport, address, face scan)
- Reveal exact wallet balance or history to qualify for access
- Accept that sensitive data is stored by a third party

This is unacceptable for users who are otherwise legitimate, low-risk, and privacy-conscious. Stellar's own documentation acknowledges that *"blockchain transparency is valuable for many use cases, but not all — real-world finance often needs configurable privacy."*

### 3.3 Problem 2 — Overcollateralization as a Blunt Instrument

Most DeFi protocols fall back on overcollateralization (e.g., 150% collateral for 1x exposure) because they have no signal about who a user actually is. This:

- Locks out capital-efficient trading
- Discriminates against legitimate users who are well-known in other contexts
- Prevents the kind of credit-based access that exists in traditional finance

### 3.4 Problem 3 — No Reputation-Based Access Without Surveillance

A few protocols have attempted to implement reputation systems, but the existing approaches have problems:

| Approach | Problem |
|---|---|
| On-chain credit scores (Spectral, etc.) | Fully public — any observer can read your score |
| Centralized KYC gates | Require personal data submission and trust in provider |
| Collateral-only models | Ignore reputation entirely, lock out good actors |
| Soulbound tokens / POAPs | Prove identity but reveal it publicly |

None of these preserve privacy while enabling access.

### 3.5 Problem 4 — Wallet History is a Surveillance Vector

Even if a protocol says it is "privacy-first," onchain wallet history is readable by anyone. Users who want leveraged synthetic exposure must often connect wallets that reveal their balances, trade history, and counterparties — before they even qualify.

### 3.6 The Gap Ztellar Edge Fills

```
What users want:               What protocols want:
- Better financial access      - Risk controls
- No identity exposure         - Compliance signals
- Privacy                      - Auditable enforcement

                    ↓

What currently exists:
- Full KYC or permissionless, nothing in between

                    ↓

What Ztellar Edge provides:
- ZK-proven tier (eligibility, no raw data)
- Onchain enforcement via Soroban
- Privacy-first flow with no PII on chain
```

---

## 4. Solution Overview

### 4.1 What Ztellar Edge Does

Ztellar Edge is a two-layer system:

**Layer 1 — ZK-Verified Access**
Users generate a zero-knowledge proof that certifies:
- They belong to a specific tier (Tier 1–4)
- Their tier has not expired
- Their proof is unique and cannot be replayed (nullifier)
- No personal data is exposed — only the proof output

**Layer 2 — Synthetic Trading with Tier-Gated Leverage**
Based on the verified tier, users can open synthetic positions in stock tokens (sAAPL, sTSLA, sNVDA) with leverage caps enforced on-chain:

| Tier | Leverage Cap | Collateral Required |
|---|---|---|
| Tier 1 (Basic) | 1x | 100% |
| Tier 2 (Verified) | 2x | 60% |
| Tier 3 (Trusted) | 5x | 30% |
| Tier 4 (Premium) | 10x | 15% |

### 4.2 How the Tiers Work

The tier is computed from two inputs that never leave the user's device:

1. **Wallet behavior score** — derived from transaction count, age, and XLM balance (read from chain, scored off-chain)
2. **Policy-based KYC signal** — a signed attestation from the backend oracle confirming eligibility (no raw data stored)

These inputs go into a Groth16 circuit. The circuit outputs:
- A tier number (1–4)
- A nullifier (prevents replay)
- An expiry timestamp
- A commitment to the wallet address

Only those four outputs are ever posted on-chain. The inputs stay private.

### 4.3 User Flow (End-to-End)

```
1. User opens Ztellar Edge in browser
2. Connects Freighter wallet (Stellar native)
3. Backend oracle reads wallet activity from Stellar (tx count, XLM balance, age)
4. Backend computes score and signs with Baby Jubjub EdDSA key
5. Browser receives signed credential
6. snarkjs generates Groth16 proof in-browser using signed credential + wallet secret
7. Proof sent to Soroban ZKVerifier contract
8. Soroban calls native BN254 pairing_check host function
9. If valid → Soroban TierManager stores (wallet → tier, expiry, nullifier)
10. User opens synthetic position in SynthVault with tier-appropriate leverage
11. SynthVault checks tier before accepting position
12. Synth token (SEP-0041) minted and held by user
13. User closes position later; synth token burned; settlement in USDC
```

---

## 5. Why Ztellar Edge is Better

### 5.1 vs. Existing DeFi Synthetic Platforms

| Feature | Synthetix / GMX / dYdX | Ztellar Edge |
|---|---|---|
| Identity / KYC | None or off-chain | ZK-proven on-chain tier |
| Leverage access | Fixed collateral rules | Tier-based, reputation-aware |
| Privacy | No consideration | Core design principle |
| Compliance | Geoblocking only | Verifiable access control |
| Chain | EVM | Stellar (real-money rails) |
| User base | Crypto-native | Broader, stablecoin users |

### 5.2 vs. Traditional KYC Systems

| Feature | Onfido / Jumio / Traditional KYC | Ztellar Edge |
|---|---|---|
| Data stored | Full PII | Nothing sensitive |
| Revealed to protocol | Name, DOB, address, face | Tier number only |
| Replay risk | High (credential theft) | Nullifier prevents replay |
| Onchain integration | Off-chain only | Fully onchain enforced |
| Auditability | Centralized logs | Transparent Soroban state |

### 5.3 vs. Onchain Reputation Systems (Spectral, Cred Protocol)

| Feature | Existing reputation systems | Ztellar Edge |
|---|---|---|
| Score visibility | Fully public | Private — only tier revealed |
| Enforcement | Soft signals only | Hard leverage caps on-chain |
| Financial product layer | None (just scoring) | Full synthetic trading product |
| Privacy model | Read by anyone | ZK-proven, cannot be read back |

### 5.4 vs. Soulbound Tokens / POAPs

| Feature | SBTs / POAPs | Ztellar Edge |
|---|---|---|
| Reveals identity | Yes (publicly linked) | No — only tier |
| Replay protection | Revocation lists | Cryptographic nullifier |
| Access enforcement | Manual / off-chain | Automatic on Soroban |
| ZK integration | None | Core mechanism |

### 5.5 The Key Differentiator

> Most projects do identity **or** privacy **or** trading. Ztellar Edge does all three in a single coherent product, natively on Stellar's real-money rails.

The combination is specifically designed for users in real-world remittance and payment corridors — exactly Stellar's existing user base — who want access to synthetic savings products without exposing their identity or financial history.

---

## 6. Stellar Ecosystem Integration

This section is critical for hackathon evaluation. Every major component maps to something Stellar has built or is actively building.

### 6.1 Protocol 25 — BN254 and Poseidon Host Functions

Stellar Protocol 25 (X-Ray) introduced native host functions for:

- `g1_add` — elliptic curve point addition on BN254
- `g1_mul` — scalar multiplication on BN254
- `pairing_check` — bilinear pairing check (core of Groth16 verification)
- `Poseidon` / `Poseidon2` hash — ZK-friendly hash used in your nullifier and commitment scheme

**How Ztellar Edge uses this:**
The Soroban ZKVerifier contract calls `pairing_check` directly to verify the Groth16 proof. This is what makes onchain proof verification affordable on Stellar — without these host functions, full BN254 math in pure Wasm would be prohibitively expensive.

### 6.2 Protocol 26 — Extended BN254 Support

Protocol 26 (Yardstick) added nine more BN254 host functions including:

- Multi-scalar multiplication (MSM)
- Scalar field arithmetic
- Curve membership checks

**How Ztellar Edge uses this:**
The verifier can use MSM for batched multi-proof verification if multiple users submit at once, reducing per-user gas costs. Curve membership checks are used to validate points in the proof before calling the more expensive pairing operation.

### 6.3 Soroban Smart Contracts

Soroban is Stellar's Rust-based smart contract platform. Ztellar Edge deploys four Soroban contracts:

| Contract | Role |
|---|---|
| `zk_verifier` | Calls `pairing_check` host fn, validates Groth16 proof |
| `tier_manager` | Stores wallet → (tier, expiry, nullifier), enforces uniqueness |
| `synth_vault` | Reads tier, enforces leverage cap, opens/closes positions |
| `synth_token` | SEP-0041 fungible token contract for sAAPL, sTSLA, sNVDA |

### 6.4 SEP-0041 Token Standard

Stellar's SEP-0041 is the native fungible token standard for Soroban, equivalent to ERC-20 on EVM. The synth tokens (sAAPL, sTSLA, sNVDA) are SEP-0041 tokens minted by the vault when a position opens and burned when it closes.

**Why this matters:** Using SEP-0041 means the synth tokens are compatible with the Stellar wallet ecosystem (Freighter, Lobstr, etc.) and can be integrated with other Stellar DeFi protocols in the future.

### 6.5 Stellar Privacy Architecture Alignment

Stellar's privacy documentation describes a roadmap with these elements:

| Stellar Privacy Feature | Ztellar Edge Alignment |
|---|---|
| Configurable privacy | Users opt into proving tier — they control what is revealed |
| Access controls | Leverage caps enforced on-chain based on verified tier |
| Association set providers | Nullifier-based exclusion of replayed proofs |
| View keys | Future: auditor view key to reconstruct tier proof trail |
| Confidential tokens | Future: extend synth tokens to hide position amounts |
| Privacy pools | Architecture is compatible with Stellar's privacy pool research |

### 6.6 Freighter Wallet

Freighter is Stellar's standard browser extension wallet. Ztellar Edge integrates with Freighter for:

- Wallet connection
- Transaction signing for opening/closing positions
- Identity binding (Stellar AccountID as the identity primitive)

This means no MetaMask, no EVM, no bridging — a pure Stellar-native user experience.

### 6.7 Testnet & Friendbot

Development and demo run on Stellar Testnet with XLM funded via friendbot (`https://friendbot.stellar.org`). This makes the demo reproducible by any judge without real funds.

---

## 7. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  Next.js Frontend                                               │
│  ┌──────────────┐   ┌───────────────┐   ┌──────────────────┐  │
│  │ Freighter    │   │ snarkjs        │   │ Stellar SDK       │  │
│  │ Wallet       │   │ Proof Gen      │   │ Contract Client   │  │
│  │ @stellar/    │   │ (Groth16,      │   │ (auto-generated   │  │
│  │ freighter-   │   │  BN254)        │   │  via bindings)    │  │
│  │ api          │   └───────────────┘   └──────────────────┘  │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
              │                    │                    │
              ▼                    ▼                    ▼
┌─────────────────┐    ┌───────────────────┐    ┌─────────────────┐
│  Backend Oracle  │    │  ZK Circuit Layer │    │  Stellar Testnet│
│  (Express/Node)  │    │                   │    │  (Soroban)      │
│                  │    │  tier_proof.circom│    │                 │
│  - Reads wallet  │    │  (Groth16/BN254)  │    │  ┌───────────┐ │
│    activity from │    │  - Input: score,  │    │  │zk_verifier│ │
│    Stellar RPC   │◄──►│    wallet secret  │    │  │           │ │
│  - Computes score│    │  - Output: tier,  │───►│  │pairing_   │ │
│  - Signs with    │    │    nullifier,     │    │  │check host │ │
│    Baby Jubjub   │    │    expiry,        │    │  │fn (BN254) │ │
│    EdDSA         │    │    commitment     │    │  └─────┬─────┘ │
└─────────────────┘    └───────────────────┘    │        │        │
                                                 │        ▼        │
                                                 │  ┌───────────┐ │
                                                 │  │tier_mgr   │ │
                                                 │  │(wallet →  │ │
                                                 │  │ tier,     │ │
                                                 │  │ expiry,   │ │
                                                 │  │ nullifier)│ │
                                                 │  └─────┬─────┘ │
                                                 │        │        │
                                                 │        ▼        │
                                                 │  ┌───────────┐ │
                                                 │  │synth_vault│ │
                                                 │  │(leverage  │ │
                                                 │  │ cap, open/│ │
                                                 │  │ close,    │ │
                                                 │  │ settle)   │ │
                                                 │  └─────┬─────┘ │
                                                 │        │        │
                                                 │        ▼        │
                                                 │  ┌───────────┐ │
                                                 │  │synth_token│ │
                                                 │  │(SEP-0041  │ │
                                                 │  │ sAAPL,    │ │
                                                 │  │ sTSLA,    │ │
                                                 │  │ sNVDA)    │ │
                                                 │  └───────────┘ │
                                                 └─────────────────┘
```

### Component Summary

| Component | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | UI, wallet connection, proof trigger |
| Wallet | Freighter (`@stellar/freighter-api`) | Sign transactions, expose AccountID |
| Stellar SDK | `@stellar/stellar-sdk` | Build and submit Soroban transactions |
| Contract Bindings | `stellar contract bindings typescript` | Type-safe contract client |
| ZK Circuit | Circom 2.0 (Groth16/BN254) | Generate tier proof |
| Proof Generator | snarkjs (browser, Wasm) | In-browser proof generation |
| Backend Oracle | Express.js / Node.js | Score wallet, sign credential |
| ZK Verifier | Soroban Rust contract | Verify Groth16 proof via `pairing_check` |
| Tier Manager | Soroban Rust contract | Store and query wallet → tier mapping |
| Synth Vault | Soroban Rust contract | Open/close positions, enforce leverage |
| Synth Token | SEP-0041 Soroban token | Mint/burn synthetic tokens |
| Price Oracle | Reflector Network | Provide stock price feeds on Soroban |

---

## 8. Technical Flow

### 8.1 Proof Generation Flow (Off-Chain)

```
Step 1: User connects Freighter
        → freighter-api.getPublicKey() → returns Stellar AccountID

Step 2: Frontend calls backend oracle
        → POST /score { walletAddress }
        → Backend reads: tx_count, xlm_balance, account_age from Stellar Horizon
        → Backend computes tier_score (0–100)
        → Backend signs { tier_score, wallet, expiry } with Baby Jubjub EdDSA key
        → Returns: { tier_score, signature, expiry }

Step 3: Browser loads circuit artifacts
        → Fetches tier_proof.wasm and tier_proof.zkey from /public/circuits/

Step 4: snarkjs.groth16.fullProve()
        → Private inputs: { wallet_secret, score, sig_r, sig_s, sig_pk }
        → Public inputs: { tier, nullifier, expiry, wallet_commitment }
        → Returns: { proof, publicSignals }

Step 5: Format proof for Soroban
        → Serialize proof.pi_a, proof.pi_b, proof.pi_c as Soroban ScVals
        → Build Soroban transaction invoking zk_verifier::verify(proof, public_signals)
```

### 8.2 On-Chain Verification Flow (Soroban)

```
Step 6: zk_verifier::verify() called
        → Checks nullifier not already used (anti-replay)
        → Calls host function: pairing_check(pi_a, pi_b, pi_c, vk_gamma, vk_delta, vk_ic)
        → If pairing returns true → proof is valid
        → Emits: ProofVerified { wallet, tier, nullifier, expiry }

Step 7: tier_manager::set_tier() called internally
        → Stores: storage().set(wallet, TierRecord { tier, expiry, nullifier })
        → Used nullifier stored in nullifier_set to prevent replay

Step 8: Transaction signed and submitted via Freighter
        → User signs the Soroban transaction in Freighter popup
        → Transaction confirmed on Stellar testnet
```

### 8.3 Trading Flow

```
Step 9: User selects synth token (sAAPL, sTSLA, sNVDA) and leverage

Step 10: Frontend checks user's current tier
         → synth_vault::get_max_leverage(wallet) → reads tier_manager
         → Validates requested leverage ≤ tier's max leverage

Step 11: User submits collateral (USDC or XLM)
         → synth_vault::open_position(asset, leverage, collateral)
         → Vault fetches current price from Reflector oracle
         → Validates leverage cap
         → Mints synth_token via SEP-0041 call
         → Stores position: { wallet, asset, entry_price, leverage, collateral }

Step 12: User closes position later
         → synth_vault::close_position(position_id)
         → Vault fetches current price
         → Calculates PnL: (exit_price - entry_price) / entry_price * leverage
         → Burns synth_token
         → Returns: collateral + PnL (or collateral - loss)
         → Settlement in USDC
```

---

## 9. Smart Contract Specifications

### 9.1 `zk_verifier` Contract

**Purpose:** Verifies a Groth16 proof using Stellar's native BN254 pairing host functions.

**State:**
```rust
// Verifying key loaded at deploy time
struct VerifyingKey {
    vk_alpha_g1: G1Point,
    vk_beta_g2: G2Point,
    vk_gamma_g2: G2Point,
    vk_delta_g2: G2Point,
    vk_ic: Vec<G1Point>,  // one per public input + 1
}

// Nullifier set (prevents proof replay)
Set<Bytes32>  // nullifier_set
```

**Functions:**
```rust
fn init(env: Env, vk: VerifyingKey)
fn verify(env: Env, proof: Groth16Proof, public_signals: Vec<i128>) -> bool
fn is_nullifier_used(env: Env, nullifier: Bytes32) -> bool
```

**Verification logic:**
```rust
fn verify(env: Env, proof: Groth16Proof, public_signals: Vec<i128>) -> bool {
    // 1. Parse nullifier from public_signals[0]
    let nullifier = public_signals[0];
    assert!(!nullifier_set.contains(nullifier), "Proof already used");

    // 2. Compute vk_x = sum(vk_ic[i] * public_signals[i])
    let vk_x = compute_vk_x(&vk_ic, &public_signals);  // uses g1_mul + g1_add

    // 3. Pairing check: e(pi_a, pi_b) == e(vk_alpha, vk_beta) * e(vk_x, vk_gamma) * e(pi_c, vk_delta)
    let result = env.crypto().bn254_pairing_check(
        &[proof.pi_a, vk_x, proof.pi_c],
        &[proof.pi_b, vk.vk_gamma_g2, vk.vk_delta_g2]
    );

    if result {
        nullifier_set.insert(nullifier);
        // emit event
    }
    result
}
```

### 9.2 `tier_manager` Contract

**Purpose:** Stores and retrieves verified tier records for wallets.

**State:**
```rust
struct TierRecord {
    tier: u8,           // 1, 2, 3, or 4
    expiry: u64,        // Unix timestamp
    nullifier: Bytes32, // For audit reference
    verified_at: u64,   // Block timestamp
}

Map<AccountId, TierRecord>
```

**Functions:**
```rust
fn set_tier(env: Env, wallet: AccountId, record: TierRecord)
    // Only callable by zk_verifier contract

fn get_tier(env: Env, wallet: AccountId) -> Option<TierRecord>

fn get_max_leverage(env: Env, wallet: AccountId) -> u8
    // Returns: Tier1→1, Tier2→2, Tier3→5, Tier4→10

fn is_tier_valid(env: Env, wallet: AccountId) -> bool
    // Checks expiry > current_ledger_time
```

**Leverage table:**
```rust
fn get_max_leverage(tier: u8) -> u8 {
    match tier {
        1 => 1,
        2 => 2,
        3 => 5,
        4 => 10,
        _ => 0,
    }
}
```

### 9.3 `synth_vault` Contract

**Purpose:** Manages synthetic positions with tier-enforced leverage caps.

**State:**
```rust
struct Position {
    id: u64,
    wallet: AccountId,
    asset: Symbol,       // "sAAPL", "sTSLA", "sNVDA"
    entry_price: i128,   // in USDC, 6 decimal places
    leverage: u8,
    collateral: i128,    // USDC amount
    size: i128,          // notional = collateral * leverage
    opened_at: u64,
}

Map<u64, Position>          // position_id → Position
Map<AccountId, Vec<u64>>    // wallet → [position_ids]
u64                         // next_position_id
```

**Functions:**
```rust
fn open_position(
    env: Env,
    asset: Symbol,
    leverage: u8,
    collateral: i128,
) -> u64
// Checks: tier_manager.get_max_leverage(caller) >= leverage
// Checks: leverage * collateral <= position_size_cap
// Gets price from Reflector oracle
// Mints synth_token to caller
// Returns position_id

fn close_position(env: Env, position_id: u64) -> i128
// Only callable by position owner
// Gets current price from Reflector
// Calculates PnL
// Burns synth_token from caller
// Returns settlement amount in USDC

fn get_position(env: Env, position_id: u64) -> Option<Position>

fn get_positions(env: Env, wallet: AccountId) -> Vec<Position>
```

**PnL Calculation:**
```rust
fn calculate_pnl(entry_price: i128, exit_price: i128, leverage: u8, collateral: i128) -> i128 {
    let price_change_bps = (exit_price - entry_price) * 10000 / entry_price;
    let leveraged_return_bps = price_change_bps * (leverage as i128);
    collateral * leveraged_return_bps / 10000
}
```

### 9.4 `synth_token` Contract (SEP-0041)

**Purpose:** Fungible token contract for each synthetic asset.

Three separate deployments:
- `synth_aapl` → sAAPL token
- `synth_tsla` → sTSLA token
- `synth_nvda` → sNVDA token

Each follows the SEP-0041 standard interface:

```rust
fn initialize(env: Env, admin: AccountId, decimal: u32, name: String, symbol: String)
fn mint(env: Env, to: AccountId, amount: i128)       // only synth_vault can call
fn burn(env: Env, from: AccountId, amount: i128)     // only synth_vault can call
fn balance(env: Env, id: AccountId) -> i128
fn transfer(env: Env, from: AccountId, to: AccountId, amount: i128)
fn allowance(env: Env, from: AccountId, spender: AccountId) -> i128
fn approve(env: Env, from: AccountId, spender: AccountId, amount: i128, expiration_ledger: u32)
```

---

## 10. ZK Circuit Specifications

### 10.1 Circuit: `tier_proof.circom`

**Language:** Circom 2.0  
**Proving system:** Groth16  
**Curve:** BN254  
**Tooling:** snarkjs (proof gen in browser), circom2 (circuit compile)

### 10.2 Private Inputs (never leave user device)

```
wallet_secret          // User's private key or salted hash of wallet address
score                  // Credit/behavior score (0-100) from backend oracle
sig_r, sig_s           // Baby Jubjub EdDSA signature from oracle
sig_pk_x, sig_pk_y    // Oracle's public key
```

### 10.3 Public Outputs (posted on-chain)

```
tier            // u8: 1–4, derived from score thresholds
nullifier       // Poseidon(wallet_secret, nonce) — prevents replay
expiry          // timestamp: now + 30 days
wallet_commitment // Poseidon(wallet_address, wallet_secret)
```

### 10.4 Circuit Logic (pseudocode)

```
// 1. Verify oracle signature
BabyJubjubVerifier(sig_r, sig_s, sig_pk_x, sig_pk_y, Poseidon(score, wallet, expiry)) === 1

// 2. Compute nullifier
nullifier <== Poseidon(wallet_secret, 1)

// 3. Compute wallet commitment
wallet_commitment <== Poseidon(wallet_address, wallet_secret)

// 4. Derive tier from score
// Score 0–24   → Tier 1
// Score 25–49  → Tier 2
// Score 50–74  → Tier 3
// Score 75–100 → Tier 4
tier <== TierFromScore(score)

// 5. Range check on score
score in range [0, 100]

// 6. Validate expiry is in the future
expiry > current_timestamp
```

### 10.5 Wallet Score Inputs (Oracle-Side)

The backend oracle reads the following from Stellar Horizon/RPC and computes a score:

| Signal | Weight | Description |
|---|---|---|
| `tx_count` | 30% | Number of transactions in account history |
| `xlm_balance` | 25% | Current XLM balance (normalized to cap) |
| `account_age_days` | 25% | Days since account creation |
| `unique_counterparties` | 20% | Distinct accounts interacted with |

Score formula (simplified):
```
score = (tx_count_norm * 0.30) +
        (xlm_balance_norm * 0.25) +
        (account_age_norm * 0.25) +
        (counterparty_norm * 0.20)
score = clamp(score * 100, 0, 100)
```

### 10.6 Tier Thresholds

| Tier | Score Range | Leverage | Collateral |
|---|---|---|---|
| 1 (Basic) | 0–24 | 1x | 100% |
| 2 (Verified) | 25–49 | 2x | 60% |
| 3 (Trusted) | 50–74 | 5x | 30% |
| 4 (Premium) | 75–100 | 10x | 15% |

### 10.7 Circuit Artifacts

| File | Purpose | Location |
|---|---|---|
| `tier_proof.circom` | Circuit definition | `/circuits/` |
| `tier_proof.wasm` | Browser-compatible prover | `/public/circuits/` |
| `tier_proof.zkey` | Proving key (trusted setup) | `/public/circuits/` |
| `verification_key.json` | Verifying key (for Soroban init) | `/contracts/zk_verifier/` |
| `tier_proof_js/` | snarkjs helper (generate_witness) | `/public/circuits/` |

---

## 11. Frontend Specifications

### 11.1 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Wallet | `@stellar/freighter-api` |
| Stellar SDK | `@stellar/stellar-sdk` |
| ZK Proving | `snarkjs` (browser bundle) |
| State management | React Context + useState |
| Contract clients | Auto-generated via `stellar contract bindings typescript` |

### 11.2 Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `Home` | Landing page, product pitch, connect wallet CTA |
| `/prove` | `ProveAccess` | ZK proof generation flow |
| `/trade` | `TradeDashboard` | Open/close positions, view tier |
| `/positions` | `Positions` | List open positions |

### 11.3 Key UI Components

**ConnectWallet**
- Renders "Connect Freighter" button
- On connect: reads AccountID, checks existing tier from chain
- Shows tier badge if already verified

**ProveAccessFlow**
- Step 1: "Checking wallet activity..." (backend oracle call)
- Step 2: "Generating your ZK proof..." (snarkjs in browser)
- Step 3: "Submitting proof to Stellar..." (Soroban transaction)
- Step 4: "Access granted — Tier X" (success state)

**TierBadge**
- Displays user's current tier (1–4) with expiry
- Color coded: Gray → Green → Blue → Gold
- Hover: shows max leverage and collateral requirement

**SynthTradePanel**
- Asset selector: sAAPL / sTSLA / sNVDA
- Live price (from Reflector, polled every 10s)
- Collateral input
- Leverage slider (capped by tier)
- Estimated position size preview
- Open Position button → triggers Freighter signing

**PositionCard**
- Shows: asset, leverage, entry price, current price, PnL %
- Close button → triggers close_position → Freighter signing

### 11.4 Environment Variables

```
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID=C...
NEXT_PUBLIC_TIER_MANAGER_CONTRACT_ID=C...
NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID=C...
NEXT_PUBLIC_SYNTH_AAPL_CONTRACT_ID=C...
NEXT_PUBLIC_SYNTH_TSLA_CONTRACT_ID=C...
NEXT_PUBLIC_SYNTH_NVDA_CONTRACT_ID=C...
ORACLE_SIGNING_KEY=<baby_jubjub_private_key>
REFLECTOR_CONTRACT_ID=C...
```

---

## 12. Feature Requirements

### 12.1 Must-Have (P0 — Core Demo)

| ID | Feature | Description |
|---|---|---|
| F1 | Freighter wallet connection | Connect wallet, read AccountID |
| F2 | Backend oracle scoring | Read wallet activity, compute score, sign |
| F3 | In-browser ZK proof gen | snarkjs generates Groth16 proof |
| F4 | Soroban proof verification | ZKVerifier contract validates proof on Stellar |
| F5 | Tier assignment | TierManager stores wallet → tier |
| F6 | Tier display in UI | User sees their tier and max leverage |
| F7 | Open synthetic position | SynthVault opens position with tier leverage cap |
| F8 | Close synthetic position | SynthVault closes position, returns settlement |
| F9 | 3 synthetic assets | sAAPL, sTSLA, sNVDA supported |
| F10 | Testnet deployment | All contracts on Stellar testnet |

### 12.2 Should-Have (P1 — Polish)

| ID | Feature | Description |
|---|---|---|
| F11 | Live price display | Reflector oracle feeds real-time prices |
| F12 | PnL calculation | Show unrealized P/L on open positions |
| F13 | Proof expiry display | Show when tier expires, prompt re-prove |
| F14 | Position history | List closed positions with outcome |
| F15 | Tier upgrade path | UI explains how to get a higher tier |

### 12.3 Nice-to-Have (P2 — Stretch Goals)

| ID | Feature | Description |
|---|---|---|
| F16 | Nullifier audit | Admin can view nullifier usage without seeing private data |
| F17 | View key stub | Stub for auditor view key — shows architecture even if not fully built |
| F18 | Batch proof verification | Demonstrate Protocol 26 MSM for multiple proofs |
| F19 | Liquidation logic | Auto-close under-collateralized positions |
| F20 | DCA position opening | Scheduled position entry |

### 12.4 Out of Scope (Explicitly Cut)

- HSP (fee module) — no separate fee token
- 9+ synth assets — only 3 for the hackathon
- Liquidation bots — only manual close
- Mainnet deployment — testnet only
- Full mobile wallet support
- Cross-chain bridge

---

## 13. 5-Day Sprint Plan

### Day 1 — ZK Foundation (June 25)

**Goal:** Groth16 circuit compiles and Soroban verifier deployed to testnet.

**Tasks:**
- [ ] Set up Circom 2.0 and snarkjs locally
- [ ] Write `tier_proof.circom` — inputs, BabyJubjub sig verify, Poseidon nullifier, tier derivation
- [ ] Perform trusted setup (`snarkjs groth16 setup`, `snarkjs groth16 newzkey`)
- [ ] Export `.wasm`, `.zkey`, `verification_key.json`
- [ ] Write `zk_verifier` Soroban contract in Rust
- [ ] Implement `pairing_check` call using `soroban-sdk` BN254 host functions
- [ ] `cargo build --target wasm32-unknown-unknown`
- [ ] Deploy to Stellar testnet via `stellar contract deploy`
- [ ] Write test: generate proof with snarkjs, call verifier contract, assert valid

**Deliverable:** Verifier contract deployed, proof verification working end-to-end.

---

### Day 2 — Core Contracts (June 26)

**Goal:** TierManager and SynthVault deployed and functional.

**Tasks:**
- [ ] Write `tier_manager` Soroban contract
  - Structs: `TierRecord`
  - Functions: `set_tier`, `get_tier`, `get_max_leverage`, `is_tier_valid`
  - Only `zk_verifier` can call `set_tier` (auth check)
- [ ] Wire `zk_verifier → tier_manager` on valid proof
- [ ] Write `synth_vault` Soroban contract
  - Structs: `Position`
  - Functions: `open_position`, `close_position`, `get_positions`
  - Calls `tier_manager.get_max_leverage` before accepting leverage
  - Stub: use fixed price for now (replace with Reflector on Day 3)
- [ ] Write `synth_token` (SEP-0041) contract — 3 instances
- [ ] Deploy all 4 contracts to testnet
- [ ] Write integration test: prove → set tier → open position → close position

**Deliverable:** Full contract suite deployed, E2E flow passing in tests.

---

### Day 3 — Oracle + Token Flow (June 27)

**Goal:** Live prices from Reflector and full E2E flow working.

**Tasks:**
- [ ] Integrate Reflector oracle contract for sAAPL, sTSLA, sNVDA price feeds
- [ ] Write backend oracle (Express.js)
  - `GET /score?wallet=` — reads Stellar Horizon, computes score, signs
  - Baby Jubjub key pair setup
  - Returns `{ score, sig, expiry }`
- [ ] Test: backend oracle → snarkjs proof gen → verifier → tier → vault open → close
- [ ] Fix any contract interaction bugs found during E2E testing
- [ ] Document contract IDs and testnet addresses

**Deliverable:** Full E2E flow working with real oracle data and real Reflector prices.

---

### Day 4 — Frontend (June 28)

**Goal:** Browser-usable app with Freighter and full ZK flow.

**Tasks:**
- [ ] Scaffold Next.js 14 app
- [ ] Install: `@stellar/freighter-api`, `@stellar/stellar-sdk`, `snarkjs`
- [ ] Generate contract bindings: `stellar contract bindings typescript`
- [ ] Build `ConnectWallet` component
- [ ] Build `ProveAccessFlow` component (4-step stepper)
- [ ] Build `SynthTradePanel` component
- [ ] Build `PositionCard` and `Positions` page
- [ ] Build `TierBadge` component
- [ ] Wire all pages together
- [ ] Point at testnet contract IDs
- [ ] Test full golden path in browser end-to-end

**Deliverable:** Working web app, full golden path demoable in browser.

---

### Day 5 — Polish & Submit (June 29)

**Goal:** Record demo, clean README, submit by 12:00 PM PST.

**Tasks:**
- [ ] Final bug fixes from Day 4 testing
- [ ] Write `README.md`
  - What is Ztellar Edge
  - How ZK is used
  - How to run locally
  - Deployed contract addresses
  - Demo video link
  - Architecture diagram
- [ ] Record 2–3 minute demo video
  - Show: connect wallet → prove tier → see tier badge → open position → close position → show PnL
  - Narrate: what ZK is doing, what Stellar is doing
- [ ] Final commit and push to public GitHub repo
- [ ] Submit on DoraHacks with repo link + demo video link
- [ ] **Deadline: June 29, 12:00 PM PST**

---

## 14. Submission Requirements Checklist

| Requirement | Status | Notes |
|---|---|---|
| Open-source repo | Must do | Public GitHub with full source code |
| Clear README.md | Must do | What it is, how to run, what ZK does |
| Demo video (2–3 min) | Must do | Show proof flow + trading |
| ZK is load-bearing | Core feature | Proof → tier → leverage enforcement |
| Stellar integration | Core feature | Soroban contracts on testnet |
| Groth16/BN254 | Chosen approach | Uses Protocol 25 native host fns |

---

## 15. Out of Scope

These items are explicitly excluded from the hackathon submission to keep the build manageable:

| Feature | Reason Excluded |
|---|---|
| Mainnet deployment | Testnet sufficient for demo |
| Real liquidation bots | Adds infra complexity |
| HSP / fee module | Not essential for ZK story |
| 9+ synth assets | 3 is enough to demonstrate the system |
| Full mobile wallet | Freighter desktop is sufficient |
| Cross-chain bridge | Not relevant to core ZK claim |
| Privacy pool integration | Future extension |
| Confidential token amounts | Future extension aligned with Stellar roadmap |
| Recursive proof batching | Advanced Protocol 26 feature — mention in README as future |
| View key for auditors | Stub/mention in README, not implemented |

---

## Appendix A — Dependency List

### Soroban Contracts (Rust)
```toml
[dependencies]
soroban-sdk = "22.0.0"
```

### Frontend (Node.js)
```json
{
  "@stellar/freighter-api": "^2.x",
  "@stellar/stellar-sdk": "^12.x",
  "snarkjs": "^0.7.x",
  "next": "14.x",
  "react": "18.x",
  "typescript": "5.x",
  "tailwindcss": "3.x"
}
```

### Backend Oracle (Node.js)
```json
{
  "@stellar/stellar-sdk": "^12.x",
  "express": "^4.x",
  "babyjubjub": "^1.x"
}
```

### ZK Tooling
```
circom 2.0.x
snarkjs 0.7.x
node 20.x
```

---

## Appendix B — Key References

| Resource | URL |
|---|---|
| Circom Docs | https://docs.circom.io/ |
| snarkjs GitHub | https://github.com/iden3/snarkjs |
| Groth16 Verifier on Stellar | https://github.com/stellar/soroban-examples/tree/main/groth16_verifier |
| Circom on Stellar Tutorial | https://jamesbachini.com/circom-on-stellar/ |
| Soroban SDK Docs | https://developers.stellar.org/docs/build/smart-contracts |
| SEP-0041 Standard | https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md |
| Reflector Oracle | https://reflector.network |
| Freighter Wallet API | https://docs.freighter.app |
| Stellar Protocol 25 Notes | https://developers.stellar.org/docs/learn/fundamentals/stellar-protocol |
| Stellar Privacy Docs | https://developers.stellar.org/docs/learn/fundamentals/privacy |
| Stellar Hacks Hackathon | https://dorahacks.io/hackathon/stellar-hacks |
| Stellar Dev Discord | https://discord.gg/stellardev |

---

*Document prepared for Ztellar Edge — Stellar Hacks: Real-World ZK hackathon submission.*  
*Submission deadline: June 29, 2026, 12:00 PM PST.*
