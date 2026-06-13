import { describe, expect, it } from "vitest";
import { parseAdminNames } from "./admin";

describe("parseAdminNames", () => {
  it("trims comma-separated names and drops blanks", () => {
    expect(parseAdminNames("owner, admin ,Alex,,")).toEqual([
      "owner",
      "admin",
      "Alex",
    ]);
  });
});

