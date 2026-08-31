# Browser and server error capture

Browser errors are captured automatically when browser analytics is enabled. WordPress also captures
fatal PHP shutdown errors and supports explicit caught-exception reporting.

Browser stack frames retain the script path, line, column, and structural function name. Script URL
queries (including Astro's Netlify deployment query) and fragments are stripped without discarding
the frame. Chrome, Safari, and Firefox stack formats are supported, including stacks whose first
line is a frame. Exception messages and URL origins are not sent.

Netlify's HTML bootstrap uses `context.deploy.id` as the release unless `IC_ANALYTICS_RELEASE` is
explicitly configured. It falls back to `COMMIT_REF` and `DEPLOY_ID` when no deploy context is present.
Those build variables are not normally available in an Edge Function. See the
[Netlify Edge Functions API](https://docs.netlify.com/build/edge-functions/api/#deploy) and
[runtime environment documentation](https://docs.netlify.com/build/edge-functions/environment-variables/).

These diagnostics apply to new occurrences. Missing frames and release IDs cannot be recovered from
older reports. A group without frames identifies an error type, not a confirmed failing component;
do not resolve it solely because a later page load succeeds.

For Lambda and Node, wrap an existing handler with the public Git module:

```ts
import {
  createWebhookDestination,
  withServerErrorCapture,
} from "internet-crafters-client";

const destination = createWebhookDestination({
  url: process.env.IC_ANALYTICS_INGEST_URL!,
  token: process.env.IC_ANALYTICS_INGEST_TOKEN!,
});

export const handler = withServerErrorCapture(originalHandler, {
  destination,
  context: ([request]) => ({
    eventId: request.requestContext.requestId,
    hostname: "customer.example",
    mechanism: "lambda.handler",
    pagePath: request.rawPath,
    platform: "aws",
    platformSiteId: process.env.AWS_LAMBDA_FUNCTION_NAME,
    release: process.env.IC_ANALYTICS_RELEASE ?? "unknown",
    runtime: "lambda",
    source: "aws-lambda",
  }),
});
```

The wrapper sends structural type/release/stack frames, never the exception message, and rethrows the
same original failure. If reporting fails, the collector failure is swallowed so it cannot replace
the application's error or change the platform's retry behavior.

The portal fingerprints structural failures per site, increments the occurrence count, reopens a
resolved group when it recurs, throttles team alerts, and provides acknowledge/resolve/ignore triage.
Exact occurrences follow the 90-day raw retention policy; the grouped issue remains.

## Check this document against

- `src/browser/errors.ts`
- `src/edge/runtime.ts`
- `src/edge/entrypoints/browser-bootstrap.ts`
- `tests/browser-errors.test.ts`
- `tests/runtime.test.ts`
- `tests/browser-bootstrap-response.test.ts`
- `src/errors/server.ts`
- `src/errors/capture.ts`
- `src/public.ts`
- `tests/server-errors.test.ts`
