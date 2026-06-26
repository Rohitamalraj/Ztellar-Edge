#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bls12_381::{Fr, Bls12381G1Affine, Bls12381G2Affine},
    vec, Address, BytesN, Env, Vec,
};

// ──────────────────────────────────────────────
// Public signal indices in the Groth16 proof
// ──────────────────────────────────────────────
// Circom outputs first, then public inputs.  nPublic = 5.
// Index 0: nullifier         — Poseidon(wallet_secret, 1)         [output]
// Index 1: wallet_commitment — Poseidon(wallet_secret, wallet_address) [output]
// Index 2: tier              — 1, 2, 3, or 4                      [output]
// Index 3: wallet_address    — Stellar public key as field element [public input]
// Index 4: expiry            — Unix timestamp (seconds)           [public input]
pub const SIG_NULLIFIER: u32 = 0;
pub const SIG_WALLET_COMMITMENT: u32 = 1;
pub const SIG_TIER: u32 = 2;
pub const SIG_WALLET_ADDRESS: u32 = 3;
pub const SIG_EXPIRY: u32 = 4;
pub const NUM_PUBLIC_SIGNALS: u32 = 5;

// ──────────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────────
#[contracttype]
enum DataKey {
    Vk,
    Nullifier(BytesN<32>),
    TierManager,
    Admin,
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: Bls12381G1Affine,
    pub beta: Bls12381G2Affine,
    pub gamma: Bls12381G2Affine,
    pub delta: Bls12381G2Affine,
    pub ic: Vec<Bls12381G1Affine>, // length = NUM_PUBLIC_SIGNALS + 1
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: Bls12381G1Affine,
    pub b: Bls12381G2Affine,
    pub c: Bls12381G1Affine,
}

// ──────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ZkVerifierError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    MalformedVerifyingKey = 3,
    InvalidProof = 4,
    NullifierAlreadyUsed = 5,
    ProofExpired = 6,
    Unauthorized = 7,
}

// ──────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────
#[contract]
pub struct ZkVerifier;

#[contractimpl]
impl ZkVerifier {
    /// Initialize the verifier with the Groth16 verification key and the
    /// address of the TierManager contract it will call on success.
    pub fn init(
        env: Env,
        admin: Address,
        vk: VerificationKey,
        tier_manager: Address,
    ) -> Result<(), ZkVerifierError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ZkVerifierError::AlreadyInitialized);
        }
        if vk.ic.len() != NUM_PUBLIC_SIGNALS + 1 {
            return Err(ZkVerifierError::MalformedVerifyingKey);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Vk, &vk);
        env.storage().instance().set(&DataKey::TierManager, &tier_manager);
        Ok(())
    }

    /// Verify a Groth16 ZK proof and, if valid, register the tier on the
    /// TierManager contract.
    ///
    /// `pub_signals` order must match the circuit output order:
    ///   [nullifier, wallet_commitment, tier, expiry]
    pub fn verify_and_register(
        env: Env,
        wallet: Address,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> Result<u32, ZkVerifierError> {
        // ── 1. Load VK ──────────────────────────────────────────────────
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(ZkVerifierError::NotInitialized)?;

        // ── 2. Validate signal count ────────────────────────────────────
        if pub_signals.len() != NUM_PUBLIC_SIGNALS {
            return Err(ZkVerifierError::MalformedVerifyingKey);
        }

        // ── 3. Extract and validate expiry ──────────────────────────────
        let expiry_fr: Fr = pub_signals.get(SIG_EXPIRY).unwrap();
        let expiry_secs = expiry_fr.to_u256().to_u128().unwrap_or(0) as u64;
        let now = env.ledger().timestamp();
        if expiry_secs <= now {
            return Err(ZkVerifierError::ProofExpired);
        }

        // ── 4. Check nullifier not already used ─────────────────────────
        let nullifier_fr: Fr = pub_signals.get(SIG_NULLIFIER).unwrap();
        let nullifier_bytes: BytesN<32> = nullifier_fr.to_bytes();
        if env
            .storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier_bytes.clone()))
        {
            return Err(ZkVerifierError::NullifierAlreadyUsed);
        }

        // ── 5. Compute vk_x = ic[0] + Σ (pub_signals[i] * ic[i+1]) ────
        let bls = env.crypto().bls12_381();
        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(ZkVerifierError::MalformedVerifyingKey);
        }
        let mut vk_x: Bls12381G1Affine = vk.ic.get(0).unwrap();
        for i in 0..pub_signals.len() {
            let s: Fr = pub_signals.get(i).unwrap();
            let v: Bls12381G1Affine = vk.ic.get(i + 1).unwrap();
            let prod = bls.g1_mul(&v, &s);
            vk_x = bls.g1_add(&vk_x, &prod);
        }

        // ── 6. Pairing check: e(-A,B)·e(α,β)·e(vk_x,γ)·e(C,δ) == 1 ──
        let neg_a = -proof.a;
        let vp1 = vec![&env, neg_a, vk.alpha, vk_x, proof.c];
        let vp2 = vec![&env, proof.b, vk.beta, vk.gamma, vk.delta];
        let valid = bls.pairing_check(vp1, vp2);
        if !valid {
            return Err(ZkVerifierError::InvalidProof);
        }

        // ── 7. Mark nullifier as spent ──────────────────────────────────
        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(nullifier_bytes), &true);

        // ── 8. Extract tier and call TierManager ────────────────────────
        let tier_fr: Fr = pub_signals.get(SIG_TIER).unwrap();
        let tier = tier_fr.to_u256().to_u128().unwrap_or(0) as u32;

        let tier_manager: Address = env
            .storage()
            .instance()
            .get(&DataKey::TierManager)
            .unwrap();

        let client = TierManagerClient::new(&env, &tier_manager);
        client.set_tier(&wallet, &tier, &expiry_secs);

        Ok(tier)
    }

    /// Check if a nullifier has already been spent.
    pub fn is_nullifier_used(env: Env, nullifier_bytes: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier_bytes))
    }

    /// Admin can update the TierManager address.
    pub fn set_tier_manager(
        env: Env,
        new_tier_manager: Address,
    ) -> Result<(), ZkVerifierError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ZkVerifierError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::TierManager, &new_tier_manager);
        Ok(())
    }

    /// Get the current TierManager contract address.
    pub fn tier_manager(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::TierManager)
    }
}

// ──────────────────────────────────────────────
// TierManager client (cross-contract call)
// ──────────────────────────────────────────────
mod tier_manager_interface {
    soroban_sdk::contractimport!(
        file = "../target/wasm32v1-none/release/ztellar_tier_manager.wasm"
    );
}
use tier_manager_interface::Client as TierManagerClient;
