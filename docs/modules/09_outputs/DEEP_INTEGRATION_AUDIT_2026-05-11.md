---
module_id: MODULE_OUTPUTS
doc_kind: DEEP_INTEGRATION_AUDIT
owner_business: user
owner_tech: user
status: review
last_updated: 2026-05-11
scope_anchor: 09_outputs/MODULE_DEEP_INTEGRATION_AUDIT
work_type: docs-only
---

# Deep Integration Audit — Outputs + Format Lanes (2026-05-11)

## 1. Scope

Deep docs-only triangulation across:

- `09_outputs` (library/governance)
- `10_dokumenty` (`/wordy`)
- `11_tabele` (`/excele`)
- `12_prezentacje` (`/prezentacje`)

Triangulation inputs: runtime code (`routeConfig`, `AppRoutes`, `menuConfig`, runtime shells/components), module contracts, RAW packets, V8.1 output doctrine.

## 2. Runtime Ownership Map (As-Is)

| Route / entry | AppView / menu binding | Runtime shell in code | Owner module (as-is) | Artifact ownership posture |
| --- | --- | --- | --- | --- |
| `/presentations` | `AppView.PRESENTATIONS`, sidebar `Outputs` | `MainLayout` + `ProductionModuleGate(moduleName="Outputs")` + `ReportsAndPresentationsHub` | `09_outputs` | canonical artifact library/runtime surface |
| `/reports`, `/reports/management` | `AppView.REPORTS_ENTRY` / `REPORTS_MANAGEMENT` legacy | redirect to `/presentations?tab=documents` | `09_outputs` | legacy bridge; no separate owner |
| `/reports/builder`, `/reports/builder/:reportId` | `AppView.FULL_STEP6_REPORTS` maps here | `ReportBuilderView` under `moduleName="Outputs"` | `09_outputs` | report editing under outputs lane |
| `/presentations/wizard` | route-level entry from outputs hub | `PresentationWizard` under `moduleName="Outputs"` | `09_outputs` | deck generation entry in outputs lane |
| `/presentations/builder/:deckId` | route-level entry from wizard/library | `DeckBuilder` under `moduleName="Outputs"` | `09_outputs` | deck edit/export flow in outputs lane |
| `/presentations/shared/:shareToken`, `/presentations/embed/:shareToken` | share/embed routes | `SharedPresentationView` | `09_outputs` | scoped external artifact view |
| `/wordy` | `AppView.WORDY`, sidebar `Documents` | `V4ComingSoonView` (placeholder) | `10_dokumenty` | placeholder-only; target runtime not mounted |
| `/excele` | `AppView.EXCELE`, sidebar `Tables` | `V4ComingSoonView` (placeholder) | `11_tabele` | placeholder-only; target runtime not mounted |
| `/prezentacje` | `AppView.PREZENTACJE_GEN`, sidebar `Presentations` | `V4ComingSoonView` (placeholder) | `12_prezentacje` | standalone lane placeholder; production lane remains `/presentations` in 09 |

## 3. Key Code-Level Findings (Double-Truth Risk)

### 3.1 Confirmed As-Is truths

1. `09_outputs` truly owns active production output runtime (`/presentations`, report builder, wizard, deck builder, shared/embed).
2. `10/11/12` route identities are live in menu/appview but runtime remains placeholder on all three lane routes.
3. `ReportsAndPresentationsHub` uses route/query tab sync and exposes command-row controls (`rightControls`, `commandRowContent`) aligned with Menu 3 doctrine.

### 3.2 Integration inconsistencies

| ID | Inconsistency | Severity | Impact |
| --- | --- | --- | --- |
| `DIA-P1-001` | `09_outputs/00_META.md` declares route `/presentations` with `AppView.FULL_STEP6_REPORTS`, but code maps `AppView.FULL_STEP6_REPORTS -> /reports/builder`. | `P1` | appview-level ownership signaling drift |
| `DIA-P1-002` | `WordyView`, `ExceleView`, `PrezentacjeView` are imported in `AppRoutes.tsx` but not mounted on `/wordy`, `/excele`, `/prezentacje` (placeholder rendered instead). | `P1` | dormant runtime substrate can be mistaken as active ownership |
| `DIA-P1-003` | `PresentationWizard`/`DeckBuilder` execute generation/export flows directly in outputs lane while module 12 remains placeholder lane, requiring strict boundary narrative to avoid dual-product truth. | `P1` | user-facing confusion risk between `/presentations` and `/prezentacje` |
| `DIA-P2-001` | visual evidence assets listed in assignments/packets were not present in workspace during audit. | `P2` | no screenshot-backed UI proof in this pass |

## 4. MUST / SHOULD / OUT (triangulated)

### MUST

1. Outputs stays canonical library and governance layer.
2. Format lanes keep ownership of their runtime contracts even when currently placeholder.
3. No hidden write/export; impactful actions require explicit review/approval.
4. Menu 3/right-side contextual action rail is canonical and non-duplicated.
5. Lifecycle states (`loading/empty/error/degraded/success`) must be explicit with next-action guidance.

### SHOULD

1. Keep lightweight UX parity across word/excel/presentation flows.
2. Keep one artifact identity and lineage across lanes.
3. Keep route ownership and lane boundaries explicit in UI copy and docs.

### OUT

1. Runtime code changes in this cycle.
2. New heavy dialog-first orchestration as main path.
3. Any second artifact registry or ownership takeover by outputs.

## 5. As-Is vs Target vs Delta

| Axis | As-Is | Target | Delta |
| --- | --- | --- | --- |
| Runtime owner map | mostly coherent, but appview mapping drift exists | route/appview/docs ownership map fully aligned | `P1` |
| 09 vs 10/11/12 boundary | contractually defined; runtime split can be misread | explicit boundary with no double truth in docs, routing, copy | `P1` |
| Menu 3 doctrine | outputs hub shows command-row mechanism | cross-lane evidence pack proving no duplicate rails | `P1` |
| Approval/export doctrine | documented strongly; runtime proof depth incomplete | explicit cross-family evidence before publish/export claims | `P1` |
| State evidence | documented; not fully test-evidenced | full matrix per family with next-action proof | `P2` |

## 6. Decision Table (KEEP / ENHANCE / NEW / DEFER)

| Decision ID | Topic | Decision | Rationale | Status |
| --- | --- | --- | --- | --- |
| `DIA-001` | Outputs as active runtime owner for `/presentations` family | `KEEP` | confirmed by route + shell + component mounts | `PASS` |
| `DIA-002` | Placeholder honesty for `/wordy`, `/excele`, `/prezentacje` | `KEEP` | aligns with code and module docs | `PASS` |
| `DIA-003` | AppView-route ownership alignment for outputs | `ENHANCE` | `FULL_STEP6_REPORTS` mismatch vs module 09 metadata | `PASS_WITH_P1` |
| `DIA-004` | Dormant Kimi lane runtime signaling | `ENHANCE` | imported views exist but are not mounted; docs should keep this explicit | `PASS_WITH_P1` |
| `DIA-005` | Cross-lane boundary clarity (`/presentations` vs `/prezentacje`) | `ENHANCE` | avoid dual ownership interpretation | `PASS_WITH_P1` |
| `DIA-006` | Evidence depth for Menu 3 + approval/export + states | `NEW` | currently mostly docs-level | `NOT_DONE` |
| `DIA-007` | Visual proof attachment | `DEFER` | assets unavailable in workspace | `NOT_DONE` |

## 7. Edge Decisions (Graph / Lineage / Traceability)

| Edge / matrix area | Decision | Notes |
| --- | --- | --- |
| `09_outputs -> 10_dokumenty` handoff | `NO_NEW_EDGE` | existing edge is correct; strengthen evidence only |
| `09_outputs -> 11_tabele` handoff | `NO_NEW_EDGE` | existing edge is correct; strengthen evidence only |
| `09_outputs -> 12_prezentacje` handoff | `NO_NEW_EDGE` | existing edge is correct; boundary clarity remains required |
| Artifact classes (document/table/deck/output package) | `NO_NEW_ARTIFACT` | no new artifact type introduced |
| `SYSTEM_TRACEABILITY_MATRIX` row detail for outputs lanes | `UPDATE_TRACEABILITY_DETAIL` | broaden runtime evidence granularity for deep audit findings |

## 8. P0 / P1 / P2 Closure Register

### P0

- none requiring structural runtime ownership changes in this docs cycle.

### P1

1. Fix docs-level appview ownership drift (`FULL_STEP6_REPORTS` mapping mismatch).
2. Keep dormant Kimi runtime status explicit to avoid product truth drift.
3. Add cross-lane evidence backlog for approval/export and Menu 3-only placement.

### P2

1. Reattach missing screenshot evidence.
2. Add state-depth evidence packs across output families.

## 9. Final

`NEEDS_OWNER_DECISION`

Reason: deep map is coherent enough for docs closure, but unresolved owner decisions remain on appview ownership alignment, dormant-runtime signaling policy, and pending P1/P2 evidence closure.

