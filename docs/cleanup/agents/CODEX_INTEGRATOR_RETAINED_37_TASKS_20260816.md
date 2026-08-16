# Codex integrator — retained completion scope (37 tasks)

Branch: `codex/recovery-canonical-20260816`

This register proves the four-lane denominator: Claude A/B/C own 45 distinct
top-level tasks and Codex retains the remaining 37 of 82. Ideas sub-packets in
Claude C are mandatory scope but do not change the top-level denominator.

## Remaining module tasks — 29

### Interview — 1

1. `INT-UI-CANON-001`

### Results — 5

2. `RES-BVP-001`
3. `RES-MVP-LEGACY-CUTOVER-001`
4. `RES-MVP-VISIBILITY-001`
5. `RES-FLOW-ADAPTER-001`
6. `RES-UI-CANON-001`

### Finance — 6

7. `FIN-BVP-001`
8. `FIN-MVP-CUTOVER-001`
9. `FIN-MVP-CANDIDATE-001`
10. `FIN-MVP-RECONCILIATION-001`
11. `FIN-MVP-IMPORT-001`
12. `FIN-UI-CANON-001`

### Meeting policy — 1

13. `MTG-POL-001`

### Admin — 4

14. `ADM-BVP-001`
15. `ADM-MVP-OPS-001`
16. `ADM-MVP-BACKUP-001`
17. `ADM-UI-CANON-001`

### Settings — 6

18. `SET-BVP-001`
19. `SET-MVP-OAUTH-001`
20. `SET-MVP-MFA-001`
21. `SET-MVP-EXPORT-001`
22. `SET-MVP-DELETE-001`
23. `SET-UI-CANON-001`

### Partner — 6

24. `PRT-POL-001`
25. `PRT-BVP-001`
26. `PRT-MVP-LEDGER-001`
27. `PRT-MVP-ACCRUAL-001`
28. `PRT-MVP-LEGACY-CUTOVER-001`
29. `PRT-UI-CANON-001`

## Cross-program tasks — 8

30. `FLOW-TRANSFORM-MVP-001`
31. `NFR-PERF-001`
32. `OPS-OBS-001`
33. `SEC-PRIV-001`
34. `DATA-DR-001`
35. `PERSONA-UAT-001`
36. `UI-CANON-ALL-001`
37. `REL-001-T01`

## Atomic execution matrix

All tasks use `EXECUTION_GATE_CATALOG_20260816.md`; quantified cross-program
thresholds and fail-closed decisions come from
`OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md`.

| Task | Required predecessors | Owner/result contract | Required gates / blocker |
| --- | --- | --- | --- |
| `INT-UI-CANON-001` | lane-A Interview runtime | mounted respondent/manager/owner views; no writer | G0–G2,G4,G6 + human |
| `RES-BVP-001` | lane-B Results signal contract | KPI/ROI/OKR owners; three gold flows; append-only history | G0–G6; mount/role decisions |
| `RES-MVP-LEGACY-CUTOVER-001` | Results parity+usage | one writer; backfill; legacy read-only/retired | G0–G3,G5–G6; rollback proof |
| `RES-MVP-VISIBILITY-001` | role decision | approved visibility/roll-up matrix | G0–G6; `BLOCKED_OWNER` |
| `RES-FLOW-ADAPTER-001` | lane-B signal + Results owner | exactly-once Execution→Results and Actual→Finance outbox | G0–G6 |
| `RES-UI-CANON-001` | Results runtime stable | KPI/ROI/OKR mounted states and three-role fixture | G0–G2,G4,G6 + human |
| `FIN-BVP-001` | Results Actual contract | statement/baseline/prediction/analysis/valuation and identity | G0–G6; architecture spine |
| `FIN-MVP-CUTOVER-001` | parity/backfill/usage | one compatibility/V8 writer and ID space | G0–G6; non-destructive rollback |
| `FIN-MVP-CANDIDATE-001` | Finance identity stable | versioned numerical anchors and one candidate receipt | G0–G6 |
| `FIN-MVP-RECONCILIATION-001` | owner decision+Results outbox | Finance proposal/dispute; never overwrite Actual | G0–G6; `BLOCKED_OWNER` |
| `FIN-MVP-IMPORT-001` | Finance spine | XLSX/CSV map/correct/confirm and immutable import receipt | G0–G6 |
| `FIN-UI-CANON-001` | five workspaces stable | flags OFF/ON, deep links, identity/error/conflict | G0–G2,G4,G6 + human |
| `MTG-POL-001` | none | consent/retention/legal-hold decision; recording OFF default | G0,G6; `BLOCKED_OWNER` |
| `ADM-BVP-001` | capability policy | invite/accept/role/revoke, last-owner and audit | G0–G6 |
| `ADM-MVP-OPS-001` | Admin owner | IAM jobs/retry/audit/observability and runbook | G0–G3,G5–G6 |
| `ADM-MVP-BACKUP-001` | DR contract | tenant export/backup/restore, encryption and access audit | G0–G3,G5–G6 + DATA-DR |
| `ADM-UI-CANON-001` | Admin runtime | forbidden controls hidden, multi-persona states | G0–G2,G4,G6 + human |
| `SET-BVP-001` | preference/tenant-policy boundary | profile/language/theme/notifications/AI persistence; no secret readback | G0–G6 |
| `SET-MVP-OAUTH-001` | provider decision | connect/revoke/error, scopes/residency and secret redaction | G0–G6; `BLOCKED_OWNER` |
| `SET-MVP-MFA-001` | security contract | enroll/challenge/recovery/re-auth and audit | G0–G6 |
| `SET-MVP-EXPORT-001` | privacy authorization | portable export request/receipt/readback | G0–G6 |
| `SET-MVP-DELETE-001` | legal decision | request/cancel/approve/hold/anonymize; destructive execution OFF by default | G0–G6; `BLOCKED_OWNER` |
| `SET-UI-CANON-001` | Settings runtime | preference/security/privacy states | G0–G2,G4,G6 + human |
| `PRT-POL-001` | commercial/legal decision | currency/rule/eligibility/window/reversal/dispute/tax | G0,G6; `BLOCKED_OWNER` |
| `PRT-BVP-001` | bounded V8 owner | register/connect/certification/code/attribution/reopen | G0–G6 |
| `PRT-MVP-LEDGER-001` | policy | append-only participant ledger/rule/correction/reversal/dispute | G0–G6 |
| `PRT-MVP-ACCRUAL-001` | policy | referral→eligible accrual→manual request→independent approval | G0–G6; `BLOCKED_OWNER` |
| `PRT-MVP-LEGACY-CUTOVER-001` | ledger parity/usage | backfill, zero legacy writer/fallback and rollback | G0–G6 |
| `PRT-UI-CANON-001` | Partner runtime | partner/certification/attribution/ledger/accrual states | G0–G2,G4,G6 + human |
| `FLOW-TRANSFORM-MVP-001` | integrated A→C→B then Results/Finance | one source→candidate→Initiative→Execution→Actual→reconciliation→PIR lineage | G0–G6; deployed desktop/mobile |
| `NFR-PERF-001` | frozen release candidate | quantified performance defaults | measurable-gates document |
| `OPS-OBS-001` | cross-flow correlation IDs | logs/metrics/alerts/SLO/runbooks | measurable-gates document |
| `SEC-PRIV-001` | all provider/policy packets | threat model, security negatives, dependency disposition | measurable-gates document |
| `DATA-DR-001` | additive schema stable | backup/checksum/restore/RPO/RTO/rehearsal | measurable-gates document |
| `PERSONA-UAT-001` | module golden flows | seven role job stories and negatives | measurable-gates document + human |
| `UI-CANON-ALL-001` | 16 UI packets | aggregate all states/viewports/themes/languages/a11y | measurable-gates document + human |
| `REL-001-T01` | every preceding MVP task DONE/approved OUT | exact SHA deploy/readback, two telemetry windows and rollback | explicit Piotr authorization |

## Integrator responsibilities beyond task implementation

- own all shared route/Gateway/menu/flags/types/migration-order/package files;
- review and serially integrate Claude A → C → B commits;
- resolve cross-lane contracts without broad merging branch histories;
- rerun invalidated focused/type/build/realDB/browser gates after each lane;
- freeze exact integration/demo/release SHAs and keep evidence identities exact;
- retain literal owner/legal/provider/human/production blockers;
- authorize no push/deploy/release without Piotr's explicit instruction.
