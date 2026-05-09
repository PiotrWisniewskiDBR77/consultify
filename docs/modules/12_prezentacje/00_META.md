---
module_id: MODULE_PRESENTATIONS
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Prezentacje (Presentation Studio)

## Purpose

Metadane kontraktu modułu `Prezentacje` i jego miejsce w systemie.

## Identity

- **Sidebar label**: Prezentacje
- **Folder**: `12_prezentacje`
- **Module id**: `MODULE_PRESENTATIONS`
- **Primary entry (today)**: Outputs `/presentations` → Presentations tab; legacy generator `/prezentacje`

## Canonicality

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`

## Doctrine

- **Gamma-level beauty** jest wymaganiem jakości, ale Gamma nie jest kanonicznym modelem ani runtime.
- **Methodology before design**: cel biznesowy → audience → decision context → source pack → narrative plan → template/blueprint → schema → generation → layout/design → QA → approval → export/share.
- Runtime jest **enterprise-governed**: source grounding, approvals, audyt, tenant safety.

## Open questions (max 3)

1. Jaka jest docelowa konsolidacja tras: czy `/prezentacje` zostaje, czy wszystko idzie przez Outputs `/presentations`?
2. Jaki jest kanoniczny “deck schema/model” (V8) i jak mapuje się na obecny builder?
3. Jakie są minimalne P0 QA gates przed eksportem PDF/PPTX (visual + methodology + source)?

