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

  return {
    html: html.replace(headClose, `${releaseTag}${SCRIPT_TAG}</head>`),
    injected: true,
  };
}
