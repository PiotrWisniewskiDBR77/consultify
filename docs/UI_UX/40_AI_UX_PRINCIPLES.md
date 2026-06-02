---
uiux_doc_id: UIUX_AI_UX_PRINCIPLES
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# AI UX principles (governance-first)

## Purpose

Zamknąć zasady UI/UX dla AI w aplikacji: jawność, kontrola, brak hidden learning, traceability i spójne placement akcji.

## Applies To

Chat, AI actions w modułach, propozycje/automatyzacje, AI OS/internal tools, AI w admin/governance.

## Must

- **MUST**: No Silent Execution — `proposal -> approval -> execution -> audit` dla istotnych mutacji.
- **MUST**: No Hidden Learning — memory/personalization jest kontrolowane i komunikowane; private mode ma realny skutek.
- **MUST**: Traceability — AI outputs/proposals/artifacts pokazują źródła/lineage albo jawne ograniczenie.
- **MUST**: Honest degraded AI — jeśli kontekst/źródła są niegotowe/blocked/partial, UI to komunikuje.
- **MUST**: Placement — kontekstowe AI actions są w Menu 3 / command row (a dla executive modules: w right rail zgodnie z MELS).

## Must Not

- **MUST NOT**: Udawać pewności bez evidence (brak “confident prose” przy braku źródeł).
- **MUST NOT**: Dublować AI toolbarów w canvasie.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/UI_UX/42_AI_ACTIONS_PLACEMENT.md`
- `DRD/consultify/docs/UI_UX/43_PROPOSAL_APPROVAL_AUDIT.md`
- `DRD/consultify/docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`

