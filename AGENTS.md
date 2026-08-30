# Repository instructions

This repository is a Netlify Extension that injects reusable analytics into customer sites.

## Commands

- `npm test`: focused unit and contract tests
- `npm run typecheck`: strict TypeScript check
- `npm run check`: Biome formatting and lint check
- `npm run spell`: spelling check
- `npm run generated:check`: rebuild and validate self-contained Edge Function outputs
- `npm run build`: production extension build
- `npm run verify`: complete preflight gate

## Architecture constraints

- Write behavior tests before implementation changes.
- Keep the canonical event contract provider-neutral and versioned.
- Keep browser payloads allowlisted; never add form values, text content, URL queries, or collector
  credentials.
- Put destination integrations behind `AnalyticsDestination`.
- Maintain modular source under `src/`; do not hand-edit `.generated/`.
- Inject only registered functions and preserve independent crawler/browser opt-outs.
- Update the relevant documentation and its `Check this document against` block when behavior changes.

## Check this document against

- `package.json`
- `src/index.ts`
- `src/contracts/analytics-event.ts`
- `src/edge/destinations/types.ts`
- `scripts/build-edge-functions.mjs`
