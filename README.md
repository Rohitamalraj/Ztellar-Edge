# Ztellar Edge

**Privacy-preserving synthetic stock trading on Stellar — Stellar Hacks: Real-World ZK submission**

Users prove their wallet activity score falls into a tier (1–4) using a Groth16 ZK proof verified on-chain by a Soroban smart contract via Stellar's native BLS12-381 host functions. The verified tier determines their maximum leverage when trading synthetic stocks (sAAPL, sTSLA, sNVDA).

---

## Architecture

```
Browser (snarkjs)          Stellar Testnet
┌─────────────────┐       ┌──────────────────────────────────────────┐
│ Wallet Activity │       │                                          │
│   → Score       │       │  ZK Verifier (Groth16 + BLS12-381)      │
│   → ZK Proof   │──────▶│    ↓ verify_and_register()              │
│   (in-browser) │       │  Tier Manager (tier 1-4, 30-day expiry)  │
└─────────────────┘       │    ↓ open_position()                    │
                          │  Synth Vault (sAAPL / sTSLA / sNVDA)    │
                          └──────────────────────────────────────────┘
```

### Tiers

| Tier | Score | Max Leverage |
|------|-------|-------------|
| 1 | 0–24 | 1× |
| 2 | 25–49 | 2× |
| 3 | 50–74 | 5× |
| 4 | 75–100 | 10× |

---

## Repo Structure

```
├── PRD.md                    Full product requirements document
├── circuits/
│   ├── tier_proof.circom     Groth16 circuit (BLS12-381, 573 constraints)
│   ├── scripts/
│   │   ├── compile.sh        circom compile
│   │   ├── setup.sh          Powers of Tau + zkey generation
│   │   └── test_proof.js     End-to-end proof test
│   └── package.json
├── contracts/
│   ├── Cargo.toml            Soroban workspace
│   ├── zk_verifier/          Groth16 on-chain verifier (BLS12-381)
│   ├── tier_manager/         Stores verified tiers per wallet
│   ├── synth_vault/          Leveraged synthetic position engine
│   ├── synth_token/          SEP-0041 fungible token (sAAPL/sTSLA/sNVDA)
│   └── scripts/
│       ├── deploy.sh         Testnet deployment
│       └── init_verifier.js  Upload Groth16 VK to ZK Verifier contract
└── frontend/                 Next.js 16 + Tailwind + shadcn/ui
    ├── app/
    │   ├── page.tsx           Landing page
    │   ├── prove/             ZK tier verification flow
    │   ├── trade/             Trading dashboard
    │   └── api/score/         Wallet scoring oracle (Horizon)
    ├── components/
    │   ├── landing/           Animated landing sections
    │   ├── dashboard/         Trading UI (markets, chart, form, positions)
    │   └── zk/                Prove flow + tier badge
    └── lib/
        ├── zk/generate-proof.ts  snarkjs in-browser proof generation
        └── stellar.ts             Soroban contract interaction + BLS byte encoding
```

---

## Testnet Contracts

| Contract | Address |
|----------|---------|
| ZK Verifier | `CCXWUFODL5BLHM4IIFGCUVLLTTWFKG7CO4S2A6EYWHO3YKT4EPRPCA23` |
| Tier Manager | `CC7EF4NGJDLQECANFXHXA32UAHYQKVU6Z57COFSR2WIB5TMQL3G4EKQF` |
| Synth Vault | `CDJUUXRCKJFLOGTQ77Z4VOZRPTZG2X5VB3IQAZRG6CSCONJAK57TU45X` |
| sAAPL | `CCJ2FSS234EZB7LE2JZLLRZXEVDX4QIN2GMK7EDA5XXNCNPYSQYOGYXX` |
| sTSLA | `CD4HYGTAL7EZRYCGAPIXILCFZDN4RYLGJN4SYYIVHY56OAFWDVADDQZ4` |
| sNVDA | `CBHBEHJD2GSHSQY2MVJ464KZDL3QOZWZBQABP2VSFVRJQ4BUBXVJLTTK` |

---

## Local Setup

### Prerequisites
- Node.js 18+, Rust (stable), circom 2.x, Stellar CLI 27+

### Frontend
```bash
cd frontend
cp .env.local.example .env.local   # fill in contract IDs above
npm install
npm run dev                         # http://localhost:3000
```

### Circuit (regenerate proving keys)
```bash
cd circuits
npm install
bash scripts/compile.sh
bash scripts/setup.sh
cp build/tier_proof_js/tier_proof.wasm ../frontend/public/zk/
cp keys/tier_proof_0001.zkey ../frontend/public/zk/
cp keys/verification_key.json ../frontend/public/zk/
node scripts/test_proof.js
```

### Contracts (rebuild)
```bash
cd contracts
stellar contract build --package ztellar-tier-manager
stellar contract build --package ztellar-zk-verifier
stellar contract build --package ztellar-synth-vault
stellar contract build --package ztellar-synth-token
```

---

## Stellar Stack

| Stellar Technology | Usage |
|---|---|
| **Soroban smart contracts** | ZK verifier, tier manager, vault, tokens |
| **BLS12-381 host functions** | `g1_add`, `g1_mul`, `pairing_check` — native Groth16 |
| **SEP-0041** | Synthetic token standard (sAAPL/sTSLA/sNVDA) |
| **Stellar Horizon** | Wallet scoring oracle (tx history, balances) |
| **Freighter wallet** | In-browser signing via `@stellar/freighter-api` |
| **Soroban RPC** | Transaction simulation and submission |

---

Built for **Stellar Hacks: Real-World ZK** hackathon.
