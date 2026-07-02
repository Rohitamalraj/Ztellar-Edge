#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, Vec,
};

// ──────────────────────────────────────────────
// Vault cross-contract client (typed via import)
// ──────────────────────────────────────────────
mod vault_contract {
    soroban_sdk::contractimport!(
        file = "../target/wasm32v1-none/release/ztellar_synth_vault.wasm"
    );
}
use vault_contract::Client as VaultClient;

// ──────────────────────────────────────────────
// SIP data
// ──────────────────────────────────────────────

/// Stores one SIP configuration per user per asset.
#[derive(Clone)]
#[contracttype]
pub struct Sip {
    pub id: u64,
    pub user: Address,
    pub asset: u32,           // asset ID matching vault (0=sAAPL, 1=sTSLA …)
    pub amount: i128,         // per-installment USDC, 7-decimal (e.g. 10 USDC = 100_000_000)
    pub period: u64,          // seconds between investments (min 60)
    pub next_due: u64,        // unix ledger timestamp of next due investment
    pub count: u32,           // installments completed
    pub total_invested: i128, // cumulative USDC invested, 7-decimal
    pub active: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Vault,
    NextId,
    Sip(u64),
    UserSips(Address),
}

// ──────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────

#[contract]
pub struct SipContract;

#[contractimpl]
impl SipContract {
    pub fn init(env: Env, admin: Address, vault: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Vault, &vault);
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    /// Create a new SIP. No USDC is transferred at creation — each
    /// installment is pulled when `invest` is called.
    pub fn create_sip(
        env: Env,
        user: Address,
        asset: u32,
        amount: i128,  // 7-decimal USDC per installment
        period: u64,   // seconds
    ) -> u64 {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        if period < 60 {
            panic!("period must be >= 60 seconds");
        }
        if asset >= 12 {
            panic!("invalid asset");
        }

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);

        let sip = Sip {
            id,
            user: user.clone(),
            asset,
            amount,
            period,
            next_due: env.ledger().timestamp(), // first installment due immediately
            count: 0,
            total_invested: 0,
            active: true,
        };
        env.storage().persistent().set(&DataKey::Sip(id), &sip);

        let mut user_sips: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserSips(user.clone()))
            .unwrap_or(Vec::new(&env));
        user_sips.push_back(id);
        env.storage().persistent().set(&DataKey::UserSips(user), &user_sips);

        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    /// Execute the next SIP installment. Calls vault.open_position on behalf of
    /// the user (1x LONG). User must sign — assembleTransaction builds the full
    /// auth tree covering this call, the vault sub-invocation, and the USDC
    /// transfer in one Freighter signing step.
    pub fn invest(env: Env, sip_id: u64) {
        let mut sip: Sip = env
            .storage()
            .persistent()
            .get(&DataKey::Sip(sip_id))
            .expect("SIP not found");

        sip.user.require_auth();

        if !sip.active {
            panic!("SIP is cancelled");
        }
        let now = env.ledger().timestamp();
        if now < sip.next_due {
            panic!("SIP not due yet");
        }

        let vault_id: Address = env.storage().instance().get(&DataKey::Vault).unwrap();
        // Open a 1x LONG position in the vault. The vault pulls USDC directly
        // from sip.user — the user's auth covers this sub-invocation automatically.
        VaultClient::new(&env, &vault_id)
            .open_position(&sip.user, &sip.asset, &0u32, &1u32, &sip.amount);

        sip.next_due += sip.period;
        sip.count += 1;
        sip.total_invested += sip.amount;
        env.storage().persistent().set(&DataKey::Sip(sip_id), &sip);
    }

    pub fn cancel_sip(env: Env, sip_id: u64) {
        let mut sip: Sip = env
            .storage()
            .persistent()
            .get(&DataKey::Sip(sip_id))
            .expect("SIP not found");
        sip.user.require_auth();
        sip.active = false;
        env.storage().persistent().set(&DataKey::Sip(sip_id), &sip);
    }

    pub fn get_sip(env: Env, sip_id: u64) -> Option<Sip> {
        env.storage().persistent().get(&DataKey::Sip(sip_id))
    }

    pub fn get_user_sips(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserSips(user))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_vault(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Vault)
    }
}
