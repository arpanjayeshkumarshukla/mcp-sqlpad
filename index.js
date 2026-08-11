#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.SQLPAD_BASE_URL;
const TOKEN = process.env.SQLPAD_TOKEN;

if (!BASE_URL) {
  console.error("SQLPAD_BASE_URL env var is not set. Export it before launching this server.");
  process.exit(1);
}

if (!TOKEN) {
  console.error("SQLPAD_TOKEN env var is not set. Export it before launching this server.");
  process.exit(1);
}

function authHeaders(extra = {}) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${TOKEN}`,
    ...extra,
  };
}

async function sqlpadFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SQLPad ${options.method || "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

async function runQuery(connectionId, sql) {
  const batch = await sqlpadFetch("/api/batches", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ connectionId, batchText: sql }),
  });

  const deadline = Date.now() + 30_000;
  let current = batch;
  while (current.status === "started" || current.status === "queued") {
    if (Date.now() > deadline) {
      throw new Error(`Query timed out after 30s (batch ${batch.id}, status ${current.status})`);
    }
    await new Promise((r) => setTimeout(r, 500));
    current = await sqlpadFetch(`/api/batches/${batch.id}`, { headers: authHeaders() });
  }

  const statement = current.statements?.[0];
  if (!statement) {
    throw new Error(`Batch ${batch.id} finished with status ${current.status} but returned no statement`);
  }
  if (statement.error) {
    throw new Error(`SQL error: ${JSON.stringify(statement.error)}`);
  }

  const rows = await sqlpadFetch(`/api/statements/${statement.id}/results`, { headers: authHeaders() });
  const columns = (statement.columns || []).map((c) => c.name);
  return { columns, rows, rowCount: statement.rowCount };
}

const server = new McpServer({ name: "sqlpad-mcp", version: "1.0.0" });

server.tool(
  "list_connections",
  "List SQL connections configured in SQLPad beta (name, driver, id). Does not expose host/credentials.",
  {},
  async () => {
    const connections = await sqlpadFetch("/api/connections", { headers: authHeaders() });
    const summary = connections.map((c) => ({ id: c.id, name: c.name, driver: c.driver }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "run_query",
  "Run a SQL query against a SQLPad connection (by connectionId from list_connections) and return columns + rows.",
  {
    connectionId: z.string().describe("Connection id from list_connections"),
    sql: z.string().describe("SQL statement to run"),
  },
  async ({ connectionId, sql }) => {
    const result = await runQuery(connectionId, sql);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
