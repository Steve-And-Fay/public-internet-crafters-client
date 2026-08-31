# Changelog

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
- `docs/privacy.md`
