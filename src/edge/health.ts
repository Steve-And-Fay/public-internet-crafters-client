import { CLIENT_VERSION } from "../version.js";
import {
  type NetlifyEnvironment,
  runtimeCollectionEnabled,
  runtimeEnvironment,
  runtimePublicPaths,
} from "./runtime.js";

export const NETLIFY_HEALTH_PATH = "/__ic/analytics/v1/health";

export function netlifyHealth(
  env: NetlifyEnvironment | undefined = runtimeEnvironment(),
): Response {
  const browserEnabled = runtimeCollectionEnabled("browser", env);
  const crawlersEnabled = runtimeCollectionEnabled("crawler", env);
  const policy = runtimePublicPaths(env);
  let collectorConfigured = false;
  try {
    const url = new URL(env?.get("IC_ANALYTICS_INGEST_URL") ?? "");
    collectorConfigured =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      Boolean(env?.get("IC_ANALYTICS_INGEST_TOKEN")?.trim());
  } catch {
    // Health responses never echo collector URLs, credentials, or raw errors.
  }
  const status =
    !browserEnabled && !crawlersEnabled
      ? "disabled"
      : collectorConfigured && policy.mode !== "invalid"
        ? "ready"
        : "misconfigured";
  return Response.json(
    {
      version: CLIENT_VERSION,
      status,
      browserEnabled,
      crawlersEnabled,
      collectorConfigured,
      publicPathsValid: policy.mode !== "invalid",
      publicPathsRestricted: policy.mode !== "all",
      // This endpoint deliberately never submits an event or tests credentials.
      deliveryVerified: false,
    },
    {
      status: status === "ready" ? 200 : 503,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    },
  );
}
