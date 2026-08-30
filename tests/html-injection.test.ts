import { describe, expect, it } from "vitest";
import { injectBrowserTracker } from "../src/edge/browser-bootstrap.js";

describe("browser tracker injection", () => {
  it("adds the same-origin client once without changing page content", () => {
    const original =
      "<!doctype html><html><head><title>Example</title></head><body>Hello</body></html>";
    const first = injectBrowserTracker(original);
    const second = injectBrowserTracker(first.html);

    expect(first.injected).toBe(true);
    expect(first.html).toContain('<script src="/__ic/analytics/v1/client.js" defer></script>');
    expect(first.html).toContain("<title>Example</title>");
    expect(second.injected).toBe(false);
    expect(second.html.match(/\/__ic\/analytics\/v1\/client\.js/g)).toHaveLength(1);
  });

  it("adds escaped release metadata for error grouping", () => {
    const result = injectBrowserTracker(
      "<!doctype html><html><head><title>Example</title></head><body></body></html>",
      'deploy-123" onload="alert(1)',
    );

    expect(result.html).toContain(
      '<meta name="ic-release" content="deploy-123&quot; onload=&quot;alert(1)">',
    );
    expect(result.html).not.toContain('content="deploy-123"');
  });

  it("leaves fragments without a head element unchanged", () => {
    expect(injectBrowserTracker("<main>Fragment</main>")).toEqual({
      html: "<main>Fragment</main>",
      injected: false,
    });
  });
});
