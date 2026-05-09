---
module_id: MODULE_DOCUMENTS
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Dokumenty (Document Studio)

## Purpose

Metadane kontraktu modułu `Dokumenty` i jego miejsce w systemie.

## Identity

- **Sidebar label**: Dokumenty
- **Folder**: `10_dokumenty`
- **Module id**: `MODULE_DOCUMENTS`
- **Primary entry (today)**: Outputs `/presentations` → Documents tab

## Canonicality

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`

## Doctrine

- Document Studio jest **format runtime** dla klasy `Document` w v8.1.
- MUST NOT tworzyć równoległego artifact registry ani równoległej “approval universe”.
- Template (w Modes 2/3) jest obiektem first-class: planowany i zatwierdzany przed generacją.

## Open questions (max 3)

1. Czy “Dokumenty” będzie osobnym sidebar entry, czy wyłącznie jako “Documents tab” w Outputs (kanon v8.1)?
2. Jaki jest kanoniczny mapping `DocumentSchema` + export (DOCX/PDF) do istniejących export helperów report-buildera?
3. Jakie minimalne QA gates są P0 przed eksportem (source + structural + language)?

