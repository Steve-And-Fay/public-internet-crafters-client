import { describe, expect, it } from "vitest";
import { attributionFromUrl } from "../src/browser/attribution.js";

describe("campaign attribution", () => {
  it("keeps only campaign labels and paid-click provider presence", () => {
    const attribution = attributionFromUrl(
      new URL(
        "https://example.com/landing?utm_source=google&utm_medium=cpc&utm_campaign=summer%20service&utm_content=blue-ad&utm_term=pool%20repair&gclid=secret-click-id&email=person@example.com",
      ),
    );

    expect(attribution).toEqual({
      campaign: "summer service",
      content: "blue-ad",
      medium: "cpc",
      paid_click_present: true,
      paid_click_provider: "google",
      source: "google",
      term: "pool repair",
    });
    expect(JSON.stringify(attribution)).not.toContain("secret-click-id");
    expect(JSON.stringify(attribution)).not.toContain("person@example.com");
  });

  it("recognizes provider identifiers without retaining their values", () => {
    expect(attributionFromUrl(new URL("https://example.com/?msclkid=microsoft-secret"))).toEqual({
      paid_click_present: true,
      paid_click_provider: "microsoft",
    });
    expect(attributionFromUrl(new URL("https://example.com/?fbclid=meta-secret"))).toEqual({
      paid_click_present: true,
      paid_click_provider: "meta",
    });
  });

  it("returns no attribution for unrelated query values", () => {
    expect(
      attributionFromUrl(new URL("https://example.com/?email=person@example.com&coupon=private")),
    ).toBeUndefined();
  });
});
