# sqlpad-mcp

A minimal Model Context Protocol server for [SQLPad](https://github.com/sqlpad/sqlpad), exposing two tools:

- `list_connections` — list configured SQL connections (id, name, driver only; no host/credentials)
- `run_query` — run a SQL statement against a connection and return columns + rows

## Setup

```bash
npm install
```

Set environment variables before launching:

- `SQLPAD_TOKEN` (required) — bearer token for your SQLPad instance
- `SQLPAD_BASE_URL` (required) — base URL of your SQLPad instance

## Usage

Add to your MCP client config (e.g. Claude Code `~/.claude.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "sqlpad": {
      "command": "node",
      "args": ["/absolute/path/to/sqlpad-mcp/index.js"],
      "env": {
        "SQLPAD_TOKEN": "your-token-here"
      }
    }
  }
}
```
