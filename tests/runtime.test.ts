import { describe, expect, it } from "vitest";
import { runtimeRelease } from "../src/edge/runtime.js";

function environment(values: Record<string, string | undefined>) {
  return { get: (name: string) => values[name] };
}

describe("Netlify runtime metadata", () => {
  it("uses an explicit release before Netlify deploy metadata", () => {
    expect(
      runtimeRelease(
        environment({
          COMMIT_REF: "commit-456",
          DEPLOY_ID: "deploy-789",
          IC_ANALYTICS_RELEASE: "customer-release-123",
        }),
      ),
    ).toBe("customer-release-123");
  });

  it("falls back through Netlify commit and deploy identifiers", () => {
    expect(runtimeRelease(environment({ COMMIT_REF: "commit-456", DEPLOY_ID: "deploy-789" }))).toBe(
      "commit-456",
    );
    expect(runtimeRelease(environment({ DEPLOY_ID: "deploy-789" }))).toBe("deploy-789");
    expect(runtimeRelease(environment({}))).toBe("unknown");
  });
});
