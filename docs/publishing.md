# Publishing and customer rollout

## Distribution model

Use the public GitHub repository as the source of truth; do not publish this repository to the npm
registry. `private: true` prevents an accidental registry release but still permits direct Git
installation. The expected flows are:

```text
GitHub production branch -> Netlify build-time installer -> customer site Edge Functions
GitHub tag or commit -> Git dependency prepare build -> AWS, WordPress, and custom Node projects
```

For portable dependencies, pin a tag or full commit. Netlify's build-time installer can track `main`:

```sh
npm install --save-dev "github:Steve-And-Fay/public-internet-crafters-client#v0.2.4"
```

npm installs the dependencies needed by a Git package with a `prepare` script, runs that portable
build, and records the resolved commit in the customer lockfile. To roll out an update, change the
tag or update the dependency, commit the lockfile, and deploy. A Git URL does not silently update an
existing lockfile.

## Netlify release

1. Update `package.json`, both root versions in `package-lock.json`, the WordPress header/cache
   version, and pinned installation examples together. The consistency tests enforce this.
2. Run `npm run verify` before each push and smoke-test installation from the packaged artifact.
3. Merge the reviewed client update into GitHub `main`, then create the matching `v<version>` tag at
   that exact commit. Tags are immutable rollback points; never move an existing release tag.
4. Deploy a pilot customer whose build command runs `ic-client install netlify` from GitHub `main`.
5. Run `ic-client doctor netlify --url https://customer.example.com` from the same release, then
   verify collection in the portal. The doctor checks configuration, not event ingestion.
6. Allow remaining customer sites to receive the update on their next deploy.

## Customer rollout

1. Register the client and exact site hostname in the portal and create a unique installation token.
   Each original, rebuilt, or preview hostname needs a separate installation; do not reuse another site's token.
2. Add the GitHub installer to the customer's Netlify build command and the production-scoped
   runtime variables documented in `README.md`. Review privacy disclosures and consent controls.
3. Deploy the customer site; the installer refreshes its four generated function files during build.
4. Run the [read-only health check](installation-health.md), then verify a normal HTML page visit,
   an intentional click, and crawler collection in the portal. Check the reduced-data privacy mode.
5. Confirm query strings, credentials, and visible page text are absent from stored events. Do not
   manufacture repeated errors or send emails as an installation test.

Publishing to GitHub centralizes maintenance. Customer sites tracking `main` receive that code during
their next build and deploy; nothing silently mutates an already-deployed site. No npm registry
release is involved.

## Portable artifacts

Run `npm run verify`. Ready-to-package adapters are written to:

- `dist/wordpress/internet-crafters-analytics/`
- `dist/aws/`

The WordPress folder can be zipped for WordPress Admin, or both adapters can be copied from an
installed Git dependency with `npx ic-client install`. This repository does not automatically publish
GitHub Releases; external publication remains an explicit maintainer action.

Netlify bills injected Edge Function usage to the customer site. Check current limits and pricing
before expanding beyond a pilot.

## Check this document against

- `README.md`
- `package.json`
- `src/installer.ts`
- `src/doctor.ts`
- `tests/release-consistency.test.ts`
- `scripts/build-portable.mjs`
- `platforms/`
