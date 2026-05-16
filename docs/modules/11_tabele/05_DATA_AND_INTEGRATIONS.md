---
module_id: MODULE_TABLES
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Tabele (Table Studio)

## Purpose

Obiekty danych i integracje Table Platform: template catalog, audit ledger, AI usage, QA reports, source packs, conversions oraz form intake.

## Must

- MUST: przechowywać template lifecycle (draft/approved/deprecated) + seeded base templates.
- MUST: audit ledger dla record mutations + `TENANT_VIOLATION` refusal na cross-tenant probes.
- MUST: `tp_ai_usage` jako audyt kosztów AI i budgets per workspace.
- MUST: conversions zapisują `tp_table_conversions` rows (attempt history).
- MUST: form intake JWT ma osobny public endpoint `/api/table-platform/public/forms/jwt/:token`.

## Must Not

- MUST NOT: przepuszczać public intake bez allow-list i rate limits.

## Should

- SHOULD: integrować konwersje z Outputs (doc/slides) przez adapter materializer (bez hardforków runtime’ów).

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`

