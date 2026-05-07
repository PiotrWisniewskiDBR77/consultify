# Sprint 6 — Full Validation Matrix Run (QA Gate)

**Sprint ID:** `S6`
**Owner:** Orchestrator (sequential, with QA assist)
**Status:** `BLOCKED — pending Sprint 5 merged`
**Wave:** 4
**Estimate:** ~1.5 days

## Sprint goal

Execute the full `01_VALIDATION_MATRIX.md` end-to-end against the merged work of Sprints 1–5. Capture evidence (test output, screenshots, audit reports). Produce a binary GO / GO_WITH_CONSTRAINTS / NO_GO recommendation for Sprint 7 closeout.

## Committed deliverables

- All Layer 1 (static) checks GREEN.
- All Layer 2 (unit) checks GREEN.
- All Layer 3 (component) checks GREEN.
- All Layer 4 (integration) checks GREEN; L4.4 audit recorded.
- All Layer 5 (e2e) checks GREEN.
- Layer 6 (manual / Anygravity) recorded:
  - L6.1 P0 trial card filed in `DRD/testy_antygravity/TEST_QUEUE.md` per `ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md`.
  - L6.2 DBR77 visual review screenshots attached.
  - L6.3 Menu 3 placement audit recorded.
  - L6.4 Side-by-side Wordy ↔ Tabele parity screenshot saved.
- All Layer 7 (security/tenant) checks GREEN.
- All Layer 8 (perf) checks GREEN.

## Pre-sprint risk check

- T1–T8, P1–P7, S1–S7 all reviewed; any unresolved P0/P1 escalated.

## Sprint Entry Gate

- [ ] Sprint 5 merged.
- [ ] `01_VALIDATION_MATRIX.md` reviewed.
- [ ] Test environment + staging server available.
- [ ] LLM provider mock configured for L4 backend tests.
- [ ] Anygravity test queue receives a P0 trial card.

## Work plan (1.5-day breakdown)

### Day 1 (morning)
- L1.1 lint, L1.2 frontend typecheck, L1.3 backend typecheck.
- L1.4 DBR77 hex scan.
- L1.5 untouched-files guard.

### Day 1 (afternoon)
- L2.1–L2.4 unit tests.
- L3.1–L3.4 component tests.
- L4.1–L4.4 integration tests.
- L8.1, L8.2 perf checks.

### Day 1 (evening)
- L5.1–L5.3 e2e smoke against staging.

### Day 2 (morning)
- L6.1 Anygravity P0 trial — file card, run trial, record result.
- L6.2 DBR77 visual review — screenshots saved to `evidence/sprint-6/dbr77/`.
- L6.3 Menu 3 placement audit — screenshots saved to `evidence/sprint-6/menu3/`.
- L6.4 Wordy ↔ Tabele parity screenshot — saved to `evidence/sprint-6/parity/`.

### Day 2 (afternoon)
- L7.1–L7.4 security review.
- Compile QA report.
- Recommend GO / GO_WITH_CONSTRAINTS / NO_GO.

## Sprint Exit Gate

- [ ] All Layer 1–8 checks recorded with PASS / FAIL / N/A.
- [ ] All evidence saved under `evidence/sprint-6/` subfolder of this packet.
- [ ] No unresolved P0/P1.
- [ ] QA report written.
- [ ] Recommendation: **`GO` / `GO_WITH_CONSTRAINTS` / `NO_GO`**.

## Files this sprint will touch

### Created (evidence)
- `consultify/docs/product/work-packets/table-studio-foundation/evidence/sprint-6/qa-report.md`
- `consultify/docs/product/work-packets/table-studio-foundation/evidence/sprint-6/dbr77/*.png`
- `consultify/docs/product/work-packets/table-studio-foundation/evidence/sprint-6/menu3/*.png`
- `consultify/docs/product/work-packets/table-studio-foundation/evidence/sprint-6/parity/*.png`
- `consultify/docs/product/work-packets/table-studio-foundation/evidence/sprint-6/tests/*.txt` (raw test output)

### Updated
- `01_VALIDATION_MATRIX.md` (status column filled in for every row)
- `02_RISK_REGISTER.md` (realized risks logged)

### Source code
- **NONE** (sprint is read-only QA; any P0/P1 fix requires a separate sprint card opened in this packet)

## Failure path

If any P0 / P1 lands during this sprint:
1. STOP execution.
2. Open a new sprint card under `sprints/SPRINT_6.5_HOTFIX_<topic>.md`.
3. Get user approval.
4. Execute fix.
5. Re-run impacted matrix layers.
6. Resume Sprint 6 only when GREEN.

## Realized risks

> _to fill at sprint end_

## Daily evidence

> _to fill_
