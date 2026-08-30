import type { AnalyticsEventEnvelope } from "../../contracts/analytics-event.js";
import type { AnalyticsDestination } from "./types.js";

interface WebhookDestinationOptions {
  authHeader?: string;
  authScheme?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  token?: string;
  url: string;
}

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "::1", "localhost"]);

function validateUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname))
  ) {
    throw new TypeError("Remote analytics destinations must use HTTPS");
  }
  return url;
}

function validateHeaderName(value: string): string {
  const header = value.trim().toLowerCase();
  if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/u.test(header)) {
    throw new TypeError("Invalid analytics authorization header name");
  }
  return header;
}

export function createWebhookDestination({
  authHeader = "authorization",
  authScheme = "Bearer",
  fetchImpl = fetch,
  timeoutMs = 5_000,
  token,
  url: urlValue,
}: WebhookDestinationOptions): AnalyticsDestination {
  const url = validateUrl(urlValue).toString();
  const authorizationHeader = validateHeaderName(authHeader);

  return {
    async send(event: AnalyticsEventEnvelope) {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (token) {
        headers[authorizationHeader] = authScheme ? `${authScheme} ${token}` : token;
      }

      const response = await fetchImpl(url, {
        body: JSON.stringify(event),
        headers,
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
      });

      return { accepted: response.ok, status: response.status };
    },
  };
}
