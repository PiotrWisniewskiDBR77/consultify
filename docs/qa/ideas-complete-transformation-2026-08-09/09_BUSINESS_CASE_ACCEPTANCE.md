# E08 — Business case and decision governance acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon:
`docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md` §6.1.
DoD: doc 11 §4 E08 ("stage gates enforce completeness; decision summary traces material claims;
score exposes weights/override reasons; Approve/Reject/Return/Defer persist distinctly; reopened
decisions version rather than overwrite").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — stage-gate model, business-case schema/service/routes/panel, 9-dimension scoring, decision-log governance |
| Mounted in a real consumer | Partial — flag-gated (`ff_ideaBusinessCase`), UI panel exists (`IdeaBusinessCaseSection.tsx`) |
| Executed at runtime | NOT VERIFIED |
| Persisted and read back | **NOT VERIFIED — blocking migrations unapplied** (see `03B_DATA_AND_MIGRATION_REPORT.md`) |

## 2. Evidence from this program's git history

- Wave 4 (`4308bddb82`): explicit stage-gate model (`ideaMaturityModel.ts` + `IdeaMaturityGate.tsx`)
  showing per-criterion status; business-case schema with section-to-source lineage and
  unsupported-AI-claim marking (types + service + routes + panel section + api client), behind
  default-OFF flag `ff_ideaBusinessCase`. Commit body explicitly labels this "LANDED AND VERIFIED
  (esbuild clean, targeted tests green, guards clean)" — targeted-test-level verification, not
  runtime/persistence.
- Wave 5 (`111868e07a`): "Table's 'Scoring' and 'Log decyzji' saved views were nothing but column
  presets with no model behind them — exactly the prior suspicion." Real governance now wired:
  9-dimension scoring with versioned weights and append-only history; decision log with four
  distinct outcomes (matching the DoD's Approve/Reject/Return/Defer requirement), approval gate,
  and reopen-versioning (matching "reopened decisions version rather than overwrite"). Role is
  derived from real permissions per the same commit body. The "approval blocked by stale
  financials" predicate is stated to be genuinely connected to the financial view's live status.
- Gate 1 (`7174c062ab`) Group C: a real type-safety bug was found and fixed in `RowList<T>`
  (`NoInfer<T>` fix) affecting business-case section editing — the commit body states this was
  checked for actual runtime data loss and found NONE (server stores sections as an opaque JSON
  blob; the bug was compile-time only), and reports it as such rather than overclaiming a
  data-loss fix. Three DOM round-trip tests (edit → save → re-read) were added — **in-memory/DOM
  round-trip, not server persistence** round-trip.
- R10 debt closure (Wave 5): the two handlers flagged by the program's own unregistered-action
  guard in `IdeaBusinessCaseSection.tsx` (jump-to-source, remove-list-item) were investigated and
  found to be local draft-state manipulation, structurally identical to the file's other add/remove
  buttons — not governed commands. The guard's heuristic was fixed (not bypassed, not baseline-
  bumped) to stop flagging destructured callback props.

## 3. Explicitly NOT VERIFIED / blocked

- Both E08 migrations (`20260810_idea_maturity_gates.sql`, `20260810_idea_business_case.sql`) are
  **UNAPPLIED** — confirmed directly by this task (see `03B_DATA_AND_MIGRATION_REPORT.md` §2). No
  server-side maturity attestation or business-case section has ever been written to or read back
  from a real database in this program's history.
- No contract test exists for either E08 migration in this program (unlike E12's confidentiality
  migration, which has one) — this is `EVIDENCE_MISSING`, a level below "mock-verified".
- The doc-11 §4 E08 DoD scenario (stage gates enforcing completeness, decision-summary traceability,
  score weight/override exposure, distinct Approve/Reject/Return/Defer persistence, reopen-
  versioning) has not run end-to-end against a real backend/database.

## 4. Verdict

**PARTIAL, PERSISTENCE EVIDENCE_MISSING** — unchanged from `00_PROGRAM_STATUS_AND_VERSION.md`'s
Program D / E08 row. Model, service, routes and UI compile and are flag-gated; scoring and
decision-log governance are wired with correct terminal-state modeling per the commit record; zero
of it has been proven against a real database.
