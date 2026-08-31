---
doc_id: funkcje-odbior-157
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 157 — ślad pochodzenia i cofanie

**Klasyfikacja: B** — połowa zadania zrobiona i potwierdzona dowodem mutacyjnym;
druga połowa (cofanie) **nie istnieje jako produkt**.

Marker `43322a8b31`, 2 commity. Diff = **2 pliki, 293 linie, same dodania**:
raport + test. **Zero zmian kodu produktu** — przeliczone własnoręcznie.

## Dowód mutacyjny — PRZESZEDŁ

Test bazowy odtworzony niezależnie na osobnym kontenerze Postgres. Następnie
celowo zepsuty kod **produkcyjny** (`agentApprovedMaterializationService.ts:237`,
`sourceType` → `undefined`). Test **poprawnie padł**:

```text
DAY157_COUNTS count_before=2 count_reverted=2 count_after=0
AssertionError: expected Set{ …(2) } to deeply equal Set{ …(3) }
```

Bez retry, bez maskowania. **To jest prawdziwy test, nie fałszywy dowód.**
Drzewo po przywróceniu czyste — sprawdzone.

Test woła **produkcyjny serwis**, nie własny helper obejściowy, a asercje czytają
realne wiersze z Postgresa surowym SQL-em, nie odpowiedź HTTP.

## Cztery warstwy — ścieżka `myw_agent_proposal`

1. **typ** — `TaskService.ts:153` INSERT z kolumnami `source_type, source_id` ✅
2. **baza** — `agentApprovedMaterializationService.ts:235-250` przekazuje realne
   wartości dla zadania, decyzji i notatnika ✅
3. **endpoint + wołacz** — `my-work.routes.ts:114` → `Gateway.ts:1036`
   `app.use('/api/my-work', myWorkRoutes)` ✅
4. **czy się renderuje** — `<AgentMaterializationPanel />` w `AgentHubShell.tsx:1698`
   i `:1713`; `AgentHubShell` renderowany w `MyWorkHub.tsx:4195`. **Bez flagi.** ✅

## Ograniczenia — NAZWANE, dlatego B a nie C

- **`tasks.source` nadal nie ma pisarza.** Zapis idzie do `source_type`/`source_id`,
  nie do `source`. Pierwotna dziura z przekazania **stoi otworem**.
- **Dwie inne ścieżki tworzenia zadania nadal nie zapisują pochodzenia:**
  `aiActionExecutor.ts:1101` (`_executeCreateTask`) i `taskExecutor.ts` — oba
  robią INSERT bez kolumn `source*`. Sprawdzone, potwierdzone.
- **Cofanie materializacji nie istnieje jako endpoint.** Router
  `agent-materialization.routes.ts` ma dokładnie **5 tras** (2×GET, 3×POST) i
  **zero** DELETE/undo/revert. Cofanie z raportu to prototyp SQL **wewnątrz testu**,
  nie funkcja produktu.
- Brak dowodu end-to-end przez realny HTTP z podpisanym tokenem.

## ★ Znalezisko ponad zakres — kłamstwo w dzienniku audytu

`aiActionExecutor.ts:146-161` wylicza pole `rollbackStatus: 'rollback_available'`
ze strategią `'delete_created_output_refs'` i **zapisuje je do audytu**
(`:861`, `:867`, `:869`, `:894`).

**Ten napis nie jest nigdzie odczytywany.** `grep` po całym `server/src` **i** po
`src/` (front) poza miejscami zapisu → **zero trafień**.

Czyli: dziennik audytu twierdzi „cofanie dostępne, strategia: usuń utworzone
odniesienia", podczas gdy **żadnego mechanizmu cofania nie ma**. Ktokolwiek
przeczyta ten audyt — my, klient, kontrola — zostanie wprowadzony w błąd.
To osobna szkoda od braku cofania i **wymaga własnej pozycji**.

## Czego NIE zweryfikowałem

- Kliknięcia w UI z realnym tokenem (potwierdzony montaż i render, nie przebieg).
- Rozkładu `source_type` na bazie demo — pomiar „0 wierszy" dotyczy **wyłącznie
  świeżych, pustych baz testowych**, nie demo i nie produkcji.
- Zachowania triggerów append-only pod współbieżnością.
- `canvasMaterialize.ts:578/601` i `DecisionController.ts:2274` — wymienione
  w raporcie jako sprawne, **nieprzeczytane** przeze mnie.

## Werdykt

**B, do scalenia.** Wykonawca był zdyscyplinowany: sam oznaczył swoje niedowiedzione
tezy jako `NOT_PROVEN` i nie nadużył słowa „działa". Nic z jego głównych twierdzeń
nie zostało obalone.

**Ale dyżur nie zrobił tego, co miał w tytule.** „Ślad pochodzenia" — tak, na jednej
ścieżce, z dowodem. „Cofanie" — nie, to projekt. Nazwa dyżuru obiecywała dwie rzeczy,
dostarczyła jedną. To nie jest wina wykonawcy, tylko **mojej zbyt szerokiej licencji**.
