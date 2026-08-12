# E09 — Financial case acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. DoD: doc 11 §4 E09 ("at least
three cost and three benefit drivers; benefit types separated; calculations reconcile; provenance
visible; invalid/stale state blocks approval; compute→save→reopen→mutate→stale→recompute→
convert/readback passes or named downstream blocker is honest").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — engine (`src/services/ideaFinance/`) + UX (`src/components/MyWork/table/financial/`) |
| Mounted in a real consumer | Yes, as of Wave 5 — via `engineAdapter.ts`, behind `ff_ideaFinancialCase` (default OFF) |
| Executed at runtime | NOT VERIFIED |
| Persisted and read back | NOT VERIFIED (no dedicated E09 migration exists; case data flows through the same business-case JSON blob as E08) |

## 2. History this report must be honest about: built twice, disconnected, then connected

This epic has the most explicitly documented "code exists, wiring doesn't" history in the whole
program, in the program's own words:

- `RESUME_HANDOFF.md` §5, verbatim: *"Engine (`src/services/ideaFinance/`, 32 hand-computed tests
  green) and UX (`src/components/MyWork/table/financial/`) were built by two independent agents and
  have never been connected — the UI consumes a seam interface, the engine exposes its own API,
  nobody wrote the adapter."* Held back from Wave 4's commit entirely because
  `scripts/check-gestosc.sh` correctly refused three modules with zero importers (dead code) — the
  guard was not bypassed or silenced.
- Wave 5 (`111868e07a`) closed that gap: *"E09 FINALLY INTEGRATED ... The calculation engine and
  the UX layer ... now have a real adapter."* Verified directly this session: `engineAdapter.ts`
  exists at `src/components/MyWork/table/financial/engineAdapter.ts`, and `IdeaTableTool.tsx`
  imports both `isIdeaFinancialCaseEnabled` (line 78) and `FinancialCaseDialog` (line 144), which is
  rendered at line 4655 — a real mount, not a dangling import.
- Wave 5's commit body also records the honest seams chosen instead of fabricated data: *"four
  summary fields the engine genuinely cannot always produce were made nullable instead of
  fabricating zeros; non-cash benefits route through `capacity_release` at `realizedFraction 0` (the
  only engine type that is numeric yet structurally excluded from cash totals)."* This is the kind
  of provenance-preserving choice the DoD's "provenance visible" / "invalid/stale state blocks
  approval" language asks for — recorded here as implemented, not as tested at runtime.
- Confirmed default-OFF flag: `src/utils/ideaFinancialCaseFlag.ts` header states the visual-gate
  reason explicitly (CLAUDE.md rule #7 — Piotr is never the first visual tester) and documents a
  4-tier resolution order defaulting to OFF.

## 3. Explicitly NOT VERIFIED

- The "32 hand-computed tests green" figure is the engine's own unit-test count in isolation
  (pre-adapter); it was not re-run or re-quoted independently by this task, and it predates the
  Wave 5 adapter integration — it says nothing about the adapter or the mounted dialog.
- No runtime click-through of `FinancialCaseDialog` behind the flag has been observed in this
  program's history.
- No persistence mechanism specific to E09 exists — financial case data, if saved, would need to go
  through the same JSON-blob business-case persistence path as E08, which itself has two unapplied
  migrations and zero real-database evidence (see `03B_DATA_AND_MIGRATION_REPORT.md` and
  `09_BUSINESS_CASE_ACCEPTANCE.md`). This program's history does not establish that E09 has a
  working save path at all, flag-on or flag-off.
- The doc-11 §4 E09 compute→save→reopen→mutate→stale→recompute→convert/readback chain has not run.

## 4. Verdict (as of the session below)

**MOUNTED, NOT RUNTIME/PERSISTENCE VERIFIED** — unchanged from
`00_PROGRAM_STATUS_AND_VERSION.md`'s Program E row, and consistent with `RESUME_HANDOFF.md`'s
explicit instruction: "E09 must NOT be reported as delivered." This report's contribution is
confirming, by direct file read this session, that the adapter and mount points named in the Wave 5
commit body genuinely exist in the tree — not that they work end to end.

## 5. 2026-08-11 — RISK-12 settled: verdict (c), no save path at all

Stream G4-E09-FINANCE. Worktree HEAD `d2d18aa05f`, base `origin/demo`. This section settles
RISK-12 ("E09 financial case has no dedicated persistence path... whether E09 has any working save
path at all — flag-on or flag-off — is unknown") with direct evidence. It also **corrects** §3's
speculation above: the "would need to flow through the same JSON-blob business-case persistence as
E08" theory is not just unverified, it is not wired at all, and not even structurally possible
without a schema change (see §5.3).

### 5.1 The flag

`src/utils/ideaFinancialCaseFlag.ts` — `isIdeaFinancialCaseEnabled()`, keys `ff.idea_financial_case`
(localStorage) / `ff_ideaFinancialCase` (URL) / `VITE_IDEA_FINANCIAL_CASE` (env), default **OFF**.
Real, not a phantom: it gates a real mount (`IdeaTableTool.tsx:4654`,
`{financialCaseEnabled && <FinancialCaseDialog .../>}`), and the dialog/view/hook/adapter/engine
chain behind it is real, working code (computation only — see §5.2).

### 5.2 Full traced path, hop by hop

1. `IdeaTableTool.tsx:4654-4661` — `{financialCaseEnabled && <FinancialCaseDialog open={showFinancialCase} onClose={...} readOnly={locked} onStatusChange={handleFinancialStatusChange} />}`. **No `initialCase` prop. No `onCaseChange` prop.** This is the only real mount site in the tree (grep for `FinancialCaseDialog`/`FinancialCaseView` confirms no other consumer).
2. `FinancialCaseDialog.tsx:57` — `if (!open) return null;` then renders `<FinancialCaseView readOnly={readOnly} onStatusChange={onStatusChange} />` (line 88). **`onCaseChange` is not forwarded** — the prop exists on `FinancialCaseView` (line 47) but the only real caller never passes it, and never passes `initialCase` either. The dialog's own header comment (lines 19-28) states this explicitly: *"there is no existing idea-level persistence surface this dialog can write into... The case therefore lives in this dialog's own component state... and resets on close/reopen."*
3. `FinancialCaseView.tsx:62` — `useFinancialCase({ initialCase, computeFn: resolvedComputeFn, onCaseChange })`, both `initialCase` and `onCaseChange` `undefined` at the real call site.
4. `useFinancialCase.ts:66-73` (`markDirty`) — on every driver add/edit/remove, calls `onCaseChange?.(...)`, which is `undefined` at the mount site, so this is a no-op. `recompute()` (lines 116-142) calls `computeFn` (→ `engineAdapter.ts` → `src/services/ideaFinance/engine.ts`), a **pure, synchronous/local computation** — no I/O.
5. `engineAdapter.ts` and `src/services/ideaFinance/{engine.ts,types.ts,index.ts}` — grepped for `fetch(`, `axios`, `apiClient`, `api.`, `/api/`: **zero matches**. Confirmed at both the component-tree level (`src/components/MyWork/table/financial/*`) and the engine level (`src/services/ideaFinance/*`).
6. Backend: grepped `server/src/routes` for `financial.case`/`financialCase`/`idea_financial`: **zero matches** (the one incidental hit, `transformationCaseService.ts`, is the unrelated V8 "transformation case" domain — confirmed by reading its header, not idea financial cases). No `idea-financial-case` route is registered anywhere `server/src/index.ts` mounts routers.
7. Database: grepped `server/migrations` for `financial_case`/`idea_financial`: **zero matches**. Confirmed live against the actual isolated Postgres (`127.0.0.1:54331/ideas_e12`, 1011 tables): `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%financ%case%' OR table_name ILIKE '%idea_financ%')` → **0 rows**. Also checked for a stray column: `column_name ILIKE '%financial_case%'` anywhere in `public` → **0 rows**.

**The path terminates at step 4** (`onCaseChange?.(...)` called with `undefined`) — before any network call is even attempted. Nothing past that point (steps 5-7) is reachable from the real mount, though all three were independently confirmed absent anyway.

### 5.3 Why the E08 JSON-blob theory in §3 doesn't hold up

`src/types/ideaBusinessCase.ts` (`IdeaBusinessCaseSections`) has exactly 14 fixed section keys
(`problemBaseline`, `strategicObjective`, ..., `decisionRequested`) — no `financial` or
driver-shaped key. `benefitsDisbenefits`/`costsResources` are free-text/prose lists
(`BusinessCaseBenefit[]`/`BusinessCaseCostItem[]`), structurally incompatible with
`FinancialCaseInput`'s `drivers: FinancialDriver[]` (monthly time series + scenario multipliers +
confidence + evidence refs). `IdeaTableTool.tsx` has **zero** references to
`BusinessCase`/`businessCase`/`ideaBusinessCase` (grepped) — the E08 business-case UI
(`IdeaBusinessCaseSection.tsx`) is mounted from a different component entirely
(`IdeaWorkspaceTools.tsx`), with no code connecting it to `FinancialCaseDialog`. Piggybacking E09 on
E08's persistence today is not "unverified" — it does not exist as a code path at all.

### 5.4 Verdict

**(c) — there is no save path at all, and the UI silently discards the user's work.** Adding
drivers, editing periods, recomputing, closing and reopening the dialog: none of it ever leaves the
browser tab. Confirmed by direct code trace (§5.2) and by runtime proof (§5.5).

### 5.5 Runtime proof

New test:
`tests/components/MyWork/table/financial/FinancialCaseDialog.noPersistence.test.tsx` — renders the
*actual* `FinancialCaseDialog` with the *actual* props IdeaTableTool passes it (no `initialCase`, no
`onCaseChange`), spies `global.fetch` for the whole test, adds a benefit driver with a distinctive
label, asserts it renders (sanity — defeats a vacuous negative), asserts **zero** `fetch` calls,
closes the dialog, reopens it, asserts the driver is **gone** (back to "No drivers yet." in both
cost and benefit groups) and asserts **still zero** `fetch` calls across the whole
add→close→reopen lifecycle.

Command and real exit code:
```
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true \
  npx vitest run tests/components/MyWork/table/financial/FinancialCaseDialog.noPersistence.test.tsx
→ exit 0, 1 passed
```

Negative control (sabotage/restore, since there is no existing write to disable — the equivalent
rigor check for "prove a *no*-persistence claim isn't vacuous" is to inject a fake write and confirm
RED): temporarily added `fetch('/api/idea-financial-case/SABOTAGE_PROBE', {method:'POST'}).catch(()=>{})`
inside `useFinancialCase.ts`'s `markDirty`. Result: **exit 1**, uncaught exception at
`useFinancialCase.ts:72` (`fetch` in this jsdom test environment does not resolve to a real network
client, so the injected call throws) — i.e. the sabotage was caught immediately and loudly, not
silently ignored. Reverted `useFinancialCase.ts` to its original content immediately after
(`git diff --stat -- src/ server/` shows no residual change); re-ran the unsabotaged test → **exit
0** again.

Live-DB corroboration (`127.0.0.1:54331/ideas_e12`, per §5.2 step 7): 0 tables and 0 columns
matching any financial-case naming pattern anywhere in `public` schema — direct `psql`
`information_schema` queries, not migration-file grep alone.

### 5.6 Probe cleanup

No database rows were created by this session's work — the whole point of verdict (c) is that
nothing reaches the database. The sabotage step's fake `fetch()` target
(`/api/idea-financial-case/SABOTAGE_PROBE`) was never a real route and the call itself errored
before any network I/O occurred (see above). Nothing to clean up; confirmed by the live-DB query in
§5.5 returning 0 rows for any financial-case-shaped table both before and after this session's test
runs.

### 5.7 What closing the gap would require (not built — out of this stream's scope)

1. A new migration (additive, matching the `idea_business_cases` pattern): `idea_financial_cases`
   table — `id`, `idea_id` (FK → `my_ideas`), `organization_id`, `case_json` (drivers + caseMeta +
   last result snapshot), `version`, audit columns. Needs its own table, not a 15th
   `IdeaBusinessCaseSections` key (§5.3) — the shapes don't fit the existing section envelope.
2. A service + routes pair mirroring `ideaBusinessCaseService.ts` /
   `ideaBusinessCase.routes.ts`: `GET/PUT /api/idea-financial-case/:ideaId`, org-scoped, with the
   same OCC/`version` pattern the map/business-case routes already use.
3. A frontend API client (`src/services/api/ideaFinancialCase.api.ts`, mirroring
   `ideaBusinessCase.api.ts`) plus wiring `initialCase` (fetched on mount) and `onCaseChange`
   (debounced PUT) into the real `<FinancialCaseDialog>` call site at `IdeaTableTool.tsx:4654` —
   currently neither prop is passed.
4. A decision on save granularity: whole-case PUT (simplest, matches E08) vs. per-driver
   patch (matches the row-level granularity `IdeaScoringModel` uses elsewhere in the same file).
5. A Gate-3-style real-DB test (save → refresh → cold reopen → direct-SQL readback + negative
   control), added to `tests/integration/`, before this can be reported as delivered — this
   stream's `FinancialCaseDialog.noPersistence.test.tsx` proves the *absence*; it does not become a
   persistence test once wiring is added, a new one is needed.

This is scoped, not estimated in hours — the owner (Piotr) decides whether/when to build it per
CLAUDE.md's "silniki NAJPIERW" ordering and the current program priorities.

## 6. 2026-08-12 — RISK-12 CLOSED: the save path is built. §5.4 verdict (c) is SUPERSEDED

Stream S6-E09, worktree `codex/ideas-s6-e09`, base `edb38d6a29`. The owner
decided all P1–P3 in this program get fixed, so §5.7's scoped gap was built
rather than left for a decision. **§5.4's verdict (c) ("there is no save path
at all, and the UI silently discards the user's work") is no longer true of
this tree.** §5.1–§5.3 remain accurate as history and as the reason the design
is shaped the way it is; §5.5's `noPersistence` test is superseded (see §6.7).

### 6.1 What was built

| Layer | File | Note |
|---|---|---|
| Migration | `server/migrations/20260812_idea_financial_case.sql` | `idea_financial_cases`, additive + idempotent, **applied** to the isolated DB |
| Service | `server/src/services/ideaFinancialCaseService.ts` | get/upsert, org-scoped, real compare-and-swap OCC |
| Routes | `server/src/routes/ideaFinancialCase.routes.ts` | `GET|PUT /api/idea-financial-case/:ideaId` |
| Mount | `server/src/Gateway.ts` | import + `app.use`, beside the business-case router |
| API client | `src/services/api/ideaFinancialCase.api.ts` | does NOT fail open on load (see §6.5) |
| Persistence hook | `src/components/MyWork/table/financial/useIdeaFinancialCasePersistence.ts` | load/save/conflict state machine |
| Dialog wiring | `FinancialCaseDialog.tsx` | passes `initialCase` + `onCaseChange`, owns the save UX |
| Mount site | `IdeaTableTool.tsx` L4736-4748 | **one prop added** (`ideaId`); everything else lives in the dialog |

`FinancialCaseView` gained one optional prop (`onResultChange`) so the last
COMPUTED snapshot can be persisted next to the inputs; it forwards `null`
whenever status is not `fresh`, so a stored result never describes drivers it
no longer matches.

### 6.2 Migration proof — real psql exit codes, not the runner's own report

`migrate.postgres.ts --safe` reports a failed migration as `skipped` and exits
0, so it was not used. Direct `psql -v ON_ERROR_STOP=1 -f`, three runs against
`127.0.0.1:54331/ideas_e12`:

```
RUN 1 exit=0   CREATE TABLE / CREATE INDEX / CREATE INDEX
RUN 2 exit=0   NOTICE: ... already exists, skipping  (x3)
RUN 3 exit=0   NOTICE: ... already exists, skipping  (x3)
diff run1 vs run2 → IDENTICAL      diff run2 vs run3 → IDENTICAL   (\d idea_financial_cases)
```

Objects proven from the catalog, not from the file:

```
information_schema.columns → id, idea_id, organization_id (all text NOT NULL),
  case_json text NOT NULL DEFAULT '{}'::text, version integer NOT NULL DEFAULT 1,
  created_by, updated_by (text NULL), created_at, updated_at (timestamp, CURRENT_TIMESTAMP)
pg_indexes → idea_financial_cases_pkey (UNIQUE, id)
             ux_idea_financial_cases_idea_id (UNIQUE, idea_id)
             idx_idea_financial_cases_org_id (organization_id)
pg_constraint → FOREIGN KEY (idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
                PRIMARY KEY (id)
```

`UNIQUE(idea_id)` was confirmed against the model before being enforced:
`IdeaTableTool.tsx` mounts exactly one `<FinancialCaseDialog>` per Idea Table
instance (not per row), and its own B4 comment states "One Financial Case per
Idea Table tool instance ... there is exactly one financial case to be
stale/fresh about". E08 enforces the same rule the same way.

### 6.3 Runtime chain — 6/6 green, real exit code

```
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL=postgres://postgres@127.0.0.1:54331/ideas_e12 \
npx vitest run tests/integration/e09-financial-case-persistence.realdb.test.ts --retry=0
→ real exit code 0, Test Files 1 passed, Tests 6 passed (6)
```

BOTH `RUN_DB_TESTS=1` and `MOCK_DB=false` are set: `NODE_ENV=test` alone
substitutes a DB mock and the suite would go green against nothing.

### 6.4 Falsifiability — the suite was proven able to fail

Sabotage target: `lastComputedAt` **inside the `case_json` envelope**, chosen
deliberately because a column `DEFAULT` has already produced one vacuous green
in this program and **no column default can reach a JSON sub-field** — the
failure mode is unavailable by construction, not by hope. Removing that one
line from the service's serializer:

```
→ real exit code 1, Tests 1 failed | 5 passed
AssertionError: expected null to be '2026-02-03T10:11:12.000Z'
  at e09-financial-case-persistence.realdb.test.ts:393  (cold-reopen readback)
```

Restored immediately; `grep -c SABOTAGE` on the service → 0; re-run → exit 0,
6/6.

### 6.5 Design decisions worth defending

- **Explicit Save button, not debounced autosave.** Recorded in
  `useIdeaFinancialCasePersistence.ts`'s header: autosave would (a) bump
  `version` continuously and 409 every other editor out, (b) persist
  half-typed drivers as real stored model rows, (c) hide transport failures
  behind a toast nobody reads. The cost — closing could discard unsent work —
  is paid off by a close-confirmation, not left as a footnote.
- **The read does NOT fail open.** `ideaBusinessCase.api.ts` collapses "no row"
  and "server down" into `null`. Here they are distinct: a load failure renders
  an error with a retry, never an empty case the user would start typing into.
- **Whole-case PUT, not per-driver PATCH** (§5.7 point 4): drivers, case meta
  and the result snapshot are one consistent unit; a per-driver patch would let
  the stored result describe a driver set that no longer exists.
- **403 vs 404.** An idea the caller cannot see → **404** (non-disclosure,
  matching E08). A case row owned by a different org for an idea the caller CAN
  see → **403** `IDEA_FINANCIAL_CASE_FOREIGN_ORG`, because 404 there would be a
  lie the caller can disprove with `GET /my-ideas/:id`. This is a deliberate
  divergence from `ideaBusinessCase.routes.ts`, which returns 404 for both.

### 6.6 A defect found by LOOKING at a screenshot, not by a test

The first implementation derived `dirty` from `status` alone. After a FAILED
save the status is `error`, so Save became disabled and the error bar's only
button called `reload()` — refetching the server copy **over the user's unsent
edits**. That is RISK-12's silent discard re-created through the error path,
and every test passed. It was visible in `e09-financial-case-error.png` (a
greyed-out Save next to a red failure). Fixed: `dirty` now also covers
`error` with pending edits, and the button retries the SAVE
("Spróbuj zapisać ponownie") rather than refetching. Two regression tests pin
it. Recorded because it is the clearest evidence in this package that the
screenshot step is a real gate, not decoration.

### 6.7 The `noPersistence` test was replaced, not deleted

`tests/components/MyWork/table/financial/FinancialCaseDialog.noPersistence.test.tsx`
asserted zero `fetch` calls and that a typed driver was GONE after reopening.
It was correct under verdict (c) and is now factually wrong — keeping it would
mean the suite actively defends the defect. It is replaced by
`FinancialCaseDialog.persistence.test.tsx`, where every claim it made has an
inverted counterpart (zero fetches → a real save call; driver gone → driver
survives; and its "sanity: marker present first" vacuity guard is kept as-is).

### 6.8 Still NOT VERIFIED

- **No browser click-through by the owner.** Evidence is the dev-render harness
  (real component, real hook, real API module, stubbed transport) plus the
  real-DB suite. The flag `ff_ideaFinancialCase` stays default OFF (CLAUDE.md #7).
- **Never executed against demo/prod/dev** — isolated ephemeral Postgres only.
- **`scripts/check-actions.sh` does not pass** — see §6.9.
- Concurrency is proven by a sequential stale-version test, **not** by two
  genuinely simultaneous writers. The SQL-level compare-and-swap
  (`WHERE ... AND version = ?`) is what would hold under a real race; that
  specific race was not executed.
- Pre-existing i18n gaps visible in the captures, NOT introduced here and NOT
  fixed here: `FinancialCaseSummaryPanel` renders "No drivers yet" and
  "Stale — recompute needed", and `FinancialConversionActions` renders
  "Convert to Financial Model" / "Convert to Budget", all in English inside the
  Polish UI.

### 6.9 Known guard failure (honest, not silenced)

`bash scripts/check-actions.sh; echo rc=$?` → **rc=1**. R10 flags three
command-verb handlers in `FinancialCaseDialog.tsx` (L194 `persistence.save()`,
L240 `saveAndClose()`, L279 the retry) as not traceable to
`IDEA_ACTION_REGISTRY`. The heuristic is CORRECT — these are genuine commands.

It was not silenced with `--update` (the baseline's own header forbids that for
new violations) and not fixed, because the fix requires adding an `ActionDef` to
`src/actions/registry/sharedActions.ts` — a file stream S5 is actively
rewriting, which the orchestrator explicitly placed off-limits, and whose
`runPanelUiOnlyCallback` helper (the one E08's `idea.workspace.business_case_save`
uses) is itself being changed by that work. Landing an entry now would collide
and be immediately reworked.

Prepared fix for whoever lands it after S5: mirror
`idea.workspace.business_case_save` exactly — add
`'idea.workspace.financial_case_save'` to the id list in
`src/actions/ideaActionRegistry.ts`, an `ActionDef` in `registry/sharedActions.ts`
(`scope: 'workspace'`, `surfaces: ['panel']`, `mutates: true`), and route the
dialog's save through `runIdeaAction(...)` the way
`IdeaBusinessCaseSection.tsx:539` does.

## 7. 2026-08-12 — integrator verification: my own 6/6 run, and a second, two-stage sabotage of the OCC layer

Stream S11-DOCS (worktree `codex/ideas-s11-docs`, HEAD `6fec03f7a0`). §6's RESOLVED
verdict for RISK-12 is confirmed, not just adopted from the stream's own report —
this section records the integrator's *own* execution of the suite plus a second,
independent falsifiability check §6.4 did not run.

### 7.1 My own run, real exit code

```
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL=postgres://postgres@127.0.0.1:54331/ideas_e12 \
npx vitest run tests/integration/e09-financial-case-persistence.realdb.test.ts --retry=0
→ exit 0, Test Files 1 passed (1), Tests 6 passed (6)
```

Confirms §6.3's figure independently, at the wave's final SHA rather than at the
stream's own working SHA.

### 7.2 A second sabotage: is the OCC actually two layers, or one layer described twice?

`ideaFinancialCaseService.ts` contains what read, on inspection, like two
independent guards against a stale-write race:

1. A **fast-path JS check** (`input.expectedVersion === undefined ||
   input.expectedVersion !== existing.version` → throws `IdeaFinancialCaseStaleVersionError`
   before any `UPDATE` is issued).
2. A **SQL compare-and-swap** on the `UPDATE` itself
   (`WHERE id = ? AND organization_id = ? AND version = ?`), with the affected-row
   count checked afterward.

§6.4's sabotage removed the `lastComputedAt` field from the serializer — a
different concern (proving the cold-reopen readback isn't vacuous), not this one.
So this had not actually been tested: disable only the fast-path check and see
whether the SQL CAS alone still produces the 409.

**Stage 1 — disable only the fast-path check.** Result: suite stayed **GREEN**,
6/6. This is the *expected*, non-vacuous outcome, not a red flag — the SQL
compare-and-swap caught the race on its own, exactly as its comment claims
(`// Compare-and-swap: the \`AND version = ?\` predicate is the real guard.`). A
green result here does not mean the check is untested; it means the *second*
layer is carrying the guarantee, which is exactly what defense-in-depth predicts.

**Stage 2 — disable the fast-path check AND neutralise the SQL CAS** (temporarily
widened the `WHERE` clause to drop `AND version = ?`). Result: **RED** —
`AssertionError: expected 200 to be 409` at the stale-version sub-test, and the
losing writer's payload was visibly persisted at `version: 3` (it should have been
rejected, leaving the winning writer's `version: 2` row intact). Restored both
guards immediately; `git diff --stat -- server/src` clean after restore; re-ran →
exit 0, 6/6 again.

**Conclusion:** the OCC is genuinely defense-in-depth, not one guard duplicated in
two places. Stage 1's green was **redundancy**, not a vacuous assertion — it is
the opposite failure mode from this program's own RISK-23 (a Postgres column
`DEFAULT` that made an *omitted write* look correct). Here, removing one full
layer of protection still left a correct behaviour; only removing both layers
exposed the defect. That distinction is why RISK-12's evidence explicitly
separates "which layer catches it" from "does something catch it."

### 7.3 Cleanup

No database rows were left behind: the stale-version sub-test's probe rows are
deleted by the suite's own teardown, confirmed by a residue count query
returning 0 both before and after this section's extra sabotage runs.

## 8. 2026-08-12 (later the same day) — §6.9's guard failure is CLOSED

Commit `a537a022e2`, landed on the integration branch after §7 was written.
§6.9's `check-actions.sh` rc=1 is no longer true of this tree.

**What changed, and how, matching §6.9's own prepared-fix shape but taking
the registry route rather than `--update`:**
`table.financial_case.save`, `table.financial_case.save_and_close`, and
`table.financial_case.retry` were added to
`src/actions/registry/tableActions.ts` — mirroring `table.record_template.*`
rather than `IdeaBusinessCaseSection.tsx`'s `sharedActions.ts` route §6.9
proposed, because `sharedActions.ts` was still off-limits (stream S5). The
three ids were placed respecting rule R11's `ORIGINAL_ORDER` requirement, not
merely appended to the end. `FinancialCaseDialog.tsx`'s three handlers
(`persistence.save()`, `saveAndClose()`, the retry) now route through
`runIdeaAction(...)`.

**A latent bug surfaced and was fixed in the same commit:**
`useIdeaFinancialCasePersistence.ts`'s `save()`/`load()` previously reported
success in the sense of "the call did not throw." They now return a truthful
`Promise<boolean>`, so the registry's `ActionResult.confirmed` reflects an
actual landed save — never `true` on a 409 (stale version) or a transport
error. This closes the same class of "reported ok without confirming" defect
§7's OCC section and RISK-30 elsewhere in this package both document —
another instance of the program's recurring lesson that a layer reporting
success for work it never confirmed is the default failure mode to check for,
not an edge case.

**Verification:**
```
bash scripts/check-actions.sh; echo rc=$?
→ rc=0
   akcji: 234 · stringów runtime: 124 · zdarzeń: 7 · metod API: 4
```
(was rc=1, 231/124/7/4, before this commit).
`tests/components/MyWork/table/financial/FinancialCaseDialog.persistence.test.tsx`:
10/10 pass. `check-action-coverage.sh` and `check-gestosc.sh` also rc=0 on
this commit's files.
