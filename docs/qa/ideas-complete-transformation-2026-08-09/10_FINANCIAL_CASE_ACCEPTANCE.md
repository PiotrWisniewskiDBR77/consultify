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
