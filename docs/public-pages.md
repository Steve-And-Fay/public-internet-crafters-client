# Public-page filtering

Page paths can contain secrets even after query strings are removed. A room link such as
`/r/private-room` may grant access to private content. Do not enable whole-site analytics on
applications with private routes without restricting the collection surface first.

## Netlify configuration

Starting in 0.3.1, set `IC_ANALYTICS_PUBLIC_PATHS` in the production context and Functions scope
before the first enabled deployment. For a room application with a small public marketing surface:

```dotenv
IC_ANALYTICS_PUBLIC_PATHS=["/","/privacy","/terms","/sponsor","/faq"]
```

Entries match exact public paths, ignoring one trailing slash. A suffix `/*` permits descendants
of a public directory: `/specimens/*` matches `/specimens/example`, not `/specimens` or
`/specimens-private`. Add the directory page separately when needed. Do not put private paths,
user identifiers, or credentials in this setting. The public list is included in public HTML.

Unsetting the variable preserves existing whole-site behavior. An empty JSON array disables all
page collection. Blank text, malformed JSON, non-string entries, broad `/*`, encoded paths, dot
segments, and other invalid patterns fail closed. Maximums are 100 entries and 8,192 characters.
Restricted paths use ASCII letters, digits, underscores, dashes, dots, slashes, and tildes; encoded
or ambiguous request paths do not match. Public non-ASCII routes need a future explicit policy.

Enforcement happens before forwarding to any analytics destination:

- Private HTML responses are returned without automatic tracker injection.
- The tracker checks the current page for every event, including SPA route changes and errors.
- Private same-site link destinations are ignored even when clicked from an allowed public page.
- Form and vendor success hooks on private pages are ignored.
- The browser endpoint independently drops disallowed source/destination paths with HTTP 204.
- The crawler observer does not forward requests to excluded paths.

This includes anonymous DNT/GPC counts: private pages are excluded rather than counted anonymously.
It does not disable hosting access logs, separate analytics providers, or application logging.
Site content, routing, authentication, and private-room behavior are not modified.

Use the automatic Netlify bootstrap for these sites. A manually embedded tracker must carry the
same `ic-public-paths` metadata before it runs; do not mix an old static tracker with the automatic
installer. Direct entry on an excluded SPA page has no injected tracker, so subsequent client-side
navigation from that page is not measured until an allowed document is loaded normally.

## Verification and other platforms

Run the installation doctor, visit an allowed page normally, and verify its event in the portal.
Test private-route exclusion locally with synthetic identifiers; do not submit real private room
links as analytics probes. The automated suite covers initial loads, route transitions, private
link destinations, form hooks, errors, malformed configuration, and both collection channels.

Automatic environment-variable enforcement currently applies to the Netlify adapter. Do not assume
WordPress, CloudFront, or a custom collector applies this variable. The portable package exports
`parsePublicPaths`, `publicPathAllowed`, and `publicDestinationAllowed` for explicit integration;
those platforms require their own server-side filtering and verification before private routes
are in scope.

## Check this document against

- `src/contracts/public-paths.ts`
- `src/browser/tracker.ts`
- `src/edge/entrypoints/browser-bootstrap.ts`
- `src/edge/entrypoints/browser-events.ts`
- `src/edge/entrypoints/crawler-observer.ts`
- `src/edge/health.ts`
- `tests/public-paths.test.ts`
- `tests/browser-privacy.test.ts`
- `tests/browser-actions.test.ts`
