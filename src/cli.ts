import { constants } from "node:fs";
import { access, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = `Usage:
  ic-client install wordpress --target <wp-content/plugins> [--force]
  ic-client install aws --target <directory> [--force]

Netlify customers install the published extension; no repository copy is needed.`;

function option(name: string): string | undefined {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const [, , command, platform] = process.argv;
const target = option("--target");
const force = process.argv.includes("--force");

if (command !== "install" || !target || !["aws", "wordpress"].includes(platform ?? "")) {
  process.stderr.write(`${usage}\n`);
  process.exitCode = 2;
} else {
  const repositoryRoot = new URL("../", import.meta.url);
  const targetRoot = resolve(target);
  const destination = resolve(
    targetRoot,
    platform === "wordpress" ? "internet-crafters-analytics" : "internet-crafters-analytics-aws",
  );

  if ((await exists(destination)) && !force) {
    throw new Error(`${destination} already exists; rerun with --force to update its files.`);
  }

  await mkdir(destination, { recursive: true });
  if (platform === "wordpress") {
    await cp(
      fileURLToPath(new URL("platforms/wordpress/internet-crafters-analytics/", repositoryRoot)),
      destination,
      { force: true, recursive: true },
    );
  } else {
    await cp(fileURLToPath(new URL("platforms/aws/", repositoryRoot)), destination, {
      force: true,
      recursive: true,
    });
  }

  process.stdout.write(`Installed ${platform} adapter in ${destination}\n`);
}
