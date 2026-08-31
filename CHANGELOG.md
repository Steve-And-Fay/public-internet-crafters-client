# Changelog

## 0.3.1

- Add opt-in Netlify public-page filtering before private-room and admin-route installations.
- Enforce the policy in browser navigation/actions/errors, the browser collector, and crawler
  observation; invalid configuration fails closed and appears in installation health checks.
- Keep unrestricted existing installations and portable event contracts unchanged.

## 0.3.0

- Register dedicated call, email, directions, download, outbound, form-button, form-attempt, and
  confirmed-form events without duplicating generic click counts.
- Add explicit native-form and vendor confirmation hooks with in-memory deduplication.
- Preserve reduced-data anonymous counts and WordPress action-event parity.

## 0.2.4

- Use a complete browser user agent for Netlify's browser-classified health routes.
- Name the Functions environment scope explicitly in Netlify setup instructions.

## 0.2.3

- Preserve readable Netlify HTML responses when tracker injection makes no change.
- Add a read-only Netlify installation doctor and deployed configuration health endpoint.
- Align package, lockfile, WordPress cache version, and pinned installation documentation.
- Document production-scoped setup, unique installation tokens, and no-email verification.

## 0.2.2

- Count privacy-signal browser traffic with reduced-data events, without session linking,
  attribution, click details, or browser error capture.

## Check this document against

- `package.json`
- `src/edge/entrypoints/browser-bootstrap.ts`
- `src/doctor.ts`
- `src/contracts/public-paths.ts`
- `docs/public-pages.md`
- `docs/privacy.md`
