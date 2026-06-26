pragma circom 2.1.9;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

/*
 * TierProof circuit — Ztellar Edge
 *
 * Proves that a wallet's score falls into a tier WITHOUT revealing the score.
 *
 * Private inputs:
 *   wallet_secret  — 248-bit secret known only to the user
 *   score          — oracle-assigned score in [0, 100]
 *
 * Public inputs:
 *   wallet_address — Stellar public key (as field element)
 *   expiry         — Unix timestamp until this proof is valid
 *
 * Public outputs (signals):
 *   nullifier         = Poseidon(wallet_secret, 1)
 *   wallet_commitment = Poseidon(wallet_secret, wallet_address)
 *   tier              = 1|2|3|4 determined by score ranges
 *
 * Tier ranges:
 *   Tier 1:  0 <= score < 25   → max 1x leverage
 *   Tier 2: 25 <= score < 50   → max 2x leverage
 *   Tier 3: 50 <= score < 75   → max 5x leverage
 *   Tier 4: 75 <= score <= 100 → max 10x leverage
 *
 * Note: Compile with: circom tier_proof.circom --r1cs --wasm --sym --curve bls12381
 * The BLS12-381 Poseidon round constants must be regenerated for production.
 * For the hackathon demo, standard circomlib Poseidon is used for rapid prototyping.
 */
template TierProof() {
    // ── Private inputs ──────────────────────────────────────────────────
    signal input wallet_secret;
    signal input score;

    // ── Public inputs ───────────────────────────────────────────────────
    signal input wallet_address;
    signal input expiry;

    // ── Public outputs ──────────────────────────────────────────────────
    signal output nullifier;
    signal output wallet_commitment;
    signal output tier;

    // ── 1. Compute nullifier = Poseidon(wallet_secret, 1) ───────────────
    component null_hash = Poseidon(2);
    null_hash.inputs[0] <== wallet_secret;
    null_hash.inputs[1] <== 1;
    nullifier <== null_hash.out;

    // ── 2. Compute wallet_commitment = Poseidon(wallet_secret, wallet_address)
    component commit_hash = Poseidon(2);
    commit_hash.inputs[0] <== wallet_secret;
    commit_hash.inputs[1] <== wallet_address;
    wallet_commitment <== commit_hash.out;

    // ── 3. Constrain score to [0, 100] ──────────────────────────────────
    // 7 bits is sufficient (2^7 = 128 > 100)
    component range_check = LessEqThan(7);
    range_check.in[0] <== score;
    range_check.in[1] <== 100;
    range_check.out === 1;

    // ── 4. Tier derivation using comparators ─────────────────────────────
    component lt25 = LessThan(7);
    lt25.in[0] <== score;
    lt25.in[1] <== 25;

    component lt50 = LessThan(7);
    lt50.in[0] <== score;
    lt50.in[1] <== 50;

    component lt75 = LessThan(7);
    lt75.in[0] <== score;
    lt75.in[1] <== 75;

    // Binary flags per tier (exactly one is 1)
    signal tier4_flag <== 1 - lt75.out;
    signal tier3_flag <== lt75.out - lt50.out;
    signal tier2_flag <== lt50.out - lt25.out;
    signal tier1_flag <== lt25.out;

    // Sum of flags must equal 1 (sanity: exactly one tier)
    signal flags_sum <== tier1_flag + tier2_flag + tier3_flag + tier4_flag;
    flags_sum === 1;

    // tier = 1*t1 + 2*t2 + 3*t3 + 4*t4
    // Use intermediate signals to avoid non-quadratic constraints
    signal t2_contrib <== 2 * tier2_flag;
    signal t3_contrib <== 3 * tier3_flag;
    signal t4_contrib <== 4 * tier4_flag;

    tier <== tier1_flag + t2_contrib + t3_contrib + t4_contrib;

    // ── 5. Constrain expiry to be positive (basic sanity) ───────────────
    // Actual expiry check happens on-chain vs ledger timestamp
    component expiry_positive = GreaterThan(64);
    expiry_positive.in[0] <== expiry;
    expiry_positive.in[1] <== 0;
    expiry_positive.out === 1;

    // ── 6. Prevent wallet_secret = 0 (trivial secret) ───────────────────
    signal secret_inv;
    secret_inv <-- 1 / wallet_secret;
    wallet_secret * secret_inv === 1;
}

component main {public [wallet_address, expiry]} = TierProof();
