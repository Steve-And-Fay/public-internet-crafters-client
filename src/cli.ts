import { type ClientPlatform, installAdapter } from "./installer.js";

const usage = `Usage:
  ic-client install netlify --target <netlify/edge-functions> [--force]
  ic-client install wordpress --target <wp-content/plugins> [--force]
  ic-client install aws --target <directory> [--force]`;

function option(name: string): string | undefined {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

const [, , command, platform] = process.argv;
const target = option("--target");
const force = process.argv.includes("--force");
const supportedPlatforms = new Set<ClientPlatform>(["aws", "netlify", "wordpress"]);

if (
  command !== "install" ||
  !target ||
  !platform ||
  !supportedPlatforms.has(platform as ClientPlatform)
) {
  process.stderr.write(`${usage}\n`);
  process.exitCode = 2;
} else {
  const repositoryRoot = new URL("../", import.meta.url);
  const result = await installAdapter({
    force,
    platform: platform as ClientPlatform,
    repositoryRoot,
    target,
  });
  process.stdout.write(`Installed ${platform} adapter in ${result.destination}\n`);
}
