---
uiux_doc_id: UIUX_AI_OUTPUT_TRUST
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# AI output trust (citations, provenance, lineage)

## Purpose

Zamknąć kontrakt “trust” dla UI: jak użytkownik i support rozumieją, na czym opiera się wynik AI oraz jak system komunikuje niepewność, degraded mode i źródła.

## Applies To

Chat, raporty, rekomendacje, propozycje zmian, generowane artefakty (docs/tables/decks), RAG.

## Must

- **MUST**: Wysokowartościowe outputy AI zawierają:
  - cytowania / evidence refs **albo** jawne stwierdzenie ograniczeń,
  - provenance (co zostało użyte),
  - trace/routing explanation dla support (i dla usera gdy relewantne).
- **MUST**: UI odróżnia:
  - grounded fact (oparte o źródła),
  - synthesis (wnioskowanie/kompilacja),
  - uncertain inference (niepewność) — i nie ukrywa tego.
- **MUST**: Jeśli źródło jest `processing/partial/unreadable/policy_blocked/quota_blocked`, UI pokazuje to jawnie.

## Must Not

- **MUST NOT**: Cytować źródeł, do których user nie ma uprawnień.
- **MUST NOT**: Pokazywać fake confidence przy braku evidence.

## Related Sources

- `DRD/consultify/docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md` (statusy: ready/partial_ready/processing/ocr_required/unreadable/policy_blocked/quota_blocked)

