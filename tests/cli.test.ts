import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLIENT_VERSION } from "../src/version.js";

const run = (...args: string[]) =>
  spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../dist/cli.mjs", import.meta.url)), ...args],
    { encoding: "utf8" },
  );

describe("packaged installation CLI", () => {
  it("identifies its release", () => {
    const result = run("--version");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(CLIENT_VERSION);
  });

  it.each([
    ["doctor", "netlify"],
    ["doctor", "netlify", "--target"],
    ["doctor", "netlify", "--target", ".", "--url"],
    ["doctor", "wordpress", "--target", "."],
  ])("rejects incomplete or unsupported usage: %j", (...args) => {
    expect(run(...args).status).toBe(2);
  });

  it("returns a machine-readable failure without making an unsafe request", () => {
    const result = run("doctor", "netlify", "--url", "http://example.com", "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, deliveryVerified: false });
  });
});
