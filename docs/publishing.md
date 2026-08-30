# Publishing and customer rollout

## Distribution model

Use the public GitHub repository as the source of truth; do not publish this repository to the npm
registry. `private: true` prevents an accidental registry release but still permits direct Git
installation. The expected flows are:

```text
GitHub production branch -> Netlify build-time installer -> customer site Edge Functions
GitHub tag or commit -> Git dependency prepare build -> AWS, WordPress, and custom Node projects
```

Pin a tag or full commit rather than the default branch:

```sh
npm install --save-dev "github:Steve-And-Fay/public-internet-crafters-client#v0.2.0"
```

npm installs the dependencies needed by a Git package with a `prepare` script, runs that portable
build, and records the resolved commit in the customer lockfile. To roll out an update, change the
tag or update the dependency, commit the lockfile, and deploy. A Git URL does not silently update an
existing lockfile.

## Netlify release

1. Run `npm run verify` before each push.
2. Merge the reviewed client update into GitHub `main`.
3. Deploy a pilot customer whose build command runs `ic-client install netlify` from GitHub `main`.
4. Verify collection, then allow the remaining customer sites to receive it on their next deploy.

## Customer rollout

1. Add the GitHub installer to the customer's Netlify build command.
2. Add the site-scoped variables documented in `README.md`.
3. Deploy the customer site; the installer refreshes its four generated function files during build.
4. Verify an HTML page, an intentional click, and a crawler request in the collector.
5. Confirm query strings and visible page text are absent from stored events.

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
- `scripts/build-portable.mjs`
- `platforms/`
