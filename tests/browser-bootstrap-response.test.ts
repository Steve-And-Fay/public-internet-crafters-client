// cspell:ignore unstub
import { afterEach, describe, expect, it, vi } from "vitest";
import browserBootstrap from "../src/edge/entrypoints/browser-bootstrap.js";

afterEach(() => vi.unstubAllGlobals());

describe("Netlify HTML response delivery", () => {
  it.each([
    ["normal HTML", "<html><head></head><body>Welcome</body></html>"],
    ["headless fragment", "<main>Welcome</main>"],
    [
      "already instrumented HTML",
      '<html><head><script src="/__ic/analytics/v1/client.js" defer></script></head><body>Welcome</body></html>',
    ],
  ])("returns a readable body for %s", async (_label, html) => {
    const values: Record<string, string> = {
      IC_ANALYTICS_ENABLED: "true",
      IC_ANALYTICS_INGEST_URL: "https://collector.example.com/events",
    };
    vi.stubGlobal("Netlify", { env: { get: (name: string) => values[name] } });
    const result = await browserBootstrap(new Request("https://example.com/"), {
      next: async () =>
        new Response(html, {
          headers: { "content-type": "text/html", "x-site-header": "preserved" },
          status: 203,
          statusText: "Non-Authoritative Information",
        }),
      waitUntil: vi.fn(),
    });

    expect(result.bodyUsed).toBe(false);
    expect(result.status).toBe(203);
    expect(result.headers.get("x-site-header")).toBe("preserved");
    const body = await result.text();
    expect(body).toContain("Welcome");
    if (html.includes("/__ic/") || !html.includes("</head>")) expect(body).toBe(html);
    else expect(body.match(/src="\/__ic\/analytics\/v1\/client.js"/gu)).toHaveLength(1);
  });

  it("preserves an untouched response when analytics is disabled", async () => {
    const response = new Response("<head></head><body>Welcome</body>", {
      headers: { "content-type": "text/html", etag: "original" },
    });
    const result = await browserBootstrap(new Request("https://example.com/"), {
      next: async () => response,
      waitUntil: vi.fn(),
    });
    expect(result).toBe(response);
    expect(await result.text()).toContain("Welcome");
    expect(result.headers.get("etag")).toBe("original");
  });

  it("passes the live Netlify deploy ID to the browser without build environment variables", async () => {
    const values: Record<string, string> = {
      IC_ANALYTICS_ENABLED: "true",
      IC_ANALYTICS_INGEST_URL: "https://collector.example.com/events",
    };
    vi.stubGlobal("Netlify", { env: { get: (name: string) => values[name] } });
    const response = await browserBootstrap(new Request("https://example.com/"), {
      deploy: { id: "edge-deploy-123" },
      next: async () =>
        new Response("<head></head><body>Welcome</body>", {
          headers: { "content-type": "text/html" },
        }),
      waitUntil: vi.fn(),
    });

    expect(await response.text()).toContain('<meta name="ic-release" content="edge-deploy-123">');
  });
});
