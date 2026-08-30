# Internet Crafters Client Analytics

Collect per-page visits from Google, Bing, OpenAI, other crawlers, and human visitors on Netlify,
AWS, and WordPress. Events include timestamps, campaign attribution, sanitized clicks, and grouped
structural errors while intentionally removing query strings, raw paid IDs, exception messages, form
values, and visible page text.

## Install and configure

For Netlify, install the extension on a customer team. For AWS or WordPress, install the pinned Git
dependency and copy the platform adapter with `npx ic-client install`. Every platform uses these
server/runtime values:

```dotenv
IC_ANALYTICS_ENABLED=true
IC_ANALYTICS_INGEST_URL=https://collector.example.com/v1/events
IC_ANALYTICS_INGEST_TOKEN=replace-with-a-site-specific-secret
IC_ANALYTICS_RELEASE=customer-site-release-id
```

Deploy the site. The extension injects its analytics functions during the build. Future extension
updates are picked up when the site is rebuilt and deployed again.

Set `IC_ANALYTICS_CRAWLERS=false` or `IC_ANALYTICS_BROWSER=false` to disable either channel without
disabling the other. Custom collectors can set `IC_ANALYTICS_INGEST_AUTH_HEADER` and
`IC_ANALYTICS_INGEST_AUTH_SCHEME`.

## Data and cost notes

Crawler events may contain a source IP and raw user-agent string. Browser events do not contain form
values, element text, coordinates, URL query strings, or persistent visitor identifiers. Browser
collection honors Do Not Track and Global Privacy Control.

The customer platform account incurs Netlify Edge Function or AWS logging/stream/function usage.
Review the site's privacy notice, consent needs, retention policy, and collector terms before
enabling browser analytics.

## Check this document against

- `README.md`
- `src/injection.ts`
- `src/edge/runtime.ts`
- `src/browser/tracker.ts`
- `platforms/`
