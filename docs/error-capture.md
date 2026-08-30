# Server error capture

Browser errors are captured automatically when browser analytics is enabled. WordPress also captures
fatal PHP shutdown errors and supports explicit caught-exception reporting.

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

- `src/errors/server.ts`
- `src/errors/capture.ts`
- `src/public.ts`
- `tests/server-errors.test.ts`
