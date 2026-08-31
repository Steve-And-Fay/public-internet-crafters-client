import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkNetlifyInstallation } from "../src/doctor.js";
import { installAdapter } from "../src/installer.js";
import { CLIENT_VERSION } from "../src/version.js";

const repositoryRoot = new URL("../", import.meta.url);
const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const ready = {
  version: CLIENT_VERSION,
  status: "ready",
  browserEnabled: true,
  crawlersEnabled: true,
  collectorConfigured: true,
  deliveryVerified: false,
};

function fetchFixture(
  health = ready,
  html = '<head><script src="/__ic/analytics/v1/client.js" defer></script></head>',
) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/health")) return Response.json(health);
    if (url.pathname.endsWith("/client.js"))
      return new Response("/* tracker */", {
        headers: { "content-type": "application/javascript" },
      });
    return new Response(html, { headers: { "content-type": "text/html" } });
  });
}

describe("Netlify installation doctor", () => {
  it("passes exact installed bundles and detects missing or changed files", async () => {
    const target = await mkdtemp(join(tmpdir(), "ic-doctor-"));
    temporaryDirectories.push(target);
    const empty = await checkNetlifyInstallation({ repositoryRoot, target });
    expect(empty.ok).toBe(false);
    await installAdapter({ repositoryRoot, target, force: false, platform: "netlify" });
    expect((await checkNetlifyInstallation({ repositoryRoot, target })).ok).toBe(true);
    await writeFile(join(target, "internet-crafters-analytics-browser-bootstrap.js"), "old bundle");
    expect((await checkNetlifyInstallation({ repositoryRoot, target })).ok).toBe(false);
  });

  it("checks the deployed site using GET requests only and does not claim ingestion", async () => {
    const fetcher = fetchFixture();
    const result = await checkNetlifyInstallation({
      repositoryRoot,
      url: "https://site.example.com/",
      fetcher,
    });
    expect(result.ok).toBe(true);
    expect(result.deliveryVerified).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [url, options] of fetcher.mock.calls) {
      expect(String(url)).not.toContain("/events");
      expect(options?.method).toBe("GET");
      expect(options?.body).toBeUndefined();
      expect(options?.redirect).toBe("error");
      // Netlify does not classify a bare Mozilla prefix as a browser.
      expect(new Headers(options?.headers).get("user-agent")).toContain("Chrome/");
      expect(new Headers(options?.headers).get("user-agent")).toContain("Safari/");
    }
  });

  it("fails when runtime configuration is incomplete or the tracker is missing", async () => {
    const misconfigured = await checkNetlifyInstallation({
      repositoryRoot,
      url: "https://site.example.com",
      fetcher: fetchFixture({ ...ready, status: "misconfigured", collectorConfigured: false }),
    });
    expect(misconfigured.ok).toBe(false);
    const missing = await checkNetlifyInstallation({
      repositoryRoot,
      url: "https://site.example.com",
      fetcher: fetchFixture(ready, "<head></head>"),
    });
    expect(missing.ok).toBe(false);
  });

  it("reports version drift", async () => {
    const result = await checkNetlifyInstallation({
      repositoryRoot,
      url: "https://site.example.com",
      fetcher: fetchFixture({ ...ready, version: "0.0.0" }),
    });
    expect(result.ok).toBe(false);
    expect(
      result.checks.some((check) => check.name === "deployed-version" && check.status === "fail"),
    ).toBe(true);
  });

  it("honors a browser opt-out without requesting browser pages", async () => {
    const fetcher = fetchFixture({ ...ready, browserEnabled: false });
    const result = await checkNetlifyInstallation({
      repositoryRoot,
      url: "https://site.example.com",
      fetcher,
    });
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("redacts network errors and rejects unsafe or ambiguous site URLs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret-token-in-url"));
    const result = await checkNetlifyInstallation({
      repositoryRoot,
      url: "https://site.example.com",
      fetcher,
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret-token-in-url");
    fetcher.mockClear();
    for (const url of [
      "http://site.example.com",
      "https://user:secret@site.example.com",
      "https://site.example.com/?token=secret",
      "https://site.example.com/subpath",
    ]) {
      expect((await checkNetlifyInstallation({ repositoryRoot, url, fetcher })).ok).toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect((await checkNetlifyInstallation({ repositoryRoot })).ok).toBe(false);
  });
});
