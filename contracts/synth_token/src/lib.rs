#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    token, Address, Env, String,
};

// ──────────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────────
#[contracttype]
enum DataKey {
    Balance(Address),
    Allowance(AllowanceKey),
    Admin,
    Vault,       // synth_vault is allowed to mint/burn
    TokenName,
    TokenSymbol,
    Decimals,
    TotalSupply,
}

#[derive(Clone)]
#[contracttype]
struct AllowanceKey {
    from: Address,
    spender: Address,
}

#[derive(Clone)]
#[contracttype]
struct AllowanceValue {
    amount: i128,
    expiration_ledger: u32,
}

// ──────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InsufficientAllowance = 5,
    NegativeAmount = 6,
    AllowanceExpired = 7,
}

// ──────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────
#[contract]
pub struct SynthToken;

#[contractimpl]
impl SynthToken {
    /// Deploy and initialize the token (SEP-0041).
    pub fn init(
        env: Env,
        admin: Address,
        vault: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) -> Result<(), TokenError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TokenError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Vault, &vault);
        env.storage().instance().set(&DataKey::TokenName, &name);
        env.storage().instance().set(&DataKey::TokenSymbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        Ok(())
    }

    // ── SEP-0041 required read functions ────────────────────────────────

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::TokenName).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::TokenSymbol).unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(AllowanceKey { from, spender });
        let val: Option<AllowanceValue> = env.storage().temporary().get(&key);
        match val {
            Some(v) if v.expiration_ledger >= env.ledger().sequence() => v.amount,
            _ => 0,
        }
    }

    // ── SEP-0041 transfer functions ──────────────────────────────────────

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) -> Result<(), TokenError> {
        from.require_auth();
        if amount < 0 {
            return Err(TokenError::NegativeAmount);
        }
        let key = DataKey::Allowance(AllowanceKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        if amount == 0 {
            env.storage().temporary().remove(&key);
        } else {
            env.storage().temporary().set(
                &key,
                &AllowanceValue { amount, expiration_ledger },
            );
            env.storage().temporary().extend_ttl(
                &key,
                expiration_ledger.saturating_sub(env.ledger().sequence()),
                expiration_ledger.saturating_sub(env.ledger().sequence()),
            );
        }
        Ok(())
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        from.require_auth();
        if amount < 0 {
            return Err(TokenError::NegativeAmount);
        }
        Self::spend_balance(&env, from, to, amount)
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        spender.require_auth();
        if amount < 0 {
            return Err(TokenError::NegativeAmount);
        }
        let key = DataKey::Allowance(AllowanceKey {
            from: from.clone(),
            spender: spender.clone(),
        });
        let val: AllowanceValue = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(TokenError::InsufficientAllowance)?;
        if val.expiration_ledger < env.ledger().sequence() {
            return Err(TokenError::AllowanceExpired);
        }
        if val.amount < amount {
            return Err(TokenError::InsufficientAllowance);
        }
        let new_allowance = AllowanceValue {
            amount: val.amount - amount,
            expiration_ledger: val.expiration_ledger,
        };
        env.storage().temporary().set(&key, &new_allowance);
        Self::spend_balance(&env, from, to, amount)
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        from.require_auth();
        if amount < 0 {
            return Err(TokenError::NegativeAmount);
        }
        let bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if bal < amount {
            return Err(TokenError::InsufficientBalance);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(bal - amount));
        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));
        Ok(())
    }

    pub fn burn_from(
        env: Env,
        spender: Address,
        from: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        spender.require_auth();
        if amount < 0 {
            return Err(TokenError::NegativeAmount);
        }
        let key = DataKey::Allowance(AllowanceKey {
            from: from.clone(),
            spender,
        });
        let val: AllowanceValue = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(TokenError::InsufficientAllowance)?;
        if val.amount < amount {
            return Err(TokenError::InsufficientAllowance);
        }
        env.storage().temporary().set(
            &key,
            &AllowanceValue {
                amount: val.amount - amount,
                expiration_ledger: val.expiration_ledger,
            },
        );
        let bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if bal < amount {
            return Err(TokenError::InsufficientBalance);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(bal - amount));
        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));
        Ok(())
    }

    // ── Privileged: only vault can mint ─────────────────────────────────

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        let vault: Address = env
            .storage()
            .instance()
            .get(&DataKey::Vault)
            .ok_or(TokenError::NotInitialized)?;
        vault.require_auth();
        if amount < 0 {
            return Err(TokenError::NegativeAmount);
        }
        let bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(bal + amount));
        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + amount));
        Ok(())
    }

    // ── Admin: update vault address ──────────────────────────────────────

    pub fn set_vault(env: Env, new_vault: Address) -> Result<(), TokenError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TokenError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Vault, &new_vault);
        Ok(())
    }

    // ── Internal helpers ─────────────────────────────────────────────────

    fn spend_balance(
        env: &Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        let from_bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if from_bal < amount {
            return Err(TokenError::InsufficientBalance);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(from_bal - amount));
        let to_bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(to_bal + amount));
        Ok(())
    }
}
