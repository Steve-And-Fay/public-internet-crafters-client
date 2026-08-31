import type { PublicPathPolicy } from "../contracts/public-paths.js";

export const BROWSER_TRACKER_PATH = "/__ic/analytics/v1/client.js";
const SCRIPT_TAG = `<script src="${BROWSER_TRACKER_PATH}" defer></script>`;

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function injectBrowserTracker(
  html: string,
  release?: string,
  publicPaths?: PublicPathPolicy,
): { html: string; injected: boolean } {
  if (html.includes(BROWSER_TRACKER_PATH)) {
    return { html, injected: false };
  }

  const headClose = /<\/head\s*>/iu;
  if (!headClose.test(html)) {
    return { html, injected: false };
  }

  const releaseTag = release
    ? `<meta name="ic-release" content="${escapeHtmlAttribute(release)}">`
    : "";
  const pathTag =
    publicPaths && publicPaths.mode !== "all"
      ? `<meta name="ic-public-paths" content="${escapeHtmlAttribute(JSON.stringify(publicPaths.paths))}">`
      : "";

  return {
    html: html.replace(headClose, `${releaseTag}${pathTag}${SCRIPT_TAG}</head>`),
    injected: true,
  };
}
