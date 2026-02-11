# dex-rugcheck-mcp

A TypeScript MCP (Model Context Protocol) server that exposes the RugCheck API for Solana token analysis.

## Installation

```bash
npm install
npm run build
```

## Usage

### As an MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "rugcheck": {
      "command": "node",
      "args": ["/path/to/dex-rugcheck-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### get_token_summary

Fetches a token report summary from the RugCheck API.

**Parameters:**
- `token_address` (string, required): The Solana token contract address

**Example:**
```
get_token_summary({ token_address: "GsNpfDJ4LDprDRj6mJM5YLs3GPAY8SSqWvVNXNCagpQV" })
```

## API Reference

This server uses the [RugCheck API](https://api.rugcheck.xyz/v1) to fetch token summaries.
