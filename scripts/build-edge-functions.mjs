import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outputDirectory = new URL("../.generated/edge-functions/", import.meta.url);
const entrypoints = ["browser-bootstrap", "browser-events", "browser-script", "crawler-observer"];

await rm(new URL("../.generated/", import.meta.url), { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const trackerBuild = await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../src/browser/tracker.ts", import.meta.url))],
  format: "iife",
  minify: true,
  platform: "browser",
  target: "es2020",
  write: false,
});
const trackerSource = new TextDecoder().decode(trackerBuild.outputFiles[0].contents);

const trackerSourcePlugin = {
  name: "browser-tracker-source",
  setup(buildContext) {
    buildContext.onResolve({ filter: /^virtual:browser-tracker-source$/ }, () => ({
      namespace: "browser-tracker-source",
      path: "source",
    }));
    buildContext.onLoad({ filter: /.*/, namespace: "browser-tracker-source" }, () => ({
      contents: `export const BROWSER_TRACKER_SOURCE = ${JSON.stringify(trackerSource)};`,
      loader: "js",
    }));
  },
};

await build({
  bundle: true,
  entryNames: "[name]",
  entryPoints: Object.fromEntries(
    entrypoints.map((name) => [
      name,
      fileURLToPath(new URL(`../src/edge/entrypoints/${name}.ts`, import.meta.url)),
    ]),
  ),
  format: "esm",
  outdir: fileURLToPath(outputDirectory),
  platform: "browser",
  plugins: [trackerSourcePlugin],
  target: "es2022",
});
