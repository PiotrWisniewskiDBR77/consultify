---
module_id: MODULE_TABLES
doc_kind: TESTS
version: 1.0
owner: user
status: approved_for_docs
last_updated: 2026-05-09
---

# Acceptance & Tests — Tabele / Excele

## Scope Of Verification (As-Is)

- Verify sidebar -> AppView -> route -> rendered component chain.
- Verify ownership/alias statements against `menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`.
- Verify role/guard behavior where module is protected.

## Required Checks

- [ ] Route opens documented runtime (`workspace` or `placeholder`) exactly as specified.
- [ ] AppView enum and route mapping are consistent in `src/types/core.ts` and `routeConfig.ts`.
- [ ] No contradiction with global ownership decisions in module docs and global docs.
- [ ] If module is placeholder, UI communicates not-ready state explicitly.
- [ ] Menu 3/right-side remains the canonical contextual AI/workflow slot (no duplicate action rails).
- [ ] High-impact table operations are contractually bound to explicit approval flow (no hidden writes).
- [ ] Runtime-state evidence exists for loading/empty/error/degraded/success (As-Is or explicit `NOT_DONE`).
- [ ] Provenance evidence depth is explicit (source/assumption/confidence/audit anchor).
- [ ] `/excele` route truth and Teresa->My Work table-builder truth are both explicitly documented and non-contradictory.
- [ ] Placeholder CTA mutation (`/module-interest`) has explicit UX handling evidence for success and failure posture.
- [ ] RAW Coverage Matrix is present in packet with statuses `USED/IMPACT_ONLY/OUT_OF_SCOPE`.
- [ ] No acceptance claim is promoted without evidence; unresolved claims are `NOT_DONE`.

## Current Gate Expectation

- Expected gate result for runtime delivery: `BLOCKED_P1 until workspace is mounted and testable.`
- Expected gate result for this docs-only integration audit pass: `APPROVED_FOR_DOCS`.
- This remains As-Is readiness plus target-state contract hardening, not implementation readiness.

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `TB_EXCELE_PLACEHOLDER` | `/excele` mounts honest placeholder runtime | `AppRoutes.tsx` -> `V4ComingSoonView` | pass |
| `TB_TABLE_RUNTIME_TARGET` | Target runtime remains documented as not mounted | `ExceleView` imported, not route-mounted | pass (`partial`) |

## Deep Audit Backlog (CODE_VS_DOCS)

| Card ID | Priority | Function | Contract Sync Status |
| --- | --- | --- | --- |
| `TB-DEA-P0-009` | P0 | `TB_EXCELE_PLACEHOLDER`, `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-DEA-P1-010` | P1 | `TB_EXCELE_PLACEHOLDER` | synced |
| `TB-DEA-P1-011` | P1 | `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-DEA-P1-012` | P1 | `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-DEA-P1-013` | P1 | `TB_TABLE_RUNTIME_TARGET` | synced |

## Deep RAW Backlog (RAW_ALIGNMENT)

| Card ID | Priority | Function | Contract Sync Status |
| --- | --- | --- | --- |
| `TB-RAW-P0-014` | P0 | module packet | synced |
| `TB-RAW-P1-015` | P1 | `TB_EXCELE_PLACEHOLDER`, `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-RAW-P1-016` | P1 | module acceptance + packet | synced |

## P0/P1/P2 Board Normalization (MODULE_INTEGRATION)

| Card ID | Priority | Function | Contract Sync Status |
| --- | --- | --- | --- |
| `TB-INT-P0-001` | P0 | `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-INT-P0-002` | P0 | `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-INT-P0-003` | P0 | `TB_EXCELE_PLACEHOLDER`, `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-INT-P1-004` | P1 | `TB_EXCELE_PLACEHOLDER`, `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-INT-P1-005` | P1 | `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-INT-P1-006` | P1 | `TB_EXCELE_PLACEHOLDER`, `TB_TABLE_RUNTIME_TARGET` | ux_evidence_pending (screenshot missing; route/component evidence accepted for docs gate) |
| `TB-INT-P2-007` | P2 | `TB_TABLE_RUNTIME_TARGET` | synced |
| `TB-INT-P2-008` | P2 | `TB_EXCELE_PLACEHOLDER` | deferred |

Reference: `RAW_TARGET_STATE_2_0_PACKET.md`.
Deep audit reference: `DEEP_GAP_AUDIT_CODE_VS_DOCS_2026-05-11.md`.
Deep RAW audit reference: `DEEP_RAW_GAP_AUDIT_2026-05-11.md`.

## RAW -> Decision -> Evidence / NOT_DONE Gate

- RAW requirements are accepted only when mapped to decision + evidence pointer.
- If evidence is absent, item must be marked `NOT_DONE` and cannot be promoted to `PASS`.
- Missing visual asset input from current audit is tracked as `TB-INT-P1-006` and does not block docs approval; it remains a UX evidence follow-up before runtime approval.

## Resolved Problem Decisions

| Problem | Docs Resolution | Runtime Result |
| --- | --- | --- |
| `/excele` route is placeholder while table builder exists via Teresa->My Work | Documented as true As-Is split; target runtime remains separate contract | `BLOCKED_P1` |
| Screenshot asset missing | Route/component evidence is sufficient for docs gate; screenshot remains follow-up evidence | `UX_EVIDENCE_PENDING` |
| Approval/provenance/schema claims need evidence discipline | All unsupported target claims stay target-only or `NOT_DONE`; no promoted claim without evidence | `DOCS_RESOLVED` |

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
- `src/views/V4ComingSoonView.tsx`
- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/MyWork/table/useSchemaProposal.ts`
- `src/components/MyWork/table/SchemaDiffPreview.tsx`
- `src/components/MyWork/table/connectors/ProvenanceBadge.tsx`
