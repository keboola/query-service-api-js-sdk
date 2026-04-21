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

  function literal(value: unknown): SafeSql {
    if (isSafeSql(value)) {
      return value;
    }
    if (value === null || value === undefined) {
      return makeSafe("NULL");
    }
    if (typeof value === "boolean") {
      return makeSafe(value ? "TRUE" : "FALSE");
    }
    if (typeof value === "bigint") {
      return makeSafe(String(value));
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new RangeError(
          `Cannot escape non-finite number: ${value}. ` +
            `Snowflake and BigQuery literals do not support NaN/Infinity.`,
        );
      }
      return makeSafe(String(value));
    }
    if (typeof value === "string") {
      if (value.includes("\x00")) {
        throw new TypeError(
          "String literal contains NUL character, which neither Snowflake nor BigQuery accept",
        );
      }
      const escaped = value.replace(/\\/g, "\\\\").replace(/'/g, "''");
      return makeSafe(`'${escaped}'`);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return makeSafe("(NULL)");
      }
      const parts = value.map((elem) => {
        if (Array.isArray(elem)) {
          throw new TypeError(
            "Nested arrays are not supported in SQL literals",
          );
        }
        return literal(elem).sql;
      });
      return makeSafe(`(${parts.join(", ")})`);
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new RangeError("Cannot escape invalid Date");
      }
      const yyyy = String(value.getUTCFullYear()).padStart(4, "0");
      const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(value.getUTCDate()).padStart(2, "0");
      const HH = String(value.getUTCHours()).padStart(2, "0");
      const MM = String(value.getUTCMinutes()).padStart(2, "0");
      const SS = String(value.getUTCSeconds()).padStart(2, "0");
      const fff = String(value.getUTCMilliseconds()).padStart(3, "0");
      const iso = `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}.${fff}+00:00`;
      if (dialect === "snowflake") {
        return makeSafe(`'${iso}'::TIMESTAMP_TZ`);
      }
      return makeSafe(`TIMESTAMP '${iso}'`);
    }
    throw new TypeError(
      `Cannot escape value of type ${typeof value}. ` +
        `Supported: null/undefined, boolean, number, bigint, string, Date, ` +
        `Array, SafeSql. If you have a Decimal/BigDecimal/UUID/Buffer value, ` +
        `convert to string explicitly and pass that.`,
    );
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function date(value: Date | string): SafeSql {
    let iso: string;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new TypeError("date() received an invalid Date");
      }
      const yyyy = String(value.getUTCFullYear()).padStart(4, "0");
      const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(value.getUTCDate()).padStart(2, "0");
      iso = `${yyyy}-${mm}-${dd}`;
    } else if (typeof value === "string") {
      if (!DATE_RE.test(value)) {
        throw new TypeError(
          `date() expects Date or 'YYYY-MM-DD' string, got: ${JSON.stringify(value)}`,
        );
      }
      iso = value;
    } else {
      throw new TypeError(
        `date() expects Date or 'YYYY-MM-DD' string, got: ${typeof value}`,
      );
    }
    if (dialect === "snowflake") {
      return makeSafe(`'${iso}'::DATE`);
    }
    return makeSafe(`DATE '${iso}'`);
  }

  // Tag function — populated in subsequent tasks.
  function tag(_strings: TemplateStringsArray, ..._values: unknown[]): string {
    throw new Error("sql`...` not implemented yet");
  }

  const api = tag as Sql;
  // Attach methods.
  Object.defineProperty(api, "dialect", { value: dialect, enumerable: true });
  api.raw = raw;
  api.literal = literal;
  api.ident = ident;
  api.date = date;
  return api;
}
