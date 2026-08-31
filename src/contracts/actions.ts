import { normalizePagePath } from "./analytics-event.js";

export const ANALYTICS_ACTION_TYPES = [
  "call",
  "directions",
  "form_submit_click",
  "form_submit",
  "form_success",
  "email",
  "download",
  "outbound",
] as const;
export type AnalyticsActionType = (typeof ANALYTICS_ACTION_TYPES)[number];

/** Stable, provider-neutral event names. Contact totals are derived, not another event. */
export const ACTION_EVENT_TYPES = {
  call: "phone_click",
  directions: "directions_click",
  form_submit_click: "form_submit_click",
  form_submit: "form_submit",
  form_success: "generate_lead",
  email: "email_click",
  download: "file_download",
  outbound: "outbound_click",
} as const;

export type ActionEventType = (typeof ACTION_EVENT_TYPES)[keyof typeof ACTION_EVENT_TYPES];

export function actionForEvent(value: unknown): AnalyticsActionType | undefined {
  return Object.entries(ACTION_EVENT_TYPES).find(([, event]) => event === value)?.[0] as
    | AnalyticsActionType
    | undefined;
}

export function safeActionType(value: unknown): AnalyticsActionType | undefined {
  return typeof value === "string" && (ANALYTICS_ACTION_TYPES as readonly string[]).includes(value)
    ? (value as AnalyticsActionType)
    : undefined;
}

/** Classify before discarding map paths; never infer actions from visible text. */
export function destinationAction(
  value: string,
  siteHostname: string,
): AnalyticsActionType | undefined {
  try {
    const url = new URL(value, `https://${siteHostname}`);
    if (url.protocol === "tel:") return "call";
    if (url.protocol === "mailto:") return "email";
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    const host = url.hostname.toLowerCase();
    if (
      ["maps.google.com", "maps.app.goo.gl", "maps.apple.com"].includes(host) ||
      (["google.com", "www.google.com", "bing.com", "www.bing.com"].includes(host) &&
        /^\/maps(?:\/|$)/u.test(url.pathname)) ||
      (host === "goo.gl" && /^\/maps(?:\/|$)/u.test(url.pathname)) ||
      (["waze.com", "www.waze.com"].includes(host) &&
        /^\/(?:ul|live-map)(?:\/|$)/u.test(url.pathname)) ||
      ["openstreetmap.org", "www.openstreetmap.org"].includes(host)
    )
      return "directions";
    return host === siteHostname ? undefined : "outbound";
  } catch {
    return undefined;
  }
}

export function sanitizeClickDestination(value: unknown, siteHostname: string): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) return null;
  try {
    const url = new URL(value, `https://${siteHostname}`);
    if (url.protocol === "tel:" || url.protocol === "mailto:") return url.protocol;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname === siteHostname ? normalizePagePath(url.pathname) : url.origin;
  } catch {
    return null;
  }
}
