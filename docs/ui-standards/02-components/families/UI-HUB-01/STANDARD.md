---
component_id: UI-HUB-01
name: Module Hub
family: shell
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
  - ModuleHub; ModuleMenu3
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-HUB-01 — Module Hub

## 1. Job to be done

Wejść do funkcji modułu, zmienić widok i uruchomić główną akcję.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `shell`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

Menu 2 48, tabs/breadcrumb, Menu 3 44, view/filter slots, primary CTA, work area. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

list, board, calendar, dashboard. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Wymagany kontrakt: dokładnie JEDEN Menu 3 aktywny naraz z trzema wymiennymi trybami w tym samym pasku — filtry z licznikami, pasek bulk, karty otwartych pozycji (`TRIADA_KANON.md` §A3) — nigdy dwa command row jednocześnie. Zakładka (`tab`) niesie własny `capability`; hub filtruje zakładki bez uprawnień z listy tabs, nie disable'uje ich. Stan zakładki i filtry Menu 3 są rekonstruowalne z URL/query, nie tylko z pamięci komponentu.

## 6. Akcje i zdarzenia

switch tab/view, search, filter, create, reset. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

loading, loaded, empty-first, empty-filtered, error, locked, no-access. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Przyciski AI hubu mieszkają WYŁĄCZNIE po prawej stronie Menu 3 (`TRIADA_KANON.md` §A3, np. „✦ AI Priorities") i działają na WIDOCZNY, przefiltrowany zestaw rekordów bieżącej zakładki — nie na cały moduł w tle. Zmiana zakładki anuluje w toku będące generowanie AI zainicjowane z poprzedniej zakładki; nie ma cichego transferu kontekstu między zakładkami.

## 9. Nawigacja

Powrót do hubu (Back z obiektu lub z innego modułu) MUSI odtworzyć: aktywną zakładkę, tryb Menu 3 (filtry/bulk/otwarte karty), scroll tabeli i zaznaczenie — to jest bardziej szczegółowy kontrakt niż ogólny shell §9, bo hub ma WŁASNY, dodatkowy stan (zakładka), którego shell nie zna. Zmiana zakładki aktualizuje URL tak, by odświeżenie strony wylądowało w tej samej zakładce.

## 10. Responsive i zoom

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla huba: Menu 2 (48 px) i Menu 3 (44 px, realnie ≈48 px — dług doc↔kod, §12) nie zwijają się w hamburger poniżej 1280 px; chipy Menu 3 przechodzą na scroll poziomy zamiast znikać.

## 11. Accessibility

Zakładki huba implementują `tablist/tab/tabpanel` z roving tabindex (strzałki lewo/prawo przełączają, Tab wchodzi/wychodzi raz) — to bezpośrednio kontrakt `Tabs` z `PRIMITIVE_INTERACTION_CONTRACT.md` §2, nie ogólna klawiatura. Menu 3 w trybie bulk ogłasza liczbę zaznaczonych przez `aria-live="polite"` przy każdej zmianie zaznaczenia, żeby czytnik ekranu nie musiał re-czytać paska.

## 12. Visual tokens

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Wartości specyficzne dla huba: Menu 2 = 48 px, Menu 3 = 44 px (cel; realnie ≈48 px — dług doc↔kod otwarty, `FOUNDATION_TOKEN_CONTRACT.md` §4, `MENU_3_ROW_CLASS`), odstęp Menu 3 → nagłówek tabeli `mb-2` (`TRIADA_KANON.md` §C3).

## 13. Security i privacy

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Specyficzne dla huba: zakładka bez capability znika z listy tabs po stronie klienta, ale endpoint danych tej zakładki MUSI też odrzucić żądanie po stronie serwera — ukryta zakładka nie może zostać wywołana przez bezpośredni deep link z zapamiętanym query.

## 14. Performance

Przełączenie zakładki nie przeładowuje Menu 2 ani otwartych kart dokumentów (`useModuleOpenDocuments`) — tylko obszar roboczy zakładki. Debounce wyszukiwania w Menu 2 (250–350 ms) jest WSPÓLNY dla wszystkich zakładek huba, nie per-zakładka. Licznik przy chipie filtra Menu 3 (w tym „0") jest zawsze widoczny nawet podczas ładowania — nie znika i nie migocze przy każdym re-fetchu.

## 15. Telemetry

Obowiązuje wspólna podstawa `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Zdarzenia specyficzne dla huba: `tab_switch` (niesie poprzednią i nową zakładkę), `document_card_open` (Menu 3 tryb ③) — osobny event od `tab_switch`.

## 16. Miejsca użycia

ModuleHub; ModuleMenu3; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`, zweryfikowane 2026-08-02: `MyWorkHub.tsx` (4474 linii, największy konsument wzorca menu modułu w kodzie) NIE importuje `StandardModuleBar` — komponent jest wspominany tylko w komentarzach jako wzór klas/rozmiaru (`MyWorkHub.tsx:4402-4403`), realny pasek jest bespoke. Referencyjny `ModuleHub.tsx` też nie renderuje `StandardModuleBar` — używa własnego `ModuleNavBar` (`ModuleHub.tsx:11,149`). 11 innych hubów (Initiatives/Assessment/Results/Interview/Audits/Meeting/Execution/Finance/Benefits/Reports×2) faktycznie importują `StandardModuleBar` — to jest realna różnica adopcji między hubami, nie jednolity stan.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Krytyczny test odrzucający tej rodziny: brak drugiego command row jednocześnie z pierwszym (Menu 2 i Menu 3 nigdy nie nakładają się funkcjonalnie); zmiana zakładki → odświeżenie strony → ta sama zakładka i te same filtry Menu 3 są aktywne (stan odtworzony z URL, nie stracony).

## 19. Evidence

Kandydat: Tasks/Decisions hub candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa przeniesiona do COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji 5, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18 zróżnicowana per rodzina (poprzednia wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).
2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

