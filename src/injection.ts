const CRAWLER_FUNCTIONS = new Set(["crawler-observer"]);
const BROWSER_FUNCTIONS = new Set(["browser-bootstrap", "browser-events", "browser-script"]);

interface InjectionOptions {
  env: Record<string, string | undefined>;
  name: string;
}

function isEnabled(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.trim().toLowerCase() === "true";
}

export function shouldInjectAnalyticsFunction({ env, name }: InjectionOptions): boolean {
  if (!isEnabled(env.IC_ANALYTICS_ENABLED)) {
    return false;
  }

  if (CRAWLER_FUNCTIONS.has(name)) {
    return isEnabled(env.IC_ANALYTICS_CRAWLERS, true);
  }

  if (BROWSER_FUNCTIONS.has(name)) {
    return isEnabled(env.IC_ANALYTICS_BROWSER, true);
  }

  return false;
}
