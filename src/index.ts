#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const RUGCHECK_API_BASE = "https://api.rugcheck.xyz/v1";
const FETCH_TIMEOUT_MS = 15000; // 15 second timeout for API requests

const server = new McpServer({
  name: "rugcheck",
  version: "1.0.0",
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
