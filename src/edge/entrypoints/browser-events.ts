import { publicDestinationAllowed, publicPathAllowed } from "../../contracts/public-paths.js";
import { normalizeBrowserEvent } from "../events/browser.js";
import {
  analyticsResponse,
  type EdgeFunctionConfig,
  type NetlifyEdgeContext,
  runtimeCollectionEnabled,
  runtimeDestination,
  runtimePublicPaths,
} from "../runtime.js";

const MAX_BODY_BYTES = 8_192;

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export default async function browserEvents(
  request: Request,
  context: NetlifyEdgeContext,
): Promise<Response> {
  if (!runtimeCollectionEnabled("browser")) {
    return analyticsResponse(404, "Analytics collection is disabled");
  }

  if (!isSameOrigin(request)) {
    return analyticsResponse(403, "Cross-origin analytics events are not accepted");
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return analyticsResponse(415, "Expected application/json");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return analyticsResponse(413, "Analytics event is too large");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return analyticsResponse(413, "Analytics event is too large");
  }

  const destination = runtimeDestination();
  if (!destination) {
    return analyticsResponse(503, "Analytics destination is not configured");
  }

  try {
    const receivedAt = new Date();
    const url = new URL(request.url);
    const input = JSON.parse(body) as Record<string, unknown>;
    const policy = runtimePublicPaths();
    const target = input?.target as Record<string, unknown> | undefined;
    if (
      !publicPathAllowed(input?.path, policy) ||
      !publicDestinationAllowed(target?.destination, url.hostname, policy)
    ) {
      return analyticsResponse(204);
    }
    const event = normalizeBrowserEvent(input, {
      anonymous: request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1",
      hostname: url.hostname,
      platform: "netlify",
      platformSiteId: context.site?.id ?? "unknown",
      receivedAt,
    });
    const result = await destination.send(event);
    return analyticsResponse(
      result.accepted ? 202 : 502,
      result.accepted ? undefined : "Destination rejected event",
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return analyticsResponse(400, "Invalid analytics event");
    }
    return analyticsResponse(502, "Analytics destination is unavailable");
  }
}

export const config: EdgeFunctionConfig = {
  header: { "netlify-agent-category": "^browser$" },
  method: "POST",
  onError: "fail",
  path: "/__ic/analytics/v1/events",
};
