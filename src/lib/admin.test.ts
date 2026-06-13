import { describe, expect, it } from "vitest";
import {
  parseAdminNames,
  signAdminSession,
  verifyAdminSession,
} from "./admin";

describe("parseAdminNames", () => {
  it("trims comma-separated names and drops blanks", () => {
    expect(parseAdminNames("owner, admin ,Alex,,")).toEqual([
      "owner",
      "admin",
      "Alex",
    ]);
  });
});

describe("admin session signing", () => {
  it("accepts tokens signed with the same secret", async () => {
    const token = await signAdminSession("user-123", "secret", 60);

    await expect(verifyAdminSession(token, "secret")).resolves.toEqual({
      userId: "user-123",
    });
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await signAdminSession("user-123", "secret", 60);

    await expect(verifyAdminSession(token, "different")).resolves.toBeNull();
  });
});
