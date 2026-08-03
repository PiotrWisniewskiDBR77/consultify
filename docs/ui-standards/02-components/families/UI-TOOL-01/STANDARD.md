---
component_id: UI-TOOL-01
name: Tool Workspace
family: workspace
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
  - tool workspaces
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-TOOL-01 — Tool Workspace

## 1. Job to be done

Wykonać specjalistyczne zadanie w stabilnym shellu z narzędziami, właściwościami i wynikiem.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `workspace`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

identity, mode toolbar, work surface, optional left rail, right properties/context, status/save. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

generator, analyzer, editor, canvas, simulation. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Poza generycznym `id`/tenant/lifecycle, narzędzie niesie kontrakt DOKUMENTU: `documentType` (jednoznacznie identyfikuje, z jakim formatem pracujemy — mapa/przepływ/whiteboard/inny), `contentSchema` (wersjonowany kształt payloadu, bo eksport i konwersja muszą wiedzieć, co czytają), `dirty` (czy są niezapisane zmiany — warunek bramki w §9) i `lastSavedAt`. W przeciwieństwie do rekordu (UI-ART-01/archetyp C) payload nie jest zbiorem pól formularza, tylko jednym blobem/grafem, więc read-back po zapisie musi potwierdzić całą wersję dokumentu, nie pojedyncze pole.

## 6. Akcje i zdarzenia

configure, run, stop, inspect, edit, save, export, convert. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

initial, configured, running, streaming, result, partial, cancelled, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

AI działa jako alternatywny generator treści narzędzia (np. wygeneruj wstępną mapę z transkryptu) — zakres to CAŁY dokument narzędzia, nie jego fragment (zakres fragmentowy jest właściwością Canvasu, patrz UI-CANVAS-01 §8). Wynik trafia jako nowa wersja robocza z widocznym diffem względem ostatniego zapisu; zatwierdzenie zamienia `dirty`-draft w zapisany dokument, odrzucenie wraca do ostatniej zapisanej wersji bez śladu w historii. Manualna edycja pozostaje możliwa w dowolnym momencie tego cyklu.

## 9. Nawigacja

Wyjście z narzędzia przy `dirty=true` zatrzymuje nawigację modalem z trzema opcjami: zapisz i wyjdź / odrzuć zmiany / zostań — to właściwość specyficzna dla tej rodziny. Reload odtwarza dokument z ostatniego zapisanego stanu, nie z lokalnego cache przeglądarki — jeśli lokalny draft istnieje, narzędzie musi o tym jawnie poinformować przy powrocie, nie ciszej go stracić ani ciszej przywrócić.

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Przy 1024 compact toolbar narzędzia zwija się do pojedynczego menu przepełnienia, ale akcja zapisu zostaje zawsze widoczna — to jedyna akcja, której to narzędzie nie chowa nigdy.

## 11. Accessibility

Toolbar trybu (mode toolbar z §3) jest `role="toolbar"` z `aria-orientation` i strzałkami do nawigacji między przyciskami (nie Tab per przycisk — Tab wchodzi/wychodzi z toolbara jako jedna zatrzymka, zgodnie z APG toolbar pattern). Work surface ogłasza zmianę trybu (generator → analyzer → editor) w live region, bo zmiana trybu bywa niewidoczna wizualnie dla czytnika ekranu, choć zmienia dostępny zestaw akcji. Save state (`Zapisywanie…/Zapisano/Błąd zapisu`) jest ogłaszany `aria-live="polite"`, nigdy tylko kolorem ikony.

## 12. Visual tokens

Podstawa: §3a. Ikony trybu narzędzia (generator/analyzer/editor/canvas/simulation) pochodzą z Lucide i są jednoznacznie przypisane per wariant — narzędzie nie wymyśla własnej ikonografii trybu, bo to jedyny wizualny sygnał, w którym trybie pracuje użytkownik, zanim przeczyta etykietę.

## 13. Security i privacy

Podstawa: §3a. Dokument narzędzia (§5) może zawierać treść klienta — eksport (§6) wynosi tę treść poza aplikację, więc dostępność formatów eksportu respektuje capability typu docelowego: narzędzie nie oferuje konwersji do formatu, do którego użytkownik nie ma uprawnień zapisu, zamiast oferować i odrzucać dopiero po próbie.

## 14. Performance

Autosave narzędzia debounce’uje na edycji treści (nie na każdym keystroke) i pokazuje `Saving/Saved/Failed`; konflikt wersji (dwie karty tego samego dokumentu otwarte równolegle) nigdy nie nadpisuje po cichu — oferuje porównanie lub zachowanie kopii. To odróżnia narzędzie od Canvasu: tu jednostką konfliktu jest CAŁY dokument, nie pojedynczy węzeł.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `tool.save`, `tool.export`, `tool.convert`, `tool.dirty_exit_blocked`. `tool.save` niesie dodatkowo `documentType` i rozmiar payloadu w bajtach (nigdy treść) — jedyny sposób odróżnienia w telemetrii, które typy narzędzi realnie ryzykują utratę danych przy dużych dokumentach.

## 16. Miejsca użycia

tool workspaces; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie: `src/components/MyWork/IdeaProcessFlowTool.tsx` istnieje i jest realnym konsumentem; `src/components/MyWork/mindmap/` i `src/components/MyWork/whiteboard/` również, ale każde z trzech miejsc implementuje własny zapis/dirty-tracking niezależnie — nie ma wspólnego `UI-TOOL-01` jako importowanego komponentu, tylko wspólny wzorzec opisany w tej karcie i podpięty faktycznie w każdym miejscu osobno. To jest realny fork trzech implementacji, nie jedna referencja z wariantami.

## 18. Acceptance tests

Krytyczny test odrzucający: zamknięcie karty przeglądarki z niezapisanymi zmianami (`dirty=true`) wywołuje natywne ostrzeżenie przeglądarki lub modal zapisu przed nawigacją wewnętrzną — zero cichej utraty. Dodatkowo: reload po nieudanym zapisie pokazuje ostatnią zapisaną wersję z jawną informacją „nie zapisano ostatnich zmian”, nie fałszywie świeży stan; eksport/konwersja do innego typu zachowuje `source` (provenance) w metadanych nowego obiektu.

## 19. Evidence

Kandydat: Notebook/Ideas/Agent screenshots = audit evidence. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
