/**
 * Types and interfaces for Keboola Query Service SDK.
 */

/** Actor type for query jobs */
export type ActorType = "user" | "system";

/** State of a query job */
export type JobState =
  | "created"
  | "enqueued"
  | "processing"
  | "canceled"
  | "completed"
  | "failed";

/** State of a statement within a job */
export type StatementState =
  | "waiting"
  | "processing"
  | "canceled"
  | "completed"
  | "failed"
  | "notExecuted";

/** Check if job state is terminal */
export function isTerminalState(state: JobState): boolean {
  return state === "completed" || state === "failed" || state === "canceled";
}

/** Column metadata from query results */
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  length?: number;
}

/** A SQL statement within a query job */
export interface Statement {
  id: string;
  query: string;
  status: StatementState;
  queryId?: string;
  sessionId?: string;
  error?: string;
  rowsAffected?: number;
  numberOfRows?: number;
  createdAt?: string;
  executedAt?: string;
  completedAt?: string;
}

/** Status of a query job */
export interface JobStatus {
  queryJobId: string;
  status: JobState;
  actorType: ActorType;
  statements: Statement[];
  createdAt: string;
  changedAt: string;
  canceledAt?: string;
  cancellationReason?: string;
}

/** Result of a query statement */
export interface QueryResult {
  status: StatementState;
  columns: Column[];
  data: unknown[][];
  rowsAffected?: number;
  numberOfRows?: number;
  message?: string;
}

/** Statement with additional workspace info for query history */
export interface StatementWithWorkspaceInfo extends Statement {
  queryJobId: string;
  warehouse?: string;
  backendSize?: string;
}

/** Query history response */
export interface QueryHistory {
  statements: StatementWithWorkspaceInfo[];
}

/** Client configuration options */
export interface ClientConfig {
  /** Base URL of the Query Service (e.g., "https://query.keboola.com") */
  baseUrl: string;
  /** Keboola Storage API token */
  token: string;
  /** Request timeout in milliseconds (default: 120000) */
  timeout?: number;
  /** Maximum number of retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Custom user agent string */
  userAgent?: string;
}

/** Options for executing a query */
export interface ExecuteQueryOptions {
  /** Branch ID */
  branchId: string;
  /** Workspace ID */
  workspaceId: string;
  /** SQL statements to execute */
  statements: string[];
  /** Whether to execute in a transaction (default: true) */
  transactional?: boolean;
  /** Actor type (default: "user") */
  actorType?: ActorType;
  /** Maximum time to wait for completion in milliseconds (default: 300000) */
  maxWaitTime?: number;
}

/** Options for submitting a job */
export interface SubmitJobOptions {
  /** Branch ID */
  branchId: string;
  /** Workspace ID */
  workspaceId: string;
  /** SQL statements to execute */
  statements: string[];
  /** Whether to execute in a transaction (default: true) */
  transactional?: boolean;
  /** Actor type (default: "user") */
  actorType?: ActorType;
}

/** Options for getting job results */
export interface GetJobResultsOptions {
  /** Query job ID */
  queryJobId: string;
  /** Statement ID */
  statementId: string;
  /** Offset for pagination (default: 0) */
  offset?: number;
  /** Page size for pagination (default: 500) */
  pageSize?: number;
}

/** Options for waiting for a job */
export interface WaitForJobOptions {
  /** Query job ID */
  queryJobId: string;
  /** Maximum time to wait in milliseconds (default: 300000) */
  maxWaitTime?: number;
  /** Initial polling interval in milliseconds (default: 100) */
  pollIntervalStart?: number;
  /** Maximum polling interval in milliseconds (default: 2000) */
  pollIntervalMax?: number;
}

/** Options for getting query history */
export interface GetQueryHistoryOptions {
  /** Branch ID */
  branchId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Get results after this statement ID */
  afterId?: string;
  /** Number of results per page (default: 500) */
  pageSize?: number;
}

/** API error response */
export interface ApiErrorResponse {
  exception?: string;
  exceptionId?: string;
  context?: Record<string, unknown>;
}
