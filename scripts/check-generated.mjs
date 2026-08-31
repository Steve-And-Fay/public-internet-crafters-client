import { access, readdir, readFile } from "node:fs/promises";

const outputDirectory = new URL("../.generated/edge-functions/", import.meta.url);
const expectedFiles = [
  "browser-bootstrap.js",
  "browser-events.js",
  "browser-script.js",
  "crawler-observer.js",
];

for (const file of expectedFiles) {
  await access(new URL(file, outputDirectory));
}

const files = await readdir(outputDirectory);
if (files.sort().join("\n") !== expectedFiles.sort().join("\n")) {
  throw new Error(`Unexpected generated edge functions: ${files.join(", ")}`);
}

for (const file of files) {
  const source = await readFile(new URL(file, outputDirectory), "utf8");
  if (/from\s+["'](?:\.|node:|@|[a-z])/u.test(source)) {
    throw new Error(`${file} contains an unsupported local, package, or Node import`);
  }
}

// Inspect the browser response, not server-side code serving the health endpoint.
const { default: browserScript } = await import(new URL("browser-script.js", outputDirectory));
const canary = "private-collector-canary";
globalThis.Netlify = {
  env: {
    get: (name) =>
      ({
        IC_ANALYTICS_ENABLED: "true",
        IC_ANALYTICS_INGEST_TOKEN: canary,
        IC_ANALYTICS_INGEST_URL: "https://private-collector.example.com/events",
      })[name],
  },
};
for (const path of ["client.js", "health"]) {
  const response = browserScript(new Request(`https://example.com/__ic/analytics/v1/${path}`));
  const body = await response.text();
  if (
    body.includes("IC_ANALYTICS_INGEST_TOKEN") ||
    body.includes(canary) ||
    body.includes("private-collector.example.com")
  ) {
    throw new Error(`The generated ${path} response exposes collector configuration`);
  }
}
delete globalThis.Netlify;
