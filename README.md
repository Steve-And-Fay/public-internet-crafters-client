# Internet Crafters Client Analytics

Reusable customer-site analytics and error monitoring for Netlify, AWS, WordPress, and custom Node
applications. It observes search and AI crawlers, injects a small browser tracker for page views,
campaign attribution, and clicks, and reports structural failures through a provider-neutral event
contract.

The repository intentionally does not include a database or reporting dashboard. Events go to a
configurable HTTPS collector, so storage can be Internet Crafters infrastructure, a third-party
analytics service, or a routing gateway that fans out to several systems.

## What it collects

- crawler and AI-agent page requests, including timestamp, page path, response status, user agent,
  platform category, request ID, and source IP
- browser page views, including initial loads and single-page application route changes
- clicks on links, buttons, and elements marked with `data-ic-track`
- sanitized UTM labels and presence-only Google, Microsoft, Meta, TikTok, or Yandex paid attribution
- browser, WordPress/PHP, Lambda, and Node errors as structural type/release/stack-frame data
- platform, platform site ID, and hostname on every event

Query strings and fragments are removed from page paths. The browser client does not collect form
values, element text, click coordinates, exception messages, email addresses, phone numbers, raw
paid-click IDs, or persistent visitor IDs. It honors Do Not Track and Global Privacy Control.

The portal hashes source IP addresses and retains raw events for 90 days. Daily aggregates and
grouped issues remain after exact events expire.

## Architecture

```text
crawler request ──> crawler observer ──────────────┐
                                                   ├─> canonical event ─> destination adapter
browser HTML ──> script injection ─> same-origin ─┘
                                event endpoint
```

Four bundled Edge Functions are injected into enabled customer sites:

- `crawler-observer` runs only for Netlify's `crawler` and `ai-agent` categories.
- `browser-bootstrap` adds the same-origin client script to browser HTML responses.
- `browser-script` serves the generated, privacy-minimized browser tracker.
- `browser-events` validates browser events and forwards them without exposing collector secrets.

The extension owns those functions. Publish an extension update once, then rebuild a customer site
to inject the latest version on its next deploy.

## Local development

Requires Node.js 20.12.2 or newer.

```sh
npm install
npm run verify
```

Useful commands:

```sh
npm test
npm run typecheck
npm run generate
npm run build
npm run dev
```

Generated Edge Functions live in `.generated/` and are not committed. The generation step bundles
all local imports because Netlify Extensions do not support local or package imports inside injected
Edge Functions.

## Configure a Netlify customer site

Install the published extension on the customer's Netlify team, then set these site-scoped
environment variables:

```dotenv
IC_ANALYTICS_ENABLED=true
IC_ANALYTICS_INGEST_URL=https://collector.example.com/v1/events
IC_ANALYTICS_INGEST_TOKEN=replace-with-a-site-specific-secret
IC_ANALYTICS_RELEASE=customer-site-release-id
```

Optional variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `IC_ANALYTICS_CRAWLERS` | `true` | Disable only crawler and AI-agent observation with `false`. |
| `IC_ANALYTICS_BROWSER` | `true` | Disable browser page views and clicks with `false`. |
| `IC_ANALYTICS_INGEST_AUTH_HEADER` | `authorization` | Collector credential header. |
| `IC_ANALYTICS_INGEST_AUTH_SCHEME` | `Bearer` | Prefix before the token; set to an empty value for raw API keys. |

Trigger a fresh deploy after changing configuration. Environment variables must be scoped to builds
and runtime so the build can decide which functions to inject and the Edge Functions can reach the
collector.

To name a high-value click, add `data-ic-track`:

```html
<a href="/contact?source=pricing" data-ic-track="pricing-contact">Contact us</a>
```

The resulting event keeps `pricing-contact` and `/contact`, but not the link text or query string.
Use `data-ic-track-ignore` on an element or ancestor to suppress click collection.

## Provider integration

The default webhook adapter posts the canonical JSON envelope to any HTTPS URL. Add third-party
mapping downstream when possible; that preserves one stable client contract and makes migrations or
fan-out straightforward. See [adding a destination](docs/adding-a-destination.md) and the
[event contract](docs/event-contract.md).

Crawler vendor classification also belongs downstream. The client captures Netlify's crawler or
AI-agent category plus the raw user-agent string. The collector can then map values such as
`Googlebot`, `bingbot`, `GPTBot`, or `OAI-SearchBot` to a vendor and product. Keeping that mapping in
the collector means a crawler signature can be corrected once without rebuilding every customer
site.

## Distribution: GitHub and Netlify, not the npm registry

This repository is marked `private` in `package.json` and is not intended for the npm registry. Push
it to a GitHub repository, import that repository as the dedicated Netlify project that hosts the
extension, and publish the extension from Netlify's extension authoring flow. Netlify builds the
extension from GitHub whenever the production branch changes.

`private: true` prevents registry publication; it does not prevent installing a Git dependency.
AWS, WordPress, and custom Node projects can pin a public GitHub tag or commit:

```sh
npm install --save-dev "github:Steve-And-Fay/public-internet-crafters-client#v0.1.0"
npx ic-client install wordpress --target ./wp-content/plugins
npx ic-client install aws --target ./infrastructure
```

The Git dependency runs `prepare` to build portable artifacts, and the customer lockfile pins the
resolved commit. Updating a customer is deliberate: update the tag or dependency, commit the lockfile,
and deploy. A Git URL does not silently change an existing lockfile.

Netlify customers install the resulting Netlify Extension instead of copying source. See the
[Netlify](docs/netlify.md), [AWS](docs/aws.md), [WordPress](docs/wordpress.md), and
[server error capture](docs/error-capture.md) guides.

## Operational limits

- Crawler identity is classification, not authentication; user-agent strings can be spoofed.
- Browser tracking can be blocked by privacy tools, content security policy, or network failure.
- Modifying HTML invokes an Edge Function and buffers eligible HTML responses; test latency on large
  pages before broad rollout.
- Netlify Edge Function usage is billed to the customer site's Netlify account.
- CloudFront real-time logs, Kinesis, and Lambda can add charges to the customer AWS account.
- Review consent, retention, disclosure, and data-processing requirements for each customer and
  destination before enabling browser analytics.

## Check this document against

- `src/index.ts`
- `src/injection.ts`
- `src/edge/entrypoints/`
- `src/contracts/analytics-event.ts`
- `docs/event-contract.md`
