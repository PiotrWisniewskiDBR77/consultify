---
component_id: UI-IDEA-01
name: Idea Diagram Canvas
family: domain-workspace
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
  - Ideas tools
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-IDEA-01 — Idea Diagram Canvas

## 1. Job to be done

Rozwinąć pomysł przez mapę, przepływ, tabelę lub whiteboard i skonwertować wynik.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `domain-workspace`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

artifact identity, canvas/table, branches/objects, tools, properties, context, AI, completeness. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

table, process flow, mind map, whiteboard. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Poza generycznym kontraktem idea niesie `stage` (etap cyklu życia: nowa/w rozwoju/gotowa do konwersji/skonwertowana), `toolType` (którym narzędziem jest rozwijana — tabela/przepływ/mapa/whiteboard, patrz UI-TOOL-01/UI-CANVAS-01) i `completeness` (wyliczony wskaźnik gotowości, nie ręcznie ustawiany status) — kompletność steruje tym, czy akcja konwersji jest w ogóle dostępna (precondition, nie tylko capability). Po konwersji idea niesie `convertedTo` (typ i ID powstałego obiektu) jako trwały backlink, widoczny w preview bez otwierania inicjatywy.

## 6. Akcje i zdarzenia

add/edit/connect/collapse/group/filter/convert. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

new, incomplete, populated, selected, editing, saving, ready-to-convert, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

AI proponuje NASTĘPNY KROK cyklu życia (np. „ta idea wygląda na gotową do konwersji” albo „brakuje właściciela”) na podstawie `completeness`, nie generuje treści narzędzia pod spodem (to robi UI-TOOL-01/UI-CANVAS-01 osadzone wewnątrz). Propozycja konwersji z AI przechodzi przez TĘ SAMĄ akcję `idea.workspace.convert` co konwersja manualna — AI nie ma bocznej ścieżki tworzenia inicjatywy z pominięciem tego samego kontraktu (patrz §17: idempotencja tej akcji nie jest dziś potwierdzona w kodzie).

## 9. Nawigacja

Po konwersji nawigacja oferuje wybór: zostań przy idei (z widocznym backlinkiem) albo przejdź do nowo utworzonego obiektu — nigdy automatyczne przekierowanie bez pytania, bo backlink musi zostać sprawdzalny z obu stron. Powrót z widoku inicjatywy do listy idei zachowuje filtr etapu (`stage`), jeśli był ustawiony — lista idei filtruje domyślnie po etapie, nie po statusie generycznym, co jest specyficzne dla tej rodziny.

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Panel kompletności (§5) pozostaje widoczny przy 1024 compact jako pasek pod tytułem, nie chowa się do kebaba — to jedyny wskaźnik tej rodziny, którego zwinięcie ukrywałoby powód, dla którego akcja konwersji jest zablokowana.

## 11. Accessibility

Wskaźnik `completeness` (§5) jest ogłaszany tekstowo („Kompletność: 60%, brakuje: właściciel, źródło”), nie tylko paskiem postępu — pasek bez tekstu przekazuje ILE brakuje, nie CO brakuje. Akcja konwersji, gdy zablokowana precondition, ma `aria-disabled` z opisem powodu w `aria-describedby`, nie samo wyszarzenie. Backlink po konwersji jest osiągalny klawiaturowo w pierwszej kolejności fokusa panelu, nie na końcu listy metadanych, bo to najważniejsza informacja po konwersji.

## 12. Visual tokens

Podstawa: §3a. Pasek/wskaźnik `completeness` używa wyłącznie `c-success`/`c-warning`/neutralnego tokenu wg progu procentowego — nigdy crimson, mimo że idea bywa „najważniejszym” obiektem na liście; ważność nie jest semantyką krytyczną.

## 13. Security i privacy

Podstawa: §3a. Idea może cytować treść z sejfu klienta (np. fragment transkryptu jako źródło pomysłu); konwersja (§6/§8) przenosi tę treść do innego obiektu (inicjatywy), który ma WŁASNY, niezależny zestaw uprawnień — dostęp do idei nie gwarantuje dostępu do powstałego z niej obiektu i odwrotnie. Backlink po konwersji (§5/§9) jest widoczny wyłącznie dla użytkowników z capability do obiektu docelowego — jeśli inicjatywa powstała, ale użytkownik stracił do niej dostęp, backlink nie ujawnia jej nazwy, tylko fakt istnienia powiązania.

## 14. Performance

Konwersja (`idea.workspace.convert`) jest operacją zapisu z potencjalnym skutkiem trwałym (nowa inicjatywa) — musi mieć stan `pending` blokujący DRUGIE kliknięcie tego samego przycisku, zanim pierwsze zdąży wrócić z serwera (ochrona przed podwójnym utworzeniem przy wolnym połączeniu; patrz §17 — dziś niezweryfikowana w kodzie). Lista idei z dużą liczbą wierszy wirtualizuje się jak każda tabela (UI-TABLE-01), ale pasek kompletności per wiersz musi przeliczać się z danych już pobranych, nie osobnym zapytaniem per wiersz.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `idea.convert_start`, `idea.convert_success`, `idea.convert_duplicate_blocked`. `convert_duplicate_blocked` mierzy skuteczność idempotencji akcji `idea.workspace.convert` (§6, §17) — więcej niż jedno udane `convert_success` na tę samą ideę jest sygnałem regresji, nie normalnym zachowaniem.

## 16. Miejsca użycia

Ideas tools; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie: `src/components/standard/IdeaRightPanel.tsx` i `src/actions/ideaActionRegistry.ts` (akcja `idea.workspace.convert`, wołająca `Api.convertMyIdea`) istnieją i są realnym konsumentem. NIE zweryfikowano w kodzie żadnego mechanizmu idempotency-key ani blokady podwójnego kliknięcia wokół tego wywołania — kontrakt §5/§6 („konwersja idempotentna”) jest wymaganiem tej karty, nie potwierdzonym stanem runtime. Dopóki nie ma dowodu w kodzie (idempotency key + pending-lock), krytyczny test §18 tej karty jest testem odrzucającym domyślnie, nie formalnością.

## 18. Acceptance tests

Krytyczny test odrzucający: podwójne kliknięcie konwersji (albo dwa równoległe wywołania) tworzy DOKŁADNIE jedną inicjatywę, z zachowanym `source`/backlinkiem do idei. Dodatkowo: `completeness` blokuje konwersję z czytelnym powodem, gdy poniżej progu; backlink po konwersji jest widoczny w preview idei bez otwierania inicjatywy; zmiana `toolType` nie gubi dotychczasowej treści narzędzia.

## 19. Evidence

Kandydat: Ideas screenshots = audit evidence. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
