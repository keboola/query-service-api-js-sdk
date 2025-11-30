import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "../src/client";
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  JobError,
  JobTimeoutError,
} from "../src/errors";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Client", () => {
  let client: Client;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new Client({
      baseUrl: "https://query.keboola.com",
      token: "test-token",
    });
  });

  describe("constructor", () => {
    it("should strip trailing slash from baseUrl", () => {
      const c = new Client({
        baseUrl: "https://query.keboola.com/",
        token: "test",
      });
      expect(c["baseUrl"]).toBe("https://query.keboola.com");
    });
  });

  describe("submitJob", () => {
    it("should submit a job and return job ID", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ queryJobId: "job-123" }),
      });

      const jobId = await client.submitJob({
        branchId: "branch-1",
        workspaceId: "ws-1",
        statements: ["SELECT 1"],
      });

      expect(jobId).toBe("job-123");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://query.keboola.com/api/v1/branches/branch-1/workspaces/ws-1/queries",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            statements: ["SELECT 1"],
            transactional: true,
            actorType: "user",
          }),
        })
      );
    });

    it("should throw AuthenticationError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        text: async () => JSON.stringify({ exception: "Invalid token" }),
      });

      await expect(
        client.submitJob({
          branchId: "branch-1",
          workspaceId: "ws-1",
          statements: ["SELECT 1"],
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it("should throw ValidationError on 400", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        text: async () => JSON.stringify({ exception: "Invalid SQL" }),
      });

      await expect(
        client.submitJob({
          branchId: "branch-1",
          workspaceId: "ws-1",
          statements: ["SELECT 1"],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        text: async () => JSON.stringify({ exception: "Workspace not found" }),
      });

      await expect(
        client.submitJob({
          branchId: "branch-1",
          workspaceId: "ws-1",
          statements: ["SELECT 1"],
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getJobStatus", () => {
    it("should return job status", async () => {
      const mockStatus = {
        queryJobId: "job-123",
        status: "completed",
        actorType: "user",
        statements: [
          { id: "stmt-1", query: "SELECT 1", status: "completed" },
        ],
        createdAt: "2024-01-01T00:00:00Z",
        changedAt: "2024-01-01T00:00:01Z",
      };

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => mockStatus,
      });

      const status = await client.getJobStatus("job-123");

      expect(status.queryJobId).toBe("job-123");
      expect(status.status).toBe("completed");
      expect(status.statements).toHaveLength(1);
    });
  });

  describe("getJobResults", () => {
    it("should return query results", async () => {
      const mockResult = {
        status: "completed",
        columns: [
          { name: "id", type: "integer", nullable: false },
          { name: "name", type: "text", nullable: true },
        ],
        data: [
          [1, "Alice"],
          [2, "Bob"],
        ],
      };

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => mockResult,
      });

      const result = await client.getJobResults({
        queryJobId: "job-123",
        statementId: "stmt-1",
      });

      expect(result.status).toBe("completed");
      expect(result.columns).toHaveLength(2);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("waitForJob", () => {
    it("should return immediately if job is completed", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          queryJobId: "job-123",
          status: "completed",
          actorType: "user",
          statements: [],
          createdAt: "2024-01-01T00:00:00Z",
          changedAt: "2024-01-01T00:00:01Z",
        }),
      });

      const status = await client.waitForJob({ queryJobId: "job-123" });
      expect(status.status).toBe("completed");
    });

    it("should throw JobError if job fails", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          queryJobId: "job-123",
          status: "failed",
          actorType: "user",
          statements: [
            { id: "stmt-1", query: "SELECT 1", status: "failed", error: "SQL error" },
          ],
          createdAt: "2024-01-01T00:00:00Z",
          changedAt: "2024-01-01T00:00:01Z",
        }),
      });

      await expect(client.waitForJob({ queryJobId: "job-123" })).rejects.toThrow(
        JobError
      );
    });

    it("should throw JobTimeoutError if job doesn't complete in time", async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        json: async () => ({
          queryJobId: "job-123",
          status: "processing",
          actorType: "user",
          statements: [],
          createdAt: "2024-01-01T00:00:00Z",
          changedAt: "2024-01-01T00:00:01Z",
        }),
      });

      await expect(
        client.waitForJob({
          queryJobId: "job-123",
          maxWaitTime: 100,
          pollIntervalStart: 10,
        })
      ).rejects.toThrow(JobTimeoutError);
    });
  });

  describe("executeQuery", () => {
    it("should submit, wait, and fetch results", async () => {
      // Submit job
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ queryJobId: "job-123" }),
      });

      // Get status (completed)
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          queryJobId: "job-123",
          status: "completed",
          actorType: "user",
          statements: [{ id: "stmt-1", query: "SELECT 1", status: "completed" }],
          createdAt: "2024-01-01T00:00:00Z",
          changedAt: "2024-01-01T00:00:01Z",
        }),
      });

      // Get results
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          status: "completed",
          columns: [{ name: "result", type: "integer", nullable: false }],
          data: [[1]],
        }),
      });

      const results = await client.executeQuery({
        branchId: "branch-1",
        workspaceId: "ws-1",
        statements: ["SELECT 1"],
      });

      expect(results).toHaveLength(1);
      expect(results[0].data).toEqual([[1]]);
    });
  });

  describe("cancelJob", () => {
    it("should cancel a job", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ queryJobId: "job-123" }),
      });

      const jobId = await client.cancelJob("job-123", "User requested");
      expect(jobId).toBe("job-123");
    });
  });

  describe("getQueryHistory", () => {
    it("should return query history", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          statements: [
            {
              id: "stmt-1",
              query: "SELECT 1",
              status: "completed",
              queryJobId: "job-123",
            },
          ],
        }),
      });

      const history = await client.getQueryHistory({
        branchId: "branch-1",
        workspaceId: "ws-1",
      });

      expect(history.statements).toHaveLength(1);
    });
  });
});
