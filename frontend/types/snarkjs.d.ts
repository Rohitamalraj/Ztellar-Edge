declare module "snarkjs" {
  interface Groth16Proof {
    pi_a: [string, string, string]
    pi_b: [[string, string], [string, string], [string, string]]
    pi_c: [string, string, string]
    protocol: string
    curve: string
  }

  interface ProveResult {
    proof: Groth16Proof
    publicSignals: string[]
  }

  interface VerifyResult {
    valid: boolean
  }

  const groth16: {
    fullProve(
      input: Record<string, string | string[]>,
      wasmFile: string | Uint8Array,
      zkeyFileName: string | Uint8Array,
      logger?: unknown
    ): Promise<ProveResult>

    verify(
      vkey: Record<string, unknown>,
      publicSignals: string[],
      proof: Groth16Proof,
      logger?: unknown
    ): Promise<boolean>

    exportSolidityCallData(
      proof: Groth16Proof,
      publicSignals: string[]
    ): Promise<string>
  }

  const plonk: {
    fullProve(
      input: Record<string, string | string[]>,
      wasmFile: string | Uint8Array,
      zkeyFileName: string | Uint8Array
    ): Promise<ProveResult>

    verify(
      vkey: Record<string, unknown>,
      publicSignals: string[],
      proof: unknown
    ): Promise<boolean>
  }
}
