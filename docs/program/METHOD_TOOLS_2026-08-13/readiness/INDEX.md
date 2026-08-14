---
document_id: METHOD-TOOLS-READINESS-INDEX
module: Tools (19 engine-backed of 31 canonical) — runtime readiness manifests
status: 0/19 RUNTIME_ACTIVE, 0/19 publishable (correct, expected)
owner: piotr
prepared_by: Stream H3 (per-tool runtime readiness manifests)
branch: codex/h-h3-manifest
candidate_sha: 91b562ea66
worktree_base_sha: 91b562ea66
evidence_date: 2026-08-13
db: local Postgres 15 (pgvector/pgvector:pg15), docker `cfy-h3-manifest`, port 56800, migrated fresh via `server/scripts/migrate.postgres.ts`
---

# Tools — per-tool runtime readiness manifests (Stream H3)

## 0. What this is

One `RuntimeReadinessManifest` (`src/toolPacks/runtimeReadiness.ts`) per each
of the 19 engine-backed tools, wired additively into
`src/toolPacks/registry.ts` (`pack.runtimeReadiness`), plus a 16-criterion
human-readable breakdown per tool (`docs/program/METHOD_TOOLS_2026-08-13/
readiness/<toolType>.json`). **Never a collective manifest** — each of the 19
JSON files is its own object, its own evidence, its own verdict.

**Ground rule enforced by this stream, not inherited on faith:** no evidence
from `dynamic-swot` (the one tool with a real engine→Output bridge) is
copied into any other tool's manifest — `readinessManifests.test.ts`
mechanically asserts this (`buildSwotOutput` never appears in another
tool's `output` evidence; no other tool's Output evidence is byte-identical
to dynamic-swot's).

**Verdict today, for all 19:** `evaluateRuntimeReadiness()` returns
`publishable: false`. Every one of the 19 is missing at least
`manualAcceptancePassed`, `lightMpq`, and `darkMpq` (nobody has evaluated
Light/Dark MPQ for any of these tools — zero `docs/qa/screens/` evidence
exists), on top of whichever mandatory gates are individually FAIL/NOT_RUN
per tool below. This is the correct, expected state of the program on
`91b562ea66` — not a bug in the manifest.

## 1. Method — re-verified this stream, not copied from ROSTER_MATRIX.md

`docs/program/METHOD_TOOLS_2026-08-13/ROSTER_MATRIX.md` (Stream G4, SHA
`773c72d371`) was the starting point. `773c72d371` is a confirmed ancestor
of `91b562ea66` (`git merge-base --is-ancestor`), and the only change in the
files this matters for between those two SHAs is the *addition* of
`engineBindingCoverage.test.ts` (`git diff --stat 773c72d371 91b562ea66 --
src/toolPacks/ src/components/DiscoveryTools/ToolCanvas.tsx
server/src/services/tools/toolOutputSnapshotService.ts
src/config/consultingToolsStandard.ts` → one file, 179 insertions, nothing
else). So the roster's structural claims were **re-verified independently
by this stream** — grep'd and re-run, not trusted:

- `grep -c "toolType ===" src/components/DiscoveryTools/ToolCanvas.tsx` → 16
  (re-counted at `91b562ea66`).
- `grep -n CONSULTING_TOOL_STANDARD_OUTPUTS
  src/config/consultingToolsStandard.ts` → `['initiative']` (re-confirmed).
- `grep -l runtimeReadiness: src/toolPacks/packs/*.pack.ts` → 0 (before this
  stream's wiring).
- `find docs/qa/screens -iname '*<toolType>*'` for all 19 → 0 hits, all 19
  (re-counted).

**Commands re-run this stream** (own disposable container `cfy-h3-manifest`,
port 56800, exit codes recorded — logs saved under `readiness/evidence/`):

```
CI=true npx vitest run src/toolPacks/__tests__/
  → 4 files / 187 tests PASS   (log: evidence/h3-contract-tests.txt)

CI=true RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=...:56800/... \
  npx vitest run --config vitest.acceptance.config.ts \
  tests/acceptance/h32-19tools.e2e.test.ts
  → 19/19 PASS                  (log: evidence/h3-h32.txt)

... npx vitest run \
  tests/integration/tools-archetype-promote-characterization.realdb.test.ts \
  --no-file-parallelism
  → 8/8 PASS                    (log: evidence/h3-archetype-promote.txt)

... npx vitest run tests/integration/tools-outputs-immutable.realdb.test.ts \
  tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts \
  --no-file-parallelism
  → 2 files / 18 tests PASS     (log: evidence/h3-swot-integ.txt)

... npx vitest run --config vitest.acceptance.config.ts \
  tests/acceptance/tls04-swot-proposal-lifecycle.e2e.test.ts
  → 33/33 PASS                  (log: evidence/h3-tls04.txt)
```

Plus a one-off, **not committed** first-party probe of the Report/
Presentation backend branches (`tests/integration/
_h3-scratch-report-presentation.realdb.test.ts`, written, run, deleted —
`git status` clean after): `sop-builder` → `outputType:'report'` → HTTP 200,
report row created; `capability-mapper` → `outputType:'presentation'` → HTTP
200, presentation row created. Log: `evidence/
h3-scratch-report-presentation.txt`. Not probed for the other 18 tools.

## 2. Ranking — closest to RUNTIME_ACTIVE, mandatory gates only (10 max)

| Tier | Tool (archetype) | Gates PASS | Gates FAIL | Gates NOT_RUN | Total manifest failures¹ |
|---|---|---|---|---|---|
| 1 | dynamic-swot (quadrant-strategic-field) | **8/10** | 1 | 1 | 4 |
| 2 | a3-problem-solving (causal-problem-solving) | 7/10 | 2 | 1 | 5 |
| 2 | capability-mapper (architecture-capability) | 7/10 | 2 | 1 | 5 |
| 2 | growth-paths (quadrant-strategic-field) | 7/10 | 2 | 1 | 5 |
| 2 | market-forces (force-radial) | 7/10 | 2 | 1 | 5 |
| 2 | portfolio-priority (decision-matrix-portfolio) | 7/10 | 2 | 1 | 5 |
| 2 | sop-builder (operating-model-standard) | 7/10 | 2 | 1 | 5 |
| 2 | value-chain (flow-value-stream) | 7/10 | 2 | 1 | 5 |
| 2 | ai-discovery (discovery-candidate-funnel) | 6/10 | 3 | 1 | 6 |
| 3 | ambition-decomposer (architecture-capability) | 4/10 | 1 | 5 | 8 |
| 3 | dms-builder (operating-model-standard) | 4/10 | 1 | 5 | 8 |
| 3 | focus-tradeoff (decision-matrix-portfolio) | 4/10 | 1 | 5 | 8 |
| 3 | inventory-autopilot (decision-matrix-portfolio) | 4/10 | 1 | 5 | 8 |
| 3 | narrative-engine (architecture-capability) | 4/10 | 1 | 5 | 8 |
| 3 | process-automation (flow-value-stream) | 4/10 | 1 | 5 | 8 |
| 3 | risk-uncertainty (decision-matrix-portfolio) | 4/10 | 1 | 5 | 8 |
| 3 | smed-planner (flow-value-stream) | 4/10 | 1 | 5 | 8 |
| 3 | pain-explorer (causal-problem-solving) | 3/10 | 2 | 5 | 9 |
| 3 | rpa-scanner (discovery-candidate-funnel) | 3/10 | 2 | 5 | 9 |

¹ Includes the two un-evaluated MPQ axes (`lightMpq`/`darkMpq`, both `null`
for all 19) on top of the gate table — this is why even dynamic-swot shows
4 total failures against only 2 non-PASS gates (`reportImplemented` FAIL +
`manualAcceptancePassed` NOT_RUN, plus lightMpq + darkMpq unevaluated).

**Tier 1 — `dynamic-swot`, 8/10.** Only tool with `outputImplemented: PASS`
on real content (not generic-empty) — `buildSwotOutput` engine bridge,
proven by `tools-outputs-immutable.realdb.test.ts` +
`tls-007-swot-candidate-handoff.realdb.test.ts` (18/18, re-run this stream)
and `tls04-swot-proposal-lifecycle.e2e.test.ts` (33/33, re-run this stream).
Still missing: `reportImplemented` (no frontend CTA, same as everyone),
`manualAcceptancePassed` (no owner review of this specific tool's runtime
screens yet — per CLAUDE.md rule #7, Piotr is never the first visual
tester), and both MPQ axes. A browser-level E2E spec exists
(`tests/e2e/tools/swot-real-pg-resume.spec.ts`, includes a hard-reload
resume test) but was **not executed this stream** (would need a live dev
server + installed Playwright browser) — recorded `NOT_VERIFIED`, not `PASS`.

**Tier 2 — the 8 archetype-representative tools this stream (and its
predecessor G4) drove end-to-end through approve+promote**
(growth-paths, market-forces, portfolio-priority, value-chain,
a3-problem-solving, capability-mapper, sop-builder, ai-discovery), 7/10 (6/10
for `ai-discovery`, which additionally fails `rendererImplemented`). Full
session + approval + initiative-handoff mechanics PASS, re-run this stream
(`tools-archetype-promote-characterization.realdb.test.ts`, 8/8). `output`
is a **proven FAIL**, not a gap in testing: the `tool_outputs` row is
created, but `payload_json.items = []` and `engineVersion =
'generic-fallback-1.0.0'` — dowiedzione (proven), not inferred. `report`/
`presentation` FAIL for the same reason as everyone (no frontend CTA).

**Tier 3 — the remaining 10** (risk-uncertainty, ambition-decomposer,
focus-tradeoff, narrative-engine, smed-planner, dms-builder,
inventory-autopilot, rpa-scanner, pain-explorer, process-automation), 4/10
(3/10 for `rpa-scanner` and `pain-explorer`, which additionally fail
`rendererImplemented`). Session mechanics PASS (h32, re-run this stream);
`approvalVerified`, `initiativeHandoffVerified`, `automatedTestsPassed`
(full DoD-path coverage) and `outputImplemented` are all `NOT_RUN` — not
individually driven to the approve/promote step by any stream so far. The
code path (`toolOutputSnapshotService.ts`'s single `dynamic-swot` branch)
strongly suggests the same generic-empty fate awaits these 10 too, but
"would be surprising" is recorded as `NOT_VERIFIED`, never promoted to
`PASS` on inference alone.

## 3. Renderer — the one gate not in the task's criterion list but load-bearing for `rendererImplemented`

`rpa-scanner`, `ai-discovery`, `pain-explorer` are `is_coming_soon=0` (the
Library presents them as fully available) and each has a full `RICH` method
engine in `src/config/`, but none of the three is among
`ToolCanvas.tsx`'s 16 dedicated `toolType === '...'` branches (re-counted
this stream) — they fall through to the generic renderer. This is recorded
as a genuine **FAIL**, not a "justified generic" — content exists and is
unserved, the opposite of justified.

## 4. Report / Presentation — universal FAIL at the product-usable level

`src/config/consultingToolsStandard.ts:35`:
`CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative']` (re-confirmed this
stream). No frontend CTA offers `report` or `presentation` as a promotion
target for **any** of the 19 tools — so both are FAIL for all 19 at the
level a client could actually use, regardless of what the backend can do.
The backend branches (`ToolController.promoteToOutput`,
`outputType==='report'|'presentation'`) do work — first-party proven this
stream for exactly one tool each (`sop-builder` → report, `capability-mapper`
→ presentation, both HTTP 200) — but "backend mechanism exists, unreachable
from the product" is still recorded FAIL, not PASS, because the DoD gate is
about what a consultant can actually do, not what an engineer can `curl`.

## 5. Light/Dark MPQ — universal NOT_VERIFIED

Zero `docs/qa/screens/` evidence exists for any of these 19 tool
workspaces (re-confirmed this stream — 0 hits for all 19). No pack sets
`lightMpq`/`darkMpq`. This is a flat, honest gap across the board — not "low
score", genuinely un-evaluated. Per CLAUDE.md's TRIADA/SPEC-A rules, MPQ
evidence requires a real render + a clean screenshot + owner acceptance,
none of which has happened for these 19 tool runtime screens yet.

## 6. Browser E2E — genuinely driven UI coverage exists for exactly one tool, and even that wasn't run this stream

- `dynamic-swot`: `tests/e2e/tools/swot-real-pg-resume.spec.ts` (real
  `page.goto`/clicks/`page.reload`) and `tests/e2e/tools-to-initiatives.spec.ts`
  exist and target it — confirmed by reading the files — but were **not
  executed this stream** (would require a live frontend dev server + an
  installed Playwright browser). `NOT_VERIFIED`.
- `market-forces`, `risk-uncertainty`: referenced by
  `tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts`, but only through
  Playwright's `request` fixture (raw API calls) — zero `page.goto`/UI
  interaction. An API smoke test in a Playwright file is not browser
  evidence. `FAIL`.
- The other 16 tools: zero references anywhere in `tests/e2e/` (re-grepped
  this stream). `FAIL` — a verified absence, not "untested, might exist".

## 7. What is unchanged by this stream

- The existing content split — 19 `PACK_COMPLETE` / 12 `EVIDENCE_MISSING` in
  `src/toolPacks/registry.ts` — is untouched (`readinessManifests.test.ts`
  asserts this directly).
- No tool's `runtimeStatus` was raised. All 19 remain `RUNTIME_PENDING`.
  `pack.runtimeReadiness` is a **new, additive** field on the 19 authored
  packs — previously always `undefined`.

## 8. Files

- `src/toolPacks/readiness/manifests.ts` — source of truth (TypeScript,
  type-checked structurally through the shared `RuntimeReadinessManifest`
  type). Each of the 19 is its own object literal with its own evidence
  strings.
- `docs/program/METHOD_TOOLS_2026-08-13/readiness/<toolType>.json` — one
  machine-readable file per tool, generated from `manifests.ts` by
  `scripts/generateToolReadinessManifests.ts` (re-run it after any edit to
  `manifests.ts` — `readinessManifests.test.ts` fails loudly if the JSON on
  disk drifts from the TS source, proven this stream by deliberately
  editing `dms-builder.json`'s `approvalVerified` to a false `PASS`: 1
  test failed with an exact diff pinpointing the falsified gate, then
  reverted by re-running the generator — `git status` clean after).
- `src/toolPacks/__tests__/readinessManifests.test.ts` — the contract test
  (180 assertions: 19 tools × ~9 checks + suite-level invariants + 3
  explicit non-vacuousness controls).
- `docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/*.txt` — raw
  command output this stream produced, referenced by
  `evidenceLedgerRefs` in every manifest.
