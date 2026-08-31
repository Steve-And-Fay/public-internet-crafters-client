# Event contract

Every destination receives one JSON object. `schema_version` is the compatibility boundary; add
optional fields within version 1, and create a new version for breaking changes.

Shared fields:

| Field | Meaning |
| --- | --- |
| `schema_version` | Currently `1`. |
| `event_id` | Request ID or browser-generated event ID. |
| `event_type` | `crawler_page_view`, `page_view`, `click`, `error`, or a registered [dedicated action](contact-actions.md). |
| `occurred_at` | ISO 8601 UTC timestamp at the source. |
| `received_at` | Optional edge receipt time for browser events. |
| `source` | `netlify-edge`, `aws-cloudfront`, `aws-lambda`, `wordpress`, or `browser`. |
| `site` | Hostname, platform, and optional platform site ID. |
| `page.path` | Path only; query string and fragment are removed. |

Crawler events add `request.agent_category`, `client_ip`, `method`, `status_code`, and `user_agent`.
Ordinary browser events add a session-scoped random ID under `properties.session_id`. Click events may add a
sanitized target kind, explicit tracking name, and destination. Same-site destinations retain only
the path; external destinations retain only the origin; phone and email destinations become `tel:`
or `mailto:`.

Page views and clicks may include sanitized UTM labels. Paid parameters such as `gclid`, `gbraid`,
`wbraid`, and `msclkid` become only `paid_click_present: true` and a provider label. Raw paid-click
values never enter the envelope.

Reduced-data counts use `properties.collection_mode: "anonymous"`, omit all session, target and
attribution properties, and round `occurred_at` to the minute. They accept only `page_view` and
`click`, never `error`. See `docs/privacy.md` for the privacy-signal behavior and its limits.

Error events add type, mechanism, release, runtime, up to 20 structural frames, and an allowlisted
coarse environment. Messages, request bodies, local variables, arbitrary context, and frame URL
queries are absent. The portal groups errors per site by structural fingerprint.

The canonical event intentionally does not freeze a crawler-vendor taxonomy. A downstream collector
should derive vendor and product dimensions from `request.user_agent`, for example Google from
`Googlebot`, Microsoft from `bingbot`, and OpenAI from `GPTBot` or `OAI-SearchBot`. Store the original
user agent so those derived dimensions can be recomputed when vendors change their signatures.

Unknown browser properties are discarded rather than passed through. The portal independently
enforces exact allowlists and refuses an invalid event as a whole.

See `examples/events.json` for representative payloads.

## Check this document against

- `src/contracts/analytics-event.ts`
- `src/edge/events/browser.ts`
- `src/browser/tracker.ts`
- `docs/privacy.md`
- `src/edge/events/crawler.ts`
- `src/errors/server.ts`
- `examples/events.json`
