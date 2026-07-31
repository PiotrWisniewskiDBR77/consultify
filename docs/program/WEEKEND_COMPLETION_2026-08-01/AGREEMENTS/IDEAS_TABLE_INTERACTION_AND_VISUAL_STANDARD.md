---
document_id: IDEAS-TABLE-INTERACTION-VISUAL-STANDARD
module: My Work / Ideas / Table
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
benchmark_reviewed: Airtable, Miro
---

# Ideas Table — interakcje, menu i standard wizualny

## 1. Cel

Table jest silnikiem uporządkowanego myślenia: zamienia powtarzalne obserwacje,
pomysły lub opcje w rekordy, pola, widoki, walidację i świadome porównanie.
Dokument jest normatywną instrukcją designu, implementacji i odbioru.

Table nie jest arkuszem finansowym, bazą aplikacyjną ani kopią Airtable. Bierze
z dojrzałych tabel przejrzystość danych i widoków, a dodaje evidence, AI review,
consulting templates i kontrolowane handoffy Consultify.

## 2. Cztery sposoby rozpoczęcia

### A. Blank structured table

Użytkownik definiuje unit of analysis, pierwsze pole primary i kolejne pola.
Pierwszy rekord można utworzyć od razu z klawiatury.

### B. Template

Użytkownik wybiera starter, widzi schema, przykładowy pusty rekord, zasady
scoringu i planowane wyjście. Template nie zawiera danych demo organizacji.

### C. Generate with Teresa

Brief obejmuje cel, unit of analysis, źródła, kryteria porównania, audience,
oczekiwany rezultat i limit rekordów. Teresa najpierw proponuje schema i
coverage, dopiero potem rekordy. Użytkownik zatwierdza oba etapy osobno.

### D. Import or transform

Źródłem może być CSV/XLSX, paste, dokument, Interview/Tool Output lub zaznaczenie
Mind Map/Whiteboard/Flow. Mapping preview pokazuje typy, błędy i pominięcia.

## 3. Model danych

### Table Artifact

`artifactId`, idea/version, name, unit of analysis, primary field, fields,
records, views, formulas/scoring models, validation rules, sources, proposals,
comments, history i handoffs.

### Field

- stable ID, label, description i type;
- required/default/validation;
- options i display format;
- source/evidence expectations;
- formula/derivation i dependencies;
- visibility/edit permissions;
- AI allowed operations;
- version/change history.

### Record i cell

Record ma stable ID, primary value, field values, owner, source posture,
validation state i relations. Cell zachowuje value, author, source, confidence,
AI proposal/manual override oraz updated time.

### View

Widok przechowuje visible/order/width fields, filters, sorts, groups, density,
color rules i summary configuration. Zmiana widoku nie zmienia danych. Widok ma
scope `personal`, `shared` albo `locked` i osobnego ownera.

## 4. Typy pól P0

- primary text;
- short/long text;
- number, percentage, currency i unit;
- single/multi select;
- status;
- checkbox;
- date/date range;
- person/team reference;
- source/evidence reference;
- linked Consultify object;
- score/rating;
- simple formula/derived;
- AI proposal value z provenance.

Unsupported type z importu pozostaje raw value z warningiem; nie jest cicho
konwertowany.

## 5. Menu 2

Zgodne ze wspólnym shellem Ideas: back/breadcrumb, title, artifact switcher,
artifact/version, collaborators, save, present/share/export/close.

Table dodaje obok tytułu badge unit of analysis i aktywny view. Nie umieszcza
filter/sort w Menu 2.

## 6. Menu 3

### Lewa strefa

- undo/redo;
- view switcher i `New view`;
- density: compact/comfortable;
- freeze primary/columns;
- search;
- history/activity.

### Środek — konfiguracja widoku

- Fields;
- Filter;
- Group;
- Sort;
- Color;
- Row height;
- Validation;
- Summary.

Aktywna konfiguracja ma badge/count i `Clear`. Automatyczny sort/filter jest
widoczny, aby użytkownik rozumiał, dlaczego nie widzi lub nie może ręcznie
przesunąć rekordu.

### Prawa strefa

- Teresa;
- Generate/Extract;
- Classify/Enrich;
- Deduplicate;
- Score/Compare;
- Find gaps;
- Transform;
- Handoff;
- Import/Export.

AI actions są kontekstowe dla table/view/selection i nie są duplikowane w
siatce.

## 7. Anatomia siatki

- top-left selection corner;
- sticky header row;
- primary field przypięte domyślnie;
- row numbers/selection controls;
- add field na końcu headers;
- add record na dole i szybki insert;
- groups z collapse, count i opcjonalnym summary;
- validation/source/AI badges nie zmieniają wysokości wiersza;
- status saving/conflict per rekord/cell, jeśli potrzebny;
- detail drawer po otwarciu rekordu.

## 8. Nawigacja i klawiatura

| Gest/skróty | Zachowanie |
| --- | --- |
| click cell | zaznacz |
| double click / Enter | edytuj |
| arrows | sąsiednia komórka |
| Tab / Shift+Tab | następna/poprzednia edytowalna komórka |
| Enter po edycji | zatwierdź i przejdź w dół |
| Esc | anuluj edycję / wróć do selection |
| Space | toggle checkbox lub otwórz select |
| Cmd/Ctrl+C/V | copy/paste z mappingiem |
| Cmd/Ctrl+D | fill down/duplicate selection zależnie od scope |
| Cmd/Ctrl+Z | undo |
| Shift+click | rozszerz selection |
| drag fill handle | fill preview; nie dla niebezpiecznych typów bez potwierdzenia |
| Cmd/Ctrl+F | search |
| Cmd/Ctrl+K | command palette |
| Delete | clear cells; rekord usuwa się osobną akcją |

Paste wielu komórek pokazuje preview, gdy zmienia typy, nadpisuje wartości lub
wychodzi poza schema. Klawiatura nie zatrzymuje się na hidden/read-only cells.

## 9. Menu kontekstowe

### Cell

Edit, copy, clear, fill, attach source, comment, ask Teresa, view history,
transform value i open linked object.

### Row

Open detail, duplicate, insert above/below, comment, assign owner, validate,
generate/enrich selected fields, transform/handoff, archive i delete.

### Column

Edit field, sort, filter, group, hide, freeze, duplicate field, validation,
formula/scoring, AI fill proposal, source coverage i delete with impact preview.

### Multi-selection

Copy, clear, fill, batch update, classify, validate, transform, export i create
proposals. Każda bulk mutation pokazuje affected count i undo.

### Header/background

New record/field/view, import, paste, reset view i table settings.

## 10. Field configuration drawer

- label/description;
- type i format;
- required/default;
- options/order/colors;
- validation i error message;
- unit/source expectation;
- formula dependencies;
- edit/view permission;
- AI policy;
- impact preview przed zmianą typu/usunięciem.

Zmiana typu tworzy migration preview: convertible, lossy, invalid, blank. User
może cancel, apply safe only lub apply all with exported backup.

## 11. Widoki

P0 utrzymuje jeden kanoniczny Grid oraz saved configurations. Nie dodajemy
Kanban/Calendar/Gantt tylko dlatego, że ma je Airtable — te powierzchnie istnieją
w odpowiednich modułach. Opcjonalne summary/chart jest panelem analizy, nie
nowym właścicielem danych.

View menu zawiera:

- create/rename/duplicate;
- personal/shared/locked;
- favorite;
- copy configuration;
- reset to default;
- share link z permission check;
- delete bez usuwania records.

## 12. Filter, sort i group

Filter wspiera warunki typed, AND/OR groups i preview count. Sort ma kolejność
priorytetów oraz naturalne porządkowanie liczb/tekstu. Group obsługuje do trzech
poziomów w P0, collapse oraz przeniesienie recordu między grupami tylko wtedy,
gdy bezpiecznie aktualizuje grouped field.

System pokazuje, czy rekord jest ukryty przez filter oraz czy auto-sort blokuje
manual reorder. AI nie analizuje ukrytych/restricted rekordów bez jawnego scope.

## 13. Formuły, scoring i jakość

P0 obejmuje jawny, ograniczony zestaw operacji: arithmetic, IF, boolean,
date difference, weighted sum/average, count i simple lookup dozwolonej relacji.

- formula editor pokazuje dependencies, type i sample result;
- circular reference jest blockerem;
- missing/error nie staje się zerem;
- scoring model pokazuje kryteria, wagi, normalizację i version;
- zmiana modelu oznacza stare wyniki jako stale;
- AI może proponować scoring, ale nie ukrywa formuły ani nie wybiera finalnie.

## 14. Teresa

### Table-level

Propose schema, extract records, recommend fields, identify missing categories,
summarize, compare subsets i recommend next artifact.

### Selection-level

Classify, enrich from sources, normalize, detect duplicate, propose merge,
score, explain, generate missing questions i prepare handoff.

Wynik to proposal table/diff. Użytkownik może akceptować per cell/row/field.
Regeneracja nie nadpisuje ręcznych zmian. `Unsupported/no source` jest jawne.

## 15. 12 template

1. Idea Register;
2. Opportunity Register;
3. Hypothesis–Evidence Table;
4. Options Comparison;
5. Prioritisation Matrix;
6. Customer Needs Register;
7. Feature/Value Comparison;
8. Risk–Assumption Register;
9. Stakeholder Needs Table;
10. Experiment/Learning Backlog;
11. Interview Insight Register;
12. Outcome/Action Candidates.

Każdy template definiuje unit, pola, walidację, suggested views, scoring
opcjonalny, pytania Teresy i dozwolone handoffy.

## 16. Import/export

Import CSV/XLSX/paste ma sheet/range selection, header detection, field mapping,
locale/date/number preview, duplicate policy i error report. Pełna wierność
workbooka nie jest celem Ideas Table.

Export CSV/XLSX/PDF/render respektuje visible/all fields, selected/all records,
groups/sort, formulas vs values, sources, confidentiality i ACL. Restricted
fields nie przeciekają przez hidden columns ani summary.

## 17. Transformacje i integracje

- Map → Table: nodes jako records, path/type/source jako fields;
- Board → Table: stickies/outcomes/votes jako records;
- Flow → Table: steps/roles/risks/IO jako records;
- Table → Map: selected records + typed relations;
- Table → Flow: selected records/order/dependencies;
- Table → Board: cards/frames dla warsztatu.

Downstream: Task/Decision/Initiative/Material proposals. Finance/KPI/Tasks nie
używają Ideas Table jako canonical store.

## 18. Standard wizualny

- spokojna, gęsta, ale czytelna siatka;
- primary text ma najwyższy kontrast;
- gridlines subtelne, selection jednoznaczne;
- sticky headers i pinned field mają delikatny elevation;
- status/option colors korzystają z tokenów, nie tęczy;
- validation error, warning, AI proposal i source mają różne ikony/tokeny;
- zebra striping tylko opcjonalnie;
- hover nie przesuwa layoutu;
- empty cells nie pokazują szumu ikon bez hover/focus;
- dark/light, zoom tekstu i high contrast muszą działać.

## 19. Mobile, accessibility i performance

- desktop/tablet: pełna edycja;
- mobile: record list/detail, filter, comment i light edit;
- screen reader ogłasza row/column header, value, editability i validation;
- virtualization dla dużych tabel, bez łamania selection/copy/export;
- server/background import, formula recalc i AI z progress/cancel;
- profile S/M/L/XL ustalone pomiarem;
- brak danych nie może wyglądać jak zawieszenie.

## 20. MVP i luki

P0: cztery starty, 12 template, typed fields, records, Grid, views,
filter/sort/group, validation, ograniczone formuły/scoring, sources, AI proposals,
CSV/XLSX w potwierdzonym zakresie, transform i handoff.

Do domknięcia: multi-artifact storage, connector `coming soon`, pełny XLSX
contract, bulk preview/undo, owner read-back, mobile/accessibility i jeden E2E
`import → structure → score → transform → handoff`.

P1: richer relations, advanced import, charts/summary i team templates. P2:
automations/database behavior i rozbudowane analytics, jeśli nadal służą Ideas.

## 21. Testy odbiorcze

- blank keyboard-only table → exit/resume;
- XLSX import z błędami locale/type → mapping → report;
- Teresa schema → records → per-cell review;
- filter/group/sort bez zmiany danych;
- scoring version change → stale results;
- Board transform → Table → Flow;
- restricted field bez wycieku w AI/export;
- selected rows → Initiative/Decision proposals → read-back.

## 22. Benchmark

Z Airtable przyjmujemy rozdział danych i widoków, personal/shared/locked views,
typed sorting, grouping, filters i field/record permissions. Z Miro przyjmujemy
prostą edycję tabel na canvasie tylko tam, gdzie wspiera artefakt. Odrzucamy
rozrost do pełnej platformy bazodanowej.

Źródła:

- https://support.airtable.com/docs/getting-started-with-airtable-views
- https://support.airtable.com/v1/docs/sorting-records-in-airtable-views
- https://support.airtable.com/v1/docs/grouping-records-in-airtable
- https://support.airtable.com/introduction-to-airtable-basics
- https://support.airtable.com/docs/managing-and-sharing-interfaces
