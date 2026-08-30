# Publishing and customer rollout

## Distribution model

Use the public GitHub repository as the source of truth; do not publish this repository to the npm
registry. `private: true` prevents an accidental registry release but still permits direct Git
installation. The expected flows are:

```text
GitHub production branch -> dedicated Netlify project -> published Netlify Extension -> customer sites
GitHub tag or commit -> Git dependency prepare build -> AWS, WordPress, and custom Node projects
```

Pin a tag or full commit rather than the default branch:

```sh
npm install --save-dev "github:Steve-And-Fay/public-internet-crafters-client#v0.1.0"
```

npm installs the dependencies needed by a Git package with a `prepare` script, runs that portable
build, and records the resolved commit in the customer lockfile. To roll out an update, change the
tag or update the dependency, commit the lockfile, and deploy. A Git URL does not silently update an
existing lockfile.

## Extension release

1. Create a GitHub repository and push this repository's `main` branch.
2. Run `npm run verify` before each push.
3. In Netlify, import the GitHub repository as a dedicated project that only hosts this extension.
4. As a Netlify Team Owner, create a private extension and select that hosting project.
5. Copy the generated, nanoid-prefixed slug from Netlify into `extension.yaml`, then commit and push
   that update.
6. Keep the extension private while testing it on projects owned by the same Netlify team.
7. To install it on customer teams, make it public and unlisted, then share its direct installation
   link. Test carefully first: Netlify does not currently allow a public extension to become private
   again.

## Customer rollout

1. Install the extension on the customer's Netlify team.
2. Add the site-scoped variables documented in `README.md`.
3. Deploy the customer site; installation alone does not inject the functions into an old deploy.
4. Verify an HTML page, an intentional click, and a crawler request in the collector.
5. Confirm query strings and visible page text are absent from stored events.

Publishing a new extension version centralizes maintenance. Customer sites receive that code during
their next build and deploy; the extension does not silently mutate an already-deployed site.

With continuous deployment enabled on the hosting project, a push to GitHub's production branch
creates a new Netlify deploy and updates the published extension. No npm registry release is involved.

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
- `extension.yaml`
- `netlify.toml`
- `package.json`
- `src/index.ts`
- `scripts/build-portable.mjs`
- `platforms/`
