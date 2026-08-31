import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ACTION_EVENT_TYPES, type AnalyticsActionType } from "../src/contracts/actions.js";
import { normalizeBrowserEvent } from "../src/edge/events/browser.js";

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

class TestElement {
  ignored = false;
  parent: TestElement | null = null;
  constructor(
    public tagName: string,
    public attributes: Record<string, string> = {},
  ) {}
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name: string) {
    return name in this.attributes;
  }
  closest(selector: string): TestElement | null {
    if (selector === "[data-ic-track-ignore]")
      return this.ignored ? this : (this.parent?.closest(selector) ?? null);
    if (selector === "form")
      return this.tagName === "FORM" ? this : (this.parent?.closest(selector) ?? null);
    return this.tagName === "SPAN" ? this.parent : this;
  }
}
class TestAnchor extends TestElement {
  constructor(attributes: Record<string, string>) {
    super("A", attributes);
  }
}
class TestForm extends TestElement {
  constructor(attributes: Record<string, string> = {}) {
    super("FORM", attributes);
  }
}

function tracker(anonymous = false, publicPaths?: string) {
  const listeners: Record<string, (event: { target: TestElement; detail?: unknown }) => void> = {};
  const storage = { getItem: vi.fn(), setItem: vi.fn() };
  const payloads: Record<string, unknown>[] = [];
  const location = { pathname: "/contact", href: "https://example.com/contact" };
  class TestBlob {
    constructor(parts: string[]) {
      payloads.push(JSON.parse(parts.join("")));
    }
  }
  runInNewContext(source, {
    URL,
    Blob: TestBlob,
    Date,
    Math,
    JSON,
    Element: TestElement,
    HTMLAnchorElement: TestAnchor,
    HTMLFormElement: TestForm,
    crypto: { randomUUID: () => "test-event" },
    window: { location },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    sessionStorage: storage,
    navigator: { doNotTrack: anonymous ? "1" : "0", sendBeacon: () => true, userAgent: "Browser" },
    fetch: vi.fn((_url, options) => {
      payloads.push(JSON.parse(options.body));
      return Promise.resolve({ ok: true });
    }),
    queueMicrotask: (fn: () => void) => fn(),
    addEventListener: vi.fn(),
    document: {
      querySelector: (selector: string) =>
        selector === 'meta[name="ic-public-paths"]' && publicPaths !== undefined
          ? { content: publicPaths }
          : null,
      addEventListener: (name: string, fn: (event: { target: TestElement }) => void) => {
        listeners[name] = fn;
      },
    },
  });
  return { payloads, listeners, storage, location };
}

describe("useful website actions", () => {
  it.each([false, true])(
    "does not record private link destinations or actions on private pages (anonymous %s)",
    (anonymous) => {
      const runtime = tracker(anonymous, '["/contact"]');
      runtime.listeners.click?.({
        target: new TestAnchor({
          href: "/r/private-room?owner_token=secret",
          "data-ic-track": "private-room",
        }),
      });
      expect(runtime.payloads).toHaveLength(1);
      runtime.location.pathname = "/r/private-room";
      runtime.location.href = "https://example.com/r/private-room";
      const form = new TestForm({ "data-ic-track": "private-form" });
      runtime.listeners.click?.({ target: new TestAnchor({ href: "tel:secret" }) });
      runtime.listeners.submit?.({ target: form });
      runtime.listeners["ic:form-success"]?.({ target: form });
      runtime.listeners["ic:lead-success"]?.({
        target: new TestElement("DIV"),
        detail: { name: "private", id: "private-id" },
      });
      runtime.location.pathname = "/contact";
      runtime.listeners["ic:form-success"]?.({ target: form });
      expect(runtime.payloads).toHaveLength(1);
    },
  );
  it.each([
    ["tel:+15205551234", "call"],
    ["mailto:private@example.com?body=secret", "email"],
    ["https://maps.google.com/?q=private-address", "directions"],
    ["https://www.google.com/maps/dir/?api=1&destination=private-address", "directions"],
    ["https://maps.app.goo.gl/abc", "directions"],
    ["https://maps.apple.com/?daddr=private-address", "directions"],
    ["https://www.bing.com/maps?cp=123", "directions"],
    ["https://www.waze.com/ul?ll=123", "directions"],
    ["https://google.com.evil.example/maps", "outbound"],
  ])("classifies %s as %s without sending contact or map query data", (href, action) => {
    const runtime = tracker();
    const nested = new TestElement("SPAN");
    nested.parent = new TestAnchor({ href });
    runtime.listeners.click?.({ target: nested });
    expect(runtime.payloads).toHaveLength(2);
    expect(runtime.payloads[1]).toMatchObject({
      event_type: ACTION_EVENT_TYPES[action as AnalyticsActionType],
      target: { action },
    });
    expect(JSON.stringify(runtime.payloads[1])).not.toMatch(
      /private|15205551234|daddr|destination=|body=|\?cp/,
    );
  });

  it("uses explicit action labels for scripted buttons and respects ignored ancestors", () => {
    const runtime = tracker();
    const button = new TestElement("BUTTON", {
      "data-ic-action": "directions",
      "data-ic-track": "office-directions",
    });
    runtime.listeners.click?.({ target: button });
    expect(runtime.payloads[1]).toMatchObject({
      target: { action: "directions", name: "office-directions" },
    });
    button.ignored = true;
    runtime.listeners.click?.({ target: button });
    expect(runtime.payloads).toHaveLength(2);
  });

  it("keeps submit-button clicks distinct from form submission attempts, including keyboard submission", () => {
    const runtime = tracker();
    const form = new TestForm({ "data-ic-track": "contact" });
    const button = new TestElement("INPUT", { type: "submit" });
    button.parent = form;
    runtime.listeners.click?.({ target: button });
    expect(runtime.payloads[1]).toMatchObject({ target: { action: "form_submit_click" } });
    expect(runtime.listeners.submit).toBeTypeOf("function");
    runtime.listeners.submit?.({ target: form });
    expect(runtime.payloads[2]).toMatchObject({
      event_type: "form_submit",
      target: { kind: "form", action: "form_submit", name: "contact" },
    });
    expect(runtime.payloads[2]?.target).not.toHaveProperty("fields");
    form.ignored = true;
    runtime.listeners.submit?.({ target: form });
    expect(runtime.payloads).toHaveLength(3);
  });

  it("keeps privacy-signal clicks generic and collects no extra form events", () => {
    const runtime = tracker(true);
    runtime.listeners.click?.({ target: new TestAnchor({ href: "tel:private" }) });
    expect(runtime.payloads[1]).not.toHaveProperty("target");
    expect(runtime.payloads[1]?.event_type).toBe("click");
    expect(runtime.listeners.submit).toBeUndefined();
    expect(runtime.listeners["ic:form-success"]).toBeUndefined();
    expect(runtime.storage.getItem).not.toHaveBeenCalled();
  });

  it("confirms forms only through the success hook, once per observed submission", () => {
    const runtime = tracker();
    const form = new TestForm({ "data-ic-track": "contact" });
    runtime.listeners["ic:form-success"]?.({ target: form });
    expect(runtime.payloads).toHaveLength(1);
    runtime.listeners.submit?.({ target: form });
    expect(runtime.payloads.map((event) => event.event_type)).not.toContain("generate_lead");
    runtime.listeners["ic:form-success"]?.({ target: form });
    runtime.listeners["ic:form-success"]?.({ target: form });
    expect(runtime.payloads.filter((event) => event.event_type === "generate_lead")).toHaveLength(
      1,
    );
    runtime.listeners.submit?.({ target: form });
    runtime.listeners["ic:form-success"]?.({ target: form });
    expect(runtime.payloads.filter((event) => event.event_type === "generate_lead")).toHaveLength(
      2,
    );
  });

  it("deduplicates vendor confirmations without forwarding vendor IDs or response fields", () => {
    const runtime = tracker();
    const event = {
      target: new TestElement("DIV"),
      detail: {
        name: "contact",
        id: "vendor-submission-id",
        fields: ["secret"],
        respondentId: "private-person",
      },
    };
    runtime.listeners["ic:lead-success"]?.(event);
    runtime.listeners["ic:lead-success"]?.(event);
    expect(runtime.payloads).toHaveLength(2);
    expect(runtime.payloads[1]).toMatchObject({
      event_type: "generate_lead",
      target: { name: "contact" },
    });
    expect(JSON.stringify(runtime.payloads[1])).not.toMatch(
      /vendor-submission-id|secret|private-person|fields|respondentId/,
    );
    expect(tracker(true).listeners["ic:lead-success"]).toBeUndefined();
  });

  it("normalizes every registered dedicated event and prevents action-name mismatches", () => {
    const context = {
      hostname: "example.com",
      platform: "netlify" as const,
      receivedAt: new Date(),
    };
    for (const [action, event_type] of Object.entries(ACTION_EVENT_TYPES)) {
      expect(
        normalizeBrowserEvent({ event_type, target: { action: "email" } }, context),
      ).toMatchObject({ event_type, properties: { action_type: action } });
      expect(
        normalizeBrowserEvent(
          { event_type, collection_mode: "anonymous", target: { action } },
          context,
        ),
      ).toMatchObject({ event_type: "click", properties: { collection_mode: "anonymous" } });
    }
  });

  it("allows only the documented action enum through the browser collector", () => {
    const context = {
      hostname: "example.com",
      platform: "netlify" as const,
      receivedAt: new Date(),
    };
    for (const action of [
      "call",
      "directions",
      "form_submit_click",
      "form_submit",
      "email",
      "download",
      "outbound",
    ]) {
      expect(
        normalizeBrowserEvent({ event_type: "click", target: { action } }, context).properties
          ?.action_type,
      ).toBe(action);
    }
    expect(
      normalizeBrowserEvent({ event_type: "click", target: { action: "private-person" } }, context)
        .properties?.action_type,
    ).toBeUndefined();
    expect(
      normalizeBrowserEvent(
        { event_type: "click", collection_mode: "anonymous", target: { action: "call" } },
        context,
      ).properties,
    ).toEqual({ collection_mode: "anonymous" });
  });
});
