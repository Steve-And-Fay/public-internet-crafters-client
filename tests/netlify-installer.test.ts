import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installAdapter } from "../src/installer.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("Netlify GitHub installer", () => {
  it("copies the four generated edge functions and preserves unrelated functions", async () => {
    const target = await mkdtemp(join(tmpdir(), "ic-client-netlify-"));
    temporaryDirectories.push(target);
    await writeFile(join(target, "domain-redirect.ts"), "export default () => undefined;\n");

    const result = await installAdapter({
      force: false,
      platform: "netlify",
      repositoryRoot: new URL("../", import.meta.url),
      target,
    });

    expect(result.files).toHaveLength(4);
    expect(result.files).toEqual(
      expect.arrayContaining([
        "internet-crafters-analytics-browser-bootstrap.js",
        "internet-crafters-analytics-browser-events.js",
        "internet-crafters-analytics-browser-script.js",
        "internet-crafters-analytics-crawler-observer.js",
      ]),
    );
    expect(await readFile(join(target, "domain-redirect.ts"), "utf8")).toContain("undefined");
    expect(
      await readFile(join(target, "internet-crafters-analytics-browser-events.js"), "utf8"),
    ).toContain("/__ic/analytics/v1/events");
  });

  it("requires force before replacing an installed Netlify function", async () => {
    const target = await mkdtemp(join(tmpdir(), "ic-client-netlify-"));
    temporaryDirectories.push(target);
    const installed = join(target, "internet-crafters-analytics-browser-bootstrap.js");
    await writeFile(installed, "old build\n");

    await expect(
      installAdapter({
        force: false,
        platform: "netlify",
        repositoryRoot: new URL("../", import.meta.url),
        target,
      }),
    ).rejects.toThrow("rerun with --force");

    await installAdapter({
      force: true,
      platform: "netlify",
      repositoryRoot: new URL("../", import.meta.url),
      target,
    });
    expect(await readFile(installed, "utf8")).not.toContain("old build");
  });
});
