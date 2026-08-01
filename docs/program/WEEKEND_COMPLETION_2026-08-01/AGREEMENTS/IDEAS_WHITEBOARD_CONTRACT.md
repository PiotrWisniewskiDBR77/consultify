---
document_id: IDEAS-WHITEBOARD-CONTRACT
module: My Work / Ideas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Ideas — Whiteboard

Szczegółowy, normatywny opis canvasu, startów, Menu 2/3, gestów, sections,
facylitacji, timera, spotlight, głosowania, prywatności, 12 template i MVP:
[`IDEAS_WHITEBOARD_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_WHITEBOARD_INTERACTION_AND_VISUAL_STANDARD.md).

## 1. Cel

Whiteboard jest elastyczną przestrzenią indywidualnej i grupowej pracy nad
niejasnym problemem. Wspiera capture, warsztat, eksplorację, grupowanie,
głosowanie i syntezę. Nie jest chaotycznym magazynem karteczek ani systemem PMO.

## 2. Obiekty

- sticky note, text, shape, connector, freehand, image i embedded artifact;
- frame/section, cluster, participant contribution i comment;
- dot vote/reaction, timer/session phase i facilitation prompt;
- source/evidence card, outcome card i parking lot;
- snapshot, activity i AI proposal.

## 3. Fazy pracy

`Prepare → Capture/Diverge → Organize → Discuss → Vote/Prioritize → Converge →
Accept outcomes → Transform/Handoff`

Fazy są pomocą facylitacyjną, nie obowiązkowym wizardem. Użytkownik może wrócić
do wcześniejszej fazy bez utraty pracy.

## 4. Funkcje

1. nieskończony canvas, zoom/pan i selection;
2. szybkie tworzenie, duplicate, align, distribute, group i lock;
3. frames, templates i workshop agenda;
4. real-time collaboration, cursors, comments i mentions;
5. timer, anonymous contribution i voting według policy;
6. upload/paste/embed ze źródłem;
7. clustering, labeling, synthesis i outcome register;
8. snapshots/history i presentation mode;
9. transform wybranych elementów do Mind Map, Table albo Flow;
10. handoff zaakceptowanych outcomes.

## 5. Teresa

Może prowadzić warsztat, zadawać pytania, proponować ćwiczenia, generować
robocze sticky notes, grupować, nazwać klastry, wykrywać pominięte perspektywy i
proponować syntezę. W trybie wieloosobowym nie dominuje rozmowy, nie przypisuje
anonimowej wypowiedzi i nie traktuje głosowania jako automatycznej decyzji.

## 6. Standard jakości

Board ma jasno określony purpose, widoczne fazy/frames, rozdzielone materiały
źródłowe i wygenerowane, zachowane minority views, jawne zasady głosowania,
zaakceptowane outcomes oraz parking lot/open questions. Synteza linkuje do
elementów źródłowych.

## 7. Granice

- trwałe relacje semantyczne rozwijamy w Mind Map;
- rejestry i scoring przenosimy do Table;
- target sequence modelujemy w Process Flow;
- zaakceptowane tasks/decisions/initiatives powstają przez handoff;
- Meeting może używać Whiteboard live, ale zachowuje session/participant policy.

## 8. Golden flow i DoD

`prepare board/agenda → invite participants → diverge → cluster/discuss → vote
→ preserve dissent → accept outcomes → transform structure → hand off`

DoD: collaboration, anonymous mode, voting integrity, snapshots, restore,
source labels, large-board performance, accessible navigation, export oraz
transform/handoff mają testy; AI proposals nigdy nie pojawiają się jako cudze
wypowiedzi.

## 9. Menu i anatomia

Whiteboard stosuje wspólny
[`shell Ideas`](IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md).

Specyficzne Menu 3:

- workshop phase i agenda;
- frames/scenes;
- participants/facilitator;
- timer;
- voting setup/results;
- cluster/synthesis/outcomes;
- AI: brainstorm, prompt, cluster, gaps, summarize;
- present/export.

Lewy toolbar: select/hand, sticky, text, shape, connector, pen, image/file,
frame, source card i reaction. Inspector: content/style, author visibility,
source, tags, frame, vote state, comments i history.

## 10. Pełny katalog funkcji

| Grupa | Funkcje |
| --- | --- |
| Prepare | template, agenda, frames, roles, privacy and voting policy |
| Capture | sticky/text/draw/image/file, paste, voice, bulk participant input |
| Arrange | move, group, align, distribute, frame, cluster, lock, layers |
| Facilitate | phase, timer, prompt, follow, presentation, parking lot |
| Collaborate | cursors, presence, comments, mentions, anonymous mode |
| Decide | voting, prioritisation, preserve dissent, acceptance of outcomes |
| AI | brainstorm proposals, clustering, labeling, gaps and synthesis |
| Govern | authorship, source labels, snapshots, activity and moderation |
| Transform | selection/frame → Map/Table/Flow |
| Handoff | accepted outcome → Task/Decision/Initiative/Material proposal |

## 11. Wejścia, wyjścia i integracje

Wejścia: blank/template, image/PDF, clipboard, Notebook, Meeting live session,
Interview quotes, Mind Map/Table/Flow selection i Teresa. Imported objects mają
source label i prawa wykorzystania.

Wyjścia: board snapshot, image/PDF, presentation scenes, outcome register,
derived artifacts i proposals downstream. Meeting może kontrolować participants,
recording/consent i session lifecycle; board zachowuje własny artifact lifecycle.

## 12. Role, stany i bezpieczeństwo

Facilitator zarządza fazą, timerem, voting i moderation; Owner zatwierdza
outcomes; uczestnicy wnoszą treść zgodnie z policy. Anonymous mode ukrywa
tożsamość w UI i downstream, ale stosuje określoną audit/privacy policy.

Stany dodatkowe: joining/reconnecting, offline changes, voting open/closed,
anonymous, facilitation locked, large-board mode, unsupported embed i source
revoked.

## 13. MVP i później

P0: sticky/text/shape/connector/frame, basic drawing/image, collaboration,
comments, phases, timer, voting, clustering/synthesis proposals, snapshots,
transform, export i handoff.

P1: advanced facilitation templates, presentation scenes, moderation i Meeting
integration. P2: rozbudowane animacje, eksperymentalne efekty przestrzenne i
zaawansowane analytics — dopiero po stabilności współpracy i persistence.

## 14. Test odbiorczy

`create workshop from Meeting → invite/join → capture in parallel → cluster with
AI proposal → vote → preserve minority view → accept outcomes → transform one
frame to Mind Map and another to Table → hand off Decision → read-back`.

## 15. AS-IS, MVP, wejścia/wyjścia i pytania

Macierz dowodów, braków i decyzji `WB-Q01..05` znajduje się w
[`IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md).
Do potwierdzenia pozostają poziom anonimowości, ownership outcomes, granica
głosowanie/decyzja oraz wydajność współpracy dużego boardu.
