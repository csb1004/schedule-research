import { describe, expect, it } from "vitest";
import {
  getOrCreateUserByDisplayName,
  normalizeDisplayName,
  type IdentityUser,
  type UserIdentityStore,
  validateDisplayNameRename,
} from "./identity";

class FakeUserIdentityStore implements UserIdentityStore {
  users: IdentityUser[];

  constructor(users: IdentityUser[] = []) {
    this.users = users;
  }

  async findFirst({
    where,
    orderBy,
  }: Parameters<UserIdentityStore["findFirst"]>[0]) {
    const matches = this.users.filter(
      (user) => user.displayName === where.displayName,
    );

    if (orderBy.createdAt === "asc") {
      matches.sort((first, second) => {
        return first.createdAt.getTime() - second.createdAt.getTime();
      });
    }

    return matches[0] ?? null;
  }

  async create({ data }: Parameters<UserIdentityStore["create"]>[0]) {
    const user = {
      id: `user-${this.users.length + 1}`,
      displayName: data.displayName,
      shortCode: data.shortCode,
      createdAt: new Date(`2026-06-${10 + this.users.length}T00:00:00.000Z`),
    };

    this.users.push(user);

    return user;
  }
}

describe("normalizeDisplayName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeDisplayName("  지민  ")).toBe("지민");
  });

  it("rejects blank names", () => {
    expect(() => normalizeDisplayName("   ")).toThrow("이름을 입력해주세요.");
  });
});

describe("getOrCreateUserByDisplayName", () => {
  it("reuses the oldest existing user with the same display name", async () => {
    const oldestUser = {
      id: "user-oldest",
      displayName: "지민",
      shortCode: "AAAA",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    };
    const newestUser = {
      id: "user-newest",
      displayName: "지민",
      shortCode: "BBBB",
      createdAt: new Date("2026-06-02T00:00:00.000Z"),
    };
    const userStore = new FakeUserIdentityStore([newestUser, oldestUser]);

    await expect(
      getOrCreateUserByDisplayName(userStore, " 지민 "),
    ).resolves.toEqual({
      user: oldestUser,
      created: false,
    });
  });

  it("creates a user when no display name exists", async () => {
    const userStore = new FakeUserIdentityStore();

    await expect(
      getOrCreateUserByDisplayName(userStore, " 지민 ", () => "ZZ99"),
    ).resolves.toMatchObject({
      user: {
        displayName: "지민",
        shortCode: "ZZ99",
      },
      created: true,
    });
  });
});

describe("validateDisplayNameRename", () => {
  it("rejects a display name used by another user", async () => {
    const userStore = new FakeUserIdentityStore([
      {
        id: "other-user",
        displayName: "지민",
        shortCode: "AAAA",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    ]);

    await expect(
      validateDisplayNameRename(userStore, " 지민 ", "current-user"),
    ).rejects.toThrow("이미 사용 중인 이름입니다.");
  });

  it("allows keeping the current user's display name", async () => {
    const userStore = new FakeUserIdentityStore([
      {
        id: "current-user",
        displayName: "지민",
        shortCode: "AAAA",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    ]);

    await expect(
      validateDisplayNameRename(userStore, " 지민 ", "current-user"),
    ).resolves.toBe("지민");
  });
});
