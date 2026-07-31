---
document_id: IDEAS-MIND-MAP-INTERACTION-VISUAL-STANDARD
module: My Work / Ideas / Mind Map
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
benchmark_reviewed: Miro, Xmind
---

# Mind Map — interakcje, menu i standard wizualny

## 1. Cel

Dokument definiuje dokładnie, jak Mind Map ma zachowywać się i wyglądać. Jest
kontraktem dla designu, implementacji i testów. Nie wolno podczas kodowania
zastępować opisanych zachowań przypadkowymi kontrolkami React Flow ani tworzyć
nowego systemu nawigacji tylko dla mapy.

Mind Map ma łączyć szybkość klasycznego narzędzia do map myśli z aktywną pomocą
Teresy, jakością konsultingową i standardem artefaktów Ideas.

## 2. Trzy równorzędne sposoby rozpoczęcia

### A. Ręczne porządkowanie myśli

Użytkownik wybiera `Blank mind map`, wpisuje temat centralny i sam rozwija
gałęzie. System nie narzuca struktury. Teresa pozostaje dostępna, ale nie dodaje
elementów bez polecenia.

Przepływ:

`New → Blank → central node → Tab/plus child → Enter sibling → arrange → save`

### B. Wygenerowanie całej mapy przez Teresę

Użytkownik opisuje temat, np. wejście z nowymi produktami na nowy rynek.
Teresa przed generacją pokazuje krótki brief:

- cel mapy;
- odbiorca;
- zakres i horyzont;
- źródła/kontekst;
- proponowane główne gałęzie;
- template/layout;
- assumptions i pytania otwarte.

Po akceptacji powstaje kompletna edytowalna propozycja. Użytkownik wybiera
`Keep`, `Edit brief`, `Regenerate variant` albo `Discard`. Mapa nie staje się
reviewed truth przez samą generację.

### C. Aktywne współprowadzenie od problemu

Użytkownik tworzy centralny node, otwiera Teresę w prawym panelu i opisuje
problem. Teresa utrzymuje `Map Working Brief`, proponuje następne gałęzie i
pytania w miarę pracy.

Możliwe ustawienia:

- `Suggest only` — sugestie w panelu, użytkownik dodaje je sam;
- `Preview on canvas` — ghost nodes i diff, użytkownik akceptuje;
- `Ask me questions` — Teresa prowadzi rozmowę, a zaakceptowane odpowiedzi
  mapuje na propozycje node'ów;
- `Pause guidance` — praca całkowicie ręczna bez utraty briefu.

Tryb aktywny jest zawsze widoczny. Teresa nie dodaje node'ów w tle.

## 3. Starter screen

Nowa Mind Map pokazuje trzy główne akcje:

1. `Start blank`;
2. `Generate with Teresa`;
3. `Choose a template`.

Niżej: `Transform existing artifact`, `Import outline/document` oraz ostatnio
używane template. Starter znika po utworzeniu pierwszego centralnego node'a,
ale jest dostępny ponownie przez `File → New artifact`.

## 4. Biblioteka 12 template

| ID | Template | Główne gałęzie startowe | Typowe użycie |
| --- | --- | --- | --- |
| MM-T01 | Blank radial map | brak | swobodne myślenie |
| MM-T02 | Brain dump organizer | thoughts, questions, facts, assumptions, next | oczyszczenie głowy |
| MM-T03 | Problem decomposition | symptoms, causes, evidence, stakeholders, constraints | zrozumienie problemu |
| MM-T04 | Root cause exploration | problem, cause families, tests, counterevidence | przygotowanie analizy przyczyn |
| MM-T05 | New market entry | market, customers, offer, competition, channels, capabilities, risks, economics | wejście na rynek |
| MM-T06 | Product or service concept | users, needs, value, features, experience, business model, risks | rozwój produktu |
| MM-T07 | Customer needs map | segments, jobs, pains, gains, evidence, opportunities | odkrywanie potrzeb |
| MM-T08 | Strategy exploration | ambition, choices, capabilities, initiatives, metrics, risks | dyskusja strategiczna |
| MM-T09 | Stakeholder landscape | groups, interests, influence, concerns, engagement | zarządzanie interesariuszami |
| MM-T10 | Risk landscape | strategic, operational, financial, people, technology, responses | identyfikacja ryzyk |
| MM-T11 | Project discovery | outcomes, scope, stakeholders, deliverables, dependencies, risks, questions | start projektu |
| MM-T12 | Interview/meeting synthesis | themes, evidence, tensions, insights, decisions, actions | synteza rozmowy |

Template zawiera strukturę, krótki opis pracy, przykładowe placeholdery i
sugerowane akcje Teresy. Nie zawiera fikcyjnych faktów organizacji. Użytkownik
może usunąć każdą gałąź i zapisać własny template, ale katalog globalny pozostaje
mały i kuratorowany.

## 5. Model mapy

### Node

- stable ID, parent ID i order;
- title oraz opcjonalna note/description;
- type, status, tags i icon;
- author/provenance/confidence;
- source/evidence refs;
- comments i relations;
- collapse state;
- position/layout metadata;
- AI proposal state;
- downstream relation.

### Edge

Drzewo parent-child jest relacją podstawową. Dodatkowy cross-link ma jawny typ:
`related`, `supports`, `contradicts`, `depends on`, `blocks` albo własną etykietę.
Cross-link nie zmienia parenta.

### Branch

Branch dziedziczy bazowy kolor i może posiadać label, owner, status oraz source
coverage. Zmiana koloru gałęzi nie zmienia semantyki.

## 6. Tryby kursora

- `Select` (`V`) — zaznaczanie i bezpośrednia manipulacja;
- `Hand` (`H` albo Space podczas drag) — przesuwanie viewportu;
- `Connect` (`L`) — dodatkowe cross-linki;
- `Comment` (`C`) — komentarz zakotwiczony do node/obszaru;
- `Text edit` — tylko po Enter/double click;
- `Present` — bez edycji, nawigacja po scenes/branches.

Aktywny tryb jest widoczny w toolbarze i kursorze. Escape zawsze wraca o jeden
poziom: text edit → node selection → clear selection → Select mode.

## 7. Nawigacja myszą i touchpadem

| Gest | Zachowanie |
| --- | --- |
| click node | zaznacz node |
| double click node | edycja tekstu |
| click canvas | usuń zaznaczenie |
| drag canvas/Space+drag | pan |
| wheel | vertical pan; zgodnie z systemem |
| trackpad pinch / Ctrl/Cmd+wheel | zoom względem kursora |
| drag node | przesuń gałąź; pokazuj preview targetu |
| drag node na target parent | reparent po drop, z undo |
| modifier+drag node | free position bez reparent; modifier pokazany w tooltipie |
| drag selection rectangle | multi-select |
| drag z handle `+` | utwórz dziecko lub cross-link zależnie od trybu |
| hover collapsed branch | liczba ukrytych node'ów/comments |

Reparent nigdy nie może wydarzyć się bez wyraźnego podświetlenia nowego parenta
i preview linii. Drop w neutralnym obszarze oznacza jedynie manual position.

## 8. Klawiatura

| Skrót | Akcja |
| --- | --- |
| `Tab` | dodaj child i rozpocznij edycję |
| `Enter` | dodaj sibling po aktywnym node |
| `Shift+Enter` | nowa linia w node podczas edycji |
| `Shift+Tab` | promote/outdent z preview; tylko jeśli poprawne |
| `Arrow keys` | przejdź przestrzennie do najbliższego node'a |
| `Cmd/Ctrl+Arrow` | opcjonalnie przejdź parent/child/sibling według platform policy |
| `F2` lub `Enter` na zaznaczeniu | edytuj node |
| `Esc` | zakończ bieżący tryb |
| `Delete/Backspace` | delete preview dla node'a z dziećmi; zwykłe delete dla leaf |
| `Cmd/Ctrl+D` | duplicate branch |
| `Cmd/Ctrl+C/V` | copy/paste z lineage w obrębie aplikacji |
| `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z` | undo/redo |
| `Cmd/Ctrl+K` | command palette |
| `/` | slash commands w edycji node'a |
| `Cmd/Ctrl+F` | search map |
| `+/-` | zoom; nie podczas text edit |
| `0` | fit map |
| `1` | zoom 100% |
| `[` / `]` | collapse/expand branch |
| `?` lub `F1` | shortcut help |

Skróty nie mogą przechwytywać wpisywania tekstu. Help pokazuje wariant Mac i
Windows. Wszystkie akcje mają odpowiednik w menu.

## 9. Menu 2 — dokładna zawartość

Od lewej:

1. back `Ideas`;
2. breadcrumb;
3. artifact icon + editable title;
4. artifact switcher;
5. artifact dropdown/version;
6. collaborator avatars;
7. save state;
8. `Present`;
9. `Share`;
10. `Export`;
11. `Close`.

Menu 2 nie zawiera formatowania node'a ani narzędzi AI dotyczących zaznaczenia.

## 10. Menu 3 — Mind Map

### Lewa strefa

- undo/redo;
- layout: Auto/Manual oraz radial/tree/left/right;
- collapse depth;
- view: minimap, sources, AI/provenance, comments;
- search/filter;
- history/snapshots.

### Strefa kontekstowa

Przy zaznaczeniu node/branch:

- add child/sibling;
- promote/demote;
- move/reparent;
- node type/icon;
- branch color/style;
- collapse/expand;
- focus/sub-map;
- add relation;
- attach source/evidence;
- comment.

### Prawa strefa

- Teresa;
- `Expand`;
- `Questions`;
- `Ideas`;
- `Challenge`;
- `Find gaps`;
- `Organize`;
- `Transform`;
- `Handoff`.

AI actions są pogrupowane pod jednym wejściem, aby pasek nie stał się listą
kilkunastu przycisków.

## 11. Prawy przycisk myszy

### Canvas — brak zaznaczenia

1. Add central node / node here;
2. Paste;
3. Select all;
4. Start from template;
5. Import/transform here;
6. Ask Teresa here;
7. Fit map / zoom 100%;
8. Canvas background/grid;
9. Snapshot.

### Node

1. Edit;
2. Add child;
3. Add sibling;
4. Expand with Teresa;
5. Duplicate node/branch;
6. Cut/copy/paste;
7. Promote/demote/reparent;
8. Collapse/expand;
9. Focus/open as sub-map;
10. Add relation;
11. Attach source/evidence;
12. Comment/mention;
13. Transform selection;
14. Create proposal: Task/Decision/Initiative/Material;
15. Style/type;
16. Delete.

Rzadkie akcje są pod `More`; maksymalnie 8 pozycji na pierwszym poziomie.
Delete node z dziećmi pokazuje wybór: `Delete branch`, `Delete node and promote
children`, `Cancel`.

### Multi-selection

Group/frame, align/distribute, batch tag/type/style, connect, transform,
handoff, copy/duplicate i delete. Akcja niedostępna pokazuje reason.

### Edge/cross-link

Edit label/type, direction, style, source, convert relation, delete. Primary
parent edge ma ograniczone akcje; jego usunięcie wymaga decyzji o dzieciach.

## 12. Object edit bar

Po pojedynczym zaznaczeniu pokazuje tylko najczęstsze akcje:

- node type/icon;
- text emphasis;
- branch color;
- add child;
- comment;
- source;
- Teresa expand;
- `More`.

Bar nie skacze podczas zoomu, nie zasłania sąsiednich node'ów i może zmienić
pozycję, gdy brakuje miejsca.

## 13. Auto-layout i manual layout

- Auto-layout jest domyślny dla nowej klasycznej mapy;
- użytkownik wybiera radial, right, left albo vertical tree;
- ruch node'a w auto-layout może zmienić kolejność lub parenta, ale nie zapisuje
  przypadkowej pozycji;
- manual mode zapisuje pozycje;
- `Tidy up` układa zaznaczoną gałąź bez zmiany parentów;
- powrót Manual → Auto pokazuje preview;
- pinned node/frame pozostaje na miejscu albo blokuje zmianę z jasnym reason;
- layout działa w tle i można go anulować dla dużej mapy.

## 14. Collapse, focus i duże mapy

- minus zwija branch;
- badge pokazuje liczbę ukrytych node'ów, komentarzy i unresolved items;
- focus mode izoluje branch, breadcrumb prowadzi do root;
- depth control pokazuje poziomy 1–N;
- search może tymczasowo odsłonić trafienie bez zmiany zapisanego collapse;
- minimap pokazuje viewport i aktywne trafienia;
- large-map mode upraszcza cienie/animacje/labels, nie dane;
- virtualization nie może zerwać keyboard navigation ani exportu.

## 15. Standard wizualny

### Hierarchia

- root: największy, wyraźny, ale nie monstrualny;
- level 1: mocne branch labels i rozpoznawalne kolory;
- level 2+: stopniowo spokojniejsza typografia i mniejszy ciężar;
- notes/evidence/status są sekundarne;
- selection ma jeden kanoniczny focus ring;
- hover jest subtelny i nie przesuwa layoutu.

### Węzły

Podstawowe formy: underline/topic, pill, rounded rectangle i card. Domyślnie
mapa stosuje lekki topic style; card jest używany dla evidence, outcomes i
obiektów bogatszych. Shape nie jest kodem semantycznym bez legendy.

### Kolor

- kolor rozróżnia główne gałęzie, nie każdy node;
- potomkowie dziedziczą hue z mniejszym nasyceniem;
- status, warning, AI i source używają osobnych tokenów/ikon, nie koloru gałęzi;
- paleta działa w dark/light mode i spełnia kontrast;
- `Randomize colors` ma preview i undo, nie jest domyślną operacją.

### Linie

- parent edges: organic curved albo clean straight zależnie od theme;
- cross-links: cieńsze, z etykietą i opcjonalną strzałką;
- selected path jest podświetlony;
- line crossing jest minimalizowany przez layout;
- animation tylko dla przejścia/focus, bez ciągłego ruchu.

### Odstępy

- stały rytm między levelami;
- dynamiczna szerokość node'a z rozsądnym max i wrap;
- długi tekst trafia do note/inspector zamiast tworzyć ogromny node;
- child insertion animuje miejsce, aby użytkownik rozumiał zmianę.

### AI i provenance

- ghost node: przerywany obrys i badge `Proposal`;
- AI-applied po akceptacji zachowuje subtelną ikonę provenance;
- assumption ma własny marker;
- source-grounded pokazuje badge/tooltip i otwiera źródło;
- unsupported claim ma warning, nie dekoracyjny confidence score.

## 16. Teresa — dokładne akcje

Na root/mapie:

- Generate full map;
- Propose main branches;
- Reorganize map;
- Find missing perspectives;
- Detect duplicates/contradictions;
- Summarize map;
- Recommend next artifact.

Na node/branch:

- Expand with topics;
- Expand with questions;
- Expand with ideas/options;
- Ask for evidence;
- Challenge assumption;
- Show alternative branch;
- Condense/merge;
- Convert branch to outcome.

Wynik pokazuje ghost nodes i diff list. Można `Accept all`, wybrać elementy,
edytować, odrzucić lub regenerować wyłącznie zaznaczoną część. Akceptacja jest
jedną transakcją z undo.

## 17. Template i AI razem

Template definiuje starter structure i questions-to-consider. Teresa wypełnia
go dopiero na podstawie briefu. Użytkownik przed generacją może:

- wyłączyć gałęzie;
- dodać własną;
- ustawić depth i poziom szczegółowości;
- wskazać źródła;
- ustawić `explore broadly` lub `prepare for decision`;
- wybrać język i audience.

Nie generujemy automatycznie 50 node'ów. Domyślnie 5–8 głównych gałęzi oraz
2–4 child nodes na gałąź, z możliwością pogłębiania.

## 18. Import i eksport

Import:

- plain outline/Markdown;
- OPML;
- CSV mapping;
- dokument/transcript przez source extraction;
- istniejący Ideas artifact;
- formaty zewnętrzne tylko po udowodnionym parserze.

Export:

- PNG/SVG/PDF;
- outline/Markdown/OPML;
- PPT scene/export;
- embed/link;
- selected branch albo full map.

Preview pokazuje zakres, hidden branches, comments, sources i confidentiality.

## 19. Współpraca i prezentacja

- real-time presence/cursors;
- follow collaborator;
- anchored comments/mentions;
- presentation scenes lub selected branches;
- presenter może odsłaniać kolejne poziomy;
- uczestnik bez edit permission nie przesuwa node'ów;
- konflikt rename/reparent ma deterministyczne rozwiązanie i activity;
- Meeting może wyświetlić mapę, a Teresa facylitować jej rozwijanie.

## 20. Mobile/tablet/accessibility

- tablet wspiera pełne pan/zoom, node edit, drag i stylus;
- mobile wspiera browse, search, collapse, comment, Teresa i lekką edycję;
- złożone multi-select/layout może pokazać `Open on larger screen`;
- keyboard focus podąża po logicznym drzewie, nie losowej kolejności DOM;
- screen reader odczytuje level, parent, child count, collapse i provenance;
- connector list umożliwia nawigację po cross-linkach;
- reduced motion i high contrast są respektowane.

## 21. MVP

### P0

- wszystkie trzy sposoby rozpoczęcia;
- 12 template;
- root/child/sibling, edit, delete, duplicate, reparent;
- auto/manual layout i co najmniej radial/right/tree;
- collapse/focus/search/minimap;
- podstawowe cross-links;
- pełne mouse/keyboard/context menu;
- sources/comments/history/save/exit/resume;
- Teresa generate/expand/questions/ideas/challenge/gaps;
- proposal diff i undo;
- transform do Table/Flow/Whiteboard;
- PNG/PDF/outline export;
- Task/Decision/Initiative/Material handoff z read-backiem;
- tenant/ACL i golden E2E.

### P1

- sub-maps, branch compare, scenes/PPT, OPML, richer collaboration;
- advanced layouts, map health i evidence overlay;
- Meeting live facilitation.

### P2

- 3D, advanced heatmaps, force simulation analytics, public template marketplace
  i rozbudowane what-if. Funkcje istniejące fragmentarycznie pozostają ukryte,
  dopóki nie spełnią wspólnego kontraktu.

## 22. Luki AS-IS

Repo zawiera dużą liczbę komponentów Mind Map, w tym layout, AI, collaboration,
snapshots, presentation i export. Do MVP trzeba przede wszystkim:

1. ograniczyć widoczną powierzchnię do funkcji rzeczywiście spiętych;
2. ujednolicić Menu 2/Menu 3/context/object bar;
3. dopracować typografię, spacing, linie, hover i selection;
4. ustabilizować reparent/manual movement;
5. wdrożyć trzy tryby startu jako jeden czytelny starter;
6. kuratorować 12 template;
7. udowodnić save/exit/resume i duże mapy;
8. domknąć transform i owner read-back E2E;
9. sprawdzić tablet/mobile/keyboard/accessibility;
10. usunąć dekoracyjne kontrolki bez realnego działania.

## 23. Testy odbiorcze

### Flow A — ręczny

`blank → root → keyboard add 20 nodes → reparent → collapse → undo → exit →
resume same state`.

### Flow B — pełna generacja

`new market template → brief preview → generate → reject/accept selected branches
→ edit → attach sources → save snapshot`.

### Flow C — Teresa współprowadzi

`central problem → Ask me questions → answer → review ghost nodes → accept →
challenge assumption → add evidence → accepted outcome`.

### Flow D — współpraca i handoff

`two editors → comment/conflict → resolve → transform branch to Table → create
Initiative Proposal Draft → receive read-back`.

### Flow E — bezpieczeństwo

`restricted source → collaborator without access → no content leak in node,
search, Teresa, export or handoff`.

## 24. Benchmark i adaptacja

Wzorce przyjęte po analizie oficjalnych materiałów:

- Miro: `Tab` child, `Enter` sibling, arrow navigation, drag/reassign, auto-layout,
  collapse/expand, cross-links oraz AI generate/expand;
- Miro: osobne select/hand/connect tools, skróty i canvas controls;
- Xmind: rozbudowany system skrótów i możliwość ich przeglądania/konfiguracji.

Consultify rozszerza te wzorce o source/evidence, konsultingową rolę Teresy,
proposal diff, artifact transforms, downstream governance i owner read-back.

Źródła benchmarku:

- https://help.miro.com/hc/en-us/articles/360017730753-Mind-map
- https://help.miro.com/hc/en-us/articles/360017731033-Shortcuts-and-hotkeys
- https://help.miro.com/hc/en-us/articles/4403634496402-Miro-for-mapping-diagramming
- https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines
- https://xmind.com/user-guide/preferences-shortcuts-new
