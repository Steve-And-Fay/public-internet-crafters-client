import {
  type AnalyticsError,
  type AnalyticsErrorFrame,
  safeIdentifier,
} from "../contracts/analytics-event.js";

interface BrowserErrorOptions {
  mechanism: "unhandledrejection" | "window.error";
  release: string;
  userAgent: string;
}

function environment(userAgent: string): NonNullable<AnalyticsError["environment"]> {
  const browser = /Edg\//iu.test(userAgent)
    ? "edge"
    : /Firefox\//iu.test(userAgent)
      ? "firefox"
      : /Chrome\//iu.test(userAgent)
        ? "chrome"
        : /Safari\//iu.test(userAgent)
          ? "safari"
          : "other";
  const os = /Windows/iu.test(userAgent)
    ? "windows"
    : /(?:Macintosh|Mac OS X)/iu.test(userAgent)
      ? "macos"
      : /Android/iu.test(userAgent)
        ? "android"
        : /(?:iPhone|iPad|iOS)/iu.test(userAgent)
          ? "ios"
          : /Linux/iu.test(userAgent)
            ? "linux"
            : "other";
  return { browser_family: browser, os_family: os };
}

function frameFromLine(line: string): AnalyticsErrorFrame | null {
  const location = line.match(
    /(?<module>(?:https?:\/\/|\/)[^\s()]+):(?<line>\d+):(?<column>\d+)\)?$/u,
  );
  if (!location?.groups) return null;
  const rawModule = location.groups.module;
  if (!rawModule) return null;
  let module = rawModule;
  try {
    const url = new URL(rawModule, "https://analytics.invalid");
    if (url.search || url.hash) return null;
    module = url.pathname;
  } catch {
    return null;
  }
  if (!module.startsWith("/") || module.includes("..") || module.length > 500) return null;
  const beforeLocation = line.slice(0, location.index).trim();
  const functionMatch = beforeLocation.match(/(?:at\s+)?(?<function>[A-Za-z0-9_.$:-]+)\s*\(?$/u);
  const functionName = functionMatch?.groups?.function;

  return {
    column: Number(location.groups.column),
    ...(functionName ? { function: functionName } : {}),
    line: Number(location.groups.line),
    module,
  };
}

export function structuralBrowserError(
  value: unknown,
  { mechanism, release, userAgent }: BrowserErrorOptions,
): AnalyticsError {
  const error = value instanceof Error ? value : null;
  const frames = (error?.stack?.split("\n").slice(1) ?? [])
    .map(frameFromLine)
    .filter((frame): frame is AnalyticsErrorFrame => frame !== null)
    .slice(0, 20);

  return {
    environment: environment(userAgent),
    frames,
    mechanism,
    release: safeIdentifier(release, "unknown", 128),
    runtime: "browser",
    type: error
      ? safeIdentifier(error.name, "BrowserError", 191)
      : mechanism === "unhandledrejection"
        ? "UnhandledRejection"
        : "BrowserError",
  };
}
