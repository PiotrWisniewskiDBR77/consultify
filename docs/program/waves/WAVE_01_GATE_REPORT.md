# Consultify — Wave 01 gate report

Verdict: `PASS`  
Branch: `codex/full-mvp-recovery-20260820`  
Production: `NOT_TOUCHED / NOT_AUTHORIZED`

## Gate results

| Gate | Result | Evidence |
|---|---|---|
| Finance first root cause | PASS | PostgreSQL log: `idx_fs_pack_active_type` duplicate precedes `25P02`; effective schema contains obsolete and current indexes |
| Finance reproducibility | PASS | mounted upload 201 then extract 422 on exact `f5c6a7f16f`; rollback-only SQL reproducer confirms legacy-index conflict and period-aware success |
| Chat disposition | PASS | owner boundary applied; current focused suite 3 files / 100 tests PASS |
| Teresa/UI inventory | PASS | three registries measured; Idea 135/135 generated parity; SWOT 23 declared / 6 handlers; global denominator missing and specified for Wave 02 |
| Critical recovery triage | PASS | Finance, SWOT, Results, Transform, Chat and Teresa candidates classified; no broad merges |
| Wave 02 backlog | PASS | four bounded packets with owned scope, DoD and fan-in order |

## Register movement

Before Wave 01: 71 `DONE_CURRENT_SHA`, 11 `PARTIAL`.  
After truthful Chat disposition: 72 `DONE_CURRENT_SHA`, 10 `PARTIAL`.  
Integrity: 82 records, 0 missing, 0 invalid.

This movement is not artificial: the external provider window remains explicitly attached to release and no provider reliability claim is made.

## Known debt carried forward

- React component tests emit non-failing `act(...)` warnings.
- Finance source packet is still outside the canonical product and must not be merged before schema repair and exact-six requalification.
- Dynamic SWOT remains dirty and protected.
- Global Teresa/UI parity is not accepted until the federated denominator exists.
- Release and production remain stopped.
