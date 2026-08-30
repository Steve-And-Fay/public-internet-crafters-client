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

const browserSource = await readFile(new URL("browser-script.js", outputDirectory), "utf8");
if (browserSource.includes("IC_ANALYTICS_INGEST_TOKEN")) {
  throw new Error("The generated browser client contains the collector credential name");
}
