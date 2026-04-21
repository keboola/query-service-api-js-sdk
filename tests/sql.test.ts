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

describe("ident - snowflake", () => {
  const sql = createSql("snowflake");

  it("quotes single part", () => {
    expect(sql.ident("status").sql).toBe('"status"');
  });

  it("preserves dots in multi-part", () => {
    expect(sql.ident("in.c-main", "customers").sql).toBe(
      '"in.c-main"."customers"',
    );
  });

  it("doubles internal double quote", () => {
    expect(sql.ident('a"b').sql).toBe('"a""b"');
  });

  it("allows unicode and spaces", () => {
    expect(sql.ident("my table").sql).toBe('"my table"');
    expect(sql.ident("café").sql).toBe('"café"');
  });

  it("rejects zero parts", () => {
    expect(() => sql.ident()).toThrow(TypeError);
  });

  it("rejects empty string", () => {
    expect(() => sql.ident("")).toThrow(TypeError);
  });

  it("rejects NUL", () => {
    expect(() => sql.ident("a\x00b")).toThrow(TypeError);
  });
});

describe("ident - bigquery", () => {
  const sql = createSql("bigquery");

  it("uses backticks", () => {
    expect(sql.ident("status").sql).toBe("`status`");
  });

  it("multi-part", () => {
    expect(sql.ident("project.dataset", "table").sql).toBe(
      "`project.dataset`.`table`",
    );
  });

  it("escapes backtick", () => {
    expect(sql.ident("a`b").sql).toBe("`a\\`b`");
  });

  it("escapes backslash", () => {
    expect(sql.ident("a\\b").sql).toBe("`a\\\\b`");
  });

  it("rejects newline", () => {
    expect(() => sql.ident("a\nb")).toThrow(TypeError);
  });

  it("rejects carriage return", () => {
    expect(() => sql.ident("a\rb")).toThrow(TypeError);
  });

  it("rejects NUL", () => {
    expect(() => sql.ident("a\x00b")).toThrow(TypeError);
  });
});
