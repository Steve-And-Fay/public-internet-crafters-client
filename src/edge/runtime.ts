import { parsePublicPaths } from "../contracts/public-paths.js";
import type { AnalyticsDestination } from "./destinations/types.js";
import { createWebhookDestination } from "./destinations/webhook.js";

export interface NetlifyEnvironment {
  get(name: string): string | undefined;
}

export interface NetlifyEdgeContext {
  deploy?: { id?: string };
  ip?: string;
  next(): Promise<Response>;
  requestId?: string;
  site?: { id?: string };
  waitUntil(promise: Promise<unknown>): void;
}

export interface EdgeFunctionConfig {
  cache?: "manual";
  excludedPath?: string | string[];
  header?: Record<string, boolean | string>;
  method?: string | string[];
  onError?: "bypass" | "fail";
  path: string | string[];
}

export function runtimeEnvironment(): NetlifyEnvironment | undefined {
  const runtime = globalThis as typeof globalThis & {
    Netlify?: { env?: NetlifyEnvironment };
  };
  return runtime.Netlify?.env;
}

function enabled(value: string | undefined, defaultValue = false): boolean {
  return value === undefined ? defaultValue : value.trim().toLowerCase() === "true";
}

export function runtimeCollectionEnabled(
  channel: "browser" | "crawler",
  env: NetlifyEnvironment | undefined = runtimeEnvironment(),
): boolean {
  if (!enabled(env?.get("IC_ANALYTICS_ENABLED"))) {
    return false;
  }

  return enabled(
    env?.get(channel === "browser" ? "IC_ANALYTICS_BROWSER" : "IC_ANALYTICS_CRAWLERS"),
    true,
  );
}

export function runtimeDestination(
  env: NetlifyEnvironment | undefined = runtimeEnvironment(),
): AnalyticsDestination | null {
  const url = env?.get("IC_ANALYTICS_INGEST_URL");
  if (!url) {
    return null;
  }

  const token = env?.get("IC_ANALYTICS_INGEST_TOKEN");
  return createWebhookDestination({
    authHeader: env?.get("IC_ANALYTICS_INGEST_AUTH_HEADER") || "authorization",
    authScheme: env?.get("IC_ANALYTICS_INGEST_AUTH_SCHEME") ?? "Bearer",
    ...(token ? { token } : {}),
    url,
  });
}

export function runtimeRelease(
  env: NetlifyEnvironment | undefined = runtimeEnvironment(),
  deploy?: NetlifyEdgeContext["deploy"],
): string {
  return (
    env?.get("IC_ANALYTICS_RELEASE") ||
    deploy?.id ||
    env?.get("COMMIT_REF") ||
    env?.get("DEPLOY_ID") ||
    "unknown"
  );
}

export function runtimePublicPaths(env: NetlifyEnvironment | undefined = runtimeEnvironment()) {
  return parsePublicPaths(env?.get("IC_ANALYTICS_PUBLIC_PATHS"));
}

export function analyticsResponse(status: number, message?: string): Response {
  return new Response(message ? JSON.stringify({ error: message }) : null, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
    status,
  });
}
