/**
 * Error handling example for Keboola Query Service SDK.
 *
 * Demonstrates how to handle various error types.
 */

import {
  Client,
  AuthenticationError,
  ValidationError,
  JobError,
  JobTimeoutError,
  NotFoundError,
  QueryServiceError,
} from "../src";

const BASE_URL = "https://query.keboola.com";
const TOKEN = process.env.KBC_TOKEN!;
const BRANCH_ID = process.env.BRANCH_ID!;
const WORKSPACE_ID = process.env.WORKSPACE_ID!;

async function main() {
  const client = new Client({
    baseUrl: BASE_URL,
    token: TOKEN,
  });

  try {
    // This query will fail due to invalid SQL
    const results = await client.executeQuery({
      branchId: BRANCH_ID,
      workspaceId: WORKSPACE_ID,
      statements: ["SELECT * FROM nonexistent_table_xyz"],
    });
    console.log("Results:", results);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      // Invalid or expired token
      console.log("Authentication failed:", error.message);
      console.log("  Status code:", error.statusCode);
    } else if (error instanceof ValidationError) {
      // Invalid request parameters
      console.log("Validation error:", error.message);
      console.log("  Context:", error.context);
    } else if (error instanceof NotFoundError) {
      // Resource not found (job, workspace, etc.)
      console.log("Not found:", error.message);
    } else if (error instanceof JobError) {
      // Query execution failed
      console.log("Job failed:", error.message);
      console.log("  Job ID:", error.jobId);
      for (const stmt of error.failedStatements) {
        console.log(`  Statement ${stmt.id}: ${stmt.error}`);
      }
    } else if (error instanceof JobTimeoutError) {
      // Job didn't complete in time
      console.log("Timeout:", error.message);
      console.log("  Job ID:", error.jobId);
      // You can cancel the job here if needed
      // await client.cancelJob(error.jobId);
    } else if (error instanceof QueryServiceError) {
      // Generic error (5xx, network issues, etc.)
      console.log("Error:", error.message);
      console.log("  Status code:", error.statusCode);
      console.log("  Exception ID:", error.exceptionId);
    } else {
      throw error;
    }
  }
}

main().catch(console.error);
