import { BROWSER_TRACKER_SOURCE } from "virtual:browser-tracker-source";
import type { EdgeFunctionConfig } from "../runtime.js";

export default function browserScript(): Response {
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
  path: "/__ic/analytics/v1/client.js",
};
