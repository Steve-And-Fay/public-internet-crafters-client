// cspell:ignore KHTML
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NETLIFY_EDGE_FUNCTIONS } from "./installer.js";
import { CLIENT_VERSION } from "./version.js";

interface HealthCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

interface DoctorOptions {
  repositoryRoot: URL;
  target?: string;
  url?: string;
  fetcher?: typeof fetch;
}

export async function checkNetlifyInstallation({
  repositoryRoot,
  target,
  url,
  fetcher = fetch,
}: DoctorOptions) {
  const checks: HealthCheck[] = [];
  const add = (name: string, status: HealthCheck["status"], message: string) =>
    checks.push({ name, status, message });
  const result = () => ({
    version: CLIENT_VERSION,
    ok: !checks.some((check) => check.status === "fail"),
    deliveryVerified: false,
    checks,
  });

  if (!target && !url) add("options", "fail", "Provide --target, --url, or both.");
  if (target) {
    for (const file of NETLIFY_EDGE_FUNCTIONS) {
      try {
        const [installed, expected] = await Promise.all([
          readFile(resolve(target, `internet-crafters-analytics-${file}`)),
          readFile(new URL(`dist/netlify/${file}`, repositoryRoot)),
        ]);
        const matches = installed.equals(expected);
        add(
          file,
          matches ? "pass" : "fail",
          matches
            ? "Installed bundle matches this release."
            : "Bundle differs; rerun install netlify --force from this release.",
        );
      } catch {
        add(file, "fail", "Bundle missing or unreadable; rerun the installer and check --target.");
      }
    }
  }
  if (!url) {
    add("deployment", "warn", "Local files only. Add --url to inspect the deployed site.");
    return result();
  }

  let site: URL;
  try {
    site = new URL(url);
    if (
      site.protocol !== "https:" ||
      site.username ||
      site.password ||
      site.search ||
      site.hash ||
      site.pathname !== "/"
    )
      throw new Error("Invalid site URL");
  } catch {
    add(
      "site-url",
      "fail",
      "Use the canonical HTTPS site origin, without credentials, a path, query, or fragment.",
    );
    return result();
  }

  const get = (path: string) =>
    fetcher(new URL(path, site).href, {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(10_000),
      headers: {
        // Netlify routes these endpoints only for its browser category.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "cache-control": "no-cache",
        dnt: "1",
        "sec-gpc": "1",
      },
    });
  try {
    const response = await get("/__ic/analytics/v1/health");
    const health = (await response.json()) as Record<string, unknown>;
    if (health.publicPathsValid === false) {
      add(
        "public-pages",
        "fail",
        "The public-page allowlist is invalid; collection fails closed. Check IC_ANALYTICS_PUBLIC_PATHS and redeploy.",
      );
    } else if (health.publicPathsRestricted === true) {
      add(
        "public-pages",
        "pass",
        "Collection is restricted to configured public paths; verify excluded pages separately.",
      );
    }
    const configured =
      response.ok &&
      health.status === "ready" &&
      health.collectorConfigured === true &&
      typeof health.browserEnabled === "boolean" &&
      typeof health.crawlersEnabled === "boolean";
    add(
      "runtime-configuration",
      configured ? "pass" : "fail",
      configured
        ? "Collector settings are present; this does not validate credentials or ingestion."
        : "Runtime collection is disabled or incomplete. Check production-scoped environment variables and redeploy.",
    );
    const current = health.version === CLIENT_VERSION;
    add(
      "deployed-version",
      current ? "pass" : "fail",
      current
        ? "Deployed client matches this release."
        : "Deployed client differs or is missing. Redeploy using the same release as this check.",
    );
    if (!configured) return result();
    if (!health.crawlersEnabled)
      add("crawler-channel", "warn", "Crawler collection is explicitly disabled.");
    if (!health.browserEnabled) {
      add(
        "browser-channel",
        "warn",
        "Browser collection is explicitly disabled; browser checks skipped.",
      );
      return result();
    }
  } catch {
    add(
      "runtime-health",
      "fail",
      "Health endpoint unavailable, redirected, or invalid. Check the canonical hostname, deployment, and Edge Function routing.",
    );
    return result();
  }

  for (const [name, path] of [
    ["html-injection", "/"],
    ["tracker-script", "/__ic/analytics/v1/client.js"],
  ] as const) {
    try {
      const response = await get(path);
      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      const valid =
        response.ok &&
        (name === "html-injection"
          ? contentType.includes("text/html") &&
            /<script\b[^>]*\bsrc\s*=\s*["']\/__ic\/analytics\/v1\/client\.js["']/iu.test(body)
          : /(?:application|text)\/javascript/iu.test(contentType) && body.trim().length > 0);
      add(
        name,
        valid ? "pass" : "fail",
        valid
          ? "Deployed resource is present."
          : "Expected tracker resource missing; check routing, HTML injection, and deployment.",
      );
    } catch {
      add(
        name,
        "fail",
        "Request failed or redirected. Check the canonical origin and site routing.",
      );
    }
  }
  add(
    "event-delivery",
    "warn",
    "Read-only check: no events sent. Confirm a normal visit in the portal separately; no test errors or emails are generated.",
  );
  return result();
}
