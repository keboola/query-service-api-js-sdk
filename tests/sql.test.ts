import { describe, expect, it } from "vitest";

import { createSql, type SafeSql } from "../src/sql";

describe("createSql", () => {
  it("constructs snowflake", () => {
    const sql = createSql("snowflake");
    expect(sql).toBeTypeOf("function");
  });

  it("constructs bigquery", () => {
    const sql = createSql("bigquery");
    expect(sql).toBeTypeOf("function");
  });

  it("rejects unknown dialect", () => {
    // @ts-expect-error invalid dialect
    expect(() => createSql("postgres")).toThrow(TypeError);
  });
});

describe("SafeSql", () => {
  it("is a branded object with .sql", () => {
    const sql = createSql("snowflake");
    const s: SafeSql = sql.raw("X");
    expect(s.__safe).toBe(true);
    expect(s.sql).toBe("X");
  });
});
