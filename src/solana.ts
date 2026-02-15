import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const SOL_DECIMALS = 9;

export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  return new Connection(rpcUrl, "confirmed");
}

export function getKeypair(): Keypair {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "SOLANA_PRIVATE_KEY environment variable is not set. Required for signing transactions."
    );
  }
  try {
    const decoded = bs58.decode(privateKey);
    return Keypair.fromSecretKey(decoded);
  } catch {
    throw new Error(
      "Invalid SOLANA_PRIVATE_KEY. Must be a base58-encoded private key."
    );
  }
}

export async function getSolBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

const decimalsCache = new Map<string, number>();

export async function getTokenDecimals(
  connection: Connection,
  mintAddress: string
): Promise<number> {
  const cached = decimalsCache.get(mintAddress);
  if (cached !== undefined) return cached;

  const mint = new PublicKey(mintAddress);
  const info = await connection.getParsedAccountInfo(mint);
  const data = info?.value?.data;
  if (data && typeof data === "object" && "parsed" in data) {
    const decimals: number = data.parsed.info.decimals;
    decimalsCache.set(mintAddress, decimals);
    return decimals;
  }
  throw new Error(`Failed to fetch decimals for mint ${mintAddress}`);
}

export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  mintAddress: string
): Promise<{ amount: string; decimals: number; uiAmount: number | null }> {
  const mint = new PublicKey(mintAddress);
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletAddress, {
    mint,
  });

  if (tokenAccounts.value.length === 0) {
    return { amount: "0", decimals: 0, uiAmount: 0 };
  }

  const parsed = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
  return {
    amount: parsed.amount,
    decimals: parsed.decimals,
    uiAmount: parsed.uiAmount,
  };
}
