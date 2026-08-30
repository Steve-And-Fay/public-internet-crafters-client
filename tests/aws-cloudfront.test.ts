import { describe, expect, it } from "vitest";
import { eventsFromCloudFrontKinesis } from "../src/aws/cloudfront.js";

const fields = [
  "timestamp",
  "c-ip",
  "sc-status",
  "cs-method",
  "cs-host",
  "cs-uri-stem",
  "cs-user-agent",
  "x-edge-request-id",
  "sc-content-type",
];

function record(values: string[]) {
  return { kinesis: { data: Buffer.from(values.join("\t"), "utf8").toString("base64") } };
}

describe("AWS CloudFront real-time log adapter", () => {
  it("turns crawler HTML requests into the canonical platform-neutral envelope", () => {
    const events = eventsFromCloudFrontKinesis(
      {
        Records: [
          record([
            "1788114130.123",
            "66.249.66.1",
            "200",
            "GET",
            "example.com",
            "/Services/Pool",
            "Googlebot/2.1",
            "edge-request-1",
            "text/html",
          ]),
        ],
      },
      { distributionId: "EDFDVBD6EXAMPLE", fields },
    );

    expect(events).toEqual([
      expect.objectContaining({
        event_id: "edge-request-1",
        event_type: "crawler_page_view",
        page: { path: "/Services/Pool" },
        request: expect.objectContaining({
          agent_category: "crawler;cloudfront-user-agent",
          client_ip: "66.249.66.1",
          status_code: 200,
          user_agent: "Googlebot/2.1",
        }),
        site: {
          hostname: "example.com",
          platform: "aws",
          platform_site_id: "EDFDVBD6EXAMPLE",
        },
        source: "aws-cloudfront",
      }),
    ]);
  });

  it("does not mislabel ordinary browsers or non-page assets as crawlers", () => {
    const event = {
      Records: [
        record([
          "1788114130.123",
          "192.0.2.1",
          "200",
          "GET",
          "example.com",
          "/",
          "Mozilla/5.0 Safari/537.36",
          "browser-1",
          "text/html",
        ]),
        record([
          "1788114130.123",
          "66.249.66.1",
          "200",
          "GET",
          "example.com",
          "/app.css",
          "Googlebot/2.1",
          "asset-1",
          "text/css",
        ]),
      ],
    };

    expect(
      eventsFromCloudFrontKinesis(event, { distributionId: "EDFDVBD6EXAMPLE", fields }),
    ).toEqual([]);
  });
});
