---
doc_id: funkcje-odbior-173
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 173 — trzy domknięcia · SCALONO (+ uzupełnienie i18n przy scaleniu)

Gałąź `codex/day173-domkniecia-20260830` (4 commity nad `514c60b355`). Odbiór:
kontener 6083 po pełnej migracji (1783 tabele), **mutacje odtworzone per pozycja**.

| R | Temat | Ocena | Sedno |
|---|---|---|---|
| R1 | root `vitest.config.ts:210` | **B** | naprawa w OBIE strony potwierdzona behawioralnie (cudzym testem, nie asercją własną); 80 obejść NIETKNIĘTE (80→80); minus: mianownik dowodu wykonawcy zdegenerowany (1 własny test) — odbiór zmierzył za niego 148/148 przed=po |
| R2 | notatki decyzji | **A** | wariant (b): stary klucz ani czytany, ani kasowany; mutacja przywrócenia bloku 166 → czerwona |
| R3 | ciche awarie | **B** | 4 bloki catch/5 mutacji, dowód 1:1 per miejsce (jeden toast → dokładnie jeden test czerwony); minus: 2 nowe klucze i18n nie istniały w locales |

Licencja czysta (10 plików = tabela), rozłączność z 163/165/170/171/172/175 = pusta.

**Wykonane przy scaleniu przez nadzorcę:** dopisane `portfolio.toast.taskSaveError`
i `initiatives.calendar.toast.rescheduleFailed` do `public/locales/{pl,en}` (bez tego
EN dostawał polski fallback).

## Otwarte po 173
1. ★ **CI po scaleniu na linii integracyjnej:** joby integration/colocated pierwszy
   raz dostaną realnie `DB_TYPE=postgres` dla ~1744 plików bez własnego obejścia —
   próbka odbioru (32 testy) bez zmiany wyniku, ale populacja niezmierzona.
   OBSERWOWAĆ pierwszy pełny przebieg test-suite.
2. Dwie ciche powierzchnie zostają (`InitiativeTasksTab.tsx:79,:133` — jawny zakaz
   instrukcji) + `consultify-decision-draft` bez zawężenia (zgłoszone) + decyzja
   o 80 obejściach (balast vs zależność od kolejności importów).
