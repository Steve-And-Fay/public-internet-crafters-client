import { describe, expect, it } from "vitest";
import { netlifyHealth } from "../src/edge/health.js";

const values = {
  IC_ANALYTICS_ENABLED: "true",
  IC_ANALYTICS_INGEST_URL: "https://collector.example.com/private-path",
  IC_ANALYTICS_INGEST_TOKEN: "secret-test-token",
};
const environment = (overrides: Record<string, string> = {}) => ({
  get: (name: string) => ({ ...values, ...overrides })[name as keyof typeof values],
});

describe("read-only Netlify health endpoint", () => {
  it("reports configuration readiness without credentials or delivery claims", async () => {
    const response = netlifyHealth(environment());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("secret-test-token");
    expect(body).not.toContain("collector.example.com");
    expect(JSON.parse(body)).toMatchObject({
      status: "ready",
      browserEnabled: true,
      crawlersEnabled: true,
      collectorConfigured: true,
      deliveryVerified: false,
    });
  });

  it.each([
    { IC_ANALYTICS_INGEST_TOKEN: "" },
    { IC_ANALYTICS_INGEST_URL: "" },
    { IC_ANALYTICS_INGEST_URL: "http://collector.example.com/events" },
    { IC_ANALYTICS_INGEST_URL: "invalid" },
  ])("rejects incomplete or unsafe collector configuration: %j", async (overrides) => {
    const response = netlifyHealth(environment(overrides));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "misconfigured",
      collectorConfigured: false,
    });
  });

  it("reports master and channel opt-outs", async () => {
    expect(
      await netlifyHealth(environment({ IC_ANALYTICS_ENABLED: "false" })).json(),
    ).toMatchObject({
      status: "disabled",
      browserEnabled: false,
      crawlersEnabled: false,
    });
    expect(
      await netlifyHealth(environment({ IC_ANALYTICS_BROWSER: "false" })).json(),
    ).toMatchObject({
      status: "ready",
      browserEnabled: false,
      crawlersEnabled: true,
    });
  });
});
