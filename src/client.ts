/**
 * Keboola Query Service Client.
 *
 * @example
 * ```typescript
 * import { Client } from '@keboola/query-service';
 *
 * const client = new Client({
 *   baseUrl: 'https://query.keboola.com',
 *   token: 'your-storage-api-token'
 * });
 *
 * const results = await client.executeQuery({
 *   branchId: '1261313',
 *   workspaceId: '2950146661',
 *   statements: ['SELECT * FROM my_table LIMIT 10']
 * });
 *
 * console.log(results[0].data);
 * ```
 */

import {
  AuthenticationError,
  JobError,
  JobTimeoutError,
  NotFoundError,
  QueryServiceError,
  ValidationError,
} from "./errors";
import {
  type ApiErrorResponse,
  type ClientConfig,
  type ExecuteQueryOptions,
  type GetJobResultsOptions,
  type GetQueryHistoryOptions,
  type JobStatus,
  type QueryHistory,
  type QueryResult,
  type SubmitJobOptions,
  type WaitForJobOptions,
  isTerminalState,
} from "./types";

const VERSION = "0.1.2";

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_POLL_INTERVAL_START = 100; // 100ms
const DEFAULT_POLL_INTERVAL_MAX = 2000; // 2s
const DEFAULT_MAX_WAIT_TIME = 300000; // 5 minutes

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Client {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.userAgent =
      config.userAgent ?? `keboola-query-service-ts-sdk/${VERSION}`;
  }

  private buildHeaders(): Record<string, string> {
    return {
      "X-StorageAPI-Token": this.token,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": this.userAgent,
    };
  }

  private handleError(
    statusCode: number,
    errorData: ApiErrorResponse,
    responseText: string
  ): never {
    const message = errorData.exception ?? responseText;
    const options = {
      statusCode,
      exceptionId: errorData.exceptionId,
      context: errorData.context,
    };

    if (statusCode === 401) {
      throw new AuthenticationError(message, options);
    } else if (statusCode === 400) {
      throw new ValidationError(message, options);
    } else if (statusCode === 404) {
      throw new NotFoundError(message, options);
    } else {
      throw new QueryServiceError(message, options);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number>;
    }
  ): Promise<T> {
    let lastError: Error | null = null;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        let url = `${this.baseUrl}${path}`;

        if (options?.params) {
          const searchParams = new URLSearchParams();
          for (const [key, value] of Object.entries(options.params)) {
            searchParams.append(key, String(value));
          }
          url += `?${searchParams.toString()}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: this.buildHeaders(),
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const shouldRetry =
          response.status >= 500 || response.status === 429;

        if (response.status >= 400) {
          const responseText = await response.text();
          let errorData: ApiErrorResponse = {};

          try {
            errorData = JSON.parse(responseText) as ApiErrorResponse;
          } catch {
            // Not JSON, use raw text
          }

          if (shouldRetry && attempt < this.maxRetries) {
            lastResponse = response;
            const waitTime = Math.min(Math.pow(2, attempt) * 100, 10000);
            const jitter = Math.random() * 100;
            await sleep(waitTime + jitter);
            continue;
          }

          this.handleError(response.status, errorData, responseText);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof QueryServiceError) {
          throw error;
        }

        lastError = error as Error;

        if (attempt < this.maxRetries) {
          const waitTime = Math.min(Math.pow(2, attempt) * 100, 10000);
          const jitter = Math.random() * 100;
          await sleep(waitTime + jitter);
          continue;
        }
      }
    }

    if (lastResponse && lastResponse.status >= 400) {
      const responseText = await lastResponse.text();
      let errorData: ApiErrorResponse = {};
      try {
        errorData = JSON.parse(responseText) as ApiErrorResponse;
      } catch {
        // Not JSON
      }
      this.handleError(lastResponse.status, errorData, responseText);
    }

    throw new QueryServiceError(
      `Request failed after ${this.maxRetries + 1} attempts: ${lastError?.message ?? "Unknown error"}`
    );
  }

  // =========================================================================
  // Low-level API methods
  // =========================================================================

  /**
   * Submit a query job without waiting for completion.
   *
   * @param options - Job submission options
   * @returns Query job ID
   */
  async submitJob(options: SubmitJobOptions): Promise<string> {
    const data = await this.request<{ queryJobId: string }>(
      "POST",
      `/api/v1/branches/${options.branchId}/workspaces/${options.workspaceId}/queries`,
      {
        body: {
          statements: options.statements,
          transactional: options.transactional ?? true,
          actorType: options.actorType ?? "user",
        },
      }
    );
    return data.queryJobId;
  }

  /**
   * Get the status of a query job.
   *
   * @param queryJobId - Query job ID
   * @returns Job status with statements
   */
  async getJobStatus(queryJobId: string): Promise<JobStatus> {
    return this.request<JobStatus>("GET", `/api/v1/queries/${queryJobId}`);
  }

  /**
   * Get results for a specific statement.
   *
   * @param options - Options for getting results
   * @returns Query result with columns and data
   */
  async getJobResults(options: GetJobResultsOptions): Promise<QueryResult> {
    return this.request<QueryResult>(
      "GET",
      `/api/v1/queries/${options.queryJobId}/${options.statementId}/results`,
      {
        params: {
          offset: options.offset ?? 0,
          pageSize: options.pageSize ?? 500,
        },
      }
    );
  }

  /**
   * Cancel a running query job.
   *
   * @param queryJobId - Query job ID
   * @param reason - Optional cancellation reason
   * @returns Query job ID
   */
  async cancelJob(queryJobId: string, reason?: string): Promise<string> {
    const data = await this.request<{ queryJobId: string }>(
      "POST",
      `/api/v1/queries/${queryJobId}/cancel`,
      {
        body: { reason: reason ?? "Canceled by user" },
      }
    );
    return data.queryJobId;
  }

  /**
   * Get query history for a workspace.
   *
   * @param options - Options for getting history
   * @returns Query history with list of statements
   */
  async getQueryHistory(options: GetQueryHistoryOptions): Promise<QueryHistory> {
    const params: Record<string, string | number> = {
      pageSize: options.pageSize ?? 500,
    };
    if (options.afterId) {
      params.afterId = options.afterId;
    }

    return this.request<QueryHistory>(
      "GET",
      `/api/v1/branches/${options.branchId}/workspaces/${options.workspaceId}/queries`,
      { params }
    );
  }

  // =========================================================================
  // High-level convenience methods
  // =========================================================================

  /**
   * Wait for a job to complete.
   *
   * @param options - Options for waiting
   * @returns Final job status
   * @throws {JobTimeoutError} If job doesn't complete within maxWaitTime
   * @throws {JobError} If job fails
   */
  async waitForJob(options: WaitForJobOptions): Promise<JobStatus> {
    const maxWaitTime = options.maxWaitTime ?? DEFAULT_MAX_WAIT_TIME;
    const pollIntervalStart =
      options.pollIntervalStart ?? DEFAULT_POLL_INTERVAL_START;
    const pollIntervalMax = options.pollIntervalMax ?? DEFAULT_POLL_INTERVAL_MAX;

    const startTime = Date.now();
    let pollInterval = pollIntervalStart;

    while (true) {
      const status = await this.getJobStatus(options.queryJobId);

      if (isTerminalState(status.status)) {
        if (status.status === "failed") {
          const failedStatements = status.statements
            .filter((s) => s.status === "failed")
            .map((s) => ({ id: s.id, error: s.error }));

          const firstError =
            failedStatements[0]?.error ?? "Job failed";

          throw new JobError(firstError, options.queryJobId, failedStatements);
        }
        return status;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitTime) {
        throw new JobTimeoutError(
          `Job did not complete within ${maxWaitTime}ms`,
          options.queryJobId
        );
      }

      await sleep(pollInterval);
      pollInterval = Math.min(pollInterval * 1.5, pollIntervalMax);
    }
  }

  /**
   * Execute query and wait for results.
   *
   * This is a convenience method that submits a job, waits for completion,
   * and fetches results for all statements.
   *
   * @param options - Query execution options
   * @returns Array of QueryResult, one per statement
   * @throws {JobError} If job fails
   * @throws {JobTimeoutError} If job doesn't complete in time
   *
   * @example
   * ```typescript
   * const results = await client.executeQuery({
   *   branchId: '1261313',
   *   workspaceId: '2950146661',
   *   statements: ['SELECT * FROM orders LIMIT 10']
   * });
   *
   * for (const result of results) {
   *   console.log('Columns:', result.columns.map(c => c.name));
   *   console.log('Data:', result.data);
   * }
   * ```
   */
  async executeQuery(options: ExecuteQueryOptions): Promise<QueryResult[]> {
    // Submit job
    const jobId = await this.submitJob({
      branchId: options.branchId,
      workspaceId: options.workspaceId,
      statements: options.statements,
      transactional: options.transactional,
      actorType: options.actorType,
    });

    // Wait for completion
    const status = await this.waitForJob({
      queryJobId: jobId,
      maxWaitTime: options.maxWaitTime,
    });

    // Fetch results for each statement
    const results: QueryResult[] = [];
    for (const statement of status.statements) {
      const result = await this.getJobResults({
        queryJobId: jobId,
        statementId: statement.id,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Stream results as an async generator.
   *
   * @param queryJobId - Query job ID
   * @param statementId - Statement ID
   * @yields Parsed JSON objects from the NDJSON stream
   *
   * @example
   * ```typescript
   * for await (const row of client.streamResults(jobId, statementId)) {
   *   console.log(row);
   * }
   * ```
   */
  async *streamResults(
    queryJobId: string,
    statementId: string
  ): AsyncGenerator<Record<string, unknown>, void, unknown> {
    const url = `${this.baseUrl}/api/v1/queries/${queryJobId}/${statementId}/results/stream`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status >= 400) {
      const responseText = await response.text();
      let errorData: ApiErrorResponse = {};
      try {
        errorData = JSON.parse(responseText) as ApiErrorResponse;
      } catch {
        // Not JSON
      }
      this.handleError(response.status, errorData, responseText);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new QueryServiceError("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) {
            yield JSON.parse(buffer) as Record<string, unknown>;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            yield JSON.parse(line) as Record<string, unknown>;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
