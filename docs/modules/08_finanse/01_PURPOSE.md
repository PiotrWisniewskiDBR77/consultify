---
module_id: MODULE_FINANCE
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Finanse

## Purpose

Zdefiniować po co istnieje moduł `Finanse`: profesjonalny runtime analizy finansowej (statements → models → valuation), z AI jako aktywnym orkiestratorem, ale bez wymyślania liczb.

## Must

- MUST: AI nigdy nie wymyśla liczb (numerical anchor).
- MUST: AI cytuje źródła dla twierdzeń (grounding do danych/okresu).
- MUST: AI proponuje, nie decyduje (Confirm/Reject/Refine).
- MUST: wspiera przepływ DRAFT→REVIEW→APPROVED dla Economics analiz.

## Must Not

- MUST NOT: zastępować Results w metrykach KPI; Finanse to modeled truth.
- MUST NOT: ukrywać walidacji modelu (np. bilans się nie spina) — musi być jawne `invalid`.

## Should

- SHOULD: umożliwiać “create initiative from analysis” (as-is Economics) jako kontrolowany handoff do Inicjatyw.

## Acceptance Criteria

- [ ] Purpose jest spójny z `FINANCIAL_ANALYSIS_V3.md` oraz `ECONOMICS_MODULE.md`.

## Related Sources

- `DRD/consultify/docs/product/FINANCIAL_ANALYSIS_V3.md`
- `DRD/consultify/docs/modules/ECONOMICS_MODULE.md`

