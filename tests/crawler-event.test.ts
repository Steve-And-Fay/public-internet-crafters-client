import { describe, expect, it } from "vitest";
import { createCrawlerPageView } from "../src/edge/events/crawler.js";

describe("crawler page-view events", () => {
  it("records a timestamped page path without its query string", () => {
    const event = createCrawlerPageView({
      context: {
        ip: "66.249.66.1",
        requestId: "01TESTREQUEST",
        site: { id: "netlify-site-1" },
      },
      occurredAt: new Date("2026-08-30T18:22:10.123Z"),
      request: new Request("https://example.com/Services/Pool?lead=private#quote", {
        headers: {
          "netlify-agent-category": "crawler;general",
          "user-agent": "Googlebot/2.1",
        },
      }),
      response: new Response("<html></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 200,
      }),
    });

    expect(event).toMatchObject({
      event_id: "01TESTREQUEST",
      event_type: "crawler_page_view",
      occurred_at: "2026-08-30T18:22:10.123Z",
      page: { path: "/Services/Pool" },
      request: {
        agent_category: "crawler;general",
        client_ip: "66.249.66.1",
        method: "GET",
        status_code: 200,
        user_agent: "Googlebot/2.1",
      },
      schema_version: 1,
      site: {
        hostname: "example.com",
        platform: "netlify",
        platform_site_id: "netlify-site-1",
      },
      source: "netlify-edge",
    });
    expect(JSON.stringify(event)).not.toContain("lead=private");
  });

  it("identifies only HTML responses as customer-facing pages", () => {
    expect(
      createCrawlerPageView.isPageResponse(
        new Response("body", { headers: { "content-type": "text/html" } }),
      ),
    ).toBe(true);
    expect(
      createCrawlerPageView.isPageResponse(
        new Response("body", { headers: { "content-type": "text/css" } }),
      ),
    ).toBe(false);
  });
});
