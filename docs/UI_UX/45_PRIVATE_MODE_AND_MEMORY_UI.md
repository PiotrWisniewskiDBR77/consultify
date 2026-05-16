---
uiux_doc_id: UIUX_PRIVATE_MODE_MEMORY
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Private mode & memory UI

## Purpose

Zamknąć UI kontrakt dla pamięci: co user widzi i kontroluje, co admin kontroluje, i jak UI komunikuje wpływ pamięci na zachowanie AI.

## Applies To

Chat, Teresa, agent flows, Settings (user controls), Admin (tenant controls), support/operator visibility.

## Must

- **MUST**: Istnieją 3 powierzchnie kontroli:
  1) user memory controls,
  2) tenant admin memory controls,
  3) operator/support visibility (explain behavior, nie bypass privacy).
- **MUST**: User widzi i kontroluje: private mode, personalization on/off, review/delete memory items, “forget promotion” dla sesji.
- **MUST**: UI nie zmusza usera do zgadywania “czy Teresa zapamięta to później”.
- **MUST**: Deny-by-default: jeśli polityka blokuje memory layer, UI pokazuje to jako wyjaśnienie zachowania (bez ujawniania prywatnej treści).

## Must Not

- **MUST NOT**: Over-promise (“private mode = zero memory”) bez realnego skutku i jasnego opisu.
- **MUST NOT**: Pozwalać supportowi na automatyczny wgląd w private memory bez policy allowance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (No Hidden Learning)
- `DRD/consultify/docs/product/USER_AND_ADMIN_MEMORY_CONTROLS_V8.md`

