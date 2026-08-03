---
component_id: UI-REL-01
name: Relations Attachments Sources
family: composed
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
  - shared relations sections
  - src/components/shared/PreviewPane/PreviewRelations.tsx (kandydat warstwy prezentacji — 20 konsumentów import / 21 JSX / 22 wzmianka, 2026-08-02; NIE wymusza kontraktu danych `type`/`source`/`target`/`provenance` z §5, patrz §17)
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-REL-01 — Relations Attachments Sources

## 1. Job to be done

Rozumieć provenance i bezpiecznie łączyć dokumenty, rekordy i dowody.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `composed`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

section header/count, grouped list, item identity/type/access, add/search, preview. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

relations, attachments, sources, evidence, backlinks. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Relacja to typowana krawędź: `type` (np. relates_to/blocks/derived_from), `source` i `target` (id + typ obiektu), `provenance` (manual/AI + kto/kiedy utworzył) i opcjonalny `label`. Relacja jest osobnym obiektem od dwóch obiektów, które łączy — usunięcie relacji nigdy nie kasuje danych po żadnej stronie. Target, do którego użytkownik nie ma dostępu, nie jest zwracany w payloadzie z nazwą — tylko jako `restricted: true`.

## 6. Akcje i zdarzenia

add, remove, open, preview, download, copy link. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

empty, loading, populated, indexing, broken, no-access, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Sugestię relacji od Teresy (np. „połącz ten insight z tą inicjatywą") traktujemy jak każdą inną propozycję AI: wymaga approve/reject, nie tworzy się cicho. Po zatwierdzeniu utworzona relacja ma `provenance.source = AI` i identyfikator uruchomienia, dzięki czemu w widoku relacji da się odróżnić krawędzie dodane przez Teresę od dodanych ręcznie — bez tego odróżnienia audyt provenance z §13 byłby niepełny.

## 9. Nawigacja

„Otwórz" z listy relacji nawiguje do docelowego obiektu z opcją powrotu do obiektu źródłowego; „podgląd" trzyma obiekt źródłowy w widoku i pokazuje cel w panelu bocznym bez zmiany trasy. Usunięta lub niedostępna relacja znika z listy bez błędu nawigacyjnego przy próbie jej otwarcia z historii/deep linku.

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Grupowana lista relacji na 1024 compact zwija grupy z licznikiem zamiast renderować wszystkie naraz.

## 11. Accessibility

Nagłówek sekcji ma w accessible name liczbę pozycji (np. „Powiązania (4)"). Każda pozycja ma osiągalny klawiaturą przycisk usunięcia z potwierdzeniem, nie tylko ikonę „×" bez etykiety. Stan `broken`/`no-access` pozycji jest ogłaszany tekstowo, nie tylko wizualnym wyszarzeniem.

## 12. Visual tokens

Podstawa: §3a. Typ krawędzi ma ikonę + etykietę tekstową — nigdy sam kolor jako jedyny nośnik znaczenia typu relacji.

## 13. Security i privacy

Podstawa: §3a. Relacja może wskazywać obiekt, do którego użytkownik nie ma dostępu — ukryty cel nie ujawnia ani nazwy, ani samego faktu istnienia relacji do niego na liście. Usunięcie relacji jest jawnie opisane jako usunięcie POWIĄZANIA, nie usunięcie obiektu docelowego — komunikat/confirm musi to nazwać wprost, żeby nie sugerować kasowania danych.

## 14. Performance

Anulowanie stale requests, stabilne skeletony, debounce tylko dla search, cache z invalidacją i wirtualizacja adekwatna do danych. Focus i selection nie mogą ginąć podczas wirtualizacji. Spinner >10 s wymaga recovery. Lista relacji/załączników powyżej progu widocznych rekordów (zgodnie z progiem 1k+ z `COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`) wirtualizuje się bez gubienia stanu `broken`/`indexing` pojedynczych pozycji.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `rel.create`, `rel.remove`, `rel.navigate`. Dodatkowo liczymy `hidden_target_count` — ile pozycji na liście było niewidocznych z powodu braku dostępu, jako wskaźnik „ile relacji prowadzi do niedostępnych celów" i sygnał do przeglądu uprawnień, bez ujawniania których.

## 16. Miejsca użycia

shared relations sections; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Poprzednia wersja tej karty twierdziła: „rejestr wskazuje »relation/context panels in `src/components/shared/NModeLayout/`«, ale w tym katalogu nie znaleziono pliku z nazwą wskazującą na dedykowany komponent relacji (`find` → zero trafień)" — to był błąd metody: `find`/`grep` ograniczony do `NModeLayout/` jest ZA WĄSKI, dokładnie ten sam błąd, przed którym ostrzega ta karta gdzie indziej („audytuj cały `src/`, nie jeden katalog"). Rozszerzenie poszukiwań poza `NModeLayout/` znajduje natychmiast realny kandydat: `src/components/shared/PreviewPane/PreviewRelations.tsx` (185 linii). Komponent renderuje grupowaną listę chipów relacji (`RelationItem`: `id`, `label`, `icon`, `tone`, `onClick`, opcjonalny `preview` z hover-mini-preview 300ms, `type` do grupowania) zgodnie z anatomią §3 (nagłówek/licznik, grupowana lista, identity/typ, dodaj/szukaj poza zakresem tego pliku, preview). Adopcja zweryfikowana 2026-08-02: import (`grep -rln "import.*PreviewRelations" src/`, liczone z importami wieloliniowymi) — **20 konsumentów**; JSX (`grep -rln "<PreviewRelations" src/`) — **21**; wzmianka (`grep -rln "PreviewRelations" src/`) — **22**. Konsumenci obejmują `DiscoveryTools/`, `Economics/`, `Initiatives/`, `Interview/` (4 pliki), `MyWork/` (4 pliki), `Results/` (5 plików) i powłokę `standard/ArtifactRightPanel.tsx`+`standard/StandardPreview.tsx` — to jest realny, szeroko przyjęty kandydat na implementację referencyjną tej rodziny. Zastrzeżenie: `PreviewRelations` renderuje LISTĘ chipów z lekkim, nietypowanym kształtem (`RelationItem` nie ma pól `source`/`target`/`provenance` z kontraktu §5) — normalizację do typowanej krawędzi `type`/`source`/`target`/`provenance` musi dziś wykonać każdy konsument osobno przed przekazaniem `items`; sam komponent nie wymusza tego kontraktu. To czyni go dobrym kandydatem na warstwę PREZENTACJI tej rodziny, nie na pełną referencyjną implementację danych z §5 — różnica do odnotowania przy ewentualnej promocji do `reference_implementations`.

## 18. Acceptance tests

Light/dark; PL/EN; 1280/1440/1920; 125%/200%; keyboard; VoiceOver/NVDA smoke; target size; contrast; reduced motion; long/empty/error/no-access; slow/timeout/retry/conflict; visual regression oraz krytyczny E2E. Dodatkowo: usunięcie relacji do obiektu bez uprawnień kończy się sukcesem bez ujawnienia nazwy obiektu, a próba otwarcia takiego targetu nie pokazuje ani nazwy, ani 404 różnego od zwykłego braku dostępu.

## 19. Evidence

Kandydat: Tasks/Decisions relations candidate. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — korekta po panelu adwersaryjnym: §17 twierdziło, że `find` w `NModeLayout/` po pliku relacji dał zero trafień i zostawiało to jako otwartą lukę — błąd był w zawężeniu poszukiwań do jednego katalogu. Rozszerzone poza `NModeLayout/`: `src/components/shared/PreviewPane/PreviewRelations.tsx` znaleziony i zweryfikowany jako realny kandydat (20/21/22 konsumentów wg metody, 2026-08-02), dodany do `reference_implementations` z zastrzeżeniem, że nie wymusza typowanego kontraktu krawędzi z §5.

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

