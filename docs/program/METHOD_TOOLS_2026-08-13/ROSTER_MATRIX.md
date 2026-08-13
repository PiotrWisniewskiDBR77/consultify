---
document_id: METHOD-TOOLS-ROSTER-MATRIX
module: Tools (19 engine-backed of 31 canonical)
status: EVIDENCE_GATHERED — 0/19 RUNTIME_ACTIVE (correct, unchanged)
owner: piotr
prepared_by: Stream G4 (rollout matrix)
branch: codex/g-g4-roster
worktree_base_sha: 773c72d371
candidate_sha: 773c72d37177eff7426e36e269d50c5400fc5dd7
evidence_date: 2026-08-13
db: local Postgres 15 (pgvector/pgvector:pg15), docker `cfy-g4-roster`, port 56703, migrated fresh via `server/scripts/migrate.postgres.ts`
---

# Tools — rollout matrix, 19 engine-backed narrow slice (Stream G4)

## 0. Scope and method

19 of the 31 canonical tools (`TOOLS_CANONICAL_ROSTER.md`) have a real method
engine in `src/config/<tool>/` and a spelled-out `PACK_COMPLETE` pack in
`src/toolPacks/registry.ts`. This document is the honest per-criterion
rollout matrix for exactly those 19, plus the 12 `EVIDENCE_MISSING` /
`COMING_SOON` tools listed explicitly (§5) so nobody has to cross-reference
another file to see the full 31.

**Ground truth used, verified not trusted:**
- `contentStatus: 'PACK_COMPLETE'` for all 19, `runtimeStatus: 'RUNTIME_PENDING'`
  for all 19 (`grep runtimeStatus src/toolPacks/packs/*.pack.ts` — zero
  `RUNTIME_ACTIVE`, zero exceptions).
- Zero packs declare `runtimeReadiness` at all (`grep -l runtimeReadiness:
  src/toolPacks/packs/*.pack.ts` → 0 files). `evaluateRuntimeReadiness()`
  therefore returns `publishable:false` for all 19 by construction — §4.13.
- `ToolCanvas.tsx` branches: exactly 16 explicit `toolType === '...'`
  branches (`grep -c "toolType ===" src/components/DiscoveryTools/ToolCanvas.tsx`
  → 16). `rpa-scanner`, `ai-discovery`, `pain-explorer` — all three
  `is_coming_soon=0` / content `RICH` per the roster doc — are **not** among
  them; they fall to the generic renderer. Confirmed CURRENT at this SHA, not
  repeated from the roster doc.
- `CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative']`
  (`src/config/consultingToolsStandard.ts:35`) — confirmed current. The
  frontend CTA only ever offers `initiative`; `report`/`presentation`/`idea`
  are backend-only paths today (§4.7–4.8 discuss what "backend-only" means in
  practice).

**Commands run this stream** (exit codes recorded, not narrated):

```bash
# Bootstrap (retried 5x — host-wide Docker memory pressure OOM-killed
# postgres mid-migration on the ~800-table baseline_gap file three times in a
# row; the migration runner resumes from schema_migrations on retry, so this
# is a resource-contention artifact of ~40 concurrent stream containers on
# this host, not a migration bug)
NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgres://consultinity:test@localhost:56703/consultinity \
  npx tsx server/scripts/migrate.postgres.ts        # exit 0 on 5th attempt, 1354 tables

# Contract tests (mocked DB is fine here — pure TS, no I/O)
CI=true npx vitest run src/toolPacks/__tests__/     # exit 0 — 4 files, 187/187 passed

# Session-mechanics characterization, all 19 (pre-existing test, unblocked this stream)
CI=true RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgres://consultinity:test@localhost:56703/consultinity \
  DB_TYPE=postgres NODE_ENV=test \
  npx vitest run --config vitest.acceptance.config.ts tests/acceptance/h32-19tools.e2e.test.ts
                                                      # exit 0 — 19/19 passed (after 2 fixes, see §6)

# NEW — one E2E per archetype, create->save->review->approve->promote
CI=true RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgres://consultinity:test@localhost:56703/consultinity \
  DB_TYPE=postgres NODE_ENV=test \
  npx vitest run tests/integration/tools-archetype-promote-characterization.realdb.test.ts --no-file-parallelism
                                                      # exit 0 — 8/8 passed
```

**Trap hit and named, not silently worked around:** running the acceptance
suite with only `NODE_ENV=test` (no `RUN_DB_TESTS=1 MOCK_DB=false`) makes
`getDatabase()` (`server/src/database/Database.ts:79-89`) silently substitute
a **mock database** — `tool_sessions` reports 0 rows on the real Postgres
even though the HTTP layer returns 200s with plausible-looking bodies. First
h32 run under plain `NODE_ENV=test` "passed" against the mock before this was
caught; the numbers in this document are all from `RUN_DB_TESTS=1
MOCK_DB=false` runs, confirmed against `docker exec ... psql` row counts
directly, not from HTTP status codes alone.

## 1. Legend

`PASS` — directly, empirically verified this stream against real Postgres or
a deterministic unit test that fails on real drift (proven — see §6.1).
`FAIL` — verified and does not hold, with the concrete reason.
`NV` — **not verified this stream**: either the code path is provably
tool-type-agnostic (so failure would be surprising) but wasn't individually
driven for this specific tool, or it genuinely wasn't looked at. Never
upgraded to PASS on inference alone.

## 2. The matrix (19 × 13)

| Tool (archetype) | Library Pack | Session engine | Q/workflow mapping | Persistence | Renderer | Output | Report | Presentation | Initiative | Evidence/validation | Light/Dark | Characterization | Runtime manifest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dynamic-swot (quadrant-strategic-field) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (content-rich, own engine) | NV¹ | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| market-forces (force-radial) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (generic-empty) | NV¹ | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| growth-paths (quadrant-strategic-field) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (generic-empty) | NV¹ | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| value-chain (flow-value-stream) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (generic-empty) | NV¹ | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| portfolio-priority (decision-matrix-portfolio) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (generic-empty) | NV¹ | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| risk-uncertainty (decision-matrix-portfolio) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| capability-mapper (architecture-capability) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (generic-empty) | PASS² | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| ambition-decomposer (architecture-capability) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| focus-tradeoff (decision-matrix-portfolio) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| narrative-engine (architecture-capability) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| a3-problem-solving (causal-problem-solving) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (generic-empty) | NV¹ | NV¹ | PASS² | PASS | FAIL | PASS | FAIL |
| sop-builder (operating-model-standard) | PASS | PASS | PASS | PASS | PASS (dedicated) | PASS (generic-empty) | PASS² | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| smed-planner (flow-value-stream) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| dms-builder (operating-model-standard) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| inventory-autopilot (decision-matrix-portfolio) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| rpa-scanner (discovery-candidate-funnel) | PASS | PASS | PASS | PASS | **FAIL** (generic, unjustified — active + rich content) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| ai-discovery (discovery-candidate-funnel) | PASS | PASS | PASS | PASS | **FAIL** (generic, unjustified — active + rich content) | PASS (generic-empty) | NV¹ | NV¹ | PASS | PASS | FAIL | PASS | FAIL |
| pain-explorer (causal-problem-solving) | PASS | PASS | PASS | PASS | **FAIL** (generic, unjustified — active + rich content) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |
| process-automation (flow-value-stream) | PASS | PASS | PASS | PASS | PASS (dedicated) | NV² | NV | NV | NV² | PASS | FAIL | PASS (session only) | FAIL |

¹ Backend mechanism directly probed and PASS for this outputType, but not
on this exact tool — see §4.7/§4.8 for which tool/outputType pairs were
actually driven, and the code-level reason this is expected to generalize.
² Not directly driven end-to-end this stream; `promoteToOutput`'s
`outputType==='initiative'`/`'report'`/`'presentation'` branches contain
zero `session.tool_type`-conditional logic beyond the one `dynamic-swot`
special case in `buildOutputForSession` (§4.6), so failure here would be a
genuine surprise — but "would be surprising" is not the same as "verified",
and is reported as `NV`, not `PASS`.

**Column totals:** Library Pack 19/19 PASS · Session engine 19/19 PASS ·
Q/workflow mapping 19/19 PASS · Persistence 19/19 PASS · Renderer 16/19
PASS, 3/19 FAIL · Output 9/19 PASS, 10/19 NV · Report 2/19 PASS, 17/19 NV ·
Presentation 1/19 PASS, 18/19 NV · Initiative 9/19 PASS, 10/19 NV ·
Evidence/validation 19/19 PASS · Light/Dark 0/19 PASS, 19/19 FAIL ·
Characterization test 19/19 PASS (session-level), 8/19 additionally PASS
(promote-level) · Runtime readiness manifest 0/19 PASS, 19/19 FAIL.

## 3. Closest to RUNTIME_ACTIVE, and exactly what each still lacks

No tool is close. Ranking by how much of the manifest's 10 mandatory gates
(`src/toolPacks/runtimeReadiness.ts` `MANDATORY_GATES`) plus MPQ plus
evidence ledger could honestly be marked PASS today:

**Tier 1 — `dynamic-swot`.** The only tool with a real `build*Output` engine
bridge (content-rich promotion, not generic-empty), a dedicated renderer, and
the deepest existing test coverage (`tests/integration/tools-outputs-immutable.realdb.test.ts`,
`tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts`,
`tests/acceptance/tls04-swot-proposal-lifecycle.e2e.test.ts`, this stream's
h32 fix). Still missing: Report/Presentation E2E proof (frontend CTA doesn't
even offer them — §4.7), Light/Dark MPQ score (zero evidence exists), and a
`runtimeReadiness` manifest entirely (the field is absent from the pack, not
merely incomplete).

**Tier 2 — the 8 archetype-representative tools this stream drove end to
end** (growth-paths, market-forces, portfolio-priority, value-chain,
a3-problem-solving, capability-mapper, sop-builder, ai-discovery): full
session + promote mechanics now PASS, but Output content is proven
generic-empty (not a gap in testing — a gap in the product: no engine bridge
exists for them), `ai-discovery` additionally fails the renderer gate, and
none has Light/Dark or a runtime manifest.

**Tier 3 — the remaining 10** (risk-uncertainty, ambition-decomposer,
focus-tradeoff, narrative-engine, smed-planner, dms-builder,
inventory-autopilot, rpa-scanner, pain-explorer, dms-builder): session
mechanics PASS (h32), promote mechanics NV (not individually driven), plus
the same renderer/Light-Dark/manifest gaps as Tier 2 (rpa-scanner and
pain-explorer additionally fail the renderer gate).

**Every one of the 19** is blocked on the same two structural items
regardless of tier: **(a)** zero Light/Dark MPQ evidence exists for any tool
in this program (this is a `docs/qa/screens/`-style visual-acceptance gap,
out of this stream's scope to produce), and **(b)** zero
`runtimeReadiness` manifests exist at all — `evaluateRuntimeReadiness()`
fails every one of them on `Brak RuntimeReadinessManifest` before it even
gets to check individual gates.

## 4. Per-criterion detail

### 4.1 Library Pack — PASS 19/19
`registry.test.ts` (pre-existing, re-run this stream): `summary.packComplete
=== 19`, `validateAll(...).summary.invalid === 0`. Each of the 19 has
`library.*` (8 required bilingual fields), `purpose`, `useCases`,
`contraindications`, `phases`, `questions` — all populated, all pass
`validateToolPack()`.

### 4.2 Session engine — PASS 19/19
`tests/acceptance/h32-19tools.e2e.test.ts`, real router
(`server/src/routes/tools.routes.ts`) behind real auth, real Postgres: for
every one of the 19 `BUILT_TOOL_IDS`, CREATE → SAVE (accepted item + W2
finishing block) → RELOAD → W2 conclusion lands in `conclusions`. 19/19
green this stream, after two fixes (§6).

### 4.3 Question/workflow mapping — PASS 19/19
**New this stream:** `src/toolPacks/__tests__/engineBindingCoverage.test.ts`
(136 tests). For each of the 19: `engine.engineDir` and
`engine.questionBankModule` exist on disk; `engine.expectedQuestionNodeCount`
equals the REAL count read from the actual bank module (imported statically,
not hand-copied — 19 different structures: flat arrays, `Record<track,
Node[]>`, and one meta-list-of-ladders for `value-chain`, all handled
correctly); `pack.phases` ids equal, in order, the real
`TOOL_STEP_DEFINITIONS[toolType]` from `src/store/useToolStore.ts` (now
exported — was module-private — for exactly this reason); every
`bankBackedPhaseIds` entry resolves to a real phase; all 19 collectively
cover all 8 `SignatureArchetype` values at least once. **Proven not
vacuous**: deliberately mutated `marketForces.pack.ts`'s declared count from
20 to 999 mid-session — the exact test failed with the exact diff, then was
reverted (`git diff` clean after).

### 4.4 Persistence — PASS 19/19 (session-level); PASS 9/19 (Output-snapshot-level, §4.6)
Session-level: proven by h32's RELOAD step (GET after PUT returns the
persisted `answers.summary.verdict` byte-for-byte) for all 19.
Output-snapshot-level (a canonical, hashed, versioned `tool_outputs` row —
migrations 946/947): PASS for the 9 directly driven this stream (§4.6).

### 4.5 Dedicated renderer — PASS 16/19, FAIL 3/19
`grep -c "toolType ===" src/components/DiscoveryTools/ToolCanvas.tsx` = 16,
naming exactly: dynamic-swot, process-automation, market-forces,
value-chain, capability-mapper, ambition-decomposer, focus-tradeoff,
narrative-engine, growth-paths, portfolio-priority, risk-uncertainty,
sop-builder, a3-problem-solving, smed-planner, dms-builder,
inventory-autopilot. **FAIL, not "justified generic"**, for rpa-scanner,
ai-discovery, pain-explorer: all three are `is_coming_soon=0` in the live
`public.tools` registry (Library presents them as fully available) and have
full `RICH` method engines (`src/config/{rpascanner,aidiscovery,painexplorer}/`)
— the generic fallback under-serves content that exists, which is the
opposite of "justified". Matches `TOOLS_CANONICAL_ROSTER.md` L4, reconfirmed
current at this SHA rather than assumed from the doc.

### 4.6 Output — PASS 9/19 directly, NV 10/19; **content is generic-empty for 18/19 regardless (code-proven, not a testing gap)**
`server/src/services/tools/toolOutputSnapshotService.ts`
`buildOutputForSession()` (line 170): the ONLY tool-type-specific branch is
`if (session.tool_type === 'dynamic-swot')`, calling the real
`buildSwotOutput` engine bridge. **Every other tool_type falls through to a
hardcoded generic draft**: `items: [], tensions: [], conclusions: []`,
`engineVersion: 'generic-fallback-1.0.0'` — "structurally valid, hashed,
versioned — honestly empty, not fabricated" per the function's own comment.
This stream's new
`tests/integration/tools-archetype-promote-characterization.realdb.test.ts`
drove the full create→save→review→approve→promote flow for one
representative tool per archetype (8 tools) and asserted exactly this:
`tool_outputs` row created, `payload_json.items` empty,
`engineVersion === 'generic-fallback-1.0.0'`. Combined with the pre-existing
`tools-outputs-immutable.realdb.test.ts` (dynamic-swot, content-rich), that
is 9/19 tools with a directly-proven `tool_outputs` row on this exact
candidate SHA. The remaining 10 were not individually driven — marked `NV`,
not inferred to `PASS`, even though the code path itself is generic.

### 4.7 Report — PASS 1/19 (backend), FAIL 19/19 (frontend CTA)
Backend: `ToolController.promoteToOutput`'s `outputType === 'report'` branch
(line 2486) calls the real `ReportBuilderService.createReport`, writes
`report_builder_reports`/`report_builder_sections`, and additionally
persists a canonical `tool_reports` lineage row
(`persistCanonicalReport`). **Empirically driven this stream** (ad-hoc probe
script, cleaned up after, not committed) for `sop-builder`: `POST
/api/tools/:id/promote {outputType:'report'}` → HTTP 200, report row
created. Not driven for the other 18. **Frontend**:
`CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative']` — no UI surface offers
`report` as a promotion target for ANY of the 19, so this is a hard FAIL at
the product-usable level for all 19 even where the backend mechanism works.

### 4.8 Presentation — PASS 1/19 (backend), FAIL 19/19 (frontend CTA)
Same shape as §4.7: backend branch exists (`promoteToOutput`, line 2582),
empirically driven this stream for `capability-mapper` → HTTP 200. Same
frontend CTA gap (`CONSULTING_TOOL_STANDARD_OUTPUTS` excludes it) blocks all
19 at the product level.

### 4.9 Initiative Proposal — PASS 9/19 directly, NV 10/19; frontend CTA PASS 19/19
This is the ONE promotion type the frontend actually exposes
(`CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative']`), so unlike
Report/Presentation there is no product-level gate on top of the backend
one. Backend mechanism directly proven for 9/19 (dynamic-swot pre-existing +
8 archetype tools this stream): `tool_initiative_links` row with
`batch_id='promote-initiative'`, and — on the default (non-funnel) path — a
real `initiatives` row. `outputType==='initiative'`'s own branch contains no
`tool_type`-conditional logic (`session.tool_type` is only read into the
`toolTrace` audit object), so the remaining 10 are expected to behave
identically — reported `NV`, not `PASS`, since that expectation wasn't
individually tested.

### 4.10 Evidence/validation — PASS 19/19
`validator.test.ts` (pre-existing): all 19 have `pack.rights` populated
(`methodologyName`, `legalReviewStatus: 'LEGAL_REVIEW_REQUIRED'`, never
`commercialUseStatus` = "Free"), `provenance` non-empty, and pass
`validateToolPack()` with zero errors.

### 4.11 Light/Dark — FAIL 19/19
`grep -l runtimeReadiness: src/toolPacks/packs/*.pack.ts` → 0 files. No pack
declares `lightMpq`/`darkMpq` at all (the field lives only on the optional
`runtimeReadiness` manifest, which no pack sets). No `docs/qa/screens/`
evidence directory exists for any of these 19 tool workspaces. This is a
flat, honest FAIL across the board — not "low score", genuinely
**un-evaluated**.

### 4.12 Characterization test — PASS 19/19 (session-level), PASS 8/19 (promote-level, new this stream)
Session-level: `h32-19tools.e2e.test.ts` covers all 19 (create/save/reload/
conclusion). Promote-level: this stream's new
`tests/integration/tools-archetype-promote-characterization.realdb.test.ts`
covers one representative per archetype (8/19) end to end through approval
and promotion, against real Postgres. The other 11 have session-level
characterization only.

### 4.13 Runtime readiness manifest for candidate SHA `773c72d371` — FAIL 19/19
No pack sets `runtimeReadiness` at all (§4.11). `evaluateRuntimeReadiness(undefined,
candidateSha)` returns `{ publishable: false, failures: ['Brak
RuntimeReadinessManifest — RUNTIME_ACTIVE wymaga dowodu, nie deklaracji.'] }`
for every one of the 19 by construction — confirmed by reading
`runtimeReadiness.ts` line 87-93, not run as a separate test (the function is
already exercised transitively by `validator.test.ts`'s "żadne narzędzie nie
jest jeszcze RUNTIME_ACTIVE" assertion, which is green).

## 5. The 12 EVIDENCE_MISSING / COMING_SOON tools (explicit, not implied)

Out of this stream's direct scope (no engine, no pack content), listed here
so the 19+12=31 accounting is visible in one place without cross-referencing
`TOOLS_CANONICAL_ROSTER.md`. All 12 are `contentStatus: 'EVIDENCE_MISSING'`,
`runtimeStatus: 'COMING_SOON'` in `src/toolPacks/registry.ts`'s
`NO_EVIDENCE` list, confirmed matching `is_coming_soon=1` in the live
`public.tools` registry per the roster doc:

`vsm-builder` · `constraint-control` · `decision-engine` · `control-tower` ·
`automation-pipeline` · `robotics-feasibility` · `logistics-automation` ·
`integration-diagnostic` · `digital-value-pool` · `legacy-analyzer` ·
`data-inventory` · `pain-to-solution`.

None of these have a method engine in `src/config/`, a spelled-out pack, a
renderer, or any session data (0 completed sessions across the whole
roster). Nothing in this document claims otherwise — flagging explicitly per
this stream's mandate ("never pretend the 12 coming-soon work").

## 6. Fixes made this stream (test-infra only — never touched `ToolController.ts` or SWOT files, per mandate)

### 6.1 `vitest.acceptance.config.ts` missing the `@` alias
`h32-19tools.e2e.test.ts` mounts the real `tools.routes.js`, which pulls
`ToolController` → `toolOutputSnapshotService` →
`../../../../src/toolOutputs/buildSwotOutput` → `@/config/swot/...`. The
acceptance config had no `resolve.alias` for `@` (unlike `vitest.config.ts`),
so this failed at import time with `Cannot find package '@/...'` before this
stream added the alias (mirrors `vitest.config.ts`'s own `@` → `src`
mapping). This was blocking every acceptance test that mounts the real tools
router, not just h32 — a pre-existing test-infrastructure gap, not
introduced this stream.

### 6.2 `h32-19tools.e2e.test.ts` missing `expectedVersion` on its PUT
A concurrent stream ("Sprint S1", per the code's own comment) added a CAS
(optimistic concurrency) gate to `ToolController.updateToolSession` —
`expectedVersion` is now REQUIRED, 428 if absent — after h32 was authored.
This stream's h32 run failed 19/19 on `428` until fixed, then 19/19 on `409
STALE_VERSION` for an unrelated reason (see §0's mock-DB trap — the FIRST
"428" run was against the real DB with no version at all; once
`expectedVersion` was added, the version comparison itself needed a real
Postgres connection to resolve correctly). Fixed by round-tripping the
`version` field the real `createToolSession` response already returns —
exactly what a genuine client does — rather than special-casing the test
harness. This is a real client-contract fix a real SPA consumer of this
endpoint would also need; not a workaround.

## 7. Known gaps found but explicitly NOT fixed (out of scope, reported per mandate)

- `organizations` table is missing `default_language` in this fresh-migrated
  DB — every `getToolSession`/session-lookup call logs a caught, non-fatal
  `column "default_language" does not exist` warning
  (`DB:Promise Query error`). Does not block any test in this report (the
  query fails soft), but is real schema drift on a `migrate.postgres.ts`
  fresh bootstrap, consistent with the "fresh-env completeness gap" pattern
  `20260719_baseline_gap.sql`'s own header describes. Not this stream's file
  to fix (shared migration infra).
- `initiatives.priority_order` — a peer stream
  (`tools-outputs-immutable.realdb.test.ts`'s own header) previously found
  this column missing on a fresh bootstrap, requiring
  `INITIATIVE_FUNNEL_ENABLED=true` to route around a direct `INSERT` that
  referenced it. **Re-checked this stream: the column exists** on this
  worktree's freshly migrated DB (`information_schema.columns` confirms),
  so this stream's tests did not need the funnel flag. Reporting the
  re-check so the next reader doesn't have to re-derive it.
