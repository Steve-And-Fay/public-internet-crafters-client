import {
  ACTION_EVENT_TYPES,
  type AnalyticsActionType,
  destinationAction,
  safeActionType,
  sanitizeClickDestination,
} from "../contracts/actions.js";
import type {
  AnalyticsAttribution,
  AnalyticsError,
  AnalyticsEventType,
} from "../contracts/analytics-event.js";
import { safeLabel } from "../contracts/analytics-event.js";
import { attributionFromUrl } from "./attribution.js";
import { structuralBrowserError } from "./errors.js";

const EVENTS_PATH = "/__ic/analytics/v1/events";
const SESSION_KEY = "ic_analytics_session_v1";
const ATTRIBUTION_KEY = "ic_analytics_attribution_v1";

interface PrivacyNavigator extends Navigator {
  globalPrivacyControl?: boolean;
}

interface BrowserEvent {
  collection_mode?: "anonymous";
  attribution?: AnalyticsAttribution;
  error?: AnalyticsError;
  event_id: string;
  event_type: Exclude<AnalyticsEventType, "crawler_page_view">;
  occurred_at: string;
  path: string;
  session_id?: string;
  target?: {
    action?: AnalyticsActionType;
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

const privacyNavigator = navigator as PrivacyNavigator;
const anonymous = navigator.doNotTrack === "1" || privacyNavigator.globalPrivacyControl === true;
const visitorSessionId = anonymous ? undefined : sessionId();

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

const visitorAttribution = anonymous ? undefined : sessionAttribution();
const release =
  document.querySelector<HTMLMetaElement>('meta[name="ic-release"]')?.content || "unknown";

function send(event: BrowserEvent): void {
  if (anonymous) {
    // One random id per event is for delivery deduplication, never visitor/session linking.
    const occurredAt = new Date(event.occurred_at);
    occurredAt.setUTCSeconds(0, 0);
    void fetch(EVENTS_PATH, {
      body: JSON.stringify({
        collection_mode: "anonymous",
        event_id: event.event_id,
        event_type: event.event_type === "page_view" ? "page_view" : "click",
        occurred_at: occurredAt.toISOString(),
        path: event.path,
      }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);
    return;
  }
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
    ...(visitorSessionId ? { session_id: visitorSessionId } : {}),
    ...(visitorAttribution ? { attribution: visitorAttribution } : {}),
  });
}

function emitClick(target: Element, formAction?: "form_submit" | "form_success"): void {
  const hostname = new URL(window.location.href).hostname;
  const href = target instanceof HTMLAnchorElement ? target.getAttribute("href") : null;
  const destination = href ? sanitizeClickDestination(href, hostname) : undefined;
  const name = safeLabel(target.getAttribute("data-ic-track"));
  const explicit = safeActionType(target.getAttribute("data-ic-action"));
  const type = target.getAttribute("type")?.toLowerCase();
  const submitButton =
    ((target.tagName === "BUTTON" && (!type || type === "submit")) ||
      (target.tagName === "INPUT" && (type === "submit" || type === "image"))) &&
    (target.closest("form") !== null || target.hasAttribute("form"));
  const action = formAction
    ? formAction
    : explicit && explicit !== "form_submit" && explicit !== "form_success"
      ? explicit
      : submitButton
        ? "form_submit_click"
        : target instanceof HTMLAnchorElement && target.hasAttribute("download")
          ? "download"
          : href
            ? destinationAction(href, hostname)
            : undefined;
  send({
    event_id: randomId(),
    event_type: action ? ACTION_EVENT_TYPES[action] : "click",
    occurred_at: new Date().toISOString(),
    path: pagePath(),
    ...(visitorSessionId ? { session_id: visitorSessionId } : {}),
    ...(visitorAttribution ? { attribution: visitorAttribution } : {}),
    target: {
      ...(action ? { action } : {}),
      ...(destination ? { destination } : {}),
      kind: formAction ? "form" : target instanceof HTMLAnchorElement ? "link" : "button",
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

emitPageView();
observeRouteChanges();
document.addEventListener(
  "click",
  (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest(
      'a,button,input[type="submit"],input[type="image"],[data-ic-track],[data-ic-action]',
    );
    if (!target || target.closest("[data-ic-track-ignore]")) return;
    emitClick(target);
  },
  { capture: true },
);
if (!anonymous) {
  const pendingForms = new WeakSet<HTMLFormElement>();
  document.addEventListener(
    "submit",
    (event) => {
      if (
        !(event.target instanceof HTMLFormElement) ||
        event.target.closest("[data-ic-track-ignore]")
      )
        return;
      // Native validation precedes this event. Application/network success does not.
      // Never read FormData, control values, action URLs, or field names.
      pendingForms.add(event.target);
      emitClick(event.target, "form_submit");
    },
    { capture: true },
  );
  document.addEventListener("ic:form-success", (event) => {
    const form = event.target;
    if (
      !(form instanceof HTMLFormElement) ||
      !pendingForms.has(form) ||
      form.closest("[data-ic-track-ignore]")
    )
      return;
    // The site's success handler dispatches this ONLY after its backend accepts the form.
    // One confirmation per observed attempt. Never infer success from a thank-you URL.
    pendingForms.delete(form);
    emitClick(form, "form_success");
  });
  const vendorConfirmations = new Set<string>();
  document.addEventListener("ic:lead-success", (event) => {
    // For integrations that validate a vendor success callback (e.g. cross-origin iframe).
    // The callback ID is used only for in-memory deduplication, never transmitted or stored.
    const detail = (event as CustomEvent).detail;
    const name = safeLabel(detail?.name);
    const id = safeLabel(detail?.id);
    if (!name || !id) return;
    const key = `${name}:${id}`;
    if (vendorConfirmations.has(key)) return;
    if (vendorConfirmations.size >= 100) return;
    vendorConfirmations.add(key);
    send({
      event_id: randomId(),
      event_type: "generate_lead",
      occurred_at: new Date().toISOString(),
      path: pagePath(),
      ...(visitorSessionId ? { session_id: visitorSessionId } : {}),
      ...(visitorAttribution ? { attribution: visitorAttribution } : {}),
      target: { action: "form_success", kind: "form", name },
    });
  });
  addEventListener("error", (event) => emitError(event.error, "window.error"));
  addEventListener("unhandledrejection", (event) => emitError(event.reason, "unhandledrejection"));
}
