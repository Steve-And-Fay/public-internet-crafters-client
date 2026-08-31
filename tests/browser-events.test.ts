import { describe, expect, it } from "vitest";
import { normalizeBrowserEvent, sanitizeClickDestination } from "../src/edge/events/browser.js";

describe("browser analytics events", () => {
  it("strips visitor and campaign data from anonymous counts even if supplied by the browser", () => {
    const event = normalizeBrowserEvent(
      {
        collection_mode: "anonymous",
        event_type: "click",
        event_id: "count-1",
        path: "/pricing?gclid=secret",
        session_id: "must-not-travel",
        attribution: { source: "google" },
        target: { kind: "link", name: "private-label", destination: "/contact" },
      },
      {
        hostname: "example.com",
        platform: "netlify",
        receivedAt: new Date("2026-08-30T18:30:59Z"),
      },
    );
    expect(event.properties).toEqual({ collection_mode: "anonymous" });
    expect(event.attribution).toBeUndefined();
    expect(event.request).toBeUndefined();
    expect(event.page.path).toBe("/pricing");
    expect(event.occurred_at).toBe("2026-08-30T18:30:00.000Z");
  });

  it("does not accept error details in anonymous mode", () => {
    expect(() =>
      normalizeBrowserEvent(
        { collection_mode: "anonymous", event_type: "error" },
        {
          hostname: "example.com",
          platform: "netlify",
          receivedAt: new Date(),
        },
      ),
    ).toThrow();
  });
  it("normalizes page views without query strings or arbitrary browser fields", () => {
    const event = normalizeBrowserEvent(
      {
        event_id: "browser-event-1",
        event_type: "page_view",
        occurred_at: "2026-08-30T18:30:00.000Z",
        path: "/products?email=person@example.com",
        secret_extra: "must not travel",
        session_id: "session-1",
      },
      {
        hostname: "example.com",
        platform: "netlify",
        platformSiteId: "netlify-site-1",
        receivedAt: new Date("2026-08-30T18:30:01.000Z"),
      },
    );

    expect(event).toMatchObject({
      event_id: "browser-event-1",
      event_type: "page_view",
      page: { path: "/products" },
      properties: { session_id: "session-1" },
      schema_version: 1,
      site: {
        hostname: "example.com",
        platform: "netlify",
        platform_site_id: "netlify-site-1",
      },
      source: "browser",
    });
    expect(JSON.stringify(event)).not.toContain("person@example.com");
    expect(JSON.stringify(event)).not.toContain("secret_extra");
  });

  it("keeps click metadata useful without collecting text or destination queries", () => {
    const event = normalizeBrowserEvent(
      {
        event_id: "browser-event-2",
        event_type: "click",
        occurred_at: "2026-08-30T18:31:00.000Z",
        path: "/pricing",
        session_id: "session-1",
        target: {
          destination: "/contact?name=someone",
          kind: "link",
          name: "pricing-contact",
          text: "Contact Jane directly",
        },
      },
      {
        hostname: "example.com",
        platform: "netlify",
        platformSiteId: "netlify-site-1",
        receivedAt: new Date("2026-08-30T18:31:01.000Z"),
      },
    );

    expect(event.properties).toEqual({
      session_id: "session-1",
      target_destination: "/contact",
      target_kind: "link",
      target_name: "pricing-contact",
    });
    expect(JSON.stringify(event)).not.toContain("Contact Jane");
    expect(JSON.stringify(event)).not.toContain("name=someone");
  });

  it("reduces external, phone, and email destinations to non-sensitive categories", () => {
    expect(
      sanitizeClickDestination("https://elsewhere.example/path?q=private", "example.com"),
    ).toBe("https://elsewhere.example");
    expect(sanitizeClickDestination("tel:+15205551212", "example.com")).toBe("tel:");
    expect(sanitizeClickDestination("mailto:person@example.com", "example.com")).toBe("mailto:");
    expect(sanitizeClickDestination("javascript:alert(1)", "example.com")).toBeNull();
  });

  it("keeps allowlisted campaign labels and reduces paid click identifiers to provider presence", () => {
    const event = normalizeBrowserEvent(
      {
        attribution: {
          campaign: "summer-service",
          content: "blue-ad",
          gclid: "must-not-travel",
          medium: "cpc",
          paid_click_present: true,
          paid_click_provider: "google",
          source: "google",
          term: "pool repair",
        },
        event_id: "browser-event-3",
        event_type: "page_view",
        occurred_at: "2026-08-30T18:32:00.000Z",
        path: "/summer-service",
        session_id: "session-1",
      },
      {
        hostname: "example.com",
        platform: "netlify",
        platformSiteId: "netlify-site-1",
        receivedAt: new Date("2026-08-30T18:32:01.000Z"),
      },
    );

    expect(event.attribution).toEqual({
      campaign: "summer-service",
      content: "blue-ad",
      medium: "cpc",
      paid_click_present: true,
      paid_click_provider: "google",
      source: "google",
      term: "pool repair",
    });
    expect(JSON.stringify(event)).not.toContain("must-not-travel");
    expect(JSON.stringify(event)).not.toContain("gclid");
  });

  it("normalizes structural error reports without accepting messages or arbitrary context", () => {
    const event = normalizeBrowserEvent(
      {
        error: {
          context: { customer_email: "person@example.com" },
          environment: { browser_family: "chrome", secret: "no" },
          frames: [
            {
              column: 9,
              function: "submitBooking",
              line: 42,
              module: "/assets/app.js?token=no",
            },
            { column: 7, function: "onClick", line: 18, module: "/assets/vendor.js" },
          ],
          mechanism: "window.error",
          message: "person@example.com failed",
          release: "site-2026.08.30",
          runtime: "browser",
          type: "TypeError",
        },
        event_id: "browser-error-1",
        event_type: "error",
        occurred_at: "2026-08-30T18:33:00.000Z",
        path: "/booking",
      },
      {
        hostname: "example.com",
        platform: "netlify",
        platformSiteId: "netlify-site-1",
        receivedAt: new Date("2026-08-30T18:33:01.000Z"),
      },
    );

    expect(event.error).toEqual({
      environment: { browser_family: "chrome" },
      frames: [{ column: 7, function: "onClick", line: 18, module: "/assets/vendor.js" }],
      mechanism: "window.error",
      release: "site-2026.08.30",
      runtime: "browser",
      type: "TypeError",
    });
    expect(JSON.stringify(event)).not.toContain("person@example.com");
    expect(JSON.stringify(event)).not.toContain("customer_email");
  });
});
