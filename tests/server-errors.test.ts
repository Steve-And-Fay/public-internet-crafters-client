import { describe, expect, it, vi } from "vitest";
import { withServerErrorCapture } from "../src/errors/capture.js";
import { createServerErrorEvent } from "../src/errors/server.js";

describe("server error adapter", () => {
  it("creates a privacy-filtered canonical error event for explicit platform capture", () => {
    const failure = new Error("API token secret and person@example.com");
    failure.name = "BookingFailure";
    failure.stack = [
      "BookingFailure: API token secret and person@example.com",
      "    at submitBooking (/var/task/booking.js:42:9)",
    ].join("\n");

    const event = createServerErrorEvent(failure, {
      eventId: "lambda-request-1",
      hostname: "example.com",
      mechanism: "lambda.handler",
      pagePath: "/api/booking?email=person@example.com",
      platform: "aws",
      platformSiteId: "booking-function",
      release: "site-2026.08.30",
      runtime: "lambda",
      source: "aws-lambda",
    });

    expect(event).toMatchObject({
      error: {
        frames: [
          {
            column: 9,
            function: "submitBooking",
            line: 42,
            module: "/var/task/booking.js",
          },
        ],
        mechanism: "lambda.handler",
        release: "site-2026.08.30",
        runtime: "lambda",
        type: "BookingFailure",
      },
      event_id: "lambda-request-1",
      event_type: "error",
      page: { path: "/api/booking" },
      site: { hostname: "example.com", platform: "aws", platform_site_id: "booking-function" },
    });
    expect(JSON.stringify(event)).not.toContain("person@example.com");
    expect(JSON.stringify(event)).not.toContain("API token secret");
  });

  it("reports a failed server handler and rethrows the original failure", async () => {
    const failure = new Error("customer and token details must stay local");
    failure.name = "CheckoutFailure";
    const send = vi.fn().mockResolvedValue({ accepted: true, status: 202 });
    const handler = withServerErrorCapture(
      async (_path: string) => {
        throw failure;
      },
      {
        destination: { send },
        context: ([path]) => ({
          eventId: "lambda-request-2",
          hostname: "example.com",
          mechanism: "lambda.handler",
          pagePath: path,
          platform: "aws",
          platformSiteId: "checkout-function",
          release: "site-2026.08.30",
          runtime: "lambda",
          source: "aws-lambda",
        }),
      },
    );

    await expect(handler("/api/checkout?token=secret")).rejects.toBe(failure);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ type: "CheckoutFailure" }),
        page: { path: "/api/checkout" },
      }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain("customer and token details");
  });

  it("never replaces the application failure when error delivery also fails", async () => {
    const failure = new Error("application failure");
    const handler = withServerErrorCapture(
      async () => {
        throw failure;
      },
      {
        destination: { send: vi.fn().mockRejectedValue(new Error("collector unavailable")) },
        context: () => ({
          hostname: "example.com",
          mechanism: "node.handler",
          pagePath: "/api/work",
          platform: "custom",
          release: "release-1",
          runtime: "node",
          source: "aws-lambda",
        }),
      },
    );

    await expect(handler()).rejects.toBe(failure);
  });
});
