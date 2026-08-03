---
component_id: UI-DECK-01
name: Presentation Deck
family: artifact
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
contract_version: 2.1
product_owner: Piotr Wisniewski
code_owner: Frontend Platform
canonical_docs:
  - docs/ui-standards/CANON.md
  - docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md
  - docs/ui-standards/02-components/PRIMITIVE_INTERACTION_CONTRACT.md
  - docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md
reference_implementations:
  - deck/presentation workspace
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-DECK-01 — Presentation Deck

## 1. Job to be done

Budować i prezentować narrację slajdową spójną z brandingiem Consultify.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `artifact`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

slide rail, canvas, toolbar, notes, properties, present/export. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

edit, presenter, review, export preview. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Deck niesie `outline` i `slides` jako DWA WIDOKI tego samego modelu danych, nie dwa osobne stany do synchronizacji ręcznej — edycja w outline (tekst, kolejność) i edycja na canvasie slajdu (layout, wykres, tabela) muszą czytać/pisać do wspólnego źródła, inaczej rozjadą się przy przełączeniu widoku. Każdy slajd niesie `layoutType` (dobierany wg typu treści — bullet/wykres/tabela/macierz, `deckLayoutDecision.ts`) i `theme` (jeden z 5 motywów klienckich `themeRegistry.ts` — executive/modern/corporate/classic/clean), niezależnie od których crimson nigdy nie wchodzi do palety motywu.

## 6. Akcje i zdarzenia

add, duplicate, reorder, edit, present, export, comment. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

empty, loaded, selected, editing, presenting, exporting, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

AI generuje propozycję slajdu lub całego outline z materiału źródłowego (transkrypt, inicjatywa, insight) — wynik trafia do outline jako draft ze wskazanym źródłem (provenance na poziomie slajdu, nie tylko całego decku), zatwierdzenie tworzy realne slajdy w aktywnym motywie. AI nie zmienia motywu ani brandingu samodzielnie — to decyzja właściciela dokumentu, poza zakresem generowania treści.

## 9. Nawigacja

Przełączenie outline↔slides zachowuje zaznaczony slajd (ten sam ID widoczny w obu widokach, nie reset do pierwszego). Presenter mode to osobny pełnoekranowy tryb z własną nawigacją klawiaturową (strzałki = następny/poprzedni slajd, Esc = wyjście z powrotem do trybu edycji na tym samym slajdzie, na którym prezentacja się zatrzymała) — to nie jest to samo Esc co w innych rodzinach, bo wychodzi z pełnego ekranu, nie z panelu.

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a. Presenter mode nie ma odpowiednika 1024 compact — poniżej progu prezentacji pełnoekranowej deck oferuje wyłącznie tryb edycji ze slide rail zwiniętym do paska miniatur, bo prezentowanie klientowi na małym ekranie nie jest scenariuszem, który ten kontrakt wspiera.

## 11. Accessibility

Slide rail (lista miniatur) to lista nawigowalna strzałkami góra/dół, Enter otwiera slajd na canvasie — to nie jest to samo co nawigacja węzłów canvasu (UI-CANVAS-01), bo kolejność jest linearna i odpowiada kolejności prezentacji, nie strukturze grafu. Presenter mode ogłasza numer i tytuł bieżącego slajdu w live region przy każdej zmianie, dla czytnika śledzącego prezentację równolegle z materiałem. Eksport (PPTX/PDF) jest akcją z jawnym stanem `exporting` → „gotowe do pobrania”, nigdy cichym pobraniem pliku bez potwierdzenia w UI.

## 12. Visual tokens

Podstawa: §3a. Siatka slajdu (16:9, `BRAND_EXPORT_CANON.md` §5, `report/pptx/designTokens.ts` `GRID`/`SPACING`): margines 0.5" ze wszystkich stron, strefa tytułu do 0.8" wysokości, strefa treści 1.0"→5.2", stopka 5.2"→5.625", `contentX` 0.5", `contentW` 9.0" — layout dobiera `deckLayoutDecision.ts` wg typu treści, nigdy ręczne piksele w komponencie slajdu. Crimson jest dozwolony wyłącznie jako mikro-znak marki Consultify w stopce/metadanych eksportu (`BRAND_EXPORT_CANON.md` §3) — nigdy jako tło slajdu, fill tabeli ani seria wykresu; wykres wieloseryjny używa sekwencji `c-tag-1..12`, nie akcentu motywu.

## 13. Security i privacy

Podstawa: §3a. Eksport (PPTX/PDF) to jedyny artefakt tej rodziny, który klient trzyma poza aplikacją — metadane eksportowanego pliku niosą `creator=Consultify` bez nazwiska konsultanta ani innych danych osobowych (`BRAND_EXPORT_CANON.md` decyzja D5); dotyczy to specyficznie pliku opuszczającego system, nie dokumentu wewnątrz aplikacji.

## 14. Performance

Eksport PPTX/PDF ma bazowy test przepełnienia: długi tytuł i szeroka tabela nie mogą wyjść poza granice slajdu w wyeksportowanym pliku (siatka 16:9, marginesy 0.5", strefa treści 1.0"→5.2" z `BRAND_EXPORT_CANON.md` §5) — sprawdzane w samym pliku wynikowym, nie tylko w podglądzie na ekranie, bo silniki PPTX/PDF łamią tekst inaczej niż przeglądarka. Fonty Office-native (Aptos/Arial/Georgia, decyzja D1) nie wymagają embeddingu — render nie zależy od pobrania Google Fonts w tle eksportu.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `deck.export_start`, `deck.export_fail`, `deck.present_mode_enter`. Dodatkowo mierzymy odsetek eksportów kończących się `overflow` w pliku wynikowym per typ slajdu (wykres/tabela/bullet, §14) — jedyny sposób wykrycia regresji renderera PPTX/PDF, zanim zobaczy ją klient.

## 16. Miejsca użycia

deck/presentation workspace; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie: `src/components/Presentations/DeckBuilder/` istnieje z realną implementacją (m.in. `DeckBuilder.tsx`, `SlideSorter.tsx`, `PresentMode.tsx`, `CardCanvas.tsx`) — presenter mode i canvas slajdu mają konsumentów. `BRAND_EXPORT_CANON.md` §11 (2026-08-02) zamyka bramkę B-P5 dla brandingu/fontów/metadanych, ale test przepełnienia w realnym pliku PPTX/PDF (§14 tej karty) nie ma tu potwierdzonego dowodu w kodzie — to wymóg kontraktu, nie zweryfikowany runtime.

## 18. Acceptance tests

Krytyczny test odrzucający: długi tytuł i szeroka tabela nie wychodzą poza slajd w wyeksportowanym PPTX/PDF (§14) — sprawdzane w pliku, nie na ekranie. Dodatkowo: przełączenie outline↔slides zachowuje zaznaczenie; crimson nie pojawia się jako tło/fill/seria (tylko mikro-znak marki); presenter mode wchodzi/wychodzi klawiaturą bez utraty pozycji; metadane eksportu nie niosą danych osobowych (D5).

## 19. Evidence

Kandydat: brak zatwierdzonej referencji. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami).

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
