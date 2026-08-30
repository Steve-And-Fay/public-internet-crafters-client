# Adding a destination

The client deployment depends on `AnalyticsDestination`, not a vendor SDK. Its only responsibility is
to send a canonical event and report whether the destination accepted it.

Prefer one of these approaches:

1. Keep the included webhook adapter and translate events in a central collector or gateway. This is
   the best fit for third-party systems because customer sites remain unchanged during migrations.
2. Add another adapter under `src/edge/destinations/` when a provider must be called directly from the
   edge. Keep credentials in Netlify runtime environment variables and map only from the canonical
   envelope.

When adding an adapter:

- require HTTPS except for loopback development
- use site-specific, revocable credentials
- set a short timeout and avoid retries in the customer request path
- never include credentials or provider configuration in `src/browser/`
- add contract tests before implementation
- document provider retention, regional processing, and relevant customer settings

If routing rules become more complex, introduce a destination factory in `src/edge/runtime.ts`; do not
branch inside event normalizers or the browser tracker.

## Check this document against

- `src/edge/destinations/types.ts`
- `src/edge/destinations/webhook.ts`
- `src/edge/runtime.ts`
- `tests/destination.test.ts`
