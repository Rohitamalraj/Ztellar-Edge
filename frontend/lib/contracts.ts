export const CONTRACTS = {
  ZK_VERIFIER:   process.env.NEXT_PUBLIC_ZK_VERIFIER_CONTRACT_ID   ?? "",
  TIER_MANAGER:  process.env.NEXT_PUBLIC_TIER_MANAGER_CONTRACT_ID  ?? "",
  SYNTH_VAULT:   process.env.NEXT_PUBLIC_SYNTH_VAULT_CONTRACT_ID   ?? "",
  USDC_TOKEN:    process.env.NEXT_PUBLIC_USDC_CONTRACT_ID          ?? "",
  SYNTH_AAPL:    process.env.NEXT_PUBLIC_SYNTH_AAPL_CONTRACT_ID    ?? "",
  SYNTH_TSLA:    process.env.NEXT_PUBLIC_SYNTH_TSLA_CONTRACT_ID    ?? "",
  SYNTH_NVDA:    process.env.NEXT_PUBLIC_SYNTH_NVDA_CONTRACT_ID    ?? "",
} as const

export const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet"

export const HORIZON_URL =
  STELLAR_NETWORK === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org"

export const SOROBAN_RPC_URL =
  STELLAR_NETWORK === "mainnet"
    ? "https://mainnet.stellar.validationcloud.io/v1/soroban/rpc"
    : "https://soroban-testnet.stellar.org"
