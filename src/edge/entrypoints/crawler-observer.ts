import { publicPathAllowed } from "../../contracts/public-paths.js";
import { createCrawlerPageView } from "../events/crawler.js";
import {
  type EdgeFunctionConfig,
  type NetlifyEdgeContext,
  runtimeCollectionEnabled,
  runtimeDestination,
  runtimePublicPaths,
} from "../runtime.js";

export default async function crawlerObserver(
  request: Request,
  context: NetlifyEdgeContext,
): Promise<Response> {
  if (
    !runtimeCollectionEnabled("crawler") ||
    !publicPathAllowed(new URL(request.url).pathname, runtimePublicPaths())
  ) {
    return context.next();
  }

  const destination = runtimeDestination(undefined, new URL(request.url).hostname);
  const occurredAt = new Date();
  const response = await context.next();

  if (!destination || !createCrawlerPageView.isPageResponse(response)) {
    return response;
  }

  const event = createCrawlerPageView({ context, occurredAt, request, response });
  context.waitUntil(destination.send(event).catch(() => undefined));
  return response;
}

export const config: EdgeFunctionConfig = {
  header: { "netlify-agent-category": "^(ai-agent|crawler)(;|$)" },
  method: "GET",
  onError: "bypass",
  path: "/*",
};
