# Cross-app row menu audit register

Status: `OPEN / INVENTORY_REQUIRED / NO_IMPLEMENTATION_AUTHORIZED`

Policy: [`ROW_MENU_POLICY_SKEPTICAL_REVIEW.md`](ROW_MENU_POLICY_SKEPTICAL_REVIEW.md)

## Required inventory

| Wave | Module | Surfaces | Current classification |
|---|---|---|---|
| 1 | Tools | Library, Sessions, Insights/Outputs, Reports, Initiatives | `OWNER_REJECTED_TOO_SPARSE / EVIDENCE_CAPTURED` |
| 1 | Interview | Inbox, Sessions, Assigned, Templates, Insights, Initiatives | `OWNER_REPORTED_GAPS / PARTIAL_EVIDENCE` |
| 2 | Historical hotspots | Sejf, Run Agent, Documents/Sheets | `REQUIRES_REVALIDATION` |
| 3 | Remaining registered table surfaces | all kebab, right-click, Preview and bulk adapters | `NOT_INVENTORIED` |

## Per-surface audit schema

Each row added during execution must contain:

`module | route/tab | entity | component | registry source | kebab | right-click |
preview | bulk | object states | personas/capabilities | backend handlers |
mutation/readback | telemetry | classification | evidence | owner`.

## Closure denominator

Closure requires:

- `100%` of registered table surfaces classified;
- zero unexplained local/raw action forks outside the allowlist;
- exact kebab↔right-click parity on every applicable table;
- every domain matrix reconciled with real backend operations;
- no placeholder/no-op actions;
- full acceptance-v1 evidence from the policy review;
- owner retest on the frozen candidate SHA.
