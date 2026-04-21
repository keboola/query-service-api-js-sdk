/**
 * SQL escape helper for the Keboola Query Service.
 *
 * Mirrors keboola_query_service.sql in the Python SDK. See
 * docs/superpowers/specs/2026-04-21-sdk-quote-helper-design.md in
 * connection-docs for the design rationale.
 */

export type Dialect = "snowflake" | "bigquery";

const VALID_DIALECTS: readonly Dialect[] = ["snowflake", "bigquery"];

export interface SafeSql {
  readonly __safe: true;
  readonly sql: string;
}

/** Returned by {@link createSql}. Callable tag function with helper methods. */
export interface Sql {
  (strings: TemplateStringsArray, ...values: unknown[]): string;
  literal(value: unknown): SafeSql;
  ident(...parts: string[]): SafeSql;
  date(value: Date | string): SafeSql;
  raw(s: string): SafeSql;
  readonly dialect: Dialect;
}

function makeSafe(sql: string): SafeSql {
  return { __safe: true, sql };
}

/** Type guard for {@link SafeSql}. Used by the tag function (Task 17+). */
export function isSafeSql(v: unknown): v is SafeSql {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { __safe?: unknown }).__safe === true
  );
}

export function createSql(dialect: Dialect): Sql {
  if (!VALID_DIALECTS.includes(dialect)) {
    throw new TypeError(
      `Unknown dialect: ${JSON.stringify(dialect)}. ` +
        `Supported: 'snowflake', 'bigquery'`,
    );
  }

  function raw(s: string): SafeSql {
    if (typeof s !== "string") {
      throw new TypeError(`raw() requires string, got: ${typeof s}`);
    }
    return makeSafe(s);
  }

  function ident(...parts: string[]): SafeSql {
    if (parts.length === 0) {
      throw new TypeError("ident() requires at least one part");
    }
    const escaped = parts.map((p) => quoteIdentPart(p));
    return makeSafe(escaped.join("."));
  }

  function quoteIdentPart(part: unknown): string {
    if (typeof part !== "string") {
      throw new TypeError(
        `ident() part must be a non-empty string, got: ${String(part)}`,
      );
    }
    if (part === "") {
      throw new TypeError(
        `ident() part must be a non-empty string, got: ${JSON.stringify(part)}`,
      );
    }
    if (dialect === "snowflake") {
      if (part.includes("\x00")) {
        throw new TypeError(
          "ident() part contains NUL, which is not permitted in snowflake identifiers",
        );
      }
      return `"${part.replace(/"/g, '""')}"`;
    }
    // bigquery
    const rejects: [string, string][] = [
      ["\x00", "NUL"],
      ["\n", "newline"],
      ["\r", "carriage return"],
    ];
    for (const [bad, name] of rejects) {
      if (part.includes(bad)) {
        throw new TypeError(
          `ident() part contains ${name}, which is not permitted in bigquery identifiers`,
        );
      }
    }
    const escaped = part.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
    return `\`${escaped}\``;
  }

  // Tag function — populated in subsequent tasks.
  function tag(_strings: TemplateStringsArray, ..._values: unknown[]): string {
    throw new Error("sql`...` not implemented yet");
  }

  const api = tag as Sql;
  // Attach methods.
  Object.defineProperty(api, "dialect", { value: dialect, enumerable: true });
  api.raw = raw;
  // literal, ident, date added in later tasks.
  api.literal = () => {
    throw new Error("literal() not implemented yet");
  };
  api.ident = ident;
  api.date = () => {
    throw new Error("date() not implemented yet");
  };
  return api;
}
