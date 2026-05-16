---
module_id: MODULE_TABLES
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Tabele (Table Studio)

## Purpose

Ustalić granice odpowiedzialności Table Studio: template + data grid + provenance + AI/QA + conversions + intake forms.

## In scope (Must)

- MUST: template catalog + specialized field types.
- MUST: provenance/audit ledger UI + cross-tenant protections.
- MUST: AI Operator (multi-scope) + QA report + Source Pack builder.
- MUST: conversions: table → document / presentation (z audit rows).
- MUST: Form intake (w tym public JWT route + allow-list + rate limits).

## Out of scope (Must Not)

- MUST NOT: dotykać niepowiązanych modułów poza kontraktowymi integracjami (np. Outputs jako odbiorca konwersji).

## Should

- TBD

## Acceptance Criteria

- [ ] Zakres jest spójny z program closeout (Blocks A–D) i nie “wymyśla” nowych surfaces.

## Related Sources

- `DRD/consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`
- `DRD/consultify/docs/product/work-packets/tabele-full-product/`

