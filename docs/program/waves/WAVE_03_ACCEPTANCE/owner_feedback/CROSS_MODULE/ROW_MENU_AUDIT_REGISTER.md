# Cross-app row menu audit register

Status: `OPEN / INVENTORY_REQUIRED / NO_IMPLEMENTATION_AUTHORIZED`

Policy: [`ROW_MENU_POLICY_SKEPTICAL_REVIEW.md`](ROW_MENU_POLICY_SKEPTICAL_REVIEW.md)

## Required inventory

| Wave | Module | Surfaces | Current classification |
|---|---|---|---|
| 1 | Tools | Library, Sessions, Insights/Outputs, Reports, Initiatives | `OWNER_REJECTED_TOO_SPARSE / EVIDENCE_CAPTURED` |
| 1 | Interview | Inbox, Sessions, Assigned, Templates, Insights, Initiatives | `OWNER_REPORTED_GAPS / PARTIAL_EVIDENCE` |
| 2 | Historical hotspots | Sejf, Run Agent, Documents/Sheets | `REQUIRES_REVALIDATION` |
| 3 | Initiatives | Main Initiatives register: kebab and right-click menu | `OWNER_REJECTED / ANCHORING_AND_POLICY_GAP / INI-OWN-003` |
| 3 | Remaining registered table surfaces | all remaining kebab, right-click, Preview and bulk adapters | `NOT_INVENTORIED` |

## Registered Wave 3 findings

| Finding | Module | Route | Entity | Surfaces | Observed problem | Required contract | Evidence | Classification |
|---|---|---|---|---|---|---|---|---|
| `INI-OWN-003` | Initiatives | `/initiatives?sampleData=initiatives` | Initiative | row right-click; row kebab | Right-click menu is detached at the table's left edge while kebab is anchored to the row. Both show `Open`, `Open preview`, and disabled `Archive`, but a shared descriptor source, exact parity, readable disabled reason, focus return and handler/permission parity are not proven. | One governed registry; exact ordered parity; anchor/clamp/flip; task-based labels; truthful accessible disabled reason; canonical zones; keyboard/focus contract; real authorized handlers and cold readback. | Screenshots `14.06.01` SHA-256 `8791162a7422d3a9cfbbcbebb54583527585c494b180166a1aec94b7ea5df359` and `14.06.09` SHA-256 `dcd8e83b50923eafd994ccdba0250b2e83ee91bf2ce831f0ef56c22681b2d53d`; runtime label `LOCAL @bcfb01483a36` | `OWNER_REJECTED / AUDIT_REQUIRED / NOT_FIXED` |

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
