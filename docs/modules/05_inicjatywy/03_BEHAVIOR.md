---
module_id: MODULE_INITIATIVES
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Inicjatywy

## Purpose

Opisać kontrakt zachowania inicjatywy: lifecycle, gate decisions, CTA i editability sterowane backendem.

## Must

- MUST: status-set inicjatywy jest kanonicznie zdefiniowany i mapuje się na UX locks/buttons (z SoT).
- MUST: gate transitions są widoczne tylko gdy `availableTransitions[].canCurrentUserExecute = true` (brak disabled workflow buttons).
- MUST: FE renderuje editability i CTA z `GateReadinessCheck.capabilities` (backend source of truth).
- MUST: `Status`, `Phase`, `Next Gate` są read-only (system-controlled); `Priority/Owner/Target date` są warunkowo edytowalne wg `capabilities.topBar.*`.
- MUST: AI CTA jest widoczna, ale disabled z wyjaśnieniem gdy `capabilities.ctaBar.canUseAi = false`.

## Must Not

- MUST NOT: FE nie może inferować permissions lokalnie (deny-by-default jeśli brak capabilities).
- MUST NOT: pokazywać disabled workflow actions zamiast ukryć (workflow actions są “only active”).

## Should

- SHOULD: polityka baseliny timeline: `APPROVED` nie wymaga baseliny, baseline staje się blokująca od `SCHEDULED`.
- SHOULD: Steering Board delegation rule: gdy steering board jest disabled, gate’y steering mogą wykonać `PROJECT_SPONSOR` lub `PORTFOLIO_OWNER` (backend przepisuje requiredRoles).

## Acceptance Criteria

- [ ] Dla danego statusu UI pokazuje wyłącznie CTA zgodne z backend payloadem.
- [ ] W statusach `CANCELLED`/`ARCHIVED` AI CTA jest wyłączona i UI wyjaśnia powód.

## Related Sources

- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`

