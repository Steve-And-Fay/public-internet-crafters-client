import { describe, expect, it } from "vitest";
import { structuralBrowserError } from "../src/browser/errors.js";

describe("browser error capture", () => {
  it("keeps structural frames and never copies exception messages or URL queries", () => {
    const failure = new TypeError("Customer person@example.com could not submit token=secret");
    failure.stack = [
      "TypeError: Customer person@example.com could not submit token=secret",
      "    at submitBooking (https://example.com/assets/app.js?token=secret:42:9)",
      "    at onClick (https://example.com/assets/booking.js:18:7)",
    ].join("\n");

    const output = structuralBrowserError(failure, {
      mechanism: "window.error",
      release: "site-2026.08.30",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
    });

    expect(output).toEqual({
      environment: { browser_family: "chrome", os_family: "macos" },
      frames: [{ column: 7, function: "onClick", line: 18, module: "/assets/booking.js" }],
      mechanism: "window.error",
      release: "site-2026.08.30",
      runtime: "browser",
      type: "TypeError",
    });
    expect(JSON.stringify(output)).not.toContain("person@example.com");
    expect(JSON.stringify(output)).not.toContain("token=secret");
  });

  it("reports non-Error promise reasons only as an unhandled rejection type", () => {
    expect(
      structuralBrowserError("private rejection body", {
        mechanism: "unhandledrejection",
        release: "unknown",
        userAgent: "unknown",
      }),
    ).toMatchObject({ frames: [], type: "UnhandledRejection" });
  });
});
