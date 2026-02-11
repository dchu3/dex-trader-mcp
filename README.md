# dex-trader-mcp

A TypeScript MCP (Model Context Protocol) server for Solana token trading via Jupiter aggregator.

## Features

- **Token Trading** — Buy and sell tokens using Jupiter aggregator for best prices across all DEXs
- **Swap Quotes** — Preview trades before executing (price, output, route, price impact)
- **Balance Checking** — Check wallet SOL and token balances

## Installation

```bash
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_PRIVATE_KEY` | For trading/balance tools | Base58-encoded Solana wallet private key |
| `SOLANA_RPC_URL` | No | Custom Solana RPC endpoint (defaults to `https://api.mainnet-beta.solana.com`) |

### As an MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "dex-trader": {
      "command": "node",
      "args": ["/path/to/dex-trader-mcp/dist/index.js"],
      "env": {
        "SOLANA_PRIVATE_KEY": "your-base58-private-key",
        "SOLANA_RPC_URL": "https://your-rpc-endpoint.com"
      }
    }
  }
}
```

## Tools

### get_quote

Preview a swap via Jupiter aggregator without executing. Returns price, output amount, price impact, and routing info.

**Parameters:**
- `input_mint` (string, required): Input token mint address (use `SOL` for native SOL)
- `output_mint` (string, required): Output token mint address (use `SOL` for native SOL)
- `amount` (number, required): Amount of input token in human-readable units (e.g. `0.5` for 0.5 SOL)
- `input_decimals` (number, optional): Decimals of the input token (default: 9)
- `slippage_bps` (number, optional): Slippage tolerance in basis points (default: 50 = 0.5%)

### buy_token

Buy a Solana token by spending SOL. Uses Jupiter aggregator for best price.

**Parameters:**
- `token_address` (string, required): Mint address of the token to buy
- `sol_amount` (number, required): Amount of SOL to spend (e.g. `0.1`)
- `slippage_bps` (number, optional): Slippage tolerance in basis points (default: 50 = 0.5%)

### sell_token

Sell a Solana token for SOL. Uses Jupiter aggregator for best price.

**Parameters:**
- `token_address` (string, required): Mint address of the token to sell
- `token_amount` (number, required): Amount of tokens to sell in human-readable units
- `token_decimals` (number, required): Number of decimals for the token (e.g. 6 for USDC, 9 for most SPL tokens)
- `slippage_bps` (number, optional): Slippage tolerance in basis points (default: 50 = 0.5%)

### get_balance

Check wallet SOL balance and optionally a specific token balance.

**Parameters:**
- `token_address` (string, optional): Mint address of a token to check balance for

## API References

- [Jupiter V6 API](https://quote-api.jup.ag/v6) — DEX aggregation and swaps
