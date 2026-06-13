import { describe, expect, it } from "vitest";
import { isDatabaseConnectionError } from "./db-error";

describe("isDatabaseConnectionError", () => {
  it("detects terminated PostgreSQL connections", () => {
    expect(
      isDatabaseConnectionError(new Error("Connection terminated unexpectedly")),
    ).toBe(true);
  });

  it("does not treat unrelated errors as database connection errors", () => {
    expect(isDatabaseConnectionError(new Error("Name is required"))).toBe(false);
  });
});

