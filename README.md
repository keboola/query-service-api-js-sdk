# Keboola Query Service TypeScript SDK

TypeScript client for [Keboola Query Service API](https://query.keboola.com/api/v1/documentation).

## Installation

```bash
npm install @keboola/query-service
# or
yarn add @keboola/query-service
# or
pnpm add @keboola/query-service
```

## Quick Start

```typescript
import { Client } from '@keboola/query-service';

// Initialize client
// IMPORTANT: Use query.keboola.com (NOT connection.keboola.com)
// Don't append /api/v1 - the SDK handles routing automatically
const client = new Client({
  baseUrl: 'https://query.keboola.com',  // Query Service URL
  token: 'your-storage-api-token'         // Your Keboola Storage API token
});

// Execute a query
const results = await client.executeQuery({
  branchId: '1261313',        // Your branch ID
  workspaceId: '2950146661',  // Your workspace ID
  statements: ['SELECT * FROM my_table LIMIT 10']
});

// Process results - one QueryResult per statement
for (const result of results) {
  console.log('Columns:', result.columns.map(col => col.name));
  console.log('Data:', result.data);
}
```

### Finding Your IDs

- **branchId**: Found in the Keboola Connection URL or via Storage API
- **workspaceId**: Go to Transformations → Workspace → Copy the workspace ID from URL or details
- **token**: Settings → API Tokens → Create new token with appropriate permissions

## Features

- **TypeScript first** - Full type definitions included
- **Promise-based** - Async/await support
- **Automatic retries** - Configurable retry logic for transient failures
- **Job polling** - Built-in exponential backoff for waiting on job completion
- **Streaming** - NDJSON streaming for large result sets
- **Next.js compatible** - Works in both Node.js and Edge runtime

## Usage

### Basic Query Execution

```typescript
import { Client } from '@keboola/query-service';

const client = new Client({
  baseUrl: 'https://query.keboola.com',
  token: process.env.KBC_TOKEN!
});

// Execute multiple statements transactionally
const results = await client.executeQuery({
  branchId: '123',
  workspaceId: '456',
  statements: [
    "SELECT * FROM orders WHERE date > '2024-01-01'",
    "SELECT COUNT(*) FROM customers"
  ],
  transactional: true  // Execute in a transaction
});

// Results is an array - one QueryResult per statement
const ordersResult = results[0];
const countResult = results[1];

console.log(`Columns: ${ordersResult.columns.map(c => c.name)}`);
console.log(`Rows: ${ordersResult.data.length}`);
```

### Low-Level API

For more control, use the low-level methods:

```typescript
// Submit job without waiting
const jobId = await client.submitJob({
  branchId: '123',
  workspaceId: '456',
  statements: ['SELECT * FROM large_table']
});

// Check status
const status = await client.getJobStatus(jobId);
console.log(`Status: ${status.status}`);  // created, enqueued, processing, completed, failed

// Wait for completion
const finalStatus = await client.waitForJob({
  queryJobId: jobId,
  maxWaitTime: 300000  // 5 minutes
});

// Get results for specific statement
const result = await client.getJobResults({
  queryJobId: jobId,
  statementId: finalStatus.statements[0].id
});
```

### Streaming Large Results

```typescript
// Stream results as NDJSON for large datasets
for await (const row of client.streamResults(jobId, statementId)) {
  processRow(row);
}
```

### Error Handling

```typescript
import {
  Client,
  AuthenticationError,
  ValidationError,
  JobError,
  JobTimeoutError,
} from '@keboola/query-service';

try {
  const results = await client.executeQuery({...});
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid token');
  } else if (error instanceof ValidationError) {
    console.log(`Invalid request: ${error.message}`);
  } else if (error instanceof JobError) {
    console.log(`Query failed: ${error.message}`);
    for (const stmt of error.failedStatements) {
      console.log(`  Statement ${stmt.id}: ${stmt.error}`);
    }
  } else if (error instanceof JobTimeoutError) {
    console.log(`Job ${error.jobId} timed out`);
  }
}
```

### Next.js API Route Example

```typescript
// app/api/query/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Client, JobError } from '@keboola/query-service';

const client = new Client({
  baseUrl: process.env.KEBOOLA_QUERY_URL!,
  token: process.env.KEBOOLA_TOKEN!
});

export async function POST(request: NextRequest) {
  const { sql } = await request.json();

  try {
    const results = await client.executeQuery({
      branchId: process.env.KEBOOLA_BRANCH_ID!,
      workspaceId: process.env.KEBOOLA_WORKSPACE_ID!,
      statements: [sql]
    });

    return NextResponse.json({
      columns: results[0].columns,
      data: results[0].data
    });
  } catch (error) {
    if (error instanceof JobError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
```

### Query History

```typescript
const history = await client.getQueryHistory({
  branchId: '123',
  workspaceId: '456',
  pageSize: 100
});

for (const stmt of history.statements) {
  console.log(`${stmt.queryJobId}: ${stmt.query.slice(0, 50)}... (${stmt.status})`);
}
```

## Configuration

```typescript
const client = new Client({
  baseUrl: 'https://query.keboola.com',
  token: 'your-token',
  timeout: 120000,      // Request timeout (ms)
  maxRetries: 3,        // Max retry attempts
  userAgent: 'my-app/1.0'  // Custom user agent
});
```

## API Reference

### Client Methods

| Method | Description |
|--------|-------------|
| `executeQuery()` | Submit query, wait for completion, return results |
| `submitJob()` | Submit query job without waiting |
| `getJobStatus()` | Get current job status |
| `getJobResults()` | Get results for a statement |
| `waitForJob()` | Wait for job to complete |
| `cancelJob()` | Cancel a running job |
| `getQueryHistory()` | Get query history for workspace |
| `streamResults()` | Stream results as NDJSON |

### Types

- `JobStatus` - Job status with statements
- `QueryResult` - Query results with columns and data
- `Statement` - Individual SQL statement info
- `Column` - Column metadata
- `JobState` - `'created' | 'enqueued' | 'processing' | 'completed' | 'failed' | 'canceled'`
- `StatementState` - `'waiting' | 'processing' | 'completed' | 'failed' | 'canceled' | 'notExecuted'`

### Errors

- `QueryServiceError` - Base error class
- `AuthenticationError` - Invalid token (401)
- `ValidationError` - Invalid request (400)
- `NotFoundError` - Resource not found (404)
- `JobError` - Query execution failed
- `JobTimeoutError` - Job didn't complete in time

## License

MIT
