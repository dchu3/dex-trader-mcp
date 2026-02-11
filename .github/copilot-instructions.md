# Copilot Instructions

## Build

```bash
npm run build    # TypeScript compilation via tsc
npm start        # Run the compiled server
```

There are no tests or linters configured.

## Architecture

This is a **Model Context Protocol (MCP) server** that exposes Solana blockchain tools over stdio transport. It uses `@modelcontextprotocol/sdk` and communicates via JSON-RPC with MCP clients (e.g., Claude Desktop, VS Code).

### Source layout

- `src/index.ts` — MCP server setup and all tool definitions (`server.tool()` calls). This is the entry point.
- `src/solana.ts` — Solana wallet and RPC utilities (keypair loading, balance queries). Exports constants `SOL_MINT` and `SOL_DECIMALS`.
- `src/jupiter.ts` — Jupiter V6 REST API integration (quote fetching, swap execution with `VersionedTransaction`).

### External APIs

| API | Base URL | Purpose |
|-----|----------|---------|
| RugCheck | `https://api.rugcheck.xyz/v1` | Token safety/rug-pull analysis |
| Jupiter V6 | `https://quote-api.jup.ag/v6` | DEX aggregation, quotes, and swap transactions |
| Solana RPC | Configurable via `SOLANA_RPC_URL` | On-chain reads and transaction submission |

### Data flow for swaps

1. Get quote from Jupiter (`GET /quote`) → returns routing and expected output
2. Request serialized transaction from Jupiter (`POST /swap`) → returns base64 `VersionedTransaction`
3. Deserialize, sign with wallet keypair, send via Solana RPC, await confirmation

## Conventions

### MCP tool pattern

Every tool in `src/index.ts` follows the same structure:

```typescript
server.tool(
  "tool_name",
  "Human-readable description",
  { /* Zod schema for parameters */ },
  async (params) => {
    try {
      // ... logic ...
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
    }
  }
);
```

- Tools always return `{ content: [{ type: "text", text: string }] }` — never throw.
- Use `as const` on the `type` field for TypeScript narrowing.
- Use Zod schemas with `.describe()` on every parameter.
- Errors are caught and returned as text content, not thrown.

### Token amounts

- User-facing amounts are in human-readable units (e.g., `0.5` SOL).
- API/on-chain amounts use raw integer units (lamports, smallest token unit).
- Conversion: `rawAmount = Math.round(humanAmount * 10 ** decimals)`.
- SOL uses `LAMPORTS_PER_SOL` from `@solana/web3.js` for conversion.

### Module system

- ESM (`"type": "module"` in package.json, `NodeNext` module resolution).
- Local imports must use `.js` extension (e.g., `import { ... } from "./solana.js"`).

### Environment variables

- `SOLANA_PRIVATE_KEY` — base58-encoded private key, loaded lazily by `getKeypair()`. Read-only tools (`get_quote`, `get_token_summary`) work without it.
- `SOLANA_RPC_URL` — optional, defaults to public mainnet endpoint.
- Never hardcode secrets. The wallet key must only come from `process.env`.

### Solana SDK

Uses `@solana/web3.js` v1.x (not v2/@solana/kit). Jupiter's swap endpoint returns serialized `VersionedTransaction` objects designed for the v1 API.
