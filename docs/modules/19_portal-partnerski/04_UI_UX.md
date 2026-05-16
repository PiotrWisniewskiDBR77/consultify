---
module_id: MODULE_PARTNER_PORTAL
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Portal partnerski

## Purpose

Zdefiniować UX portalu partnera: onboarding checklist, workspace, earnings/payout surfaces i komunikaty governance/degraded.

## Must

- **MUST**: Lifecycle jest czytelny i “prowadzi do realnego stanu” (onboarding prowadzi do aktywnego partnera).
- **MUST**: Earnings/payout surfaces pokazują provenance i statusy (hold/review/failure) bez ukrywania problemów.
- **MUST**: W UI nie ma “magicznego salda” bez możliwości wytłumaczenia — saldo jest derived z ledger.

## Must Not

- **MUST NOT**: Ujawniać operator‑sensitive szczegółów (np. pełne powody fraud review) partnerowi.

## Should

- **SHOULD**: Spójne CTA i guidance w stanach “managed by operator” (z informacją co partner może zrobić dalej).

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md`

