export const ANALYTICS_SCHEMA_VERSION = 1 as const;

export type AnalyticsEventType = "click" | "crawler_page_view" | "error" | "page_view";
export type AnalyticsSource =
  | "aws-cloudfront"
  | "aws-lambda"
  | "browser"
  | "netlify-edge"
  | "wordpress";
export type AnalyticsPlatform = "aws" | "custom" | "netlify" | "wordpress";

export interface AnalyticsAttribution {
  campaign?: string;
  content?: string;
  medium?: string;
  paid_click_present?: boolean;
  paid_click_provider?: string;
  source?: string;
  term?: string;
}

export interface AnalyticsErrorFrame {
  column?: number;
  function?: string;
  line?: number;
  module: string;
}

export interface AnalyticsError {
  environment?: {
    browser_family?: string;
    os_family?: string;
    runtime_version?: string;
  };
  frames: AnalyticsErrorFrame[];
  mechanism: string;
  release: string;
  runtime: "browser" | "edge" | "lambda" | "node" | "php" | "wordpress";
  type: string;
}

export interface AnalyticsEventEnvelope {
  attribution?: AnalyticsAttribution;
  error?: AnalyticsError;
  event_id: string;
  event_type: AnalyticsEventType;
  occurred_at: string;
  page: {
    path: string;
  };
  properties?: Record<string, string>;
  received_at?: string;
  request?: {
    agent_category: string;
    client_ip: string;
    method: string;
    status_code: number;
    user_agent: string;
  };
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  site: {
    hostname: string;
    platform: AnalyticsPlatform;
    platform_site_id?: string;
  };
  source: AnalyticsSource;
}

export function normalizePagePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "/";
  }

  try {
    const parsed = new URL(value, "https://analytics.invalid");
    const path = parsed.pathname || "/";
    return path.slice(0, 2_048);
  } catch {
    const path = value.split(/[?#]/u, 1)[0] || "/";
    return (path.startsWith("/") ? path : `/${path}`).slice(0, 2_048);
  }
}

export function safeIdentifier(value: unknown, fallback: string, max = 128): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const safe = value.replace(/[^a-zA-Z0-9._:/\\-]/gu, "").slice(0, max);
  return safe || fallback;
}

export function safeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const safe = value.replace(/[^a-zA-Z0-9._:-]/gu, "").slice(0, 128);
  return safe || undefined;
}

export function safeCampaignLabel(value: unknown): string | undefined {
  if (typeof value !== "string" || value.includes("@") || /(?:https?:\/\/|\d{7,})/iu.test(value)) {
    return undefined;
  }

  const safe = value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._:/-]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 128);
  return safe || undefined;
}

export function safeTimestamp(value: unknown, fallback: Date): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  return fallback.toISOString();
}
