# Results Next — RESUME HANDOFF

Written 2026-08-10 by the orchestrator session that carried the program from
RN-G0 through the three domains, the outbox dispatcher, and the start of RN-G2.
Written because that session's context was exhausted, not because work stopped.

**Read this file first. Then read `EXECUTION_LEDGER.md` §0–§53 — it is the
authoritative history and every claim below traces to a numbered section there.**

---

## 1. Exact state

| | |
|---|---|
| Worktree | `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809` |
| Branch | `codex/results-vnext-g0-20260809` |
| HEAD | `7ec58e800d` (eight-package parallel wave merged; ledger §55) |
| Ahead of `origin/demo` | **316 commits** |
| Pushed | **nothing, ever** |
| Deployed | **nothing, ever** |
| Reference tag | `rn-g3-gold-flow-reference` → `d463c32b8c` (the dispatcher slice, all 8 proofs green) |
| Ledger high-water | **§55** — grep `^## ` live before writing a new one; sessions have collided on this three times |

### Dirty state at handoff — READ CAREFULLY, two different owners

**Owned by a DIFFERENT, parallel session. Do NOT touch, commit, revert, or stage:**
- `server/src/database/PostgresDatabase.ts` (M)
- `tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts` (M)
- `tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts` (M)
- `tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` (M)
- `server/migrations/20260810_fix_initiatives_status_default.sql` (??)

These have been left untouched for the entire session by explicit instruction and
must stay that way. See §4 for why they matter.

The second block that used to be listed here — the RN-G2 P1 (KPI) files — has
since landed in `81f2af407f`. The working tree now holds only the five
foreign-session files above.

---

## 2. What is DONE and evidenced

All claims below are backed by real-Postgres runs recorded in the ledger, not by
mocks or documentation.

**Three domains, backend-complete:**
- **KPI** — 7 epics (E001–E007), ledger §14–§30
- **ROI** — 8 epics (E001–E008), ledger §31–§39
- **OKR** — 8 epics (E001–E008), ledger §40–§48

**Platform / integration:**
- **Outbox dispatcher + `mywork_projection`** (ledger §49, tag `rn-g3-gold-flow-reference`) — all 8 acceptance proofs green. Closed the gap where 143 event types fanned out to zero consumers.
- **IO-D resolved** (§50) — `search_path` is `public, v8`, `public`'s CHECK is the widened one, consumer succeeds on a fresh schema. Proven functionally (insert passes under `public,v8`, fails under reversed). **Not proof about demo** — see §4.
- **Two dead consumer groups retired** (§51) — `decisions_projection` and `notifications_projection`, plus a contract test making "events routed into the void" structurally impossible to reintroduce.
- **`finance_projection` consumer** (§52) — 15/15 tests. `UNBUILT_CONSUMER_GROUPS` is now **empty**: every routed group has a real consumer.
- **Cross-domain gold flow** (§53) — 10 steps end to end, zero hand-inserted event rows, zero rows left `failed`/`dead_letter`/`parked`, cross-org isolation proven through the public path. `tsc` clean repo-wide on that run; 35/35 across all three acceptance suites.

**RN-G2 (UI) started:**
- **P0 shared shell landed** (`203c73b64e`, `32eb92a3c7`) — `src/components/ResultsVNext/`: registry shell composed from `StandardModuleBar`/`StandardTable`/`StandardPreview`, `HonestValue.tsx`, `LifecycleLockBadge.tsx`, `ResultsVNextForbiddenState.tsx`, `resultsVNextFeatureFlags.ts` (per-domain flags, default **OFF**), routes `/results/kpi|roi|okr`. 16 QA screenshots in `docs/qa/screens/rn-g2-shell-2026-08-10/`.
- P0 also **fixed the dev-render harness** — `dev-render/screens/tools-sesja-wyjscie.tsx` was missing, which 500'd *every* registered screen. Restored from `bd102b668c`.

---

## 3. What was IN FLIGHT at handoff

Two agents were running. **Check their worktrees before starting anything — do not duplicate.**

| Package | Where | State |
|---|---|---|
| **RN-G2 P1 — KPI registry** | main worktree | **COMPLETE and committed** (`81f2af407f`) — see §3a. |
| **RN-G2 P2 — ROI registry** | isolated worktree (agent `a6d6ce91abb988955`) | **COMPLETE and merged** — code `9d27454ac8`, visual QA `de48a5fdb6`. See ledger §54. |

**Correction to a stale claim in this file's own history**: commit `bdbf6d518f`
recorded P2 as "stopped mid-package". That was written by a parallel process
while the QA round was still running and was already wrong when saved. P2 was
not abandoned — it was finished, typechecked, canon-checked and accepted on 17
screenshots. Do not act on that commit message.

### 3b. Wave launched 2026-08-10 — four parallel lanes, all based on `de48a5fdb6`

Each lane owns an isolated worktree under `/Users/piotrwisniewski/rn-g2-lanes/`
with `node_modules` symlinked to this worktree's copy (a worktree without it
makes vite die silently). One worktree, one agent — the mandate that four
sessions have already broken. Verify a lane's base with `git log --oneline -1`
before touching it.

| Lane | Worktree / branch | Package | Owns these files |
|---|---|---|---|
| **okr** | `rn-g2-lanes/okr`, `rn-g2-lane-okr` | §G #23 OKR Sets registry + preview | `src/components/ResultsVNext/okr/**`, `ResultsOkrRegistryPage.tsx` |
| **kpi-scorecards** | `rn-g2-lanes/kpi-scorecards`, `rn-g2-lane-kpi-scorecards` | §G #8 KPI Scorecards registry + detail | KPI scorecard files, `routeConfig.ts`/`AppRoutes.tsx` |
| **roi-create** | `rn-g2-lanes/roi-create`, `rn-g2-lane-roi-create` | quick-create (master plan §9 Etap 3) + lifecycle transitions (§G #16 part) | `src/components/ResultsVNext/roi/**` |
| **platform** | `rn-g2-lanes/platform`, `rn-g2-lane-platform` | P-UI-1 + P-UI-2 defects, shared legacy-archive panel | `src/components/standard/**`, `ResultsVNextRegistryShell.tsx`, `ResultsVNext/legacy/**` |

Only the **platform** lane may touch shared components; the other three are
forbidden from them and must escalate instead. Every lane conflicts on exactly
three shared files — `src/components/ResultsVNext/index.ts`, `dev-render/main.tsx`,
and (for kpi-scorecards) the route files. Those conflicts are additive and
mechanical; resolve by keeping both sides, as was done when P2 met P1.

### 3a. RN-G2 P1 (KPI registry) — landed, with three real backend gaps found

Built: `kpiApi.ts`, a real `ResultsKpiRegistryPage.tsx` (Standard components only,
`persistKey: results-vnext.kpi-registry`, `HonestValueCell`, `LifecycleLockBadge`,
deep-link forbidden state), and a dev-render screen. 11 QA screenshots in
`docs/qa/screens/rn-g2-kpi-2026-08-10/`. All QA axes pass. `tsc` clean, both canon
scripts pass (list-canon debt actually dropped by 1).

**Three backend gaps it discovered by reading real route/repository code — the next
packages will hit these too:**
1. **No GET endpoint returns the joined `rvn_kpi_definition_versions` row.** `GET /kpi`
   and `GET /kpi/:id` return only the bare `rvn_kpi_definitions` row. Name, unit, target
   geometry and the version's `approvalStatus` are returned *only* as a side effect of
   the create/approve/reject mutations. The registry therefore shows `kpiCode` as row
   identity, not a human-readable name. **This is a real API gap, not a UI shortcut.**
2. **`listMyKpis` / `listOrganizationKpiAttention` are not row lists** — the first is an
   obligations/attention feed, the second an aggregate-stats view. Neither is usable as a
   "My KPIs registry" data source despite what the names suggest.
3. **404 collapses "not found" and "ABAC denied"** — `getKpi` returns null uniformly for
   both via the visibility-scoped JOIN, so the forbidden state cannot show the true DENY
   reason from `RN_G1_PLATFORM_DESIGN.md` §B. P1 defaults to `NO_VISIBILITY_RECORD` per
   that doc's fail-closed convention and documents it as an assumption, not an API fact.

**A bug class worth knowing before writing P2/P3**: `StandardTable`'s `TableRow` type
requires an `id` field, but the domain DTOs use `kpiId`/`caseId`/`setId`. Passing rows
through without mapping silently breaks both React row keys *and* row-click selection —
no error, the click just does nothing. Map `{ ...row, id: row.<domainId> }` before handing
data to the table.

**Environment note**: `EmptyState`'s Framer Motion fade intermittently sticks mid-transition
when driven live through the MCP browser tool on this loaded machine — reproduced on the
already-committed P0 screen too, so it is pre-existing and environment-specific. The
headless `dev-render/shot.mjs` path (3.5s settle) does not hit it; use that for QA shots.

---

## 4. Known pre-existing defects — NOT caused by this program, but they matter

1. **`initiatives_organization_id_fkey` fixture gap** — **18 of 36** ROI `*.realdb.test.ts` files never insert their `ORG_ID` into `organizations` before inserting into `initiatives`. Causes a stable **33 failures** in every `tests/resultsVnext` run. Verified identical before/after every package this session. The fix exists on another branch (`72cc5e233d`) but not here. Also unaudited: 4 KPI files and the entire OKR domain (42 files).
2. **`initiatives.status DEFAULT 'step3'` violates its own CHECK** — fixed **twice, independently**. Full analysis committed at `docs/product/results-vnext/INITIATIVES_STATUS_FIX_RECONCILIATION.md`. Both fixes converge on `DEFAULT 'DRAFT'` and are compatible in either order. **Fix B (`f99016b632`, other branch) is more complete** — it also patches `000_initdb_core_tables.sql`, which `run-initdb.js` executes directly, bypassing the migration runner entirely. The uncommitted fix here patches only 1 of 4 schema-producing paths.
3. **`decimal.js` type errors in `roiCalculationEngine.ts`** — ~18–28 under the `server/` tsconfig depending on run. Untouched all session; the final gold-flow run reported zero, so verify rather than assume.
4. **IO-D is resolved for a fresh schema, NOT for demo.** Before promoting, a human must run against demo:
   ```sql
   SELECT n.nspname AS schema, pg_get_constraintdef(c.oid) AS check_definition
     FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'v8_canonical_object_states' AND c.contype = 'c'
    ORDER BY n.nspname;
   SHOW search_path;
   SELECT (SELECT nspname FROM pg_namespace n JOIN pg_class c ON c.relnamespace = n.oid
            WHERE c.oid = 'v8_canonical_object_states'::regclass) AS resolved_schema;
   ```
   If `resolved_schema` returns `v8`, IO-D becomes a live blocker and needs an additive migration widening the other copy.
5. **`EXECUTION_LEDGER.md` section order ≠ chronology** — §42 sits between §41 and §43; §26 appears before §25. Numbers are unique; order is not. Do not "fix" by reordering.

---

## 5. What REMAINS

**RN-G2 (the bulk).** Scope committed at `docs/product/results-vnext/RN_G2_UI_SCOPE.md` — **20–26 bounded packages**, of which P0 is done and P1/P2 are in flight. Remaining after those: the full KPI/ROI/OKR domain tools (ROI Case alone spans ~15 sub-resource groups), Teresa surfaces, and cross-cutting QA.

**Non-negotiable UI rules** (`CLAUDE.md` "UI — PRAWO NADRZĘDNE", `docs/ui-standards/TRIADA_KANON.md`):
- List screens EXCLUSIVELY from `StandardModuleBar`/`StandardTable`/`StandardPreview`. Run `scripts/check-list-canon.sh` before every commit — this rule was broken once before and it broke the frozen canon.
- `primary` = crimson `#85182F`, **critical semantics only**. CTAs and active states neutral; focus blue `c-focus`. Run `scripts/check-artefakt.sh`.
- Everything behind a flag, default **OFF**.
- **persistKey trap**: legacy KPI/ROI/OKR own `T36`/`T37`/`T38` with keys `results.kpi-scorecards`/`results.roi-reviews`/`results.okr-sets`. RN-G2 uses `results-vnext.*` — using the legacy keys corrupts real users' saved column state.
- **The honest-missing invariant must survive into the UI**: the backend deliberately returns `null` / `not_calculable` rather than a fabricated `0`, enforced across ~23 epics. Use P0's `HonestValueCell` everywhere. Never an em-dash that reads as zero.
- **Visual QA is part of each package, not a later step.** Render via `dev-render/` + `shot.mjs` (working now), screenshot every state, fix until dark+light, PL+EN, 1440+1280, 125% zoom, keyboard focus, ARIA all pass. Save under `docs/qa/screens/rn-g2-<pkg>-<date>/`.

**Then**: full regression on the final integrated SHA, the acceptance matrix, and the evidence packet.

---

## 6. Standing working rules that earned their keep

- **One worktree, one agent.** Violated once this session (two agents on `consumerRegistry.ts`/`atomicWrite.ts`) and it cost two in-flight corrections. Parallel packages go to isolated worktrees unless they touch genuinely disjoint files.
- **Verify the worktree base.** Four agents this session started from a wrong/stale base, one ~4400 commits behind. Always `git log --oneline -8` first and confirm recent expected commits.
- **Every new repository function and command needs a direct real-Postgres test**, not only a mocked route test. This caught a real bug in essentially every epic where it was applied.
- **Ephemeral Postgres recipe**: TCP `127.0.0.1`, free port, `initdb --locale=C`, Postgres 17. Set **both** `RUN_DB_TESTS=1` and `NODE_ENV=test` — with `NODE_ENV=test` alone, `DbPromise` writes silently hit a mock while `acquirePgClient` writes hit real Postgres. That produced one false red this session.
- **`::text` cast on every join** to `rvn_platform_resource_visibility.resource_id` (TEXT) from a UUID column. Missed 7 times in one KPI epic; the single most-repeated real bug in this program.
- **Never invent a formula, threshold, or gradient no source defines.** Rejected four times this session (OKR linear falloff, attention-state thresholds, scoring buckets, ROI/Finance divergence tolerance). Return `not_calculable` or open a reconciliation instead.
- **Commit after every logical piece.** Network drops and session limits killed long runs repeatedly; incremental commits turned hours of loss into minutes.

---

## 7. First command to resume

```bash
cd "/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809" && \
  git log --oneline -8 && git status --short && git worktree list
```

Then, in order:
1. Review the uncommitted RN-G2 P1 (KPI) files listed in §1 — decide whether to finish or restart that package.
2. Check the P2 (ROI) isolated worktree; merge if complete.
3. Continue RN-G2 package by package per `RN_G2_UI_SCOPE.md`.
4. Only after RN-G2: final regression, acceptance matrix, evidence packet.

---

## 8. Honest status

**`IMPLEMENTED_EVIDENCED_CANDIDATE` has NOT been reached.** What is true:

- Domain backends (KPI/ROI/OKR) and the async integration layer are built and evidenced on real Postgres.
- RN-G3, RN-G5 and RN-G6 have real end-to-end evidence for what has been built; each still carries named open items recorded in the ledger, not silently closed.
- **RN-G2 is 11 of 20–26 packages complete.** Done: P0 shell, KPI registry, ROI registry, OKR Sets registry, KPI Scorecards (+ its own route), ROI quick-create + 7 lifecycle transitions, ROI modelling (baseline/policy/assumptions/cost+benefit lines), OKR Objectives/KRs/check-ins, KPI measurements (record/correct/verify/dispute), the shared read-only legacy-archive panel (built, exported, deliberately unwired), and the shared-shell defect fixes.
- Evidence on the merged head: `tsc --noEmit` 0 errors, `vite build` green, `check-list-canon.sh` debt 408 against baseline 409 (it went DOWN), `check-artefakt.sh` 7/7 unchanged, **214 QA screenshots** across 11 `docs/qa/screens/rn-g2-*` directories, all 15 `persistKey`s in the `results-vnext.*` namespace, all three domain flags default OFF.
- **Two packages were accepted and only later found to carry a real defect** — both are recorded that way in ledger §55, not smoothed over: the OKR registry shipped with a progress-scale bug the harness mock cancelled out, and the KPI registry shipped a rules-of-hooks crash on a tab no screenshot had ever clicked. Both are fixed now. The lesson is written into the ledger: a screenshot proves a screen renders, not that it can be clicked.
- Eight UI questions stay open as OQ-UI-A…H in `RN_G2_OPEN_QUESTIONS_UI.md`, none of them silently resolved.
- **RN-G7 cannot start before RN-G2 finishes.**
- Nothing has been pushed, merged to demo, or deployed. No terminal PASS has been self-declared — that is Codex's and the Founder's call, per this program's own contract.
