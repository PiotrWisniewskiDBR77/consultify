# CHAT-IMG P2 v2 — W187 receipt

**Verdict: READY FOR CTO REVIEW.** The `database_default` branch now evaluates namespaced OpenRouter model IDs with the same provider-native capability ID used by the routing guard, and AIPipeline recovers the user's text from multimodal content before intent classification.

## Scope and provenance

- Base: `bd7ff4943118fdcf3442cffb4532a89cce00860b`
- Branch: `codex/chat-img-p2-v2-w187-20260917`
- Decision: DEC-581, W187
- Product files: `server/src/services/ai/modelRouter.ts`, `server/src/services/ai/AIPipeline.ts`
- Tests: `chatImages.modelRouterDatabaseDefault.test.ts`, `chatImages.aipipelineIntent.test.ts`
- No migrations, flags, UI changes, screenshots, staging access, deployment, or protected-ref pushes.

## Behaviour proved

1. `ModelRouter.select({ requirements: { vision: true } })` selects the organization `database_default` OpenRouter row `openai/gpt-4o-mini` after capability normalization.
2. The selection is proved both with `OPENROUTER_API_KEY` present and with the provider key available only from the database row.
3. The streaming AIPipeline receives a real multimodal user message (`text` + `image`) and classifies the text `Create an initiative...`; the tool list contains only `generate_initiative`, so `[object Object]` cannot silently bypass deterministic intent routing.
4. Existing image transport/provider contracts remain green.

## Verification

- Fresh install: `npm ci --ignore-scripts` — PASS; 2,075 packages installed.
- Exact lock: `npm ls @types/node --depth=0` — root/workspaces deduplicated to `22.19.3`.
- Focused tests: 4 files, **7/7 PASS**, `--retry=0`:
  - `chatImages.modelRouterDatabaseDefault.test.ts`
  - `chatImages.aipipelineIntent.test.ts`
  - `chatImages.multimodal.test.ts`
  - `chatImages.aiSdkV6.contract.test.ts`
- Server TSC from the fresh lock: **0 diagnostics**, RC=0.
- Full front TSC: candidate **152 diagnostics**, reference line reported by CTO **169**. The candidate changes only `server/**`, which root `tsconfig.json` excludes, so the front delta attributable to this package is **0**; the locally exact-lock front count is 152. No diagnostic names a changed file.
- `check:jezyk:ci` — PASS (K8sen -2).
- `check:flagi:dockerfile` — PASS (196 flags, 208 ARGs, 0 missing).
- `check:list-canon --all` — PASS (346/346 baseline; no new violations).
- `git diff --check` — PASS.
- Prettier: the two new tests and `modelRouter.ts` are clean. Whole-file check on `AIPipeline.ts` remains red on three pre-existing formatting locations outside this diff; the added helper and changed call-site are formatted.

## Mutation evidence

- Replacing `defaultProviderCapabilityId` with the raw namespaced ID at the `database_default` guard makes **2/2 tests RED**: env case falls to `static_fallback`; DB-only case throws `No routable model satisfies requirements`.
- Replacing `textFromChatMessageContent(lastUser)` at the AIPipeline call-site with `String(lastUser || '')` makes **1/1 test RED**: both `generate_deliverable` and `generate_initiative` remain exposed instead of the required single initiative tool.
- Both mutations were restored before final verification.

## Review

Independent read-only review: **PASS — 0×P0 / 0×P1 / 0×P2**. The reviewer independently checked both mutation logs, the full AIPipeline call-site, database-default routing, ordinary-string parity, exact Node types, server TSC, and diff hygiene.
