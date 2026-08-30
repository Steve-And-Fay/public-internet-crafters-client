import { describe, expect, it } from "vitest";
import { shouldInjectAnalyticsFunction } from "../src/injection.js";

const enabled = {
  IC_ANALYTICS_ENABLED: "true",
};

describe("build-time function selection", () => {
  it("injects crawler collection only for an enabled site", () => {
    expect(
      shouldInjectAnalyticsFunction({
        env: enabled,
        name: "crawler-observer",
      }),
    ).toBe(true);

    expect(
      shouldInjectAnalyticsFunction({
        env: {},
        name: "crawler-observer",
      }),
    ).toBe(false);
  });

  it("allows crawler and browser channels to be disabled independently", () => {
    expect(
      shouldInjectAnalyticsFunction({
        env: { ...enabled, IC_ANALYTICS_CRAWLERS: "false" },
        name: "crawler-observer",
      }),
    ).toBe(false);

    expect(
      shouldInjectAnalyticsFunction({
        env: { ...enabled, IC_ANALYTICS_BROWSER: "false" },
        name: "browser-bootstrap",
      }),
    ).toBe(false);
  });

  it("does not inject unknown future functions by accident", () => {
    expect(
      shouldInjectAnalyticsFunction({
        env: enabled,
        name: "unregistered-observer",
      }),
    ).toBe(false);
  });
});
