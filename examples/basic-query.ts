/**
 * Basic query example for Keboola Query Service SDK.
 *
 * Before running, set these environment variables:
 *   export KBC_TOKEN="your-storage-api-token"
 *   export BRANCH_ID="your-branch-id"
 *   export WORKSPACE_ID="your-workspace-id"
 */

import { Client } from "../src";

const BASE_URL = "https://query.keboola.com";
const TOKEN = process.env.KBC_TOKEN!;
const BRANCH_ID = process.env.BRANCH_ID!;
const WORKSPACE_ID = process.env.WORKSPACE_ID!;

async function main() {
  const client = new Client({
    baseUrl: BASE_URL,
    token: TOKEN,
  });

  // Execute a simple query
  const results = await client.executeQuery({
    branchId: BRANCH_ID,
    workspaceId: WORKSPACE_ID,
    statements: ["SELECT 1 as id, 'hello' as message"],
  });

  // Process results
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    console.log(`\n--- Statement ${i + 1} ---`);
    console.log("Columns:", result.columns.map((col) => col.name));
    console.log(
      "Column types:",
      result.columns.map((col) => col.type)
    );
    console.log("Row count:", result.data.length);
    console.log("Data:");
    for (const row of result.data) {
      console.log(" ", row);
    }
  }
}

main().catch(console.error);
