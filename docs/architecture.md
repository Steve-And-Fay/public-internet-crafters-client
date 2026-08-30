# Architecture

The system separates customer deployment, event normalization, delivery, and storage across
Netlify, AWS, WordPress, and custom Node applications.

1. A platform adapter observes a crawler request, same-origin browser event, or structural error.
2. Event modules convert input into schema version 1 of the canonical envelope.
3. A server/runtime adapter adds the hostname-bound credential and delivers over HTTPS.
4. The portal stores the event and durable rollup before optional downstream adapters run.

## Why generated Edge Functions exist

Netlify Extension-injected Edge Functions support inline declarations and URL imports, but not local
module imports. Source remains modular under `src/edge/`; `scripts/build-edge-functions.mjs` uses
esbuild to produce self-contained files under `.generated/edge-functions/`. The extension injects
those outputs. `scripts/check-generated.mjs` rejects unexpected files and unsupported imports.

The browser tracker follows the same model. Its source is maintained in `src/browser/tracker.ts`,
bundled to an immediately invoked script, and embedded into the generated `browser-script` function.

`scripts/build-portable.mjs` builds the same tracker for WordPress, the CloudFront Kinesis consumer,
the public Node module, and the `ic-client` Git installer.

## Request flows

### Crawlers

Netlify matches `crawler` and `ai-agent` categories before invoking the observer. The observer calls
the next handler, records only HTML responses, and delivers the event in `context.waitUntil()` so
collector latency is not added to the page response.

### Browsers

The bootstrap runs only for browser-classified GET requests and excludes the analytics routes. It
injects a deferred same-origin script into successful HTML. The client sends an initial page view,
route changes, sanitized attribution, clicks, and structural errors to the event endpoint. The
endpoint enforces same-origin requests, an 8 KiB limit, JSON content type, and the canonical allowlist
before forwarding. These controls reduce casual abuse, but they are not proof that a human generated
an event; downstream reporting should still tolerate spoofed or duplicated analytics.

### AWS

CloudFront real-time logs flow through Kinesis to the bundled Lambda consumer. The SAM template
creates the stream, IAM delivery role, real-time log configuration, consumer, and event source. An
existing distribution stays outside the stack: attach the output ARN to each observed cache behavior.

### WordPress

The plugin enqueues the browser tracker, accepts events on a fixed rewrite route, observes crawler
HTML responses at shutdown, and reports fatal PHP errors without messages. Configuration comes from
constants or environment variables and is never printed into the page.

## Failure behavior

Observer and bootstrap functions use Netlify's bypass behavior to protect the customer response.
Crawler delivery failures are swallowed after the response continues. Browser event failures return
an error only to the background analytics request. WordPress uses non-blocking HTTP. The reusable
server wrapper reports and then rethrows the same application failure; collector failure never
replaces it. The collector token never enters browser code.

## Check this document against

- `scripts/build-edge-functions.mjs`
- `scripts/check-generated.mjs`
- `src/edge/entrypoints/`
- `src/edge/runtime.ts`
- `src/browser/tracker.ts`
- `src/aws/`
- `src/errors/`
- `platforms/`
