---
uiux_doc_id: UIUX_TERESA_AND_ASSISTANTS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Teresa & assistants (one conversation surface)

## Purpose

Zamknąć zasadę: w aplikacji istnieje **jedna** powierzchnia konwersacji (Teresa) i moduły nie hodują lokalnych czatów/agent paneli z osobną historią i inputem.

## Applies To

Chat, moduły executive (Wordy/Excele/Prezentacje/Tabele), Canvas, narzędzia i panele edycyjne.

## Must

- **MUST**: Jedna powierzchnia czatu w całej aplikacji: Teresa (`UnifiedChatPanel`).
- **MUST**: Moduł nie renderuje własnego pola promptu ani własnego okna wiadomości AI.
- **MUST**: Sugestie i quick actions modułu są publikowane do Teresy jako chipy/suggested actions (jednolity UX).
- **MUST**: Pamięć rozmowy jest ciągła między modułami (bez “trzech UX rozmowy”).

## Must Not

- **MUST NOT**: Lokalny “Agent AI” panel z inputem i osobną historią w narzędziu.
- **MUST NOT**: Ukryte autoprompty i ukryte wpisy AI poza wątkiem Teresy.

## Acceptance Criteria

- [ ] Na ekranach authoringowych nie ma dwóch pól tekstowych “rozmowy z AI” równolegle.
- [ ] Proposal/approval/audit działa przez jednolity envelope.

## Related Sources

- `DRD/consultify/docs/product/UNIFIED_CONVERSATION_SURFACE_TERESA_SSOT.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_08_TERESA_2026-03-29.md`
- `DRD/UI_UX_SOURCE_OF_TRUTH.md`

