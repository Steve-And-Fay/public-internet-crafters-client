import type { AnalyticsDestination } from "./destinations/types.js";
import { createWebhookDestination } from "./destinations/webhook.js";

export interface NetlifyEnvironment {
  get(name: string): string | undefined;
}

export interface NetlifyEdgeContext {
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

function runtimeEnvironment(): NetlifyEnvironment | undefined {
  const runtime = globalThis as typeof globalThis & {
    Netlify?: { env?: NetlifyEnvironment };
  };
  return runtime.Netlify?.env;
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

export function runtimeRelease(env: NetlifyEnvironment | undefined = runtimeEnvironment()): string {
  return (
    env?.get("IC_ANALYTICS_RELEASE") || env?.get("COMMIT_REF") || env?.get("DEPLOY_ID") || "unknown"
  );
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
