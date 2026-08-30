# Netlify installation

Install the published Internet Crafters Extension on the customer team, then configure these
site-scoped build and runtime variables:

```dotenv
IC_ANALYTICS_ENABLED=true
IC_ANALYTICS_INGEST_URL=https://my.internetcrafters.com/ingest/v1/events
IC_ANALYTICS_INGEST_TOKEN=replace-with-the-site-installation-token
IC_ANALYTICS_RELEASE=customer-site-release-id
```

Optional controls:

| Variable | Default | Purpose |
| --- | --- | --- |
| `IC_ANALYTICS_CRAWLERS` | `true` | Disable crawler and AI-agent observation with `false`. |
| `IC_ANALYTICS_BROWSER` | `true` | Disable browser page views, clicks, attribution, and errors. |
| `IC_ANALYTICS_INGEST_AUTH_HEADER` | `authorization` | Collector credential header. |
| `IC_ANALYTICS_INGEST_AUTH_SCHEME` | `Bearer` | Prefix before the token; empty means a raw API key. |

Trigger a fresh deploy after changing configuration. Test the script endpoint, one page view, one
named click, and a crawler request. The collector token must not appear in the served browser script
or HTML.

## Check this document against

- `src/index.ts`
- `src/injection.ts`
- `src/edge/entrypoints/`
- `extension.yaml`
