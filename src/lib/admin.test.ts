import { describe, expect, it } from "vitest";
import {
  assertAdminNameAllowed,
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

describe("assertAdminNameAllowed", () => {
  it("rejects reserved admin names for non-admin users", () => {
    expect(() => assertAdminNameAllowed("owner", ["owner"], false)).toThrow(
      "관리자 이름은 관리자만 사용할 수 있습니다.",
    );
  });

  it("allows reserved admin names for admin users", () => {
    expect(() => assertAdminNameAllowed("owner", ["owner"], true)).not.toThrow();
  });

  it("allows ordinary names for non-admin users", () => {
    expect(() =>
      assertAdminNameAllowed("member", ["owner"], false),
    ).not.toThrow();
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
