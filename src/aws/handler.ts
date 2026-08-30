import { createWebhookDestination } from "../edge/destinations/webhook.js";
import { eventsFromCloudFrontKinesis } from "./cloudfront.js";

const DEFAULT_FIELDS = [
  "timestamp",
  "c-ip",
  "sc-status",
  "cs-method",
  "cs-host",
  "cs-uri-stem",
  "cs-user-agent",
  "x-edge-request-id",
  "sc-content-type",
];

interface KinesisEvent {
  Records?: Array<{ kinesis?: { data?: string } }>;
}

export async function handler(event: KinesisEvent): Promise<void> {
  const url = process.env.IC_ANALYTICS_INGEST_URL;
  const token = process.env.IC_ANALYTICS_INGEST_TOKEN;
  const distributionId = process.env.IC_CLOUDFRONT_DISTRIBUTION_ID;
  if (!url || !token || !distributionId) {
    throw new Error("Internet Crafters analytics environment is incomplete");
  }
  const fields = (process.env.IC_CLOUDFRONT_LOG_FIELDS || DEFAULT_FIELDS.join(","))
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  const destination = createWebhookDestination({ token, url });
  const events = eventsFromCloudFrontKinesis(event, { distributionId, fields });
  for (const analyticsEvent of events) {
    const result = await destination.send(analyticsEvent);
    if (!result.accepted) throw new Error(`Analytics ingest refused with status ${result.status}`);
  }
}
