# Netlify installation

Add this command before the site's production build. It downloads the client from GitHub and updates
only the four Internet Crafters Edge Function files while preserving unrelated functions:

```sh
npx --yes github:Steve-And-Fay/public-internet-crafters-client#main install netlify \
  --target ./netlify/edge-functions --force
```

For example, a Netlify build command can be:

```sh
npm ci && npx --yes github:Steve-And-Fay/public-internet-crafters-client#main install netlify --target ./netlify/edge-functions --force && npm run build
```

Configure these site-scoped runtime variables:

```dotenv
IC_ANALYTICS_ENABLED=true
IC_ANALYTICS_INGEST_URL=https://my.internetcrafters.com/ingest/v1/events
IC_ANALYTICS_INGEST_TOKEN=replace-with-the-site-installation-token
```

Use a distinct portal installation token for each exact hostname. Limit these variables to the
production context and select the **Functions** scope (which includes Edge Functions at runtime);
preview hosts remain disabled unless explicitly
registered for collection. The installer itself does not need the collector token at build time.
Omit `IC_ANALYTICS_RELEASE` to use `COMMIT_REF` or `DEPLOY_ID`, or provide your real release identifier.

## Multiple hosts on one Netlify project

Check actual redirect behavior; Netlify's configured primary domain does not prove every domain
alias redirects to it. Starting in 0.3.2, projects serving more than one verified hostname can set
`IC_ANALYTICS_INGEST_TOKENS_BY_HOST` to a JSON object mapping each exact hostname to its own portal
installation token. Keep all installations under the verified site's existing organization.

```dotenv
IC_ANALYTICS_INGEST_TOKENS_BY_HOST={"example.com":"primary-installation-token","www.example.com":"www-installation-token","alias.example.com":"alias-installation-token"}
```

Store the entire value as a **secret**, in **production context / Functions scope** only. Include
the primary host as well as every alias that serves pages directly. Use lowercase DNS names only,
without schemes, ports, paths, wildcards, trailing dots, or implicit `www` matching. The map supports
1–20 hosts, is bounded to 32,768 characters, and each token must be 1–1,024 printable non-whitespace
ASCII characters. A malformed map or unmapped host disables forwarding and HTML injection; health
returns misconfigured. The map takes precedence over `IC_ANALYTICS_INGEST_TOKEN` and never falls back
to that token for missing hosts. With no map variable, existing single-token behavior is unchanged.

Browser events and crawler requests retain their actual hostname and use only that host's credential.
No domain redirect, tenant reassignment, or portal hostname-check exemption is introduced. Health
reports readiness for the host being checked, without exposing the map, tokens, or collector URL.
Run the doctor and confirm a normal visit separately on each configured non-redirecting host.

Optional controls:

| Variable | Default | Purpose |
| --- | --- | --- |
| `IC_ANALYTICS_CRAWLERS` | `true` | Disable crawler and AI-agent observation with `false`. |
| `IC_ANALYTICS_BROWSER` | `true` | Disable browser page views, clicks, attribution, and errors. |
| `IC_ANALYTICS_PUBLIC_PATHS` | unset | JSON public-page allowlist for sites with private paths; see [public pages](public-pages.md). |
| `IC_ANALYTICS_INGEST_AUTH_HEADER` | `authorization` | Collector credential header. |
| `IC_ANALYTICS_INGEST_AUTH_SCHEME` | `Bearer` | Prefix before the token; empty means a raw API key. |

Trigger a fresh deploy after changing configuration. Test the script endpoint, one page view, one
named click, and a crawler request. The collector token must not appear in the served browser script
or HTML. Tracking `main` intentionally takes the latest reviewed client commit on every deploy; use
a release tag instead when a customer needs a frozen version.

After installation, run `ic-client doctor netlify --target ./netlify/edge-functions`. After deployment,
add `--url https://customer.example.com` using the canonical hostname. See the
[health-check guide](installation-health.md) for GitHub commands, exit codes, and limitations.

The bootstrap always returns a readable HTML response, including pages already containing the
tracker or fragments without a closing head tag. Pages without a closing head remain unchanged;
they cannot receive automatic tracker injection.

## Check this document against

- `src/index.ts`
- `src/injection.ts`
- `src/edge/entrypoints/`
- `src/installer.ts`
- `src/doctor.ts`
- `src/edge/health.ts`
- `src/contracts/public-paths.ts`
- `tests/browser-bootstrap-response.test.ts`
- `src/edge/runtime.ts`
- `tests/netlify-host-credentials.test.ts`
