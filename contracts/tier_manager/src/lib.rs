#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env};

// ──────────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────────
#[contracttype]
enum DataKey {
    TierRecord(Address),
    Verifier,
    Admin,
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
#[derive(Clone)]
#[contracttype]
pub struct TierRecord {
    pub tier: u32,    // 1, 2, 3, or 4
    pub expiry: u64,  // Unix timestamp seconds
}

// ──────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TierManagerError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidTier = 4,
    WalletNotVerified = 5,
}

// ──────────────────────────────────────────────
// Leverage caps per tier
// ──────────────────────────────────────────────
fn max_leverage(tier: u32) -> u32 {
    match tier {
        1 => 1,
        2 => 2,
        3 => 5,
        4 => 10,
        _ => 0,
    }
}

// ──────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────
#[contract]
pub struct TierManager;

#[contractimpl]
impl TierManager {
    /// Initialize with admin and the ZK verifier address that is allowed to
    /// call set_tier.
    pub fn init(
        env: Env,
        admin: Address,
        verifier: Address,
    ) -> Result<(), TierManagerError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TierManagerError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        Ok(())
    }

    /// Called by ZkVerifier after successful proof verification.
    /// Only the registered verifier contract may call this.
    pub fn set_tier(
        env: Env,
        wallet: Address,
        tier: u32,
        expiry: u64,
    ) -> Result<(), TierManagerError> {
        let verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::Verifier)
            .ok_or(TierManagerError::NotInitialized)?;

        // When ZkVerifier calls this, require_auth() passes because the
        // invoking contract (ZkVerifier) IS the verifier address.
        verifier.require_auth();

        if tier < 1 || tier > 4 {
            return Err(TierManagerError::InvalidTier);
        }

        let record = TierRecord { tier, expiry };
        env.storage()
            .persistent()
            .set(&DataKey::TierRecord(wallet), &record);
        Ok(())
    }

    /// Returns the TierRecord for a wallet, or None if not verified.
    pub fn get_tier(env: Env, wallet: Address) -> Option<TierRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::TierRecord(wallet))
    }

    /// Returns the maximum leverage cap for a wallet's current (non-expired) tier.
    /// Returns 0 if wallet is unverified or tier has expired.
    pub fn get_max_leverage(env: Env, wallet: Address) -> u32 {
        let record: Option<TierRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::TierRecord(wallet));
        match record {
            Some(r) if r.expiry > env.ledger().timestamp() => max_leverage(r.tier),
            _ => 0,
        }
    }

    /// Returns true if the wallet has a valid (non-expired) tier.
    pub fn is_tier_valid(env: Env, wallet: Address) -> bool {
        let record: Option<TierRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::TierRecord(wallet));
        match record {
            Some(r) => r.expiry > env.ledger().timestamp(),
            None => false,
        }
    }

    /// Admin can update the verifier address (e.g. after redeploying zk_verifier).
    pub fn set_verifier(
        env: Env,
        new_verifier: Address,
    ) -> Result<(), TierManagerError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TierManagerError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Verifier, &new_verifier);
        Ok(())
    }

    /// Returns the tier number (0 = unverified/expired).
    pub fn tier_of(env: Env, wallet: Address) -> u32 {
        let record: Option<TierRecord> = env
            .storage()
            .persistent()
            .get(&DataKey::TierRecord(wallet));
        match record {
            Some(r) if r.expiry > env.ledger().timestamp() => r.tier,
            _ => 0,
        }
    }
}
