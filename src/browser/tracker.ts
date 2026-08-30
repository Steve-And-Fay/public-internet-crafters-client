import type { AnalyticsAttribution, AnalyticsError } from "../contracts/analytics-event.js";
import { attributionFromUrl } from "./attribution.js";
import { structuralBrowserError } from "./errors.js";

const EVENTS_PATH = "/__ic/analytics/v1/events";
const SESSION_KEY = "ic_analytics_session_v1";
const ATTRIBUTION_KEY = "ic_analytics_attribution_v1";

interface PrivacyNavigator extends Navigator {
  globalPrivacyControl?: boolean;
}

interface BrowserEvent {
  attribution?: AnalyticsAttribution;
  error?: AnalyticsError;
  event_id: string;
  event_type: "click" | "error" | "page_view";
  occurred_at: string;
  path: string;
  session_id?: string;
  target?: {
    destination?: string;
    kind: string;
    name?: string;
  };
}

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = randomId();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

function pagePath(): string {
  return window.location.pathname || "/";
}

const visitorSessionId = sessionId();

function sessionAttribution(): AnalyticsAttribution | undefined {
  const current = attributionFromUrl(new URL(window.location.href));
  try {
    if (current) {
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current));
      return current;
    }
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    return stored ? (JSON.parse(stored) as AnalyticsAttribution) : undefined;
  } catch {
    return current;
  }
}

const visitorAttribution = sessionAttribution();
const release =
  document.querySelector<HTMLMetaElement>('meta[name="ic-release"]')?.content || "unknown";

function send(event: BrowserEvent): void {
  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon(EVENTS_PATH, new Blob([body], { type: "application/json" }))) {
      return;
    }
  } catch {
    // Fall through to a keepalive request.
  }

  void fetch(EVENTS_PATH, {
    body,
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

function emitPageView(): void {
  send({
    event_id: randomId(),
    event_type: "page_view",
    occurred_at: new Date().toISOString(),
    path: pagePath(),
    session_id: visitorSessionId,
    ...(visitorAttribution ? { attribution: visitorAttribution } : {}),
  });
}

function emitClick(target: Element): void {
  const destination = target instanceof HTMLAnchorElement ? target.getAttribute("href") : undefined;
  const name = target.getAttribute("data-ic-track") || undefined;
  send({
    event_id: randomId(),
    event_type: "click",
    occurred_at: new Date().toISOString(),
    path: pagePath(),
    session_id: visitorSessionId,
    ...(visitorAttribution ? { attribution: visitorAttribution } : {}),
    target: {
      ...(destination ? { destination } : {}),
      kind: target instanceof HTMLAnchorElement ? "link" : "button",
      ...(name ? { name } : {}),
    },
  });
}

function emitError(value: unknown, mechanism: "unhandledrejection" | "window.error"): void {
  send({
    error: structuralBrowserError(value, { mechanism, release, userAgent: navigator.userAgent }),
    event_id: randomId(),
    event_type: "error",
    occurred_at: new Date().toISOString(),
    path: pagePath(),
  });
}

function observeRouteChanges(): void {
  let lastPath = pagePath();
  const routeChanged = () => {
    const nextPath = pagePath();
    if (nextPath === lastPath) return;
    lastPath = nextPath;
    queueMicrotask(emitPageView);
  };

  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function analyticsHistoryMethod(...args) {
      const result = original.apply(this, args);
      routeChanged();
      return result;
    };
  }
  addEventListener("popstate", routeChanged);
}

const privacyNavigator = navigator as PrivacyNavigator;
if (navigator.doNotTrack !== "1" && privacyNavigator.globalPrivacyControl !== true) {
  emitPageView();
  observeRouteChanges();
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest("a,button,[data-ic-track]");
      if (!target || target.closest("[data-ic-track-ignore]")) return;
      emitClick(target);
    },
    { capture: true },
  );
  addEventListener("error", (event) => emitError(event.error, "window.error"));
  addEventListener("unhandledrejection", (event) => emitError(event.reason, "unhandledrejection"));
}
