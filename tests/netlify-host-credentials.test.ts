// cspell:ignore unstub
import { afterEach, describe, expect, it, vi } from "vitest";
import browserBootstrap from "../src/edge/entrypoints/browser-bootstrap.js";
import browserEvents from "../src/edge/entrypoints/browser-events.js";
import crawlerObserver from "../src/edge/entrypoints/crawler-observer.js";
import { netlifyHealth } from "../src/edge/health.js";

afterEach(() => vi.unstubAllGlobals());

const tokens = { "example.com": "primary-secret", "alias.example.com": "alias-secret" };
function setup(raw: string | undefined = JSON.stringify(tokens)) {
  const values: Record<string, string | undefined> = {
    IC_ANALYTICS_ENABLED: "true",
    IC_ANALYTICS_INGEST_URL: "https://collector.example.com/events",
    IC_ANALYTICS_INGEST_TOKEN: "legacy-secret",
    IC_ANALYTICS_INGEST_TOKENS_BY_HOST: raw,
    IC_ANALYTICS_PUBLIC_PATHS: '["/","/contact"]',
  };
  const env = { get: (name: string) => values[name] };
  vi.stubGlobal("Netlify", { env });
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetcher);
  return { env, fetcher, values };
}
const html = "<html><head></head><body>Public page</body></html>";
const context = () => ({
  next: async () => new Response(html, { headers: { "content-type": "text/html" } }),
  waitUntil: vi.fn(),
});
const request = (hostname: string) =>
  new Request(`https://${hostname}/__ic/analytics/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: `https://${hostname}` },
    body: JSON.stringify({
      event_type: "page_view",
      path: "/",
      site: { hostname: "forged.example" },
    }),
  });

describe("exact-host Netlify credentials", () => {
  it.each(Object.entries(tokens))(
    "routes browser and crawler credentials for %s without rewriting the host",
    async (host, token) => {
      const { fetcher } = setup();
      expect((await browserEvents(request(host), context())).status).toBe(202);
      const crawlerContext = context();
      await crawlerObserver(new Request(`https://${host}/contact`), crawlerContext);
      await crawlerContext.waitUntil.mock.calls[0]?.[0];
      expect(fetcher).toHaveBeenCalledTimes(2);
      for (const [, options] of fetcher.mock.calls) {
        expect(options.headers.authorization).toBe(`Bearer ${token}`);
        expect(JSON.parse(options.body).site.hostname).toBe(host);
        expect(options.body).not.toContain(token);
      }
    },
  );

  it("preserves the existing single-token behavior when no map is configured", async () => {
    const { fetcher, values } = setup();
    delete values.IC_ANALYTICS_INGEST_TOKENS_BY_HOST;
    expect((await browserEvents(request("example.com"), context())).status).toBe(202);
    expect(fetcher.mock.calls[0]?.[1].headers.authorization).toBe("Bearer legacy-secret");
  });

  it.each([
    "unregistered.example.com",
    "preview.netlify.app",
    "example.com.evil.test",
    "www.example.com",
  ])(
    "fails closed for the unmapped host %s without falling back to a single token",
    async (host) => {
      const { env, fetcher } = setup();
      expect((await browserEvents(request(host), context())).status).toBe(503);
      expect(
        await (await browserBootstrap(new Request(`https://${host}/`), context())).text(),
      ).toBe(html);
      const crawlerContext = context();
      await crawlerObserver(new Request(`https://${host}/`), crawlerContext);
      expect(crawlerContext.waitUntil).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
      expect(netlifyHealth(env, host).status).toBe(503);
    },
  );

  it.each([
    "",
    "broken-json",
    "null",
    "[]",
    "{}",
    '{"example.com":null}',
    '{"example.com":""}',
    '{"example.com":" token "}',
    '{"*.example.com":"token"}',
    '{"https://example.com":"token"}',
    '{"Example.com":"token"}',
    '{"example.com":"bad\\nheader"}',
    JSON.stringify({ "example.com": "a".repeat(1025) }),
  ])("rejects malformed maps without single-token fallback (%#)", async (raw) => {
    const { env, fetcher } = setup(raw);
    expect((await browserEvents(request("example.com"), context())).status).toBe(503);
    expect(netlifyHealth(env, "example.com").status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps all credentials and the map out of HTML and health output", async () => {
    const { env } = setup();
    const response = await browserBootstrap(new Request("https://alias.example.com/"), context());
    const body = await response.text();
    expect(body).toContain("/__ic/analytics/v1/client.js");
    const health = netlifyHealth(env, "alias.example.com");
    expect(health.status).toBe(200);
    const publicOutput = body + (await health.text());
    for (const privateValue of [
      ...Object.values(tokens),
      "legacy-secret",
      "IC_ANALYTICS_INGEST_TOKENS_BY_HOST",
      "collector.example.com",
    ])
      expect(publicOutput).not.toContain(privateValue);
  });

  it("retains same-origin and private-page restrictions on a mapped alias", async () => {
    const { fetcher } = setup();
    const crossOrigin = request("alias.example.com");
    crossOrigin.headers.set("origin", "https://example.com");
    expect((await browserEvents(crossOrigin, context())).status).toBe(403);
    expect(
      await (
        await browserBootstrap(new Request("https://alias.example.com/admin"), context())
      ).text(),
    ).toBe(html);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
