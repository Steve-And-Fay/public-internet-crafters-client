import { NetlifyExtension } from "@netlify/sdk";
import { shouldInjectAnalyticsFunction } from "./injection.js";

const extension = new NetlifyExtension();

extension.addEdgeFunctions("./.generated/edge-functions", {
  prefix: "internet_crafters_client",
  shouldInjectFunction: ({ name }) => shouldInjectAnalyticsFunction({ env: process.env, name }),
});

export { extension };
