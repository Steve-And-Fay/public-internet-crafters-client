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
      frames: [
        { column: 9, function: "submitBooking", line: 42, module: "/assets/app.js" },
        { column: 7, function: "onClick", line: 18, module: "/assets/booking.js" },
      ],
      mechanism: "window.error",
      release: "site-2026.08.30",
      runtime: "browser",
      type: "TypeError",
    });
    expect(JSON.stringify(output)).not.toContain("person@example.com");
    expect(JSON.stringify(output)).not.toContain("token=secret");
  });

  it.each([
    "SyntaxError: private message\n    at hydrate (https://example.com/_astro/Header.js?dpl=deploy-123#private:12:34)",
    "hydrate@https://example.com/_astro/Header.js?dpl=deploy-123#private:12:34",
    "@https://example.com/_astro/Header.js?dpl=deploy-123#private:12:34",
  ])("retains a deployment-tagged frame in Chrome, Safari, and Firefox stack formats", (stack) => {
    const failure = new SyntaxError("private message");
    failure.stack = stack;
    const output = structuralBrowserError(failure, {
      mechanism: "unhandledrejection",
      release: "deploy-123",
      userAgent: "unknown",
    });

    expect(output.frames).toEqual([
      {
        column: 34,
        ...(stack.startsWith("@") ? {} : { function: "hydrate" }),
        line: 12,
        module: "/_astro/Header.js",
      },
    ]);
    expect(JSON.stringify(output)).not.toContain("private");
    expect(JSON.stringify(output.frames)).not.toContain("dpl=");
    expect(JSON.stringify(output.frames)).not.toContain("example.com");
  });

  it("does not turn an exception message containing a URL into a frame", () => {
    const failure = new SyntaxError("private https://example.com/private-message:1:2");
    failure.stack = `${failure.name}: ${failure.message}`;
    expect(
      structuralBrowserError(failure, {
        mechanism: "unhandledrejection",
        release: "unknown",
        userAgent: "unknown",
      }).frames,
    ).toEqual([]);
  });

  it("keeps the location when Chrome decorates a function with an alias", () => {
    const failure = new SyntaxError("private message");
    failure.stack =
      "SyntaxError: private message\n    at async Object.hydrate [as render] (https://example.com/_astro/client.js?dpl=deploy-123:5:8)";
    expect(
      structuralBrowserError(failure, {
        mechanism: "unhandledrejection",
        release: "unknown",
        userAgent: "unknown",
      }).frames,
    ).toEqual([{ column: 8, line: 5, module: "/_astro/client.js" }]);
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
