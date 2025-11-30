/**
 * Example Next.js API Route using Keboola Query Service SDK.
 *
 * This file shows how to use the SDK in a Next.js API route.
 * Place this in your Next.js project at: app/api/query/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { Client, JobError, AuthenticationError } from "keboola-query-service";

// Initialize client (consider using environment variables)
const client = new Client({
  baseUrl: process.env.KEBOOLA_QUERY_URL ?? "https://query.keboola.com",
  token: process.env.KEBOOLA_TOKEN!,
});

const BRANCH_ID = process.env.KEBOOLA_BRANCH_ID!;
const WORKSPACE_ID = process.env.KEBOOLA_WORKSPACE_ID!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sql } = body as { sql: string };

    if (!sql) {
      return NextResponse.json(
        { error: "SQL query is required" },
        { status: 400 }
      );
    }

    const results = await client.executeQuery({
      branchId: BRANCH_ID,
      workspaceId: WORKSPACE_ID,
      statements: [sql],
      maxWaitTime: 60000, // 1 minute timeout
    });

    const result = results[0];

    return NextResponse.json({
      columns: result.columns.map((c) => ({ name: c.name, type: c.type })),
      data: result.data,
      rowCount: result.data.length,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    if (error instanceof JobError) {
      return NextResponse.json(
        {
          error: "Query execution failed",
          details: error.message,
          failedStatements: error.failedStatements,
        },
        { status: 400 }
      );
    }

    console.error("Query error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Example usage from frontend:
 *
 * ```typescript
 * const response = await fetch('/api/query', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ sql: 'SELECT * FROM users LIMIT 10' }),
 * });
 *
 * const data = await response.json();
 * console.log(data.columns, data.data);
 * ```
 */
