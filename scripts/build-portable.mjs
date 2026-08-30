import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootFile = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const distDirectory = new URL("../dist/", import.meta.url);
const trackerFile = rootFile("platforms/wordpress/internet-crafters-analytics/assets/tracker.js");

await rm(distDirectory, { force: true, recursive: true });
await mkdir(new URL("../platforms/aws/function/", import.meta.url), { recursive: true });
await mkdir(
  new URL("../platforms/wordpress/internet-crafters-analytics/assets/", import.meta.url),
  {
    recursive: true,
  },
);

await build({
  bundle: true,
  entryPoints: [rootFile("src/browser/tracker.ts")],
  format: "iife",
  minify: true,
  outfile: trackerFile,
  platform: "browser",
  target: "es2020",
});

await build({
  bundle: true,
  entryPoints: [rootFile("src/aws/handler.ts")],
  format: "esm",
  outfile: rootFile("platforms/aws/function/index.mjs"),
  platform: "node",
  target: "node20",
});

await build({
  bundle: true,
  entryPoints: [rootFile("src/public.ts")],
  format: "esm",
  outfile: rootFile("dist/public.mjs"),
  platform: "node",
  sourcemap: true,
  target: "node20",
});

await build({
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  entryPoints: [rootFile("src/cli.ts")],
  format: "esm",
  outfile: rootFile("dist/cli.mjs"),
  platform: "node",
  target: "node20",
});
await chmod(new URL("cli.mjs", distDirectory), 0o755);

await cp(new URL("../platforms/aws/", import.meta.url), new URL("aws/", distDirectory), {
  recursive: true,
});
await cp(
  new URL("../platforms/wordpress/internet-crafters-analytics/", import.meta.url),
  new URL("wordpress/internet-crafters-analytics/", distDirectory),
  { recursive: true },
);
await cp(
  new URL("../.generated/edge-functions/", import.meta.url),
  new URL("netlify/", distDirectory),
  {
    recursive: true,
  },
);
