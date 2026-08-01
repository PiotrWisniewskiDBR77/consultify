---
document_id: IDEAS-WHITEBOARD-INTERACTION-VISUAL-STANDARD
module: My Work / Ideas / Whiteboard
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
benchmark_reviewed: FigJam, Miro
---

# Whiteboard — interakcje, menu i standard wizualny

## 1. Cel

Whiteboard ma być swobodnym, pięknym i kontrolowanym miejscem pracy jednej lub
wielu osób. Służy do eksploracji i warsztatu, ale prowadzi do udokumentowanych
outcomes. Dokument definiuje precyzyjnie canvas, menu, obiekty, facylitację,
głosowanie, AI, wygląd, bezpieczeństwo i MVP.

## 2. Cztery sposoby rozpoczęcia

### A. Blank board

Pusty canvas do ręcznej pracy. Użytkownik może od razu tworzyć sticky, tekst,
rysunek i frame.

### B. Workshop template

Template tworzy sekcje, instrukcje, fazy, timer suggestions, voting setup i
parking lot. Placeholdery są wizualnie odróżnione od danych uczestników.

### C. Generate workshop with Teresa

Brief: cel, uczestnicy, czas, expected outcomes, sposób pracy, prywatność,
materiały źródłowe i styl facylitacji. Teresa pokazuje agenda/sections preview,
potem generuje board proposal.

### D. Import/transform

Źródło: Meeting/Interview, dokument/obraz/PDF, Mind Map, Table lub Flow. Preview
pokazuje mapping do sections/objects oraz elementy nierozpoznane.

## 3. Model danych

Whiteboard Artifact ma pages/sections, objects, layers/order, workshop session,
participants, timer, voting sessions, outcomes, sources, comments, snapshots,
activity, AI proposals i handoffs.

Object: ID/type/content/position/size/rotation/style, section/layer, author
visibility, locked state, source/evidence, tags, comments, reactions/votes,
provenance i transform relations.

## 4. Obiekty P0

- sticky note;
- text;
- basic shapes;
- connector/arrow;
- freehand pen/highlighter/eraser;
- image i supported file/link preview;
- frame/section;
- source/evidence card;
- outcome card;
- comment pin;
- stamp/reaction/vote.

Bogate widgets są P1/P2 i wymagają własnego kontraktu. Nie uruchamiamy plugin
marketplace w MVP.

## 5. Menu 2

Wspólny shell Ideas: back/breadcrumb/title, artifact switcher/version,
collaborators, save, present/share/export/close.

Whiteboard pokazuje dodatkowo active page/section i, podczas sesji, phase +
participant count. Timer/voting nie trafia do Menu 2.

## 6. Menu 3

### Lewa strefa

- undo/redo;
- pages/sections/scenes;
- zoom/minimap/fit;
- grid/snap;
- layers/locked items;
- search;
- history/snapshots.

### Środek — workshop

- Agenda/Phase;
- Participants;
- Timer;
- Spotlight/Follow;
- Voting;
- Anonymous mode;
- Reactions;
- Present.

### Prawa strefa

- Teresa;
- Brainstorm;
- Prompt participants;
- Cluster/Organize;
- Find gaps;
- Summarize;
- Outcome review;
- Transform;
- Handoff/Export.

## 7. Dolny/lewy toolbar

Logiczne grupy:

1. navigation: Select/Hand;
2. capture: Sticky/Text;
3. visual: Shape/Connector/Pen/Image;
4. organize: Section/Frame/Table embed;
5. collaborate: Comment/Reaction;
6. insert: source/artifact/template.

Ostatnio użyte style są dostępne, ale toolbar nie rozrasta się. Shortcut i
tooltip pokazują nazwę. Aktywny tool jest wyraźny.

## 8. Nawigacja i manipulacja

| Gest | Zachowanie |
| --- | --- |
| click/double click | select/edit |
| Space+drag / middle drag | pan |
| trackpad two-finger/pinch | pan/zoom |
| drag canvas | selection rectangle w Select mode |
| Shift+click | add/remove selection |
| drag object | move z snap guides |
| modifier+drag | duplicate z preview |
| resize handles | resize z constraints |
| rotation handle | rotate, Shift snap |
| drag into section | attach to section po highlight |
| drag section | move wraz z contents |

Obiekt locked nie rusza się i pokazuje reason. Zmiana section/layer jest
audytowalna. Pan/zoom nigdy nie tworzy przypadkowych kresek lub selections.

## 9. Klawiatura

- `V/H`: select/hand;
- `S`: sticky, `T`: text, `R/O`: rectangle/oval, `L`: connector, `P`: pen,
  `C`: comment;
- `Shift+S`: section;
- `Enter/F2`: edit;
- arrows: move selection; Shift+arrows większy krok;
- `Tab/Shift+Tab`: następny/poprzedni obiekt logicznie/warstwowo;
- `Cmd/Ctrl+D`: duplicate;
- `Cmd/Ctrl+G`, `Shift+Cmd/Ctrl+G`: group/ungroup;
- `Cmd/Ctrl+C/V`, `Z`: copy/paste/undo;
- `Delete`: delete z undo; section pokazuje impact;
- `Cmd/Ctrl+F/K`: search/command;
- `0/1`: fit/100%;
- `F1`: help.

## 10. Menu prawego przycisku

Canvas: sticky/text/shape/section here, paste, template, import, Ask Teresa,
select all, grid/background, fit, snapshot.

Object: edit, duplicate, copy/cut, bring forward/back, align, group, lock,
comment, source/evidence, reactions, Ask Teresa, transform/handoff, delete.

Sticky/text: dodatkowo change type, author visibility, tags, cluster, turn into
outcome. Image/file: crop/replace/download/source/alt text.

Section: rename, add instructions/template, hide/reveal contents, spotlight,
select contents, duplicate, export, transform, archive/delete.

Multi-selection: group/section, align/distribute, tidy/grid, batch style/tag,
cluster, vote scope, transform/handoff i delete.

## 11. Object edit bar i inspector

Floating bar pokazuje najczęstsze: style/color, text, duplicate, lock, comment,
source, Teresa i More. Nie zasłania selection i dokuje się przy małej przestrzeni.

Inspector:

- Properties/Style;
- Source & Evidence;
- Author/Privacy;
- Comments/Reactions;
- Relations/Section;
- Teresa;
- History.

## 12. Sections, pages i scenes

Section grupuje obiekty, ma title/instructions/status i może ukrywać treść do
momentu ujawnienia. Link do section otwiera dokładny viewport.

Page jest wyższym podziałem dla dużych lub cyklicznych boardów i wymaga modelu
multi-artifact/page storage. W MVP można użyć sections/scenes, jeżeli pages nie
mają stabilnego persistence.

Scene jest prezentacyjnym viewportem, nie kopią danych. Reorder scenes buduje
walkthrough.

## 13. Workshop lifecycle

`Prepare → Open/Join → Diverge → Organize → Discuss → Vote/Prioritize →
Converge → Accept outcomes → Close → Follow-up/Reopen`

Facilitator może ustawić fazę, instrukcję, duration, scope section, participant
permissions i expected output. Faza nie blokuje ręcznej nawigacji, chyba że
policy warsztatu jawnie ogranicza editing.

## 14. Timer i spotlight

Timer jest jeden aktywny per workshop session. Facilitator domyślnie kontroluje
start/pause/add/stop; policy może pozwolić editorom. Każdy widzi countdown, ale
może wyciszyć dźwięk.

Spotlight zaprasza do śledzenia viewportu prezentera; uczestnik może odmówić
lub przestać śledzić. Nie przejmuje kursora ani sterowania. Facilitator może
przekazać spotlight innej osobie za jej zgodą.

## 15. Voting

Voting setup:

- prompt;
- scope: section/selection;
- eligible objects;
- liczba głosów per participant;
- single/multiple votes per object;
- start/end/timer;
- identity mode;
- tie handling;
- czy wyniki pozostają na boardzie.

Podczas secret vote uczestnik widzi własne głosy, nie cudze ani sugestywne live
counts; opcjonalnie ukrywamy cursors w voting scope. Po zamknięciu pokazujemy
wyniki, participation i minority distribution.

Voting nie tworzy Decision. Wynik może przygotować Decision Case Proposal.

## 16. Anonymous i privacy modes

- `Named` — autor widoczny;
- `Pseudonymous workshop` — inni uczestnicy nie widzą autora; audyt może znać
  tożsamość zgodnie z policy;
- `Strict anonymous` — identity nie jest przechowywana/udostępniana poza
  minimalnym security envelope; wymaga osobnej decyzji privacy.

Tryb jest pokazany przed dołączeniem. Zmiana w trakcie ma impact warning.
Teresa, export, search i outcomes respektują ten sam poziom.

## 17. Teresa

### Prepare

Proponuje agenda, sections, ćwiczenia, prompts, timebox i outcome format.

### Diverge

Zadaje neutralne pytania, może generować oznaczone proposal stickies i pilnuje
różnorodności perspektyw. Nie udaje uczestnika.

### Organize

Proponuje clusters/labels, duplicates, tensions i missing perspectives. Ghost
frames/labels wymagają akceptacji.

### Converge

Podsumowuje themes, dissent, evidence i outcome candidates. Nie interpretuje
vote jako decyzji i nie usuwa minority view.

### Handoff

Mapuje accepted outcome do Table/Map/Flow lub proposal downstream z lineage.

## 18. 12 template

1. Blank collaborative board;
2. Brainwriting / silent brainstorm;
3. Problem framing workshop;
4. How Might We ideation;
5. Affinity mapping;
6. Customer journey workshop;
7. Retrospective;
8. Strategy workshop;
9. Prioritisation and voting;
10. Process redesign workshop;
11. Stakeholder alignment;
12. Meeting/Interview synthesis.

Template ma purpose, duration, participant range, preparation, sections,
facilitator script, Teresa actions, voting policy i expected outcomes.

## 19. Import/export i integracje

Import: images/PDF, clipboard, supported files/links, transcript, Notes,
Interview/Meeting, Map/Table/Flow. OCR/extraction tworzy proposals, nie fakty.

Export: PNG/SVG/PDF, selected section/full board, PPT scenes, outcome register,
share/embed. Preview obejmuje hidden sections, identities, comments, sources i
confidentiality.

Meeting zarządza live participant/consent context; Whiteboard posiada artifact.
Transforms prowadzą do Map/Table/Flow. Handoff prowadzi do Tasks/Decisions/
Initiatives/Materials.

## 20. Standard wizualny

- neutralny canvas z subtelnym gridem;
- sticky zachowuje charakter notatki, ale tekst ma wysoki kontrast;
- ograniczona paleta semantyczna i workshop colors;
- sections mają lekką ramę/header, nie ciężkie kontenery;
- selection, collaborator colors, comments i votes są odróżnione;
- source card i AI proposal mają jawne badges;
- shadows/animations subtelne, bez „zabawkowego” chaosu;
- toolbar nowoczesny, grupowany i zawsze czytelny;
- large-board mode ogranicza efekty, nie dane;
- dark/light, high contrast i reduced motion.

## 21. Collaboration, accessibility i performance

Presence/cursors, follow, comments/mentions, optimistic changes, reconnect i
conflict recovery. Activity zapisuje create/edit/delete/move/AI/vote/outcome.

Screen reader odczytuje object type/content/section/author policy. Keyboard
nawiguje po sections i object order. Tablet wspiera stylus/touch; mobile browse,
comment, vote, follow i light edit.

Profile S/M/L/XL, virtualization, viewport-only render, background export i
hard limit muszą być oparte o pomiar. Limit backendu 500 nodes jest AS-IS i
wymaga świadomego UX, a nie nagłego błędu przy zapisie.

## 22. MVP i luki

P0: cztery starty, 12 template, core objects, selection/style/sections,
comments/presence, phases, timer, spotlight, voting, named+pseudonymous policy,
Teresa proposals, snapshots, transform/export/handoff.

Luki: multi-artifact/pages, pełna anonymity decision, jeden workshop golden
flow, reconnect/conflict load, limit UX, hidden-section leakage, mobile/a11y,
Meeting consent integration i owner read-back.

P1: strict anonymous po decyzji, richer presentation/pages, Meeting live oraz
team templates. P2: marketplace/widgets, dekoracyjne effects i analytics.

## 23. Testy odbiorcze

- blank manual board → exit/resume;
- generated workshop brief → selective accept;
- 10+ participants/reconnect/conflict;
- secret voting bez live leakage;
- pseudonymous board bez identity leak w AI/export;
- section hide/reveal/spotlight;
- Teresa cluster z zachowaniem dissent;
- Board → Map/Table/Flow transforms;
- outcome → Decision/Initiative proposal → read-back;
- 500-node boundary i recovery.

## 24. Benchmark

Z FigJam przyjmujemy prosty podział board/panels/toolbar, sections, pages,
templates, timer, spotlight/follow, hidden voting i collaboration. Z Miro
przyjmujemy canvas conventions oraz structured facilitation. Consultify dodaje
Teresa facilitation, evidence, outcome governance i downstream lineage.

Źródła:

- https://help.figma.com/hc/en-us/articles/15300412458647-Explore-FigJam-files
- https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam
- https://help.figma.com/hc/en-us/articles/5025214483351-Facilitate-meetings-with-spotlight
- https://help.figma.com/hc/en-us/articles/4402269549591-Stay-on-track-with-the-timer-in-FigJam
- https://help.figma.com/hc/en-us/articles/24005082123159-Create-and-manage-pages-in-FigJam
- https://help.figma.com/hc/en-us/articles/1500004362321-Guide-to-FigJam
