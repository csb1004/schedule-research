import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("server action database locks", () => {
  it("does not return PostgreSQL void values from advisory lock queries", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");

    expect(source).not.toContain("pg_advisory_xact_lock");
    expect(source).toContain("pg_try_advisory_xact_lock");
    expect(source).toContain("locked: boolean");
  });
});
