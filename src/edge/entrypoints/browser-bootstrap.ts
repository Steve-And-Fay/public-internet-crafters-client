import { injectBrowserTracker } from "../browser-bootstrap.js";
import {
  type EdgeFunctionConfig,
  type NetlifyEdgeContext,
  runtimeDestination,
} from "../runtime.js";

const BODY_HEADERS = ["content-encoding", "content-length", "content-md5", "etag"];

export default async function browserBootstrap(
  _request: Request,
  context: NetlifyEdgeContext,
): Promise<Response> {
  const response = await context.next();
  if (!runtimeDestination() || !response.ok || !response.body) {
    return response;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/html") && !contentType.includes("application/xhtml+xml")) {
    return response;
  }

  const transformed = injectBrowserTracker(await response.text());
  if (!transformed.injected) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const header of BODY_HEADERS) headers.delete(header);
  return new Response(transformed.html, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export const config: EdgeFunctionConfig = {
  excludedPath: "/__ic/analytics/*",
  header: { "netlify-agent-category": "^browser$" },
  method: "GET",
  onError: "bypass",
  path: "/*",
};
