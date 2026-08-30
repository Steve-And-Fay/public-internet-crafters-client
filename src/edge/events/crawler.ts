import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsEventEnvelope,
  normalizePagePath,
} from "../../contracts/analytics-event.js";

interface CrawlerEventInput {
  context: {
    ip?: string;
    requestId?: string;
    site?: { id?: string };
  };
  occurredAt: Date;
  request: Request;
  response: Response;
}

function isPageResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.startsWith("text/html") || contentType.includes("application/xhtml+xml");
}

function buildCrawlerPageView({
  context,
  occurredAt,
  request,
  response,
}: CrawlerEventInput): AnalyticsEventEnvelope {
  const url = new URL(request.url);

  return {
    event_id: context.requestId || crypto.randomUUID(),
    event_type: "crawler_page_view",
    occurred_at: occurredAt.toISOString(),
    page: { path: normalizePagePath(url.pathname) },
    request: {
      agent_category: (request.headers.get("netlify-agent-category") ?? "unknown").slice(0, 128),
      client_ip: (context.ip ?? "unknown").slice(0, 128),
      method: request.method,
      status_code: response.status,
      user_agent: (request.headers.get("user-agent") ?? "unknown").slice(0, 1_024),
    },
    schema_version: ANALYTICS_SCHEMA_VERSION,
    site: {
      hostname: url.hostname,
      platform: "netlify",
      platform_site_id: context.site?.id ?? "unknown",
    },
    source: "netlify-edge",
  };
}

export const createCrawlerPageView = Object.assign(buildCrawlerPageView, { isPageResponse });
