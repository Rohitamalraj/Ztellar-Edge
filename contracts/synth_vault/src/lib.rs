#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    token, Address, Env, Vec,
};

// ──────────────────────────────────────────────
// Supported synthetic assets  (asset id = index)
// ──────────────────────────────────────────────
pub const ASSET_AAPL: u32 = 0;
pub const ASSET_TSLA: u32 = 1;
pub const ASSET_NVDA: u32 = 2;
pub const ASSET_MSFT: u32 = 3;
pub const ASSET_AMZN: u32 = 4;
pub const ASSET_GOOG: u32 = 5;
pub const ASSET_META: u32 = 6;
pub const ASSET_NFLX: u32 = 7;
pub const ASSET_AMD:  u32 = 8;
pub const ASSET_JPM:  u32 = 9;
pub const ASSET_SPY:  u32 = 10;
pub const ASSET_PFE:  u32 = 11;
pub const ASSET_COUNT: u32 = 12;

// ──────────────────────────────────────────────
// Direction: Long = 0, Short = 1
// ──────────────────────────────────────────────
pub const DIR_LONG:  u32 = 0;
pub const DIR_SHORT: u32 = 1;

// ──────────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────────
#[contracttype]
enum DataKey {
    Position(u64),
    WalletPositions(Address),
    NextId,
    Admin,
    TierManager,
    UsdcToken,
    Price(u32),
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
#[derive(Clone)]
#[contracttype]
pub struct Position {
    pub id: u64,
    pub wallet: Address,
    pub asset: u32,
    pub direction: u32,
    pub leverage: u32,
    pub entry_price: i128,  // micro-USD (6 decimals)
    pub collateral: i128,   // micro-USDC (6 decimals)
    pub opened_at: u64,
}

// ──────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized     = 1,
    NotInitialized         = 2,
    Unauthorized           = 3,
    WalletNotVerified      = 4,
    LeverageExceedsTierCap = 5,
    InvalidAsset           = 6,
    InvalidLeverage        = 7,
    InvalidCollateral      = 8,
    PositionNotFound       = 9,
    NotPositionOwner       = 10,
}

// ──────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────
#[contract]
pub struct SynthVault;

#[contractimpl]
impl SynthVault {
    pub fn init(
        env: Env,
        admin: Address,
        tier_manager: Address,
        usdc_token: Address,
    ) -> Result<(), VaultError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(VaultError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TierManager, &tier_manager);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::NextId, &0u64);

        // Seed prices in micro-USD (price * 1_000_000)
        env.storage().instance().set(&DataKey::Price(ASSET_AAPL), &211_450_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_TSLA), &248_120_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_NVDA), &135_800_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_MSFT), &452_860_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_AMZN), &215_450_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_GOOG), &185_370_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_META), &681_420_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_NFLX), &1_291_500_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_AMD),  &172_180_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_JPM),  &272_900_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_SPY),  &594_200_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_PFE),  &25_100_000i128);
        Ok(())
    }

    /// Admin or oracle updates an asset price (micro-USD, 6 decimals).
    pub fn set_price(env: Env, asset: u32, price: i128) -> Result<(), VaultError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(VaultError::NotInitialized)?;
        admin.require_auth();
        if asset >= ASSET_COUNT {
            return Err(VaultError::InvalidAsset);
        }
        env.storage().instance().set(&DataKey::Price(asset), &price);
        Ok(())
    }

    pub fn set_tier_manager(env: Env, new_tier_manager: Address) -> Result<(), VaultError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(VaultError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::TierManager, &new_tier_manager);
        Ok(())
    }

    pub fn get_price(env: Env, asset: u32) -> Result<i128, VaultError> {
        env.storage()
            .instance()
            .get(&DataKey::Price(asset))
            .ok_or(VaultError::InvalidAsset)
    }

    /// Bulk-update all 12 asset prices in one TX (used by price oracle).
    /// prices must be exactly ASSET_COUNT elements, micro-USD (6 decimals).
    pub fn set_prices(env: Env, prices: Vec<i128>) -> Result<(), VaultError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(VaultError::NotInitialized)?;
        admin.require_auth();
        if prices.len() != ASSET_COUNT {
            return Err(VaultError::InvalidAsset);
        }
        for i in 0..ASSET_COUNT {
            let price = prices.get(i).unwrap();
            if price > 0 {
                env.storage().instance().set(&DataKey::Price(i), &price);
            }
        }
        Ok(())
    }

    pub fn get_usdc_token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::UsdcToken)
    }

    pub fn get_vault_usdc_balance(env: Env) -> i128 {
        let usdc: Address = match env.storage().instance().get(&DataKey::UsdcToken) {
            Some(a) => a,
            None => return 0,
        };
        token::Client::new(&env, &usdc).balance(&env.current_contract_address())
    }

    pub fn open_position(
        env: Env,
        wallet: Address,
        asset: u32,
        direction: u32,
        leverage: u32,
        collateral: i128,
    ) -> Result<u64, VaultError> {
        wallet.require_auth();

        if asset >= ASSET_COUNT {
            return Err(VaultError::InvalidAsset);
        }
        if direction > DIR_SHORT {
            return Err(VaultError::InvalidLeverage);
        }
        if leverage < 1 || leverage > 10 {
            return Err(VaultError::InvalidLeverage);
        }
        if collateral <= 0 {
            return Err(VaultError::InvalidCollateral);
        }

        let tier_manager: Address = env
            .storage()
            .instance()
            .get(&DataKey::TierManager)
            .ok_or(VaultError::NotInitialized)?;
        let tm_client = TierManagerClient::new(&env, &tier_manager);
        let max_lev = tm_client.get_max_leverage(&wallet);
        if max_lev == 0 {
            return Err(VaultError::WalletNotVerified);
        }
        if leverage > max_lev {
            return Err(VaultError::LeverageExceedsTierCap);
        }

        // Pull USDC collateral from wallet into vault.
        // The wallet must authorize this sub-invocation — assembleTransaction
        // and Freighter handle this automatically in one signing step.
        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .ok_or(VaultError::NotInitialized)?;
        token::Client::new(&env, &usdc)
            .transfer(&wallet, &env.current_contract_address(), &collateral);

        let entry_price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Price(asset))
            .ok_or(VaultError::InvalidAsset)?;

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0u64);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        let position = Position {
            id,
            wallet: wallet.clone(),
            asset,
            direction,
            leverage,
            entry_price,
            collateral,
            opened_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::Position(id), &position);

        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::WalletPositions(wallet.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        ids.push_back(id);
        env.storage().persistent().set(&DataKey::WalletPositions(wallet), &ids);

        Ok(id)
    }

    pub fn close_position(
        env: Env,
        wallet: Address,
        position_id: u64,
    ) -> Result<i128, VaultError> {
        wallet.require_auth();

        let position: Position = env
            .storage()
            .persistent()
            .get(&DataKey::Position(position_id))
            .ok_or(VaultError::PositionNotFound)?;

        if position.wallet != wallet {
            return Err(VaultError::NotPositionOwner);
        }

        let current_price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Price(position.asset))
            .ok_or(VaultError::InvalidAsset)?;

        let raw_change = current_price - position.entry_price;
        let signed_change = if position.direction == DIR_SHORT { -raw_change } else { raw_change };
        let pnl = position.collateral * (position.leverage as i128) * signed_change
            / position.entry_price;

        // Return collateral + PnL (capped at 0 on loss, capped at vault balance on win)
        let gross = position.collateral + pnl;
        let usdc: Address = env
            .storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .ok_or(VaultError::NotInitialized)?;
        let usdc_client = token::Client::new(&env, &usdc);
        if gross > 0 {
            let vault_bal = usdc_client.balance(&env.current_contract_address());
            let return_amount = if gross <= vault_bal { gross } else { vault_bal };
            if return_amount > 0 {
                usdc_client.transfer(&env.current_contract_address(), &wallet, &return_amount);
            }
        }

        env.storage().persistent().remove(&DataKey::Position(position_id));

        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::WalletPositions(wallet.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        let mut new_ids: Vec<u64> = Vec::new(&env);
        for eid in ids.iter() {
            if eid != position_id {
                new_ids.push_back(eid);
            }
        }
        env.storage().persistent().set(&DataKey::WalletPositions(wallet), &new_ids);

        Ok(pnl)
    }

    pub fn get_position(env: Env, position_id: u64) -> Option<Position> {
        env.storage().persistent().get(&DataKey::Position(position_id))
    }

    pub fn get_wallet_positions(env: Env, wallet: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::WalletPositions(wallet))
            .unwrap_or_else(|| Vec::new(&env))
    }
}

// ──────────────────────────────────────────────
// TierManager cross-contract client
// ──────────────────────────────────────────────
mod tier_manager_interface {
    soroban_sdk::contractimport!(
        file = "../target/wasm32v1-none/release/ztellar_tier_manager.wasm"
    );
}
use tier_manager_interface::Client as TierManagerClient;
