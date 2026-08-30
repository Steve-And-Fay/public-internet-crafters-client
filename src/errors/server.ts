import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsError,
  type AnalyticsErrorFrame,
  type AnalyticsEventEnvelope,
  type AnalyticsPlatform,
  type AnalyticsSource,
  normalizePagePath,
  safeIdentifier,
} from "../contracts/analytics-event.js";

export interface ServerErrorContext {
  eventId?: string;
  hostname: string;
  mechanism: string;
  occurredAt?: Date;
  pagePath: string;
  platform: AnalyticsPlatform;
  platformSiteId?: string;
  release: string;
  runtime: AnalyticsError["runtime"];
  source: AnalyticsSource;
}

function frameFromLine(line: string): AnalyticsErrorFrame | null {
  const location = line.match(
    /(?<module>(?:file:\/\/)?\/?[A-Za-z0-9_./@\\:-]+):(?<line>\d+):(?<column>\d+)\)?$/u,
  );
  if (!location?.groups) return null;
  const rawModule = location.groups.module;
  if (!rawModule) return null;
  const module = rawModule.replace(/^file:\/\//u, "");
  if (module.includes("..") || module.length > 500) return null;
  const prefix = line.slice(0, location.index).trim();
  const functionName = prefix.match(/(?:at\s+)?(?<function>[A-Za-z0-9_.$:\\-]+)\s*\(?$/u)?.groups
    ?.function;

  return {
    column: Number(location.groups.column),
    ...(functionName ? { function: functionName } : {}),
    line: Number(location.groups.line),
    module,
  };
}

export function createServerErrorEvent(
  value: unknown,
  context: ServerErrorContext,
): AnalyticsEventEnvelope {
  const failure = value instanceof Error ? value : null;
  const frames = (failure?.stack?.split("\n").slice(1) ?? [])
    .map(frameFromLine)
    .filter((frame): frame is AnalyticsErrorFrame => frame !== null)
    .slice(0, 20);
  const platformSiteId = context.platformSiteId
    ? safeIdentifier(context.platformSiteId, "unknown", 200)
    : undefined;

  return {
    error: {
      frames,
      mechanism: safeIdentifier(context.mechanism, "server.exception", 80),
      release: safeIdentifier(context.release, "unknown", 128),
      runtime: context.runtime,
      type: failure ? safeIdentifier(failure.name, "ServerError", 191) : "ServerError",
    },
    event_id: safeIdentifier(context.eventId, crypto.randomUUID()),
    event_type: "error",
    occurred_at: (context.occurredAt ?? new Date()).toISOString(),
    page: { path: normalizePagePath(context.pagePath) },
    schema_version: ANALYTICS_SCHEMA_VERSION,
    site: {
      hostname: context.hostname.toLowerCase(),
      platform: context.platform,
      ...(platformSiteId ? { platform_site_id: platformSiteId } : {}),
    },
    source: context.source,
  };
}
