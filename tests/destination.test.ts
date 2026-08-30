import { describe, expect, it, vi } from "vitest";
import { createWebhookDestination } from "../src/edge/destinations/webhook.js";

const event = {
  event_id: "event-1",
  event_type: "page_view" as const,
  occurred_at: "2026-08-30T18:30:00.000Z",
  page: { path: "/" },
  schema_version: 1 as const,
  site: { hostname: "example.com", platform: "netlify" as const, platform_site_id: "site-1" },
  source: "browser" as const,
};

describe("destination adapters", () => {
  it("sends the canonical envelope through a configurable authenticated webhook", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    const destination = createWebhookDestination({
      authHeader: "x-api-key",
      authScheme: "",
      fetchImpl,
      token: "site-secret",
      url: "https://collector.example/events",
    });

    await expect(destination.send(event)).resolves.toEqual({ accepted: true, status: 202 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://collector.example/events",
      expect.objectContaining({
        body: JSON.stringify(event),
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-api-key": "site-secret",
        }),
        method: "POST",
      }),
    );
  });

  it("refuses insecure remote destinations", () => {
    expect(() =>
      createWebhookDestination({
        fetchImpl: vi.fn<typeof fetch>(),
        token: "site-secret",
        url: "http://collector.example/events",
      }),
    ).toThrow(/HTTPS/);
  });
});
