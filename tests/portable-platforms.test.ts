import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const repositoryFile = (path: string) => new URL(`../${path}`, import.meta.url);

describe("portable customer deployments", () => {
  it("keeps the WordPress collector credential server-side", async () => {
    const plugin = await readFile(
      repositoryFile(
        "platforms/wordpress/internet-crafters-analytics/internet-crafters-analytics.php",
      ),
      "utf8",
    );

    expect(plugin).toContain("/__ic/analytics/v1/events");
    expect(plugin).toContain("IC_ANALYTICS_INGEST_TOKEN");
    expect(plugin).toContain("wp_remote_post");
    expect(plugin).toContain("internet_crafters_capture_exception");
    expect(plugin).toContain("register_shutdown_function");
    expect(plugin).not.toMatch(/<meta[^>]+(?:token|ingest)/iu);
  });

  it("provisions the AWS real-time log delivery path without baking in secrets", async () => {
    const template = await readFile(repositoryFile("platforms/aws/template.yaml"), "utf8");

    expect(template).toContain("AWS::CloudFront::RealtimeLogConfig");
    expect(template).toContain("AWS::Kinesis::Stream");
    expect(template).toContain("AWS::Serverless::Function");
    expect(template).toContain("IC_ANALYTICS_INGEST_TOKEN");
    expect(template).toContain("NoEcho: true");
    expect(template).toContain("RealtimeLogConfigArn");
  });

  it("exposes a portable CLI and builds artifacts during Git installation", async () => {
    const packageJson = JSON.parse(
      await readFile(repositoryFile("package.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(packageJson.private).toBe(true);
    expect(packageJson.bin).toEqual({ "ic-client": "dist/cli.mjs" });
    expect(packageJson.scripts).toMatchObject({
      "build:portable": "node scripts/build-portable.mjs",
      prepare: "npm run build:portable && npm run generate",
    });
  });
});
