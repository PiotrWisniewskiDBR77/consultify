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

## 4. Verdict

**MOUNTED, NOT RUNTIME/PERSISTENCE VERIFIED** — unchanged from
`00_PROGRAM_STATUS_AND_VERSION.md`'s Program E row, and consistent with `RESUME_HANDOFF.md`'s
explicit instruction: "E09 must NOT be reported as delivered." This report's contribution is
confirming, by direct file read this session, that the adapter and mount points named in the Wave 5
commit body genuinely exist in the tree — not that they work end to end.
