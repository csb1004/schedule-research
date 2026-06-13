import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("server action database locks", () => {
  it("does not return PostgreSQL void values from advisory lock queries", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");

    expect(source).toContain("WITH lock AS");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("SELECT 1::int AS locked FROM lock");
  });
});
