/**
 * Custom error classes for Keboola Query Service SDK.
 */

/** Base error for Query Service errors */
export class QueryServiceError extends Error {
  public readonly statusCode?: number;
  public readonly exceptionId?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      exceptionId?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "QueryServiceError";
    this.statusCode = options?.statusCode;
    this.exceptionId = options?.exceptionId;
    this.context = options?.context;
  }
}

/** Raised when authentication fails (401) */
export class AuthenticationError extends QueryServiceError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      exceptionId?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, options);
    this.name = "AuthenticationError";
  }
}

/** Raised when request validation fails (400) */
export class ValidationError extends QueryServiceError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      exceptionId?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, options);
    this.name = "ValidationError";
  }
}

/** Raised when resource is not found (404) */
export class NotFoundError extends QueryServiceError {
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      exceptionId?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, options);
    this.name = "NotFoundError";
  }
}

/** Raised when a query job fails */
export class JobError extends QueryServiceError {
  public readonly jobId: string;
  public readonly failedStatements: Array<{ id: string; error?: string }>;

  constructor(
    message: string,
    jobId: string,
    failedStatements: Array<{ id: string; error?: string }> = [],
    options?: {
      statusCode?: number;
      exceptionId?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, options);
    this.name = "JobError";
    this.jobId = jobId;
    this.failedStatements = failedStatements;
  }
}

/** Raised when waiting for job completion times out */
export class JobTimeoutError extends QueryServiceError {
  public readonly jobId: string;

  constructor(
    message: string,
    jobId: string,
    options?: {
      statusCode?: number;
      exceptionId?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, options);
    this.name = "JobTimeoutError";
    this.jobId = jobId;
  }
}
