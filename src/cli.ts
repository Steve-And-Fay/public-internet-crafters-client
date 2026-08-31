import { checkNetlifyInstallation } from "./doctor.js";
import { type ClientPlatform, installAdapter } from "./installer.js";
import { CLIENT_VERSION } from "./version.js";

const usage = `Usage:
  ic-client install netlify --target <netlify/edge-functions> [--force]
  ic-client install wordpress --target <wp-content/plugins> [--force]
  ic-client install aws --target <directory> [--force]
  ic-client doctor netlify [--target <netlify/edge-functions>] [--url <https://site.example.com>] [--json]
  ic-client --version`;

function option(name: string): string | undefined {
  const position = process.argv.indexOf(name);
  const value = position >= 0 ? process.argv[position + 1] : undefined;
  return value?.startsWith("--") ? undefined : value;
}

const [, , command, platform] = process.argv;
const target = option("--target");
const force = process.argv.includes("--force");
const supportedPlatforms = new Set<ClientPlatform>(["aws", "netlify", "wordpress"]);
const malformedOptions = ["--target", "--url"].some(
  (name) => process.argv.includes(name) && !option(name),
);

if (malformedOptions || (command === "doctor" && !target && !option("--url"))) {
  process.stderr.write(`${usage}\n`);
  process.exitCode = 2;
} else if (command === "--version") {
  process.stdout.write(`${CLIENT_VERSION}\n`);
} else if (command === "doctor" && platform === "netlify") {
  const url = option("--url");
  const result = await checkNetlifyInstallation({
    repositoryRoot: new URL("../", import.meta.url),
    ...(target ? { target } : {}),
    ...(url ? { url } : {}),
  });
  process.stdout.write(
    process.argv.includes("--json")
      ? `${JSON.stringify(result, null, 2)}\n`
      : `Internet Crafters Client ${CLIENT_VERSION}\n${result.checks.map((check) => `${check.status.toUpperCase()} ${check.name}: ${check.message}`).join("\n")}\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
} else if (
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
