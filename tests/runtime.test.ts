import { describe, expect, it } from "vitest";
import { runtimeCollectionEnabled, runtimeRelease } from "../src/edge/runtime.js";

function environment(values: Record<string, string | undefined>) {
  return { get: (name: string) => values[name] };
}

describe("Netlify runtime metadata", () => {
  it("requires the global switch and defaults each enabled channel on", () => {
    expect(runtimeCollectionEnabled("browser", environment({}))).toBe(false);
    expect(runtimeCollectionEnabled("browser", environment({ IC_ANALYTICS_ENABLED: "true" }))).toBe(
      true,
    );
    expect(
      runtimeCollectionEnabled(
        "browser",
        environment({ IC_ANALYTICS_BROWSER: "false", IC_ANALYTICS_ENABLED: "true" }),
      ),
    ).toBe(false);
    expect(
      runtimeCollectionEnabled(
        "crawler",
        environment({ IC_ANALYTICS_CRAWLERS: "false", IC_ANALYTICS_ENABLED: "true" }),
      ),
    ).toBe(false);
  });

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

  it("uses the actual edge deploy when build environment variables are unavailable or stale", () => {
    expect(runtimeRelease(environment({}), { id: "edge-deploy-123" })).toBe("edge-deploy-123");
    expect(
      runtimeRelease(environment({ COMMIT_REF: "old-commit", DEPLOY_ID: "old-deploy" }), {
        id: "edge-deploy-123",
      }),
    ).toBe("edge-deploy-123");
    expect(
      runtimeRelease(environment({ IC_ANALYTICS_RELEASE: "explicit-release" }), {
        id: "edge-deploy-123",
      }),
    ).toBe("explicit-release");
  });
});
