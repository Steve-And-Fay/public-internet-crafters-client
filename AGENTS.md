# Repository instructions

This repository is a GitHub-distributed analytics client for Netlify, AWS, WordPress, and Node.

## Commands

- `npm test`: focused unit and contract tests
- `npm run typecheck`: strict TypeScript check
- `npm run check`: Biome formatting and lint check
- `npm run spell`: spelling check
- `npm run generated:check`: rebuild and validate self-contained Edge Function outputs
- `npm run build`: production portable and Netlify adapter build
- `npm run verify`: complete preflight gate

## Architecture constraints

- Write behavior tests before implementation changes.
- Keep the canonical event contract provider-neutral and versioned.
- Keep browser payloads allowlisted; never add form values, text content, URL queries, or collector
  credentials.
- Put destination integrations behind `AnalyticsDestination`.
- Maintain modular source under `src/`; do not hand-edit `.generated/`.
- Install only registered functions and preserve independent crawler/browser opt-outs.
- Update the relevant documentation and its `Check this document against` block when behavior changes.

## Check this document against

- `package.json`
- `src/installer.ts`
- `src/contracts/analytics-event.ts`
- `src/edge/destinations/types.ts`
- `scripts/build-edge-functions.mjs`
