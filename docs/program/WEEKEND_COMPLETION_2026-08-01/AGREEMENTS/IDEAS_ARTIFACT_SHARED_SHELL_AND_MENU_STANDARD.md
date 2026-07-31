---
document_id: IDEAS-ARTIFACT-SHARED-SHELL-MENU-STANDARD
module: My Work / Ideas
scope: Mind Map, Table, Process Flow, Whiteboard
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Ideas — wspólny shell, menu i mechanika artefaktów

## 1. Cel standardu

Użytkownik, który nauczył się jednego narzędzia Ideas, ma rozumieć pozostałe.
Mind Map, Table, Process Flow i Whiteboard mają własną semantykę pracy, ale
korzystają z tego samego shellu, nawigacji, stanów, reguł AI, źródeł,
współpracy, historii i handoffu.

## 2. Hierarchia

```text
My Work
└── Ideas list
    └── Idea Workspace
        ├── Idea Context
        ├── Artifact Library
        ├── Mind Map Artifact(s)
        ├── Table Artifact(s)
        ├── Process Flow Artifact(s)
        └── Whiteboard Artifact(s)
```

Idea jest kontenerem. Artefakt jest wersjonowanym rezultatem pracy konkretnego
narzędzia. Canvas/siatka nie jest całym obiektem — należy do artefaktu.

## 3. Wspólna anatomia ekranu

### Menu 1 — globalne

Główne menu aplikacji pozostaje bez zmian i pozwala opuścić My Work.

### Menu 2 — My Work / Idea Workspace

Stały pasek zawiera:

- back do listy Ideas;
- breadcrumb `My Work / Ideas / Idea / Artifact`;
- title i rename;
- artifact switcher: Mind Map, Table, Process Flow, Whiteboard;
- lista artefaktów danego typu oraz `New`;
- owner/collaborators;
- save state i version status;
- share/present/export;
- close/exit.

Zmiana narzędzia otwiera artefakt tego typu. Jeżeli go nie ma, system pokazuje
starter screen: pusty, template albo transform z istniejącego artefaktu.

### Menu 3 — command row

Lewa część jest wspólna:

- undo/redo;
- view/zoom lub density;
- search;
- selection scope;
- history/snapshots;
- comments/activity.

Środek zawiera kontrolki właściwe aktywnemu narzędziu. Prawa część zawiera:

- Teresa/AI actions;
- Sources/Evidence;
- Validate/Review;
- Transform;
- Handoff.

Ta sama akcja AI nie występuje jednocześnie w Menu 3 i canvasie. Toolbar
canvasa służy do bezpośredniego tworzenia i edycji obiektów.

### Główny workspace

- viewport tabeli albo canvasa;
- stałe, czytelne zaznaczenie;
- empty/loading/degraded/error overlay bez utraty nawigacji;
- autosave state;
- obecność współpracowników;
- możliwość wyjścia w każdej chwili.

### Lewy toolbar narzędzia

Tylko prymitywy tworzenia i manipulacji, np. node, sticky, shape, connector,
activity, column. Nie zawiera drugiego globalnego menu ani duplikatu AI.

### Prawy inspector/panel

Jeden wzorzec panelu z zakładkami zależnymi od kontekstu:

- Properties;
- Source & Evidence;
- Comments;
- Relations;
- Teresa;
- History/Activity.

Panel może być zamknięty, resize'owany i zachowuje stan per artefakt.

### Dolne/floating controls

Zoom, fit, minimap, page/frame navigation i presentation controls. Nie zasłaniają
treści i respektują safe area/mobile.

## 4. Wspólne menu obiektu

Po zaznaczeniu obiektu pojawia się mały object edit bar:

- edit title/content;
- style właściwy typowi;
- duplicate;
- comment;
- attach source/evidence;
- link/relate;
- move/group;
- convert/transform selection;
- delete z undo;
- `More` dla rzadkich akcji.

Akcje wysokiego wpływu pokazują preview. Menu kontekstowe i keyboard shortcut
uruchamiają tę samą komendę oraz ten sam permission check.

## 5. Wspólne menu File/Artifact

- New artifact;
- Rename, duplicate i move;
- Import;
- Export;
- Snapshot/version;
- Restore/compare;
- Share/presentation;
- Archive;
- Delete do kosza, jeśli policy pozwala.

Import nigdy nie zastępuje aktywnego artefaktu bez preview. Export respektuje
ACL, privacy, source attribution i aktualny selection/full scope.

## 6. Wspólny model danych

Każdy artefakt ma:

- `artifactId`, `ideaId`, type, name, version i status;
- owner, collaborators, organization/project scope;
- source artifact/version oraz transform lineage;
- purpose, assumptions, tags i language;
- objects i selection model;
- source/evidence relations;
- AI proposals i human decisions;
- snapshots, comments, activity i audit;
- accepted outcomes;
- export/share metadata;
- handoff records oraz owner read-back.

## 7. Wspólne statusy

Artefakt:

`Draft → Working → Needs evidence → Review ready → Reviewed → Outcome accepted
→ Handed off → Archived / Superseded`

Save:

`Unsaved → Saving → Saved → Save failed → Conflict → Recovered`

AI proposal:

`Preparing → Generated → In review → Accepted / Rejected → Applied → Superseded`

Transform:

`Preview → Ready → Running → Derived artifact created → Needs review / Accepted`

## 8. Tworzenie i wejścia

Każde narzędzie może rozpocząć z:

- pustego artefaktu;
- template/starter;
- promptu/rozmowy z Teresą;
- pliku lub wklejonej treści;
- danych z Notebook, Interview, Meeting, Tools, Assessment lub Materials;
- zaznaczenia albo całości innego artefaktu Ideas.

Przed importem/generacją system pokazuje assumptions, mapping i target artifact.

## 9. Wyjścia

### Lokalnie w Ideas

- kolejny artefakt przez transformację;
- accepted outcome;
- snapshot;
- summary/insight candidate;
- linked Notebook page.

### Downstream

- Task Proposal;
- Decision Case Proposal;
- Initiative Proposal Draft;
- Material input lub render/export;
- Tool/Assessment/Meeting context;
- Run Agent process proposal z zatwierdzonego Flow.

Żadne wyjście nie omija review systemu właścicielskiego.

## 10. Transformacja

Transform modal pokazuje:

1. source artifact/version i selected scope;
2. target tool i nowy/existing artifact;
3. mapping elementów;
4. informacje zachowane, przekształcone i pominięte;
5. AI-generated labels/relations/assumptions;
6. source/evidence coverage;
7. permissions;
8. preview;
9. rezultat `Create derived artifact`.

Transformacja jest idempotentna dla request ID, zachowuje source i umożliwia
porównanie. Późniejsza zmiana source nie nadpisuje derived artifact; pokazuje
`source changed` i opcję kontrolowanego refresh/merge.

## 11. Teresa

Wspólne akcje:

- `Help me choose a tool`;
- `Generate starting structure`;
- `Organize selection`;
- `Find gaps/contradictions`;
- `Challenge assumptions`;
- `Suggest next step`;
- `Summarize outcomes`;
- `Prepare transform`;
- `Prepare handoff`.

Każda akcja używa aktywnego artifact/selection, pokazuje plan operacji i zwraca
proposal diff. Teresa nie zmienia source, ACL, ownera ani accepted outcome.

## 12. Collaboration

- presence i cursors;
- comments/mentions anchored do object ID;
- optimistic update z conflict handling;
- object/field locks tylko tam, gdzie nie da się bezpiecznie merge'ować;
- attribution każdej zmiany;
- facilitator controls tylko dla Whiteboard/session;
- role-aware sharing i project membership;
- notification do My Work Inbox, bez lokalnej kopii taska.

## 13. Dostępność, urządzenia i wydajność

- wszystkie krytyczne akcje dostępne z klawiatury;
- focus, screen reader labels i odpowiedni kontrast;
- reduced motion;
- touch targets i tablet mode;
- mobile: browse/comment/light edit; złożona edycja może jawnie wymagać większego
  ekranu, ale nigdy nie kończy się pustym ekranem;
- virtualization/lazy render dla dużych artefaktów;
- worker/background operation dla ciężkiego layoutu, eksportu i AI;
- progress, cancel i retry dla operacji długich.

## 14. Error/degraded states

- source unavailable/revoked;
- permission changed;
- partial import;
- AI unavailable;
- save conflict/offline;
- stale derived artifact;
- unsupported object during transform;
- export partial/failed;
- owner handoff rejected/deferred;
- artifact too large/performance mode.

Każdy stan mówi: co zachowano, czego brakuje i co użytkownik może zrobić dalej.

## 15. Telemetria i jakość

- create/open/save/exit/resume success;
- time to first meaningful object/outcome;
- transform preview/accept/failure;
- AI proposal accept/edit/reject;
- source/evidence coverage;
- collaboration conflict rate;
- handoff and read-back success;
- abandonment i recoverability;
- performance dla rozmiarów S/M/L/XL.

Treść prywatna nie trafia do telemetryki produktowej.

## 16. Wspólna bramka MVP

MVP wymaga:

1. listy Ideas i tworzenia/otwierania Idea;
2. czterech stabilnych artefaktów;
3. spójnego Menu 2/Menu 3, exit i resume;
4. podstawowej edycji i persistence;
5. jednego template/startera per narzędzie;
6. Sources/Evidence oraz AI proposal review;
7. co najmniej sześciu kluczowych transformacji z preview;
8. accepted outcomes;
9. handoff do Task, Decision, Initiative Proposal i Material;
10. permission/tenant isolation;
11. testu E2E całej rodziny;
12. ukrycia funkcji dekoracyjnych bez działającego kontraktu.
