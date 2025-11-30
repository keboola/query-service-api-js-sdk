/**
 * Keboola Query Service TypeScript SDK.
 *
 * A TypeScript client for the Keboola Query Service API that allows you to execute
 * SQL queries against Keboola workspaces.
 *
 * @packageDocumentation
 *
 * @example Quick Start
 * ```typescript
 * import { Client } from '@keboola/query-service';
 *
 * // Initialize client
 * // IMPORTANT: Use query.keboola.com (NOT connection.keboola.com)
 * const client = new Client({
 *   baseUrl: 'https://query.keboola.com',
 *   token: 'your-storage-api-token'
 * });
 *
 * // Execute a query
 * const results = await client.executeQuery({
 *   branchId: '1261313',
 *   workspaceId: '2950146661',
 *   statements: ['SELECT * FROM my_table LIMIT 10']
 * });
 *
 * // Process results
 * for (const result of results) {
 *   console.log('Columns:', result.columns.map(c => c.name));
 *   console.log('Data:', result.data);
 * }
 * ```
 *
 * @example Error Handling
 * ```typescript
 * import {
 *   Client,
 *   AuthenticationError,
 *   ValidationError,
 *   JobError,
 *   JobTimeoutError,
 * } from '@keboola/query-service';
 *
 * try {
 *   const results = await client.executeQuery({...});
 * } catch (error) {
 *   if (error instanceof AuthenticationError) {
 *     console.log('Invalid token');
 *   } else if (error instanceof ValidationError) {
 *     console.log('Invalid request:', error.message);
 *   } else if (error instanceof JobError) {
 *     console.log('Query failed:', error.message);
 *     console.log('Failed statements:', error.failedStatements);
 *   } else if (error instanceof JobTimeoutError) {
 *     console.log('Timeout, job ID:', error.jobId);
 *   }
 * }
 * ```
 *
 * @example Finding Your IDs
 * - **baseUrl**: Use https://query.keboola.com (NOT connection.keboola.com)
 * - **token**: Settings -> API Tokens in Keboola Connection
 * - **branchId**: Found via Storage API or in project URL
 * - **workspaceId**: Transformations -> Workspace -> Copy ID from URL
 */

// Client
export { Client } from "./client";

// Types
export type {
  ActorType,
  JobState,
  StatementState,
  Column,
  Statement,
  JobStatus,
  QueryResult,
  StatementWithWorkspaceInfo,
  QueryHistory,
  ClientConfig,
  ExecuteQueryOptions,
  SubmitJobOptions,
  GetJobResultsOptions,
  WaitForJobOptions,
  GetQueryHistoryOptions,
} from "./types";

export { isTerminalState } from "./types";

// Errors
export {
  QueryServiceError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  JobError,
  JobTimeoutError,
} from "./errors";
