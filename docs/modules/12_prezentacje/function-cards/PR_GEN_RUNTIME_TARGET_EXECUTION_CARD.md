---
module_id: MODULE_PRESENTATIONS
function_id: PR_GEN_RUNTIME_TARGET
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — PR_GEN_RUNTIME_TARGET

## 1. Metadata

- scope_anchor: `12_prezentacje/PR_GEN_RUNTIME_TARGET`
- primary_module: `12_prezentacje`
- work_type: `docs-only`

## 2. Scope Anchor

- in scope: target runtime doctrine alignment, approval/governance acceptance hardening, ownership boundary integrity.
- out of scope: mounting `PrezentacjeView` on `/prezentacje`.

## 3. RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `PR-RT-P0-001` | generator runtime must be governed artifact engine, not a raw slide generator | `NEW + ENHANCE` | `RAW_TARGET_STATE_2_0_PACKET.md`, `functions/PR_GEN_RUNTIME_TARGET.md`, `docs/product/PREZENTACJE_V8_SSOT.md` |
| `PR-RT-P1-001` | AI operations must remain `propose -> review -> accept/reject`; no silent publish/export | `ENHANCE` | `docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`, `functions/PR_GEN_RUNTIME_TARGET.md` |
| `PR-RT-P2-001` | Teresa-executed deck generation/edit/review as module-level hard doctrine | `DEFER` | `NOT_DONE` |
| `PR-RAW-P1-001` | Teresa hard-rule must be closed or explicitly owner-decided in module 12 docs | `OWNER_DECISION_REQUIRED` | `07_ACCEPTANCE_AND_TESTS.md` (`OWNER-TERESA-12-001`) |

## 4. As-Is vs Target vs Delta

| Dimension | As-Is | Target | Delta |
| --- | --- | --- | --- |
| Route mount | imported but not mounted | mounted standalone runtime with explicit governance | `NEW` |
| AI governance | generic rule text | explicit propose/review/accept gate and auditability | `ENHANCE` |
| Delivery gate | implied | explicit review/approval before high-impact publish/export claims | `ENHANCE` |
| Required states | documented module-wide | function-level state acceptance chain | `ENHANCE` |
| Teresa execution binding | absent | explicit deck-work execution doctrine | `DEFER` |

## 5. Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `PR-RT-P0-001` | `P0` | acceptance text did not explicitly bind approval gate to publish/export claims | `READY` |
| `PR-RT-P1-001` | `P1` | function-level state and Menu 3 proof matrix incomplete | `WAITING_P0` |
| `PR-RT-P2-001` | `P2` | Teresa hard rule and visual evidence not canonicalized in module 12 sources | `WAITING_P0` |

## 6. Done Gate

- contract completeness: `PASS`
- evidence chain completeness: `PASS_WITH_P2`
- runtime readiness: `BLOCKED_P1` (target runtime still unmounted)
- docs verdict: `NEEDS_OWNER_DECISION`

## 7. Deep Audit Code Evidence (2026-05-11)

- runtime evidence: `PrezentacjeView` exists in `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` with generation/export logic.
- mount evidence: `/prezentacje` route in `src/routes/AppRoutes.tsx` still renders `V4ComingSoonView`.
- boundary implication: runtime target remains code-present but route-unmounted, so any shipped claim for standalone generator lane stays `NOT_DONE`.
- hard-rule status: Teresa deck-work execution doctrine is explicitly tracked as owner decision pending, not implicitly ignored.

## 8. Stage 1.5 Ultra-Deep Normalization (2026-05-11)

| Gap ID | Priority | Stage 1.5 finding | Function status |
| --- | --- | --- | --- |
| `PR-S15-P0-002` | `P0` | future runtime must bind export/share/publish to review/approval/audit posture | `READY_DOCS` |
| `PR-S15-P1-001` | `P1` | Teresa deck-work execution binding unresolved for target runtime | `NEEDS_OWNER_DECISION` |
| `PR-S15-P1-002` | `P1` | future contextual AI actions must use Menu 3/right-side only | `READY_DOCS` |
| `PR-S15-P1-003` | `P1` | function-level runtime states must be evidenced before mount | `READY_DOCS` |
| `PR-S15-P2-002` | `P2` | MELS source unavailable at expected path | `NOT_DONE` |

Stage 1.5 decision: `NEW_DOC_TARGET + DEFER_RUNTIME`.
