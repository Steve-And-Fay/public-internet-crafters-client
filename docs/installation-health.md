# Installation health checks

The Netlify doctor is read-only. It never submits analytics, generates synthetic errors, uses the
collector token from your terminal, or sends email. It uses GET requests without cookies and does
not execute browser JavaScript. Site/platform access logs may still record those requests.

## Before deployment

Run after the GitHub installer, using the same client release for both commands:

```sh
npx --yes github:Steve-And-Fay/public-internet-crafters-client#main doctor netlify \
  --target ./netlify/edge-functions
```

This compares the four installed bundles byte-for-byte with that release. Missing, modified, or
stale bundles fail. Unrelated customer functions are ignored. A local-only pass does not inspect
Netlify environment variables, routing, or the deployed site.

## After deployment

```sh
npx --yes github:Steve-And-Fay/public-internet-crafters-client#main doctor netlify \
  --url https://customer.example.com
```

You can supply both `--target` and `--url`. Add `--json` for automation. Exit code `0` means all
requested checks passed (warnings may remain); `1` means a check failed; `2` means invalid CLI usage.
Use `ic-client --version` to identify the checking release. For an older deployment, run its exact
tag or commit instead of `main`; a newer doctor correctly reports version drift until redeployment.

The deployed check verifies:

- `GET /__ic/analytics/v1/health`: enabled channels, collector configuration presence, client version
- `/`: the HTML response references the injected same-origin tracker
- `/__ic/analytics/v1/client.js`: a nonempty JavaScript response is served

The health endpoint shares the existing browser-script Edge Function, so there are still only four
installed functions. Its response is not cached and contains no token, collector URL, or visitor
data. Incomplete configuration or fully disabled collection returns HTTP 503. A browser-only opt-out
skips browser checks, while a crawler-only opt-out produces a warning. Netlify routes the endpoint
for browser-classified requests; the doctor supplies a browser-style user agent.

Use the canonical HTTPS origin without a path, query string, or credentials. Redirects fail
explicitly rather than silently checking a different host. Authentication-protected preview sites
must be verified through their authorized workflow; the doctor does not bypass access controls.

## What a pass does not prove

`deliveryVerified` is always `false`. Configuration presence does not prove the installation token
is valid, the hostname is registered, the collector is reachable, or events are stored. The check
also does not execute clicks, test content security policy, inspect every page, or prove crawler
identity. Confirm one normal visit and click in the portal after deploying, check browser privacy
mode, and inspect crawler collection separately. Do not generate errors or email as a health probe.

The doctor currently supports Netlify only; AWS and WordPress still require platform-specific pilots.

## Check this document against

- `src/cli.ts`
- `src/doctor.ts`
- `src/edge/health.ts`
- `src/edge/entrypoints/browser-script.ts`
- `tests/doctor.test.ts`
- `tests/netlify-health.test.ts`
