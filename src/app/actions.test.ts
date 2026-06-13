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

describe("updateDisplayName admin session handling", () => {
  it("checks the admin password when renaming to an admin name", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");
    const updateDisplayNameSource = actionSource(source, "updateDisplayName");

    expect(updateDisplayNameSource).toContain(
      'String(formData.get("adminPassword") ?? "")',
    );
    expect(updateDisplayNameSource).toContain("requiresPassword: true");
    expect(updateDisplayNameSource).not.toContain("assertAdminNameAllowed");
  });

  it("updates the admin session cookie based on the renamed display name", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");
    const updateDisplayNameSource = actionSource(source, "updateDisplayName");

    expect(updateDisplayNameSource).toContain("cookieStore.delete(ADMIN_COOKIE)");
    expect(updateDisplayNameSource).toContain(
      "cookieStore.set(ADMIN_COOKIE, token, cookieOptions())",
    );
  });
});

describe("ordinary name admin cookie cleanup", () => {
  it("clears any existing admin session when entering an ordinary name", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");
    const enterNameSource = actionSource(source, "enterName");

    expect(enterNameSource).toContain("cookieStore.delete(ADMIN_COOKIE)");
  });

  it("clears any existing admin session when switching to an ordinary name", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");
    const updateDisplayNameSource = actionSource(source, "updateDisplayName");

    expect(updateDisplayNameSource).toContain("cookieStore.delete(ADMIN_COOKIE)");
    expect(updateDisplayNameSource).not.toContain("} else if (isAdmin) {");
  });
});

describe("updateDisplayName name-based identity switching", () => {
  it("switches to the user for the renamed display name instead of renaming the current user", () => {
    const source = readFileSync("src/app/actions.ts", "utf8");
    const updateDisplayNameSource = actionSource(source, "updateDisplayName");

    expect(updateDisplayNameSource).toContain("getOrCreateUserByDisplayName");
    expect(updateDisplayNameSource).toContain("cookieStore.set(USER_COOKIE");
    expect(updateDisplayNameSource).not.toContain("transaction.user.update");
  });
});

function actionSource(source: string, actionName: string): string {
  const start = source.indexOf(`export async function ${actionName}`);
  const end = source.indexOf("export async function", start + 1);

  return source.slice(start, end);
}
