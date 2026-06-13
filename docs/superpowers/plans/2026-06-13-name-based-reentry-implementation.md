# Name-Based Reentry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users re-enter by name and edit the availability previously recorded under that same name, while keeping admin names password-protected.

**Architecture:** Extract name identity rules into a small `src/lib/identity.ts` helper that is easy to test without Next cookies or a real database. Server actions will call this helper to reuse existing users, create new users, and reject ambiguous renames. The calendar UI will stop rendering short codes while keeping short codes in the database.

**Tech Stack:** Next.js App Router server actions, Prisma 7, Vitest, TypeScript.

---

## File Structure

- Create `src/lib/identity.ts`: pure-ish identity helper functions and small repository interfaces for Prisma user delegates.
- Create `src/lib/identity.test.ts`: TDD coverage for name reuse, new user creation, short-code collision retry, duplicate rename rejection, and same-user rename allowance.
- Modify `src/app/actions.ts`: replace always-create entry flow with get-or-create-by-name; block duplicate display-name renames; keep admin password challenge.
- Modify `src/app/schedule-calendar.tsx`: remove visible `#shortCode` rendering from current user and selected-day user rows.
- Modify `src/app/schedule-calendar.test.ts`: add a source-level regression test that the calendar no longer renders short-code text.

---

### Task 1: Add Tested Identity Helper

**Files:**
- Create: `src/lib/identity.ts`
- Create: `src/lib/identity.test.ts`
- Modify: `src/lib/user.ts`

- [ ] **Step 1: Write the failing identity helper tests**

Create `src/lib/identity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getOrCreateUserByDisplayName,
  normalizeDisplayName,
  validateDisplayNameRename,
  type IdentityUser,
  type UserIdentityStore,
} from "./identity";

function user(
  overrides: Partial<IdentityUser> & Pick<IdentityUser, "id" | "displayName">,
): IdentityUser {
  return {
    id: overrides.id,
    displayName: overrides.displayName,
    shortCode: overrides.shortCode ?? "ABCD",
    createdAt: overrides.createdAt ?? new Date("2026-06-13T00:00:00.000Z"),
  };
}

function store(existing: IdentityUser[] = []): UserIdentityStore & {
  created: IdentityUser[];
} {
  const created: IdentityUser[] = [];

  return {
    created,
    async findFirst({ where, orderBy }) {
      const matches = existing.filter(
        (record) => record.displayName === where.displayName,
      );

      if (orderBy.createdAt === "asc") {
        matches.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
      }

      return matches[0] ?? null;
    },
    async create({ data }) {
      const record = user({
        id: `created-${created.length + 1}`,
        displayName: data.displayName,
        shortCode: data.shortCode,
      });
      created.push(record);
      return record;
    },
  };
}

describe("normalizeDisplayName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeDisplayName("  추상범  ")).toBe("추상범");
  });
});

describe("getOrCreateUserByDisplayName", () => {
  it("reuses the oldest existing user with the same display name", async () => {
    const older = user({
      id: "older",
      displayName: "추상범",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    const newer = user({
      id: "newer",
      displayName: "추상범",
      createdAt: new Date("2026-06-02T00:00:00.000Z"),
    });
    const userStore = store([newer, older]);

    await expect(
      getOrCreateUserByDisplayName(userStore, " 추상범 "),
    ).resolves.toEqual({ user: older, created: false });
    expect(userStore.created).toHaveLength(0);
  });

  it("creates a user when no display name exists", async () => {
    const userStore = store();

    await expect(
      getOrCreateUserByDisplayName(userStore, "새이름", () => "WXYZ"),
    ).resolves.toEqual({
      user: expect.objectContaining({
        displayName: "새이름",
        shortCode: "WXYZ",
      }),
      created: true,
    });
    expect(userStore.created).toHaveLength(1);
  });
});

describe("validateDisplayNameRename", () => {
  it("rejects a display name used by another user", async () => {
    const userStore = store([user({ id: "other-user", displayName: "이미있음" })]);

    await expect(
      validateDisplayNameRename(userStore, "이미있음", "current-user"),
    ).rejects.toThrow("이미 사용 중인 이름입니다.");
  });

  it("allows keeping the current user's display name", async () => {
    const current = user({ id: "current-user", displayName: "내이름" });
    const userStore = store([current]);

    await expect(
      validateDisplayNameRename(userStore, "내이름", "current-user"),
    ).resolves.toBe("내이름");
  });
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run:

```powershell
npm test -- src/lib/identity.test.ts
```

Expected: FAIL because `src/lib/identity.ts` does not exist.

- [ ] **Step 3: Implement the identity helper**

Create `src/lib/identity.ts`:

```ts
import { createShortCode } from "@/lib/user";

export type IdentityUser = {
  id: string;
  displayName: string;
  shortCode: string;
  createdAt: Date;
};

export type UserIdentityStore = {
  findFirst(input: {
    where: { displayName: string };
    orderBy: { createdAt: "asc" };
  }): Promise<IdentityUser | null>;
  create(input: {
    data: { displayName: string; shortCode: string };
  }): Promise<IdentityUser>;
};

export type GetOrCreateUserResult = {
  user: IdentityUser;
  created: boolean;
};

export function normalizeDisplayName(displayName: string): string {
  return displayName.trim();
}

export async function getOrCreateUserByDisplayName(
  userStore: UserIdentityStore,
  displayName: string,
  createCode = createShortCode,
): Promise<GetOrCreateUserResult> {
  const normalizedName = normalizeDisplayName(displayName);

  if (!normalizedName) {
    throw new Error("이름을 입력해주세요.");
  }

  const existingUser = await userStore.findFirst({
    where: { displayName: normalizedName },
    orderBy: { createdAt: "asc" },
  });

  if (existingUser) {
    return { user: existingUser, created: false };
  }

  return {
    user: await createUserWithUniqueCode(userStore, normalizedName, createCode),
    created: true,
  };
}

export async function validateDisplayNameRename(
  userStore: UserIdentityStore,
  displayName: string,
  currentUserId: string,
): Promise<string> {
  const normalizedName = normalizeDisplayName(displayName);

  if (!normalizedName) {
    throw new Error("이름을 입력해주세요.");
  }

  const existingUser = await userStore.findFirst({
    where: { displayName: normalizedName },
    orderBy: { createdAt: "asc" },
  });

  if (existingUser && existingUser.id !== currentUserId) {
    throw new Error("이미 사용 중인 이름입니다.");
  }

  return normalizedName;
}

async function createUserWithUniqueCode(
  userStore: UserIdentityStore,
  displayName: string,
  createCode: () => string,
): Promise<IdentityUser> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await userStore.create({
        data: {
          displayName,
          shortCode: createCode(),
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("사용자 코드를 생성하지 못했습니다.");
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
```

Keep `src/lib/user.ts` unchanged for now; `createShortCode` remains there.

- [ ] **Step 4: Run helper tests and verify GREEN**

Run:

```powershell
npm test -- src/lib/identity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/lib/identity.ts src/lib/identity.test.ts
git commit -m "feat: add name-based identity helper"
```

---

### Task 2: Wire Name Reentry Into Server Actions

**Files:**
- Modify: `src/app/actions.ts`
- Test: `src/lib/identity.test.ts`

- [ ] **Step 1: Extend the helper tests for short-code collision retry**

Append this test inside `describe("getOrCreateUserByDisplayName", ...)` in `src/lib/identity.test.ts`:

```ts
  it("retries when generated short codes collide", async () => {
    const userStore = store();
    let attempts = 0;
    const createCode = () => {
      attempts += 1;
      return attempts === 1 ? "DUP1" : "OK22";
    };
    const originalCreate = userStore.create;

    userStore.create = async (input) => {
      if (input.data.shortCode === "DUP1") {
        const error = new Error("duplicate");
        Object.assign(error, { code: "P2002" });
        throw error;
      }

      return originalCreate(input);
    };

    await expect(
      getOrCreateUserByDisplayName(userStore, "충돌", createCode),
    ).resolves.toEqual({
      user: expect.objectContaining({ shortCode: "OK22" }),
      created: true,
    });
  });
```

- [ ] **Step 2: Run the expanded helper tests**

Run:

```powershell
npm test -- src/lib/identity.test.ts
```

Expected: PASS, because Task 1 already included retry behavior.

- [ ] **Step 3: Replace user creation in server actions**

Modify the imports at the top of `src/app/actions.ts`:

```ts
import {
  getOrCreateUserByDisplayName,
  normalizeDisplayName,
  validateDisplayNameRename,
} from "@/lib/identity";
```

Remove:

```ts
import { createShortCode } from "@/lib/user";
```

Update `enterName`:

```ts
export async function enterName(
  _previousState: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const displayName = normalizeDisplayName(String(formData.get("displayName") ?? ""));
  const password = String(formData.get("adminPassword") ?? "");

  if (!displayName) {
    return { ok: false, error: "이름을 입력해주세요." };
  }

  const adminNames = parseAdminNames(process.env.ADMIN_NAMES);
  const isAdminName = adminNames.includes(displayName);

  if (isAdminName && !password) {
    return { ok: false, requiresPassword: true, adminName: displayName };
  }

  if (isAdminName && password !== process.env.ADMIN_PASSWORD) {
    return {
      ok: false,
      error: "관리자 비밀번호가 올바르지 않습니다.",
      requiresPassword: true,
      adminName: displayName,
    };
  }

  const { user } = await getOrCreateUserByDisplayName(prisma.user, displayName);
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, user.id, cookieOptions());

  if (isAdminName) {
    const secret = requireAdminSecret();
    const token = await signAdminSession(user.id, secret, ADMIN_TTL_SECONDS);
    cookieStore.set(ADMIN_COOKIE, token, cookieOptions());
  }

  revalidatePath("/");
  return { ok: true };
}
```

Update `updateDisplayName`:

```ts
export async function updateDisplayName(formData: FormData): Promise<EntryState> {
  const user = await requireCurrentUser();

  try {
    const displayName = await validateDisplayNameRename(
      prisma.user,
      String(formData.get("displayName") ?? ""),
      user.id,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { displayName },
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "이름을 변경하지 못했습니다.",
    };
  }

  revalidatePath("/");
  return { ok: true };
}
```

Delete the local `createUserWithUniqueCode` and `isUniqueConstraintError` functions from `src/app/actions.ts`.

- [ ] **Step 4: Run TypeScript/build-focused verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and build succeeds. This catches incorrect Prisma delegate typing in the server action wiring.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/app/actions.ts src/lib/identity.test.ts
git commit -m "feat: reuse users by display name"
```

---

### Task 3: Hide Short Codes From User-Facing Calendar UI

**Files:**
- Modify: `src/app/schedule-calendar.test.ts`
- Modify: `src/app/schedule-calendar.tsx`

- [ ] **Step 1: Add a failing source regression test**

Append this test to `src/app/schedule-calendar.test.ts`:

```ts
  it("does not render user short codes in visible labels", () => {
    const source = readFileSync("src/app/schedule-calendar.tsx", "utf8");

    expect(source).not.toContain("#{currentUser.shortCode}");
    expect(source).not.toContain("#{entry.shortCode}");
  });
```

- [ ] **Step 2: Run the calendar source tests and verify RED**

Run:

```powershell
npm test -- src/app/schedule-calendar.test.ts
```

Expected: FAIL because `schedule-calendar.tsx` currently renders both short-code strings.

- [ ] **Step 3: Remove visible short-code rendering**

In `src/app/schedule-calendar.tsx`, change the settings button content from:

```tsx
{currentUser.displayName} #{currentUser.shortCode}
```

to:

```tsx
{currentUser.displayName}
```

In the user row, remove this span:

```tsx
<span>#{entry.shortCode}</span>
```

Keep the `shortCode` fields in the data types for now. They remain available for internal storage even though the UI does not render them.

- [ ] **Step 4: Run the calendar source tests and verify GREEN**

Run:

```powershell
npm test -- src/app/schedule-calendar.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/app/schedule-calendar.tsx src/app/schedule-calendar.test.ts
git commit -m "feat: hide visible user short codes"
```

---

### Task 4: Final Verification and Deployment Push

**Files:**
- No new source files expected.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run build
```

Expected:

- `npm test`: all test files pass.
- `npm run build`: Prisma generate and Next build complete successfully.

- [ ] **Step 2: Confirm git state**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -5
```

Expected: working tree is clean and the three implementation commits are on `feat/schedule-calendar-app`.

- [ ] **Step 3: Push to GitHub main**

Run:

```powershell
git push origin HEAD:main
```

Expected: GitHub `main` advances to the latest implementation commit and Railway autodeploy starts.

- [ ] **Step 4: Manual production smoke test**

After Railway deploys:

1. Open the Railway public URL.
2. Enter a new non-admin name, for example `테스트사용자`.
3. Mark one date as available.
4. Clear the browser cookie or open an incognito window.
5. Enter the same name `테스트사용자`.
6. Confirm the same availability can be edited.
7. Enter an admin name from `ADMIN_NAMES`.
8. Confirm the admin password prompt still appears before entry.

Expected: same-name reentry works, short codes are not visible, and admin names remain password-protected.
