// cspell:ignore unstub dmin ftwo
import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePublicPaths, publicPathAllowed } from "../src/contracts/public-paths.js";
import browserBootstrap from "../src/edge/entrypoints/browser-bootstrap.js";
import browserEvents from "../src/edge/entrypoints/browser-events.js";
import crawlerObserver from "../src/edge/entrypoints/crawler-observer.js";
import { netlifyHealth } from "../src/edge/health.js";

afterEach(() => vi.unstubAllGlobals());

const values: Record<string, string> = {
  IC_ANALYTICS_ENABLED: "true",
  IC_ANALYTICS_INGEST_URL: "https://collector.example.com/events",
  IC_ANALYTICS_INGEST_TOKEN: "test-token",
  IC_ANALYTICS_PUBLIC_PATHS: '["/","/privacy","/specimens/*"]',
};
const env = (raw = values.IC_ANALYTICS_PUBLIC_PATHS) => ({
  get: (name: string) => (name === "IC_ANALYTICS_PUBLIC_PATHS" ? raw : values[name]),
});

describe("public page allowlists", () => {
  it("preserves collection without a policy and supports exact pages and subtrees", () => {
    expect(publicPathAllowed("/anything", parsePublicPaths(undefined))).toBe(true);
    const policy = parsePublicPaths(values.IC_ANALYTICS_PUBLIC_PATHS);
    for (const path of ["/", "/privacy", "/privacy/", "/specimens/public-item"])
      expect(publicPathAllowed(path, policy)).toBe(true);
    for (const path of ["/r/private-room", "/admin", "/specimens-private", "/specimens"])
      expect(publicPathAllowed(path, policy)).toBe(false);
  });

  it.each(["", "not-json", "{}", '["/*"]', '["/","/r/../admin"]', '["/%61dmin"]', '["/",5]'])(
    "fails closed on invalid configuration: %s",
    (raw) => {
      expect(parsePublicPaths(raw).mode).toBe("invalid");
      expect(publicPathAllowed("/", parsePublicPaths(raw))).toBe(false);
    },
  );

  it("blocks ambiguous, encoded, escaped, and private source paths", () => {
    const policy = parsePublicPaths('["/","/specimens/*"]');
    for (const path of [
      "//evil.example/",
      "/specimens/../r/secret",
      "/specimens/%2e%2e/r/secret",
      "/specimens/%252e%252e/r/secret",
      "/specimens/one%2ftwo",
      "/specimens/one?token=private",
      "/specimens/one#private",
      "/specimens/one\\secret",
      "/specimens//secret",
    ])
      expect(publicPathAllowed(path, policy)).toBe(false);
    expect(publicPathAllowed("/", parsePublicPaths("[]"))).toBe(false);
  });

  it("leaves private HTML untouched and embeds the policy only on public pages", async () => {
    vi.stubGlobal("Netlify", { env: env() });
    const html = "<html><head></head><body>Site content</body></html>";
    const privateResponse = new Response(html, {
      headers: { "content-type": "text/html", etag: "untouched" },
    });
    const privateResult = await browserBootstrap(
      new Request("https://example.com/r/private-room"),
      { next: async () => privateResponse, waitUntil: vi.fn() },
    );
    expect(privateResult).toBe(privateResponse);
    expect(await privateResult.text()).toBe(html);
    const publicResult = await browserBootstrap(new Request("https://example.com/privacy"), {
      next: async () => new Response(html, { headers: { "content-type": "text/html" } }),
      waitUntil: vi.fn(),
    });
    expect(await publicResult.text()).toContain('name="ic-public-paths"');
  });

  it("does not forward private crawler pages or crafted private browser payloads", async () => {
    vi.stubGlobal("Netlify", { env: env() });
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    const waitUntil = vi.fn();
    await crawlerObserver(new Request("https://example.com/r/private-room"), {
      next: async () =>
        new Response("<html>Private</html>", { headers: { "content-type": "text/html" } }),
      waitUntil,
    });
    expect(waitUntil).not.toHaveBeenCalled();
    for (const path of ["/admin", "/r/private-room", "/specimens/%2e%2e/r/private"]) {
      const response = await browserEvents(
        new Request("https://example.com/__ic/analytics/v1/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event_type: "page_view", path }),
        }),
        { next: vi.fn(), waitUntil },
      );
      expect(response.status).toBe(204);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not forward a private internal destination from an allowed source page", async () => {
    vi.stubGlobal("Netlify", { env: env() });
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await browserEvents(
      new Request("https://example.com/__ic/analytics/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_type: "click",
          path: "/",
          target: { destination: "https://example.com/r/private-room", name: "private-room" },
        }),
      }),
      { next: vi.fn(), waitUntil: vi.fn() },
    );
    expect(response.status).toBe(204);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports invalid policy configuration without leaking its contents", async () => {
    const response = netlifyHealth(env('["/private-token",invalid]'));
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ status: "misconfigured", publicPathsValid: false });
    expect(body).not.toContain("private-token");
  });
});
