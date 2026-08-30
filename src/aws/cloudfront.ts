import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsEventEnvelope,
  normalizePagePath,
  safeIdentifier,
} from "../contracts/analytics-event.js";

interface KinesisRecord {
  kinesis?: { data?: string };
}

interface KinesisEvent {
  Records?: KinesisRecord[];
}

interface CloudFrontContext {
  distributionId: string;
  fields: string[];
}

const CRAWLER_SIGNATURE =
  /(?:bot\b|crawler|spider|slurp|GPTBot|ChatGPT-User|OAI-SearchBot|Claude|Perplexity|Applebot|DuckDuckBot)/iu;

function valuesByField(data: string, fields: string[]): Record<string, string> {
  const values = Buffer.from(data, "base64").toString("utf8").trimEnd().split("\t");
  return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? ""]));
}

function eventFromRow(
  row: Record<string, string>,
  distributionId: string,
): AnalyticsEventEnvelope | null {
  const userAgent = row["cs-user-agent"] ?? "";
  const contentType = (row["sc-content-type"] ?? "").toLowerCase();
  const method = (row["cs-method"] ?? "GET").toUpperCase();
  if (
    !CRAWLER_SIGNATURE.test(userAgent) ||
    !contentType.includes("text/html") ||
    (method !== "GET" && method !== "HEAD")
  ) {
    return null;
  }
  const timestamp = Number(row.timestamp);
  const occurredAt = Number.isFinite(timestamp) ? new Date(timestamp * 1_000) : new Date();
  const hostname = (row["cs-host"] || row["x-host-header"] || "unknown").toLowerCase();
  const status = Number.parseInt(row["sc-status"] || "0", 10);

  return {
    event_id: safeIdentifier(row["x-edge-request-id"], crypto.randomUUID()),
    event_type: "crawler_page_view",
    occurred_at: occurredAt.toISOString(),
    page: { path: normalizePagePath(row["cs-uri-stem"]) },
    request: {
      agent_category: "crawler;cloudfront-user-agent",
      client_ip: (row["c-ip"] || "unknown").slice(0, 64),
      method,
      status_code: status >= 100 && status <= 599 ? status : 200,
      user_agent: userAgent.slice(0, 1_024),
    },
    schema_version: ANALYTICS_SCHEMA_VERSION,
    site: {
      hostname,
      platform: "aws",
      platform_site_id: safeIdentifier(distributionId, "unknown", 200),
    },
    source: "aws-cloudfront",
  };
}

export function eventsFromCloudFrontKinesis(
  event: KinesisEvent,
  context: CloudFrontContext,
): AnalyticsEventEnvelope[] {
  const events: AnalyticsEventEnvelope[] = [];
  for (const record of event.Records ?? []) {
    if (!record.kinesis?.data) continue;
    const normalized = eventFromRow(
      valuesByField(record.kinesis.data, context.fields),
      context.distributionId,
    );
    if (normalized) events.push(normalized);
  }
  return events;
}
