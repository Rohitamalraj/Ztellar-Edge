/**
 * In-browser Groth16 proof generation via snarkjs.
 * WASM circuit and zkey must be served from /public/zk/.
 *
 * After running circuits/scripts/compile.sh + setup.sh, copy:
 *   circuits/build/tier_proof_js/tier_proof.wasm → frontend/public/zk/
 *   circuits/keys/tier_proof_0001.zkey           → frontend/public/zk/
 */

// Dynamically import snarkjs to avoid SSR issues in Next.js
async function getSnarkjs() {
  const sjs = await import("snarkjs")
  return sjs.groth16
}

const WASM_URL = "/zk/tier_proof.wasm"
const ZKEY_URL = "/zk/tier_proof_0001.zkey"

export interface ZkProofResult {
  proof: {
    pi_a: [string, string, string]
    pi_b: [[string, string], [string, string], [string, string]]
    pi_c: [string, string, string]
    protocol: string
    curve: string
  }
  // Circuit outputs then public inputs:
  // [0] nullifier, [1] wallet_commitment, [2] tier, [3] wallet_address, [4] expiry
  publicSignals: string[]
}

export interface ZkInputs {
  /** 248-bit private secret known only to the user (derived deterministically from wallet) */
  walletSecret: bigint
  /** Score from oracle [0, 100] */
  score: number
  /** Stellar wallet address as BigInt (derived from public key bytes) */
  walletAddressField: bigint
  /** Unix timestamp when proof expires */
  expiry: number
}

/**
 * Derive a wallet secret from a signature. The user signs a deterministic
 * message and we hash the signature bytes to get the secret.
 * This ensures the secret is derived from the user's private key without
 * revealing it.
 */
export function deriveWalletSecret(signatureHex: string): bigint {
  // Take the first 31 bytes of the signature to stay within BLS12-381's Fr
  // BLS12-381 Fr < 2^255, so 31 bytes (248 bits) is always valid
  const bytes = hexToBytes(signatureHex.replace(/^0x/, "").slice(0, 62))
  let secret = 0n
  for (const byte of bytes) {
    secret = (secret << 8n) | BigInt(byte)
  }
  return secret === 0n ? 1n : secret
}

/**
 * Encode a Stellar address (G... Strkey) as a BigInt for use as a circuit signal.
 * Takes the raw 32-byte public key from the address.
 */
export function addressToField(stellarAddress: string): bigint {
  // Decode from strkey: base32 decode, strip 2-byte version, drop 2-byte checksum → 32 bytes
  try {
    const { Keypair } = require("@stellar/stellar-sdk")
    const kp = Keypair.fromPublicKey(stellarAddress)
    const rawKey = kp.rawPublicKey()
    let field = 0n
    for (const byte of rawKey) {
      field = (field << 8n) | BigInt(byte)
    }
    // Reduce modulo BLS12-381 Fr to ensure it's a valid field element
    // BLS12-381 Fr modulus
    const FR_MODULUS =
      0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n
    return field % FR_MODULUS
  } catch {
    // Fallback: use hash of address string bytes
    const bytes = new TextEncoder().encode(stellarAddress)
    let field = 0n
    for (const byte of bytes.slice(0, 31)) {
      field = (field << 8n) | BigInt(byte)
    }
    return field === 0n ? 1n : field
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Generate a Groth16 ZK proof in the browser for the TierProof circuit.
 * Throws if WASM/zkey files are not served at /zk/.
 */
export async function generateTierProof(inputs: ZkInputs): Promise<ZkProofResult> {
  console.group("🔐 [ZE] generateTierProof")
  console.log("WASM:", WASM_URL)
  console.log("zkey:", ZKEY_URL)
  console.log("inputs:", {
    score: inputs.score,
    expiry: new Date(inputs.expiry * 1000).toISOString(),
    walletAddressField: inputs.walletAddressField.toString().slice(0, 12) + "…",
    walletSecret: "<redacted>",
  })

  const groth16 = await getSnarkjs()
  console.log("snarkjs loaded — starting fullProve…")

  const circuitInputs = {
    wallet_secret: inputs.walletSecret.toString(),
    score: inputs.score.toString(),
    wallet_address: inputs.walletAddressField.toString(),
    expiry: inputs.expiry.toString(),
  }

  const t0 = performance.now()
  const { proof, publicSignals } = await groth16.fullProve(
    circuitInputs,
    WASM_URL,
    ZKEY_URL
  )
  const elapsed = ((performance.now() - t0) / 1000).toFixed(2)

  console.log(`✅ proof generated in ${elapsed}s`)
  console.log("publicSignals:", {
    nullifier: publicSignals[0]?.slice(0, 10) + "…",
    wallet_commitment: publicSignals[1]?.slice(0, 10) + "…",
    tier: publicSignals[2],
    wallet_address: publicSignals[3]?.slice(0, 10) + "…",
    expiry: publicSignals[4],
  })
  console.log("pi_a[0]:", proof.pi_a[0].slice(0, 16) + "…")
  console.groupEnd()

  return { proof: proof as ZkProofResult["proof"], publicSignals }
}

/**
 * Parse the tier from the public signals array output by the circuit.
 * Signal order: [nullifier, wallet_commitment, tier, wallet_address, expiry]
 */
export function parseTierFromSignals(publicSignals: string[]): number {
  return Number(publicSignals[2])
}
