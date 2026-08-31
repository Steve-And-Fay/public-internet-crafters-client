import { constants } from "node:fs";
import { access, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ClientPlatform = "aws" | "netlify" | "wordpress";

interface InstallAdapterOptions {
  force: boolean;
  platform: ClientPlatform;
  repositoryRoot: URL;
  target: string;
}

interface InstallAdapterResult {
  destination: string;
  files: string[];
}

export const NETLIFY_EDGE_FUNCTIONS = [
  "browser-bootstrap.js",
  "browser-events.js",
  "browser-script.js",
  "crawler-observer.js",
] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function installAdapter({
  force,
  platform,
  repositoryRoot,
  target,
}: InstallAdapterOptions): Promise<InstallAdapterResult> {
  const targetRoot = resolve(target);

  if (platform === "netlify") {
    const files = NETLIFY_EDGE_FUNCTIONS.map((file) => `internet-crafters-analytics-${file}`);
    const destinations = files.map((file) => resolve(targetRoot, file));
    const conflict = force
      ? undefined
      : await Promise.all(
          destinations.map(async (destination) => ({
            destination,
            exists: await exists(destination),
          })),
        ).then((checks) => checks.find((check) => check.exists));

    if (conflict) {
      throw new Error(`${conflict.destination} already exists; rerun with --force to update it.`);
    }

    await mkdir(targetRoot, { recursive: true });
    await Promise.all(
      NETLIFY_EDGE_FUNCTIONS.map((sourceFile) =>
        cp(
          fileURLToPath(new URL(`dist/netlify/${sourceFile}`, repositoryRoot)),
          resolve(targetRoot, `internet-crafters-analytics-${sourceFile}`),
          { force: true },
        ),
      ),
    );

    return { destination: targetRoot, files };
  }

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

  return { destination, files: [] };
}
