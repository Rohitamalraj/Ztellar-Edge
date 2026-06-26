#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    Address, Env, Vec,
};

// ──────────────────────────────────────────────
// Supported synthetic assets
// ──────────────────────────────────────────────
// sAAPL = 0, sTSLA = 1, sNVDA = 2
pub const ASSET_AAPL: u32 = 0;
pub const ASSET_TSLA: u32 = 1;
pub const ASSET_NVDA: u32 = 2;

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
    Position(u64),                 // position_id → Position
    WalletPositions(Address),      // wallet → Vec<u64> (position IDs)
    NextId,
    Admin,
    TierManager,
    // Price feeds keyed by asset id (set by admin/oracle for demo)
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
    pub asset: u32,         // ASSET_AAPL / ASSET_TSLA / ASSET_NVDA
    pub direction: u32,     // DIR_LONG / DIR_SHORT
    pub leverage: u32,      // e.g. 2 (= 2x)
    pub entry_price: i128,  // price in micro-USDC (6 decimals)
    pub collateral: i128,   // micro-USDC
    pub opened_at: u64,     // ledger timestamp
}

// ──────────────────────────────────────────────
// Errors
// ──────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    WalletNotVerified = 4,
    LeverageExceedsTierCap = 5,
    InvalidAsset = 6,
    InvalidLeverage = 7,
    InvalidCollateral = 8,
    PositionNotFound = 9,
    NotPositionOwner = 10,
}

// ──────────────────────────────────────────────
// Contract
// ──────────────────────────────────────────────
#[contract]
pub struct SynthVault;

#[contractimpl]
impl SynthVault {
    /// Initialize the vault with the TierManager contract address.
    pub fn init(
        env: Env,
        admin: Address,
        tier_manager: Address,
    ) -> Result<(), VaultError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(VaultError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TierManager, &tier_manager);
        env.storage().instance().set(&DataKey::NextId, &0u64);
        // Seed mock prices (6 decimals): AAPL=$192.35, TSLA=$248.12, NVDA=$875.44
        env.storage().instance().set(&DataKey::Price(ASSET_AAPL), &192_350_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_TSLA), &248_120_000i128);
        env.storage().instance().set(&DataKey::Price(ASSET_NVDA), &875_440_000i128);
        Ok(())
    }

    /// Admin updates an asset price (micro-USDC, 6 decimals).
    /// In production this would be called by the Reflector oracle adapter.
    pub fn set_price(env: Env, asset: u32, price: i128) -> Result<(), VaultError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(VaultError::NotInitialized)?;
        admin.require_auth();
        if asset > ASSET_NVDA {
            return Err(VaultError::InvalidAsset);
        }
        env.storage().instance().set(&DataKey::Price(asset), &price);
        Ok(())
    }

    /// Admin can update the TierManager address.
    pub fn set_tier_manager(
        env: Env,
        new_tier_manager: Address,
    ) -> Result<(), VaultError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(VaultError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::TierManager, &new_tier_manager);
        Ok(())
    }

    /// Get the current price for an asset in micro-USDC (6 decimals).
    pub fn get_price(env: Env, asset: u32) -> Result<i128, VaultError> {
        env.storage()
            .instance()
            .get(&DataKey::Price(asset))
            .ok_or(VaultError::InvalidAsset)
    }

    /// Open a leveraged synthetic position.
    /// Requires caller to have a valid ZK-verified tier with sufficient leverage cap.
    pub fn open_position(
        env: Env,
        wallet: Address,
        asset: u32,
        direction: u32,
        leverage: u32,
        collateral: i128,
    ) -> Result<u64, VaultError> {
        wallet.require_auth();

        if asset > ASSET_NVDA {
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

        // ── Check tier leverage cap ──────────────────────────────────────
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

        // ── Fetch entry price ────────────────────────────────────────────
        let entry_price: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Price(asset))
            .ok_or(VaultError::InvalidAsset)?;

        // ── Create position ──────────────────────────────────────────────
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0u64);
        let next_id = id + 1;
        env.storage().instance().set(&DataKey::NextId, &next_id);

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
        env.storage()
            .persistent()
            .set(&DataKey::Position(id), &position);

        // ── Track wallet's position IDs ──────────────────────────────────
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::WalletPositions(wallet.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        ids.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::WalletPositions(wallet), &ids);

        Ok(id)
    }

    /// Close a position and return the PnL (signed, in micro-USDC).
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

        // PnL = collateral * leverage * (price_change / entry_price)
        // price_change = current - entry (or entry - current for shorts)
        let raw_change = current_price - position.entry_price;
        let signed_change = if position.direction == DIR_SHORT {
            -raw_change
        } else {
            raw_change
        };
        // Use i128 arithmetic (6-decimal fixed point)
        let pnl = position.collateral * (position.leverage as i128) * signed_change
            / position.entry_price;

        // ── Remove position ──────────────────────────────────────────────
        env.storage()
            .persistent()
            .remove(&DataKey::Position(position_id));
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::WalletPositions(wallet.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        // Remove the id from the vector
        let mut new_ids: Vec<u64> = Vec::new(&env);
        for eid in ids.iter() {
            if eid != position_id {
                new_ids.push_back(eid);
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::WalletPositions(wallet), &new_ids);

        Ok(pnl)
    }

    /// Returns a single position by ID.
    pub fn get_position(env: Env, position_id: u64) -> Option<Position> {
        env.storage()
            .persistent()
            .get(&DataKey::Position(position_id))
    }

    /// Returns all position IDs for a wallet.
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
