import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { beforeAll, describe, expect, it, vi } from "vitest";

let source = "";
beforeAll(async () => {
  const result = await build({
    entryPoints: ["src/browser/tracker.ts"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
  });
  source = result.outputFiles[0]?.text ?? "";
});

function runTracker(privacy: { doNotTrack?: string; globalPrivacyControl?: boolean }) {
  const listeners: Record<string, (event?: unknown) => void> = {};
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  const sendBeacon = vi.fn().mockReturnValue(true);
  const storage = { getItem: vi.fn(), setItem: vi.fn() };
  const location = {
    pathname: "/pricing",
    href: "https://example.com/pricing?utm_source=google&gclid=secret",
  };
  const history = { pushState: vi.fn(), replaceState: vi.fn() };
  runInNewContext(source, {
    URL,
    Blob,
    Error,
    Date,
    Math,
    JSON,
    crypto: { randomUUID: () => "event-id" },
    window: { location },
    history,
    navigator: { ...privacy, sendBeacon, userAgent: "Browser" },
    sessionStorage: storage,
    fetch,
    queueMicrotask: (fn: () => void) => fn(),
    document: {
      querySelector: () => null,
      addEventListener: (name: string, fn: () => void) => {
        listeners[name] = fn;
      },
    },
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = fn;
    },
  });
  return { fetch, sendBeacon, storage, location, history, listeners };
}

describe("privacy-signal counting", () => {
  it.each([{ doNotTrack: "1" }, { globalPrivacyControl: true }])(
    "counts without browser storage, credentials, referrer, or errors: %j",
    (privacy) => {
      const runtime = runTracker(privacy);
      expect(runtime.storage.getItem).not.toHaveBeenCalled();
      expect(runtime.storage.setItem).not.toHaveBeenCalled();
      expect(runtime.sendBeacon).not.toHaveBeenCalled();
      expect(runtime.fetch).toHaveBeenCalledOnce();
      const [url, options] = runtime.fetch.mock.calls[0] ?? [];
      expect(url).toBe("/__ic/analytics/v1/events");
      expect(options).toMatchObject({
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
      });
      const payload = JSON.parse(options.body);
      expect(payload).toMatchObject({
        collection_mode: "anonymous",
        event_type: "page_view",
        path: "/pricing",
      });
      expect(payload.session_id).toBeUndefined();
      expect(payload.attribution).toBeUndefined();
      expect(runtime.listeners.error).toBeUndefined();
      expect(runtime.listeners.unhandledrejection).toBeUndefined();
      runtime.location.pathname = "/about";
      runtime.history.pushState();
      expect(runtime.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("retains session-based browser analytics without a privacy signal", () => {
    const runtime = runTracker({});
    expect(runtime.storage.setItem).toHaveBeenCalled();
    expect(runtime.sendBeacon).toHaveBeenCalledOnce();
    expect(runtime.listeners.error).toBeTypeOf("function");
  });
});
