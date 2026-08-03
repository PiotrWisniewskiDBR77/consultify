---
component_id: UI-CANVAS-01
name: Flexible Canvas
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
  - Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md
reference_implementations:
  - canvas/editor shell
known_consumers:
  - Consultify MVP modules
last_runtime_audit: 2026-08-02
---

# UI-CANVAS-01 — Flexible Canvas

## 1. Job to be done

Manipulować przestrzenną strukturą obiektów przy pełnej kontroli zoomu, zaznaczenia i klawiatury.

## 2. Kiedy używać / kiedy nie używać

Używaj, gdy problem odpowiada rodzinie `workspace`. Nie używaj jako lokalnego zamiennika podobnego komponentu ani do obejścia capability, nawigacji lub stanu danych. Granica domenowa nie uzasadnia nowego shellu.

## 3. Anatomia

viewport, nodes/objects, connectors, left tools, context toolbar, minimap, zoom, properties. Kolejność regionów jest stabilna; opcjonalny region znika bez pozostawienia pustej ramy.

## 4. Warianty

whiteboard, diagram, mind map base. Wariant zmienia semantykę lub gęstość, nie tworzy wyglądu nazwanego modułem. Light/dark korzystają z tego samego DOM.

## 5. Dane i kontrakt

Canvas niesie graf: kolekcję `nodes` (id, pozycja x/y, typ, dane) i `edges` (id, source, target, typ połączenia) plus `viewport` (zoom, pan offset) jako stan UI, nie jako dana domenowa do zapisu przy każdym ruchu myszą — zapis pozycji jest debounce’owany, zapis treści węzła jest natychmiastowy po zatwierdzeniu edycji. Powyżej progu 500 węzłów / 750 krawędzi (`COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`, wpisane też do `ARTIFACT_ANATOMY_STANDARD.md` §13.3b) kontrakt danych musi dodatkowo nieść `viewportBounds`, żeby wirtualizacja renderu (§14) wiedziała, które węzły są poza ekranem, bez przeliczania całego grafu przy każdej klatce.

## 6. Akcje i zdarzenia

select, pan, zoom, create, connect, group, align, duplicate, delete. Każda akcja ma action ID, etykietę PL/EN, ikonę, capability, precondition, pending, success/error, telemetry i confirm albo undo adekwatnie do skutku.

## 7. Stany

empty, loaded, selected, multi-selected, editing, dragging, connecting, saving, error. Ponadto: loading, partial, stale, read-only, no-access, archived i degraded tam, gdzie mają sens. Każdy stan wyjaśnia sytuację i następny krok.

## 8. AI / Teresa

Zakres AI na canvasie jest trójstopniowy i musi być nazwany w UI przed uruchomieniem (`ARTIFACT_ANATOMY_STANDARD.md` §13.3a): węzeł zaznaczony / gałąź (węzeł + potomkowie) / cały canvas. Brak zaznaczenia oznacza zakres domyślny jawnie napisany w chipie, nigdy domyślany po cichu. Wynik to warstwa węzłów „do zatwierdzenia” (wizualnie odróżnialna obrysem/badge), z approve/reject per węzeł i zbiorczo; cofnięcie całej operacji AI to jedno Cmd+Z, nie N osobnych. Przerwanie streamu (Stop) zostawia graf dokładnie w stanie sprzed operacji — żaden częściowo wygenerowany węzeł nie zostaje na płótnie bez akceptacji.

## 9. Nawigacja

Canvas ma własną nawigację wewnętrzną między węzłami — klawiaturowo (§11) i przez minimapę (klik = pan do obszaru). Fit-to-view jest akcją, nie stanem początkowym: przy wejściu canvas otwiera się na ostatnio zapisanym viewport, a fit-to-view to jawny przycisk, gdy użytkownik się zgubi. Esc na canvasie ma dwa poziomy: pierwszy Esc wychodzi z trybu edycji/łączenia węzła (zostaje na canvasie), drugi Esc dopiero opuszcza płótno do rail/panelu — zgodnie z regułą „najbardziej lokalna warstwa wygrywa” (`ARTIFACT_ANATOMY_STANDARD.md` §12.4).

## 10. Responsive i zoom

Podstawa: `COMPONENT_DOCUMENTATION_CARD_STANDARD.md` §3a — w tej rodzinie ta sekcja jest najważniejsza, bo canvas jest pierwszym kandydatem do przegięcia zasady „nic nie znika" przy dużym zoomie. Przy 400% canvas może przewijać się w dwóch osiach, ale graf zbyt duży, by sensownie nawigować przestrzennie, MUSI mieć działający alternatywny widok list/detail (tabela węzłów z filtrem/szukajką, SPEC-L) — to nie jest opcja estetyczna, tylko wymóg z `ARTIFACT_ANATOMY_STANDARD.md` §13.3b.

## 11. Accessibility

Zaznaczenie działa trzema metodami: klik pojedynczy (zastępuje zaznaczenie), Shift/Cmd-klik (dodaje/przełącza), marquee (przeciągnięcie po pustym płótnie zaznacza wszystko w prostokącie). Menu kontekstowe jest DWA różne: PPM na obiekcie (edytuj/duplikuj/usuń/połącz) i PPM na pustym płótnie (utwórz węzeł/wklej/wyrównaj widok) — nie ten sam zestaw dla obu.

Minimalny zestaw klawiaturowy (kontrakt docelowy, `ARTIFACT_ANATOMY_STANDARD.md` §13.3c), każde bez myszy:
1. Utworzenie węzła — skrót dedykowany lub Enter na zaznaczonym węźle tworzy sąsiada.
2. Nawigacja między węzłami — strzałki/Tab po strukturze grafu, nie po przypadkowej kolejności DOM.
3. Przesunięcie węzła — strzałki + modyfikator (np. Shift+strzałki).
4. Połączenie węzłów — skrót wchodzi w tryb połącz, strzałki/Tab wybierają cel, Enter zatwierdza.
5. Usunięcie — Delete/Backspace na zaznaczonym węźle/krawędzi, z potwierdzeniem gdy węzeł ma dzieci.
6. Wyjście z canvasu — Esc zwraca fokus poza płótno (rail/panel/back).

**Status: świadoma luka runtime, nie przypis (CANON §3.2).** Dopóki powyższy zestaw nie jest wdrożony i zweryfikowany klawiaturą (bez myszy, oba motywy) na danym canvasie, ten canvas NIE MOŻE otrzymać `runtime_status` wyższego niż `PARTIAL` i nie przechodzi §18 tej karty niezależnie od pozostałych punktów.

## 12. Visual tokens

Podstawa: §3a. Warstwa canvasu/lokalnej treści renderuje się na `z-index: 10` (`FOUNDATION_TOKEN_CONTRACT.md` §8, token „canvas/local content") — poniżej sticky/app chrome (20) i wszystkich portali (dropdown/overlay/modal/toast), więc żaden element canvasu nie może przykryć chrome aplikacji. Kolor krawędzi/połączenia niesie WYŁĄCZNIE typ relacji (paleta `c.tag-*`), nigdy stan zaznaczenia — zaznaczenie sygnalizuje grubość obrysu i `state-selected`, nie zmianę koloru linii, żeby dwa niezależne sygnały się nie zlewały.

## 13. Security i privacy

Podstawa: §3a. Eksport grafu (PowerPoint/kod diagramu) respektuje capability na poziomie CAŁEGO dokumentu, nie pojedynczego węzła — nie ma częściowego eksportu węzłów spoza capability użytkownika, bo canvas nie renderuje takich węzłów w ogóle.

## 14. Performance

Twardy próg (`COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`, powielony w `ARTIFACT_ANATOMY_STANDARD.md` §13.3b): ≤500 węzłów / ≤750 krawędzi, pan/zoom bez zadań renderu >50 ms na laptopie referencyjnym. Powyżej progu musi zadziałać przynajmniej jedno z: (1) ostrzeżenie + świadoma degradacja — baner „Duży graf, nawigacja może zwolnić” i automatyczne wyłączenie cieni węzłów/animacji krawędzi/live minimapy; (2) wirtualizacja — renderuj tylko węzły w viewport + bufor, reszta poza DOM, preferowane tam, gdzie przekroczenie jest regularne (np. Discovery Tool na dużych projektach). Powyżej progu, gdy nawigacja przestrzenna przestaje być użyteczna, alternatywny widok list/detail (§10) przestaje być opcją, staje się obowiązkiem.

## 15. Telemetry

Podstawa: §3a. Zdarzenia: `canvas.node_create`, `canvas.edge_create`, `canvas.zoom`, `canvas.fit`, `canvas.minimap_toggle`, każde ze znacznikiem, czy wywołane klawiaturą czy myszą — udział operacji klawiaturowych jest bezpośrednią miarą luki opisanej w §11 (zestaw klawiaturowy). Dodatkowo mierzymy liczbę węzłów/krawędzi przy przekroczeniu progu 500/750 (§14) i czy zadziałała degradacja czy wirtualizacja — jedyny sposób odróżnienia w danych, który mechanizm realnie chroni użytkowników w produkcji.

## 16. Miejsca użycia

canvas/editor shell; wszystkie moduły MVP korzystające z tej rodziny. Różnica domenowa jest schema/slotem, nie forkiem komponentu.

## 17. Known gaps i duplikaty

`runtime_status: PARTIAL`. Zweryfikowane w kodzie: `src/components/MyWork/mindmap/`, `src/components/MyWork/whiteboard/` i `src/utils/canvas/` istnieją jako realni konsumenci (Mind Map, Whiteboard). Trzy realne dziury, które do 2026-08-02 nie były zamknięte żadnym dokumentem, mają teraz SSOT w `ARTIFACT_ANATOMY_STANDARD.md`: klawiatura (§13.3c — była „przewidziana teraz, wdrożona później” bez terminu; teraz jest bramką: brak = `runtime_status` nie wyższy niż `PARTIAL`), próg wydajności 500/750/50 ms (§13.3b — istniał wcześniej wyłącznie w `COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`, nie w kanonie anatomii) i zakres AI węzeł/gałąź/canvas (§13.3a — obiecany w `UI_UX_IMPLEMENTATION_STANDARD.md` §7.4, ale SSOT anatomii o tym milczał). Ta karta jest zsynchronizowana z tymi trzema sekcjami; nie tworzy czwartego, konkurencyjnego modelu.

## 18. Acceptance tests

Krytyczny test odrzucający: utworzenie, nawigacja, przesunięcie, połączenie i usunięcie węzła — każde bez myszy, w obu motywach (§11/§13.3c) — plus test 500 węzłów/750 krawędzi bez zadań renderu >50 ms (§14). Dodatkowo: zakres akcji AI nazwany przed uruchomieniem i policzalny (§8); przerwanie streamu AI nie zostawia śladu na płótnie; graf większy niż sensowna nawigacja przestrzenna ma działający alternatywny widok list/detail (§10); wyjście z niezapisanym stanem chronione modalem.

## 19. Evidence

Kandydat: Ideas screenshots = audit evidence. Obowiązkowe ID i pakiet przypadków definiuje `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`. Screenshot bez wpisu PASS pozostaje `AUDIT_EVIDENCE`.

## 20. Change log

2026-08-02 — K-38: sekcje 10/12/13/15 odchudzone; wspólna podstawa w COMPONENT_DOCUMENTATION_CARD_STANDARD.md §3a, w karcie została wyłącznie treść specyficzna.

2026-08-02 — kontrakt 2.1: treść sekcji zróżnicowana per rodzina (wersja 2.0 współdzieliła 12 z 20 sekcji z pozostałymi kartami). Zsynchronizowano z `ARTIFACT_ANATOMY_STANDARD.md` §13.3a/§13.3b/§13.3c (zakres AI, próg wydajności, klawiatura jako świadoma luka runtime z bramką).

2026-08-02 — kontrakt 2.0; pełna metryka, 20 sekcji, normatywne tokeny, primitive behavior, UX flows i evidence gate. Spec zatwierdzona; runtime nie jest jeszcze kanoniczny.
