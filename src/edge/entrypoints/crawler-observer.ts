import { createCrawlerPageView } from "../events/crawler.js";
import {
  type EdgeFunctionConfig,
  type NetlifyEdgeContext,
  runtimeDestination,
} from "../runtime.js";

export default async function crawlerObserver(
  request: Request,
  context: NetlifyEdgeContext,
): Promise<Response> {
  const destination = runtimeDestination();
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
