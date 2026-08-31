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
  hostname?: string,
): AnalyticsDestination | null {
  const url = env?.get("IC_ANALYTICS_INGEST_URL");
  if (!url) {
    return null;
  }

  const token = runtimeToken(env, hostname);
  if (token === null) return null;
  return createWebhookDestination({
    authHeader: env?.get("IC_ANALYTICS_INGEST_AUTH_HEADER") || "authorization",
    authScheme: env?.get("IC_ANALYTICS_INGEST_AUTH_SCHEME") ?? "Bearer",
    ...(token ? { token } : {}),
    url,
  });
}

// A configured map is authoritative. Unknown hosts must never borrow another
// host's credential, including the legacy single-token fallback.
export function runtimeToken(
  env: NetlifyEnvironment | undefined = runtimeEnvironment(),
  hostname?: string,
): string | undefined | null {
  const raw = env?.get("IC_ANALYTICS_INGEST_TOKENS_BY_HOST");
  if (raw === undefined) return env?.get("IC_ANALYTICS_INGEST_TOKEN");
  if (!hostname || raw.length > 32_768) return null;
  try {
    const tokens: unknown = JSON.parse(raw);
    if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return null;
    const entries = Object.entries(tokens);
    if (entries.length === 0 || entries.length > 20) return null;
    const hostPattern =
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
    for (const [host, token] of entries) {
      if (
        !hostPattern.test(host) ||
        typeof token !== "string" ||
        token.length > 1_024 ||
        !/^[!-~]+$/u.test(token)
      )
        return null;
    }
    return Object.hasOwn(tokens, hostname) ? (tokens as Record<string, string>)[hostname] : null;
  } catch {
    return null;
  }
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
