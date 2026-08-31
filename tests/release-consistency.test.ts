import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CLIENT_VERSION } from "../src/version.js";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

describe("release version consistency", () => {
  it("keeps the package, lockfile, and WordPress cache version aligned", async () => {
    const lock = JSON.parse(await read("package-lock.json"));
    expect(lock.version).toBe(CLIENT_VERSION);
    expect(lock.packages[""].version).toBe(CLIENT_VERSION);
    const plugin = await read(
      "platforms/wordpress/internet-crafters-analytics/internet-crafters-analytics.php",
    );
    expect(plugin).toContain(`Version: ${CLIENT_VERSION}`);
    expect(plugin).toContain(`define('IC_ANALYTICS_PLUGIN_VERSION', '${CLIENT_VERSION}');`);
  });

  it("keeps pinned installation examples on the current release", async () => {
    for (const path of ["README.md", "docs/aws.md", "docs/wordpress.md", "docs/publishing.md"]) {
      const references = [
        ...(await read(path)).matchAll(/public-internet-crafters-client#v([\d.]+)/gu),
      ];
      expect(references.length).toBeGreaterThan(0);
      for (const reference of references) expect(reference[1]).toBe(CLIENT_VERSION);
    }
  });
});
