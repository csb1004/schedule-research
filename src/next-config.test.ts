import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Next self-hosting deployment config", () => {
  it("sets a deploymentId from Railway deployment metadata", () => {
    const source = readFileSync("next.config.ts", "utf8");

    expect(source).toContain("deploymentId");
    expect(source).toMatch(/RAILWAY_(GIT_COMMIT_SHA|DEPLOYMENT_ID)/);
  });
});
