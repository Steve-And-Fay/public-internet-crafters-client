export const BROWSER_TRACKER_PATH = "/__ic/analytics/v1/client.js";
const SCRIPT_TAG = `<script src="${BROWSER_TRACKER_PATH}" defer></script>`;

export function injectBrowserTracker(html: string): { html: string; injected: boolean } {
  if (html.includes(BROWSER_TRACKER_PATH)) {
    return { html, injected: false };
  }

  const headClose = /<\/head\s*>/iu;
  if (!headClose.test(html)) {
    return { html, injected: false };
  }

  return {
    html: html.replace(headClose, `${SCRIPT_TAG}</head>`),
    injected: true,
  };
}
