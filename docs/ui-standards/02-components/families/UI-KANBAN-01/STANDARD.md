---
component_id: UI-KANBAN-01
name: Kanban
family: data-view
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
contract_version: 2.1
product_owner: Piotr Wisniewski
code_owner: Frontend Platform
canonical_docs:
  - docs/ui-standards/CANON.md
  - docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md
  - docs/ui-standards/02-components/PRIMITIVE_INTERACTION_CONTRACT.md
reference_implementations:
  - src/components/standard/StandardKanban.tsx (fasada kolumn, natywny HTML5 DnD)
known_consumers:
  - src/components/Execution/ExecutionInitiativesKanbanView.tsx (bespoke dnd-kit board, reużywa tylko StandardKanbanCard)
  - src/components/Portfolio/PortfolioKanbanView.tsx (bespoke dnd-kit board, własna karta — NIE reużywa StandardKanban/StandardKanbanCard)
  - src/components/RoadmapKanban.tsx (bespoke board — poza SSOT)
last_runtime_audit: 2026-08-02
---

# UI-KANBAN-01 — Kanban

## 1. Job to be done

Porównywać i przesuwać rekordy między stanami bez ukrytej zmiany procesu.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `data-view`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

board, columns, counts/limits, cards, add, preview, overflow. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

status, owner, priority grouping; swimlane optional. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Kontrakt lane (`StandardKanbanColumn` w `StandardKanban.tsx`). Kolumna wymaga: `id` (target dropu i grupowania kart), `label` (nagłówek — znaczenie kolumny, nie skrót techniczny), `tone` (kolor kropki nagłówka, semantyka stanu wg TRIADA_KANON C1, opcjonalny — brak `tone` daje kropkę bez koloru, nie crimson domyślny). `onCreate` jest jawnym przełącznikiem „czy wolno tworzyć w tej kolumnie" — gdy nieustawiony, „+" w nagłówku fizycznie nie istnieje (nie disabled, nie ukryty warunkowo — kolumna go po prostu nie renderuje). Licznik kart (`cards.length`) jest goły, bez etykiety „items"/„kart" doklejanej po stronie kolumny — etykieta języka wchodzi przez `label`. Kolumna NIE ma własnego capability na poziomie danych — capability przenoszenia egzekwuje `onDrop`/`onCardClick` przekazane przez moduł.

## 6. Akcje i zdarzenia

open, preview, move, keyboard move, add, filter. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

loading, empty board/column, populated, dragging, invalid-drop, saving, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Kanban ma DWA rozłączne zakresy AI, które nie wolno mylić: (1) **AI na kolumnie** — akcja typu „posortuj/oceń priorytet dla całej kolumny", zakres = policzalny zestaw kart w JEDNEJ kolumnie w momencie uruchomienia (nie „wszystkie karty" ani „karty które się pojawią później"); wynik to propozycja nowego układu z approve/reject PRZED zapisem, nie natychmiastowe przesunięcie kart. (2) **AI na karcie** — pojedyncza sugestia (np. priorytet) osadzona w `chips`/`footer` karty (patrz UI-CARD-01 §8: karta sama AI nie inicjuje). Kolumna nigdy nie uruchamia AI karty i odwrotnie — to dwa osobne przyciski `sparkles`, każdy z własnym `pending` niekolidującym z drugim.

## 9. Nawigacja

Deska sama nie ma deep linku do kolumny — filtr/grupowanie żyją w Menu 3 nadrzędnym (kanon TRIADA A9: „filtry Menu 3 działają na deskę"), więc powrót z pełnego widoku karty musi odtworzyć TE filtry, nie pozycję scrolla planszy per se (deska jest przewijana poziomo, `w-[280px] shrink-0` na kolumnę — pozycja pozioma nie jest stanem wartym zapamiętania, bo kolumny mają stałą kolejność). Po przeniesieniu karty drag&dropem `onCardClick` musi otwierać preview TEJ karty w NOWEJ kolumnie, nie w starej — `columnId` karty aktualizuje się razem z przeniesieniem, więc nawigacja po `id` karty (nie po parze `id`+`columnId`) jest jedynym stabilnym kluczem.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla kanbanu: deska przewija się w poziomie (`overflow-x-auto`, kolumny stałej szerokości 280 px) — poniżej 1024 px nie zwężamy kolumn ani nie zawijamy ich w kolumnę pionową; alternatywą dla wąskiego ekranu jest widok listy tej samej encji, nie kanban ściśnięty do nieczytelności.

## 11. Accessibility

Zweryfikowane w kodzie: `StandardKanban.tsx` (fasada kolumn) implementuje WYŁĄCZNIE natywny HTML5 `draggable`/`onDragStart`/`onDrop` — bez jednego `onKeyDown` w całym pliku. To znaczy: przenoszenie kart klawiaturą (Space podnosi/strzałki przesuwają/Space upuszcza/Esc anuluje — wymóg `PRIMITIVE_INTERACTION_CONTRACT.md` §2 „Drag/drop" i appendix „DnD + keyboard move") NIE ISTNIEJE w tej fasadzie i to jest bramka blokująca `runtime_status` > `PARTIAL`, nie kosmetyczny brak. Kontrast: `ExecutionInitiativesKanbanView.tsx` używa `dnd-kit` z `KeyboardSensor` (zweryfikowane w imporcie) — czyli klawiaturowa alternatywa istnieje TYLKO w bespoke boardzie poza fasadą, co samo w sobie jest `REJECTED_LOCAL_FORK` wg reguły review w `COMPONENT_RUNTIME_BINDING_REGISTRY.md`. „Przenieś przez menu" (alternatywa nie-DnD z appendixu) nie jest zaimplementowana w żadnym z dwóch.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla kanbanu: kolumna to strefa bez `bg`/`border` (`TRIADA_KANON.md` §A9 — „kolumny-pudełka” zakazane wprost); jedynym tłem dozwolonym w strefie kolumny jest chwilowy `ring-2 ring-c-focus bg-c-surface-raised/40` podczas `dragOver` — sygnał interakcji, nie stały styl kolumny.

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla kanbanu: przeniesienie karty między kolumnami jest MUTACJĄ stanu encji (zmiana lifecycle/statusu) — `onDrop`/`onStatusChange` musi przejść tę samą bramkę capability co edycja formularzowa tego samego pola; deska nie jest „lżejszym” trybem edycji zwalniającym z autoryzacji. Karta na desce ujawnia też przypisanie osoby (owner) — patrz UI-CARD-01 §13.

## 14. Performance

Ruch karty MUSI być optimistic (karta znika ze starej kolumny i pojawia się w nowej natychmiast po drop, bez czekania na odpowiedź serwera) I musi mieć rollback — zweryfikowane w kodzie: `ExecutionInitiativesKanbanView.handleDragEnd` woła `onStatusChange(id, newStatus)` i NIE ma lokalnego try/catch ani stanu „pending przywrócenia" w tym pliku, więc rollback przy 409/403 zależy w 100% od implementacji `onStatusChange` przekazanej z zewnątrz — jeśli ten caller też nie robi rollbacku, odrzucony ruch serwera zostaje wizualnie zaakceptowany na desce (cichy błąd, dokładnie to czego zakazuje `COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`). `StandardKanban.tsx` samo w sobie jest jeszcze bardziej surowe: `onDrop` to gołe wywołanie propa bez żadnego stanu — CAŁA odpowiedzialność za optimistic/rollback leży poza fasadą.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenie specyficzne dla kanbanu: `kanban_move` niesie `fromColumnId`/`toColumnId`/`rejected: boolean` — bez tego trzeciego pola nie da się odróżnić realnej zmiany procesu od odrzuconego przez serwer ruchu, który UI pokazał jako udany (§14).

## 16. Miejsca użycia

`StandardKanban.tsx` (fasada kolumn) — brak realnego JSX-konsumenta w aplikacji poza własnym plikiem i styleguide. Realne boardy: `ExecutionInitiativesKanbanView.tsx` i `Portfolio/PortfolioKanbanView.tsx` — oba własny dnd-kit, oba różne od fasady i od siebie nawzajem.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie, TRZY równoległe implementacje kanbanu jednocześnie: (1) `StandardKanban.tsx` — fasada SSOT wg rejestru, natywny HTML5 DnD, ZERO realnych konsumentów JSX; (2) `ExecutionInitiativesKanbanView.tsx` — bespoke `dnd-kit` board z `KeyboardSensor`, reużywa tylko `StandardKanbanCard` (nie fasadę kolumn); (3) `PortfolioKanbanView.tsx` — bespoke `dnd-kit` board z WŁASNĄ kartą, nie reużywa ani fasady, ani `StandardKanbanCard`. Do tego `RoadmapKanban.tsx` jako czwarty, jeszcze bardziej odległy wariant. Rejestr wskazuje fasadę jako SSOT, ale fasada jest tą implementacją z NAJSŁABSZĄ dostępnością (brak klawiatury) — migracja „w stronę SSOT" bez naprawy §11 byłaby regresją dla `ExecutionInitiativesKanbanView`.

## 18. Acceptance tests

Krytyczny test odrzucający (appendix: „optimistic move rollback przy 409/403"), rozwinięty: przenieś kartę drag&dropem między kolumnami, zamockuj odpowiedź serwera na 409 — karta MUSI wrócić do kolumny źródłowej z widocznym komunikatem błędu (nie cichym powrotem), a stan kolumn (`cards.length` w nagłówku) musi się zgadzać z powrotem. Drugi test: Tab do karty na desce → Space podnosi → strzałka w prawo → Space upuszcza w sąsiedniej kolumnie — bez myszy, zero użycia `onDragStart`/`onDrop` natywnego. Dziś (§11/§17) ten drugi test PRZECHODZI tylko w `ExecutionInitiativesKanbanView`, nie w fasadzie `StandardKanban`.

## 19. Evidence

Kandydat: Tasks/Decisions board candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

