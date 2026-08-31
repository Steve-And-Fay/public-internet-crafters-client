<!-- cspell:ignore keepalive -->
# Privacy and anonymous counting

With Do Not Track (`navigator.doNotTrack === "1"`) or Global Privacy Control enabled, the
browser records only page-view and click counts. Payloads include a path without its query or
fragment, minute-rounded event time, event type, and a fresh random event ID for deduplication.
`properties.collection_mode` is `anonymous`. Counts cannot measure unique people or sessions.

This mode never reads or writes session storage, sends session IDs or campaign attribution,
captures click destinations/names, or installs browser error listeners. It uses `fetch` with
`credentials: "omit"`, `referrerPolicy: "no-referrer"`, and `keepalive: true`, not `sendBeacon`.
Netlify and WordPress also enforce stripping when request headers contain `DNT: 1` or `Sec-GPC: 1`.
The portal independently strips visitor/campaign properties from anonymous events.

The collector does not forward browser IP addresses or user agents to the portal. Hosting and
network providers still process request metadata to serve requests and may maintain their own
operational logs. Paths can contain identifying information on some sites, so do not put personal
information in public URLs. This is data minimization, not a guarantee of legal anonymity.

Ordinary browser mode uses a session-storage ID and sanitized attribution. Crawler request
observation is separate and server-side. Browser blockers can prevent either browser mode, and
the collector does not bypass them. Disabled browser collection stays disabled in both modes.

This behavior is not a consent platform. Site owners must provide accurate notices and apply
any required consent or opt-out controls to all other tools as well. Review privacy obligations
for the deployment's audience and jurisdiction before enabling collection.

## Verification

In DevTools, select Network > All and Preserve log. Filter `/__ic/analytics/`.
Normal mode generally appears as a beacon/Ping request; anonymous mode uses Fetch.
Verify `POST /__ic/analytics/v1/events` returns 202, then inspect the stored mode and counts.
Never generate repeated synthetic errors to test normal traffic delivery.

## Check this document against

- `src/browser/tracker.ts`
- `src/edge/events/browser.ts`
- `src/edge/entrypoints/browser-events.ts`
- `platforms/wordpress/internet-crafters-analytics/internet-crafters-analytics.php`
- `tests/browser-privacy.test.ts`
- `tests/browser-events.test.ts`
