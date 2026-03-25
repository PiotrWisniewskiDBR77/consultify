# V8 B-Runtime Staging Proof Wave 1

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `8326f019-9d78-4a72-9d2e-9f3cede699ae`

Authenticated browser session:
- `https://stage.consultinity.ai`
- superadmin session already active in browser

## Prompt OS

Direct API proof:
- `GET /api/v8/prompt-os/runtime/summary` -> `200`

Operator surface proof:
- `Superadmin -> AI Platform -> Operations -> Prompt OS runtime` is visible on live staging after deployment
- runtime panel loaded `PromptOsRuntimeSummaryPanel` bundle from staging assets
- panel rendered the read-only runtime summary with:
  - `contract = prompt-os-runtime-v8`
  - `presets = 0`
  - `bundles = 0`
  - `active bundles = 0`
  - `purposeFamiliesSupported = conversational, governed_proposal, retrieval_grounded, artifact_generation, background_automation`

## Results

Direct API proof:
- `GET /api/v8/results/dashboard` -> `200`

Scope note:
- this wave proves the routed staging read path
- dedicated Results UI continuity proof is still not captured

## Finance

Direct API proof:
- `GET /api/v8/finance/dashboard` -> `200`

Scope note:
- this wave proves the routed staging read path
- dedicated Finance UI continuity proof is still not captured

## Sync

Direct API proof:
- `GET /api/v8/sync/auth/health` -> `200`

Scope note:
- this wave proves persisted sync/auth truth on live staging
- provider round-trip, OAuth continuity, and operator UI proof are still not captured
