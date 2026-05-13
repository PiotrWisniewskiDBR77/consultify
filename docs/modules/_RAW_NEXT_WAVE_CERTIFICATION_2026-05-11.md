---
doc_id: RAW_NEXT_WAVE_CERTIFICATION_2026_05_11
doc_kind: CERTIFICATION_PLAN
owner: user
status: REVIEW
last_updated: 2026-05-11
work_type: docs-only
---

# RAW Next-Wave Certification — 2026-05-11

## 1. Purpose

Define and lock the next certification wave for RAW families that were intentionally `OUT_OF_SCOPE` in the first certification pass.

Target modules:

- `10_dokumenty` (Document Studio RAW family),
- `12_prezentacje` (Presentation Studio RAW family).

## 2. Input RAW Families

| RAW family | RAW files | Target module |
| --- | --- | --- |
| Document Studio | `docs/RAW/document-studio/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`, `docs/RAW/document-studio/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`, `docs/RAW/document-studio/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md` | `10_dokumenty` |
| Presentation Studio | `docs/RAW/presentation-studio/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md` | `12_prezentacje` |

## 3. Certification Hard Gates (Next Wave)

1. `NO_INVENTORY_GAP`: all next-wave RAW files listed and mapped.
2. `NO_THESIS_GAP`: every critical thesis has `KEEP/ENHANCE/NEW/DEFER/REJECT`.
3. `NO_CONTRACT_GAP`: thesis decisions are linked to module `00-07`, function contracts and taskboard rows.
4. `NO_EVIDENCE_AMBIGUITY`: all runtime claims mapped to route/component/API/test or explicit `NOT_DONE`.
5. `NO_WORLD_CLASS_CLAIM_WITHOUT_BENCHMARK`: each module has benchmark scoring for capability/governance/evidence/ownership/UX.

## 4. Execution Sequence

### Wave NW-10 (Module `10_dokumenty`)

1. Build semantic extraction matrix for RAW `92/93/94`.
2. Create/update module packet: `docs/modules/10_dokumenty/RAW_TARGET_STATE_2_0_PACKET.md`.
3. Sync contract layer `00-07` + function contracts.
4. Sync `IMPLEMENTATION_TASK_BOARD.md` + function cards with `P0/P1/P2`.
5. Add certification addendum and module verdict.

### Wave NW-12 (Module `12_prezentacje`)

1. Build semantic extraction matrix for RAW `96`.
2. Create/update module packet: `docs/modules/12_prezentacje/RAW_TARGET_STATE_2_0_PACKET.md`.
3. Sync contract layer `00-07` + function contracts.
4. Sync `IMPLEMENTATION_TASK_BOARD.md` + function cards with `P0/P1/P2`.
5. Add certification addendum and module verdict.

## 5. Target Deliverables

1. `docs/modules/_RAW_NEXT_WAVE_CERTIFICATION_2026-05-11.md` (this file).
2. `docs/modules/10_dokumenty/RAW_TARGET_STATE_2_0_PACKET.md` (or enriched existing packet).
3. `docs/modules/12_prezentacje/RAW_TARGET_STATE_2_0_PACKET.md` (or enriched existing packet).
4. Updated `docs/modules/_RAW_SEMANTIC_AND_WORLD_CLASS_CERTIFICATION_2026-05-11.md` with next-wave results.

## 6. Owner And Timeline

| Wave | Owner | Earliest start | Exit condition |
| --- | --- | --- | --- |
| `NW-10` | `user` | 2026-05-12 | module gets `DOCS_CERTIFIED` and explicit runtime status |
| `NW-12` | `user` | 2026-05-12 | module gets `DOCS_CERTIFIED` and explicit runtime status |

## 7. Exit Criteria For Next-Wave Certification

- `NEXT_WAVE_RAW_CERTIFIED = YES` when both `NW-10` and `NW-12` pass gates 1-5.
- If one wave remains open, global status is `NEXT_WAVE_RAW_CERTIFIED = PARTIAL`.
