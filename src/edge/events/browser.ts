import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsAttribution,
  type AnalyticsError,
  type AnalyticsErrorFrame,
  type AnalyticsEventEnvelope,
  type AnalyticsPlatform,
  normalizePagePath,
  safeCampaignLabel,
  safeIdentifier,
  safeLabel,
  safeTimestamp,
} from "../../contracts/analytics-event.js";

interface BrowserEventContext {
  hostname: string;
  platform: AnalyticsPlatform;
  platformSiteId?: string;
  receivedAt: Date;
}

interface BrowserEventInput {
  [key: string]: unknown;
  attribution?: Record<string, unknown>;
  error?: Record<string, unknown>;
  event_id?: unknown;
  event_type?: unknown;
  occurred_at?: unknown;
  path?: unknown;
  session_id?: unknown;
  target?: Record<string, unknown>;
}

function normalizeAttribution(input: unknown): AnalyticsAttribution | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const value = input as Record<string, unknown>;
  const output: AnalyticsAttribution = {};
  for (const key of ["campaign", "content", "medium", "source", "term"] as const) {
    const label = safeCampaignLabel(value[key]);
    if (label) output[key] = label;
  }
  const provider = safeLabel(value.paid_click_provider);
  if (value.paid_click_present === true && provider) {
    output.paid_click_present = true;
    output.paid_click_provider = provider;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function boundedInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10_000_000
    ? Number(value)
    : undefined;
}

function normalizeFrame(value: unknown): AnalyticsErrorFrame | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.module !== "string" ||
    input.module.length > 500 ||
    input.module.includes("?") ||
    input.module.includes("#") ||
    input.module.includes("..") ||
    !/^[a-zA-Z0-9_./@:\\-]+$/u.test(input.module)
  ) {
    return null;
  }
  const functionName =
    input.function === null ? undefined : safeIdentifier(input.function, "", 191) || undefined;
  const line = boundedInteger(input.line);
  const column = boundedInteger(input.column);
  return {
    ...(column ? { column } : {}),
    ...(functionName ? { function: functionName } : {}),
    ...(line ? { line } : {}),
    module: input.module,
  };
}

function normalizeError(value: unknown): AnalyticsError {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid browser error event");
  }
  const input = value as Record<string, unknown>;
  if (input.runtime !== "browser") throw new TypeError("Invalid browser error runtime");
  const frames = (Array.isArray(input.frames) ? input.frames : [])
    .map(normalizeFrame)
    .filter((frame): frame is AnalyticsErrorFrame => frame !== null)
    .slice(0, 20);
  const rawEnvironment =
    input.environment && typeof input.environment === "object" && !Array.isArray(input.environment)
      ? (input.environment as Record<string, unknown>)
      : {};
  const environment: NonNullable<AnalyticsError["environment"]> = {};
  for (const key of ["browser_family", "os_family", "runtime_version"] as const) {
    const identifier = safeLabel(rawEnvironment[key]);
    if (identifier) environment[key] = identifier;
  }

  return {
    ...(Object.keys(environment).length > 0 ? { environment } : {}),
    frames,
    mechanism: safeIdentifier(input.mechanism, "window.error", 80),
    release: safeIdentifier(input.release, "unknown", 128),
    runtime: "browser",
    type: safeIdentifier(input.type, "BrowserError", 191),
  };
}

export function sanitizeClickDestination(value: unknown, siteHostname: string): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) {
    return null;
  }

  try {
    const destination = new URL(value, `https://${siteHostname}`);
    if (destination.protocol === "tel:" || destination.protocol === "mailto:") {
      return destination.protocol;
    }

    if (destination.protocol !== "http:" && destination.protocol !== "https:") {
      return null;
    }

    if (destination.hostname === siteHostname) {
      return normalizePagePath(destination.pathname);
    }

    return destination.origin;
  } catch {
    return null;
  }
}

export function normalizeBrowserEvent(
  input: BrowserEventInput,
  context: BrowserEventContext,
): AnalyticsEventEnvelope {
  if (!["page_view", "click", "error"].includes(String(input.event_type))) {
    throw new TypeError("Unsupported browser analytics event type");
  }

  const eventType = input.event_type as "click" | "error" | "page_view";
  const properties: Record<string, string> = {};
  if (eventType !== "error") {
    properties.session_id = safeIdentifier(input.session_id, crypto.randomUUID());
  }

  if (eventType === "click") {
    const kind = safeLabel(input.target?.kind);
    const name = safeLabel(input.target?.name);
    const destination = sanitizeClickDestination(input.target?.destination, context.hostname);

    if (destination) properties.target_destination = destination;
    if (kind) properties.target_kind = kind;
    if (name) properties.target_name = name;
  }

  const platformSiteId = safeLabel(context.platformSiteId);
  const attribution = eventType === "error" ? undefined : normalizeAttribution(input.attribution);

  return {
    ...(attribution ? { attribution } : {}),
    ...(eventType === "error" ? { error: normalizeError(input.error) } : {}),
    event_id: safeIdentifier(input.event_id, crypto.randomUUID()),
    event_type: eventType,
    occurred_at: safeTimestamp(input.occurred_at, context.receivedAt),
    page: { path: normalizePagePath(input.path) },
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
    received_at: context.receivedAt.toISOString(),
    schema_version: ANALYTICS_SCHEMA_VERSION,
    site: {
      hostname: context.hostname,
      platform: context.platform,
      ...(platformSiteId ? { platform_site_id: platformSiteId } : {}),
    },
    source: "browser",
  };
}
