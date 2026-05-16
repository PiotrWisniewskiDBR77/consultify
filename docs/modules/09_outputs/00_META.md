---
module_id: MODULE_OUTPUTS
doc_kind: META
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# META — Outputy (Outputs Library)

## Purpose

Metadane kontraktu modułu `Outputy` i jego miejsce w systemie.

## Identity

- **Sidebar label**: Outputy (Reports & Presentations)
- **Folder**: `09_outputs`
- **Module id**: `MODULE_OUTPUTS`
- **Canonical route**: `/presentations` (redirect `/reports`)

## Canonicality

- **Contract status**: draft (w trakcie migracji z istniejących SoT)
- **Primary SSOT map**: `SSOT.md`

## Doctrine (v8.1)

- **Chat is the creation surface**, ale **Outputs Library jest kanonicznym domem** artefaktów.
- **My Work** jest filtrem operacyjnym, nie registry (nie źródło prawdy).
- Jest **jeden registry artefaktów**, a runtime’y formatów (doc/slides/sheet) są pod spodem.

## Open questions (max 3)

1. Jaki jest kanoniczny model “artifact identity” i jak mapuje się na legacy tabele runtime’ów?
2. Jak wygląda minimalny workflow review (needs review → approve/reject) w hubie, niezależnie od formatu?
3. Jakie visibility scopes są pierwszorzędne (private/project/org/review_shared/demo) w obecnej implementacji?

