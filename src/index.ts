#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { z } from "zod";
import {
  getConnection,
  getKeypair,
  getSolBalance,
  getTokenBalance,
  SOL_MINT,
  SOL_DECIMALS,
} from "./solana.js";
import { getQuote, executeSwap } from "./jupiter.js";

const RUGCHECK_API_BASE = "https://api.rugcheck.xyz/v1";
const FETCH_TIMEOUT_MS = 15000; // 15 second timeout for API requests

const server = new McpServer({
  name: "dex-trader",
  version: "2.0.0",
});

server.tool(
  "get_token_summary",
  "Get a token report summary from RugCheck API for a given Solana token address",
  {
    token_address: z.string().describe("The Solana token contract address"),
  },
  async ({ token_address }) => {
    try {
      const response = await fetch(
        `${RUGCHECK_API_BASE}/tokens/${token_address}/report/summary`,
        {
          headers: {
            accept: "application/json",
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Failed to fetch token summary. Status: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds`,
            },
          ],
        };
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// --- Jupiter Quote Tool ---

server.tool(
  "get_quote",
  "Get a swap quote from Jupiter aggregator. Preview price, output amount, and route without executing a trade.",
  {
    input_mint: z
      .string()
      .describe("Input token mint address (use 'SOL' for native SOL)"),
    output_mint: z
      .string()
      .describe("Output token mint address (use 'SOL' for native SOL)"),
    amount: z
      .number()
      .positive()
      .describe("Amount of input token (in human-readable units, e.g. 0.5 SOL)"),
    input_decimals: z
      .number()
      .int()
      .min(0)
      .max(18)
      .default(SOL_DECIMALS)
      .describe("Decimals of the input token (default 9 for SOL)"),
    slippage_bps: z
      .number()
      .int()
      .min(1)
      .max(5000)
      .default(50)
      .describe("Slippage tolerance in basis points (default 50 = 0.5%)"),
  },
  async ({ input_mint, output_mint, amount, input_decimals, slippage_bps }) => {
    try {
      const resolvedInput = input_mint === "SOL" ? SOL_MINT : input_mint;
      const resolvedOutput = output_mint === "SOL" ? SOL_MINT : output_mint;
      const rawAmount = Math.round(amount * 10 ** input_decimals);

      const quote = await getQuote(
        resolvedInput,
        resolvedOutput,
        rawAmount,
        slippage_bps
      );

      const routes = quote.routePlan.map(
        (r) => `${r.swapInfo.label} (${r.percent}%)`
      );

      const summary = {
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpact: `${quote.priceImpactPct}%`,
        slippageBps: quote.slippageBps,
        route: routes.join(" → "),
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(summary, null, 2) },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
      };
    }
  }
);

// --- Buy Token Tool ---

server.tool(
  "buy_token",
  "Buy a Solana token by spending SOL. Uses Jupiter aggregator for best price across all DEXs.",
  {
    token_address: z.string().describe("Mint address of the token to buy"),
    sol_amount: z
      .number()
      .positive()
      .describe("Amount of SOL to spend (e.g. 0.1 for 0.1 SOL)"),
    slippage_bps: z
      .number()
      .int()
      .min(1)
      .max(5000)
      .default(50)
      .describe("Slippage tolerance in basis points (default 50 = 0.5%)"),
  },
  async ({ token_address, sol_amount, slippage_bps }) => {
    try {
      const keypair = getKeypair();
      const connection = getConnection();
      const rawAmount = Math.round(sol_amount * LAMPORTS_PER_SOL);

      const quote = await getQuote(SOL_MINT, token_address, rawAmount, slippage_bps);
      const txid = await executeSwap(quote, keypair, connection);

      const result = {
        status: "success",
        transaction: txid,
        solSpent: sol_amount,
        tokenReceived: quote.outAmount,
        tokenMint: token_address,
        explorer: `https://solscan.io/tx/${txid}`,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
      };
    }
  }
);

// --- Sell Token Tool ---

server.tool(
  "sell_token",
  "Sell a Solana token for SOL. Uses Jupiter aggregator for best price across all DEXs.",
  {
    token_address: z.string().describe("Mint address of the token to sell"),
    token_amount: z
      .number()
      .positive()
      .describe("Amount of tokens to sell (in human-readable units)"),
    token_decimals: z
      .number()
      .int()
      .min(0)
      .max(18)
      .describe("Number of decimals for the token (e.g. 6 for USDC, 9 for most SPL tokens)"),
    slippage_bps: z
      .number()
      .int()
      .min(1)
      .max(5000)
      .default(50)
      .describe("Slippage tolerance in basis points (default 50 = 0.5%)"),
  },
  async ({ token_address, token_amount, token_decimals, slippage_bps }) => {
    try {
      const keypair = getKeypair();
      const connection = getConnection();
      const rawAmount = Math.round(token_amount * 10 ** token_decimals);

      const quote = await getQuote(token_address, SOL_MINT, rawAmount, slippage_bps);
      const txid = await executeSwap(quote, keypair, connection);

      const solReceived = Number(quote.outAmount) / LAMPORTS_PER_SOL;

      const result = {
        status: "success",
        transaction: txid,
        tokenSold: token_amount,
        tokenMint: token_address,
        solReceived,
        explorer: `https://solscan.io/tx/${txid}`,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
      };
    }
  }
);

// --- Get Balance Tool ---

server.tool(
  "get_balance",
  "Get wallet SOL balance and optionally a specific token balance.",
  {
    token_address: z
      .string()
      .optional()
      .describe("Optional: mint address of a token to check balance for"),
  },
  async ({ token_address }) => {
    try {
      const keypair = getKeypair();
      const connection = getConnection();
      const publicKey = keypair.publicKey;

      const solBalance = await getSolBalance(connection, publicKey);
      const result: Record<string, unknown> = {
        wallet: publicKey.toBase58(),
        solBalance,
      };

      if (token_address) {
        const tokenBal = await getTokenBalance(connection, publicKey, token_address);
        result.tokenBalance = {
          mint: token_address,
          amount: tokenBal.amount,
          decimals: tokenBal.decimals,
          uiAmount: tokenBal.uiAmount,
        };
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
