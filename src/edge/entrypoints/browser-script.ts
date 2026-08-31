import { BROWSER_TRACKER_SOURCE } from "virtual:browser-tracker-source";
import { NETLIFY_HEALTH_PATH, netlifyHealth } from "../health.js";
import type { EdgeFunctionConfig } from "../runtime.js";

export default function browserScript(request: Request): Response {
  const url = new URL(request.url);
  if (url.pathname === NETLIFY_HEALTH_PATH) return netlifyHealth(undefined, url.hostname);
  return new Response(BROWSER_TRACKER_SOURCE, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "application/javascript; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export const config: EdgeFunctionConfig = {
  cache: "manual",
  header: { "netlify-agent-category": "^browser$" },
  method: "GET",
  onError: "fail",
  path: ["/__ic/analytics/v1/client.js", NETLIFY_HEALTH_PATH],
};
