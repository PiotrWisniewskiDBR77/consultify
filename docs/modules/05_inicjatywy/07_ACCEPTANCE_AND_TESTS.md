---
module_id: MODULE_INITIATIVES
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Inicjatywy

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów dla governance UI, gate’ów i backend capabilities.

## Must

- MUST: UI renderuje CTA tylko z `availableTransitions` gdzie `canCurrentUserExecute=true`.
- MUST: properties strip (6 pól) ma poprawną editability wg `capabilities.topBar.*`.
- MUST: AI CTA jest enabled/disabled wg `capabilities.ctaBar.canUseAi` i pokazuje wyjaśnienie przy disabled.
- MUST: baseline timeline policy: `APPROVED` może istnieć bez baseliny; `SCHEDULED` wymaga baseliny (blokuje gate).

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: testować steering board delegation rule (wymagane role przepisane przez backend).

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`

