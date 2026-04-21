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

describe("literal - primitives", () => {
  const sql = createSql("snowflake");

  it("null → NULL", () => expect(sql.literal(null).sql).toBe("NULL"));
  it("undefined → NULL", () => expect(sql.literal(undefined).sql).toBe("NULL"));

  it("true → TRUE", () => expect(sql.literal(true).sql).toBe("TRUE"));
  it("false → FALSE", () => expect(sql.literal(false).sql).toBe("FALSE"));

  it("number int", () => expect(sql.literal(42).sql).toBe("42"));
  it("number negative", () => expect(sql.literal(-1).sql).toBe("-1"));
  it("number float", () => expect(sql.literal(1.5).sql).toBe("1.5"));
  it("number 0.1+0.2 round-trip lockin", () => {
    expect(sql.literal(0.1 + 0.2).sql).toBe("0.30000000000000004");
  });
  it("number 1e300 scientific notation", () => {
    expect(sql.literal(1e300).sql).toBe("1e+300");
  });

  it("bigint → decimal", () => expect(sql.literal(42n).sql).toBe("42"));
  it("bigint large", () => {
    expect(sql.literal(10n ** 100n).sql).toBe("1" + "0".repeat(100));
  });

  it("rejects NaN", () => {
    expect(() => sql.literal(NaN)).toThrow(RangeError);
  });
  it("rejects Infinity", () => {
    expect(() => sql.literal(Infinity)).toThrow(RangeError);
  });
  it("rejects -Infinity", () => {
    expect(() => sql.literal(-Infinity)).toThrow(RangeError);
  });
});

describe("literal - strings", () => {
  it("empty string", () => {
    expect(createSql("snowflake").literal("").sql).toBe("''");
  });
  it("doubles internal single quote", () => {
    expect(createSql("snowflake").literal("O'Brien").sql).toBe("'O''Brien'");
  });
  it("escapes backslash (snowflake regression)", () => {
    // Source string is 4 chars: a, \, n, b
    expect(createSql("snowflake").literal("a\\nb").sql).toBe("'a\\\\nb'");
  });
  it("escapes backslash (bigquery)", () => {
    expect(createSql("bigquery").literal("a\\nb").sql).toBe("'a\\\\nb'");
  });
  it("preserves literal newline byte", () => {
    expect(createSql("snowflake").literal("a\nb").sql).toBe("'a\nb'");
  });
  it("rejects NUL", () => {
    expect(() => createSql("snowflake").literal("a\x00b")).toThrow(TypeError);
  });
});

describe("literal - Date", () => {
  it("snowflake emits TIMESTAMP_TZ in UTC with millisecond precision", () => {
    const d = new Date("2026-04-21T14:30:45.123Z");
    expect(createSql("snowflake").literal(d).sql).toBe(
      "'2026-04-21 14:30:45.123+00:00'::TIMESTAMP_TZ",
    );
  });

  it("bigquery emits TIMESTAMP in UTC", () => {
    const d = new Date("2026-04-21T14:30:45.123Z");
    expect(createSql("bigquery").literal(d).sql).toBe(
      "TIMESTAMP '2026-04-21 14:30:45.123+00:00'",
    );
  });

  it("zero milliseconds still emit .000", () => {
    const d = new Date("2026-04-21T14:30:45.000Z");
    expect(createSql("snowflake").literal(d).sql).toBe(
      "'2026-04-21 14:30:45.000+00:00'::TIMESTAMP_TZ",
    );
  });

  it("cross-zone input normalized to UTC in output", () => {
    const d = new Date("2026-04-21T14:30:00-08:00"); // 22:30:00Z
    expect(createSql("snowflake").literal(d).sql).toBe(
      "'2026-04-21 22:30:00.000+00:00'::TIMESTAMP_TZ",
    );
  });
});

describe("literal - Array", () => {
  const sql = createSql("snowflake");

  it("non-empty", () => {
    expect(sql.literal([1, 2, 3]).sql).toBe("(1, 2, 3)");
  });

  it("mixed types", () => {
    expect(sql.literal([1, "a", null, true]).sql).toBe(
      "(1, 'a', NULL, TRUE)",
    );
  });

  it("empty → (NULL)", () => {
    expect(sql.literal([]).sql).toBe("(NULL)");
  });

  it("nested array throws", () => {
    expect(() => sql.literal([1, [2, 3]])).toThrow(TypeError);
  });
});

describe("date", () => {
  it("from YYYY-MM-DD string (snowflake)", () => {
    expect(createSql("snowflake").date("2026-04-21").sql).toBe(
      "'2026-04-21'::DATE",
    );
  });

  it("from YYYY-MM-DD string (bigquery)", () => {
    expect(createSql("bigquery").date("2026-04-21").sql).toBe(
      "DATE '2026-04-21'",
    );
  });

  it("from Date uses UTC components", () => {
    const d = new Date("2026-04-21T23:00:00-08:00"); // UTC: 2026-04-22T07:00:00Z
    expect(createSql("snowflake").date(d).sql).toBe("'2026-04-22'::DATE");
  });

  it("from Date at midnight UTC", () => {
    const d = new Date("2026-04-21T00:00:00Z");
    expect(createSql("snowflake").date(d).sql).toBe("'2026-04-21'::DATE");
  });

  it("rejects malformed string", () => {
    expect(() => createSql("snowflake").date("2026/04/21")).toThrow(TypeError);
    expect(() => createSql("snowflake").date("not-a-date")).toThrow(TypeError);
  });

  it("rejects non-Date non-string", () => {
    // @ts-expect-error invalid input
    expect(() => createSql("snowflake").date(42)).toThrow(TypeError);
  });
});

describe("sql tagged template", () => {
  const sql = createSql("snowflake");

  it("single interpolation escapes the value", () => {
    expect(sql`SET x = ${"O'Brien"}`).toBe("SET x = 'O''Brien'");
  });

  it("multiple interpolations", () => {
    const result = sql`SET a = ${1}, b = ${"two"}, c = ${null}`;
    expect(result).toBe("SET a = 1, b = 'two', c = NULL");
  });

  it("SafeSql passes through", () => {
    const table = sql.ident("in.c-main", "approvals");
    const q = sql`UPDATE ${table} SET x = ${"o'brien"}`;
    expect(q).toBe("UPDATE \"in.c-main\".\"approvals\" SET x = 'o''brien'");
  });

  it("empty template", () => {
    expect(sql``).toBe("");
  });

  it("end-to-end docs example", () => {
    const q = sql`UPDATE ${sql.ident("in.c-main", "approvals")} SET status = ${"approved"}, updated_at = ${sql.raw("CURRENT_TIMESTAMP")} WHERE id = ${123}`;
    expect(q).toBe(
      "UPDATE \"in.c-main\".\"approvals\" SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = 123",
    );
  });

  it("backslash string round-trips via snowflake escape", () => {
    const s = "a\\nb"; // 4 chars: a, \, n, b
    expect(sql`x = ${s}`).toBe("x = 'a\\\\nb'");
  });
});

describe("SafeSql passthrough", () => {
  const sql = createSql("snowflake");

  it("literal returns the same SafeSql unchanged", () => {
    const marker = sql.raw("CURRENT_TIMESTAMP");
    expect(sql.literal(marker)).toBe(marker);
  });

  it("literal returns ident unchanged", () => {
    const i = sql.ident("in.c-main", "customers");
    expect(sql.literal(i)).toBe(i);
  });
});

describe("literal - unknown types", () => {
  const sql = createSql("snowflake");

  it("rejects plain object with hint", () => {
    expect(() => sql.literal({ a: 1 })).toThrow(/convert to string/);
  });

  it("rejects Symbol", () => {
    expect(() => sql.literal(Symbol("x"))).toThrow(TypeError);
  });

  it("rejects function", () => {
    expect(() => sql.literal(() => 1)).toThrow(TypeError);
  });
});

describe("raw", () => {
  const sql = createSql("snowflake");

  it("returns SafeSql with identical sql", () => {
    const r = sql.raw("CURRENT_TIMESTAMP");
    expect(r.__safe).toBe(true);
    expect(r.sql).toBe("CURRENT_TIMESTAMP");
  });

  it("rejects non-string", () => {
    // @ts-expect-error invalid input
    expect(() => sql.raw(123)).toThrow(TypeError);
  });

  it("passes through in tagged template", () => {
    expect(sql`ts = ${sql.raw("CURRENT_TIMESTAMP")}`).toBe("ts = CURRENT_TIMESTAMP");
  });
});

describe("public package exports", () => {
  it("createSql, Dialect, SafeSql, Sql are re-exported from index", async () => {
    const pkg = await import("../src/index");
    expect(typeof pkg.createSql).toBe("function");
    // Dialect, SafeSql, Sql are types — import checks them at compile time.
  });
});
