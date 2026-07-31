---
document_id: IDEAS-MIND-MAP-CONTRACT
module: My Work / Ideas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Ideas — Mind Map

Szczegółowy, normatywny opis trzech trybów rozpoczęcia, menu, myszy, klawiatury,
context menu, layoutu, grafiki, 12 template, AI i zakresu MVP znajduje się w
[`IDEAS_MIND_MAP_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_MIND_MAP_INTERACTION_AND_VISUAL_STANDARD.md).

## 1. Cel

Mind Map pomaga zobaczyć strukturę problemu: pojęcia, przyczyny, skutki,
interesariuszy, hipotezy, zależności, evidence i luki. Jest narzędziem myślenia
relacyjnego, a nie ozdobnym diagramem ani źródłem zatwierdzonej prawdy.

## 2. Obiekty

- node: idea, question, fact, assumption, evidence, problem, cause, effect,
  opportunity, option, risk, stakeholder, KPI, outcome;
- edge: relates, causes, supports, contradicts, depends on, blocks, part of;
- frame/cluster, branch, annotation i source reference;
- snapshot, comment, assignment reference i AI proposal.

Każdy krytyczny node ma provenance posture: `user-authored`, `source-grounded`,
`AI proposal`, `assumption` albo `unresolved`.

## 3. Funkcje

1. tworzenie i edycja node/edge;
2. drag, connect, group, frame, collapse i sub-map;
3. zoom, pan, minimap, fit, search i focus;
4. templates i starting points;
5. attachments, evidence, comments i mentions;
6. auto-layout bez zmiany semantyki;
7. compare branches i snapshots;
8. presentation/export;
9. transform zaznaczenia do Table, Flow albo Whiteboard;
10. handoff wybranych outcomes.

## 4. Teresa

Może proponować gałęzie, clustering, missing perspectives, dependencies,
contradictions, blind spots, evidence gaps, summaries i what-if scenarios.
Zmiany pojawiają się jako diff/proposal. Auto-layout może być bezpośrednią akcją
UI, ale semantyczne dodanie/usunięcie/połączenie wymaga review.

## 5. Standard jakości

Mapa jest review ready, gdy ma jasno nazwany centralny problem/cel, czytelne
typy relacji, oddzielone facts/assumptions, widoczne źródła i sprzeczności,
kontrolowaną głębokość oraz zaznaczone outcomes/open questions.

## 6. Granice

- scoring wielu rekordów należy do Table;
- wykonawcza sekwencja i warunki należą do Process Flow;
- swobodna facylitacja warsztatu należy do Whiteboard;
- Task/Decision/Initiative powstaje dopiero przez handoff.

## 7. Golden flow i DoD

`start from purpose/source → build branches → attach evidence → ask Teresa for
gaps/relations → review proposals → mark outcomes → transform or hand off`

DoD: persistence, undo/redo, snapshot restore, provenance, accessible keyboard,
large-map performance, transform preview i owner read-back mają testy.

## 8. Menu i anatomia

Mind Map stosuje wspólny
[`shell Ideas`](IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md).

Specyficzne Menu 3:

- layout: free, tree, radial, force-directed;
- depth/collapse i sub-map breadcrumb;
- relation/type filters;
- compare branches;
- map health/provenance overlay;
- AI: expand branch, cluster, find blind spots, dependencies, contradictions;
- presentation i export map.

Lewy toolbar: select/hand, node, child/sibling, connector, frame, text/image,
source card. Inspector: node type/content, relation meaning, evidence, owner,
tags, confidence, comments i history.

## 9. Pełny katalog funkcji

| Grupa | Funkcje |
| --- | --- |
| Capture | quick node, paste outline, voice-to-node, source/document-to-map |
| Structure | hierarchy, free relations, clusters, frames, sub-maps, labels |
| Navigate | search, focus, breadcrumbs, collapse, minimap, large-map mode |
| Edit | multi-select, align, distribute, duplicate, batch type/tag/style |
| Analyse | gaps, duplicates, dependencies, sentiment/heatmap, branch compare |
| Collaborate | comments, mentions, assignments refs, presence, activity |
| Govern | node provenance, evidence coverage, AI diff, snapshots |
| Present | scenes, presentation mode, image/PDF/PPT/diagram-code export |
| Transform | selected/full map → Table, Flow, Whiteboard |
| Handoff | selected outcomes → Task/Decision/Initiative/Material proposal |

## 10. Wejścia, wyjścia i integracje

Wejścia: outline, dokument, Interview/Meeting transcript, Notebook page, Tool
Output, Whiteboard cluster, Table rows i Flow. Import tworzy mapping preview.

Wyjścia: derived artifacts, image/PDF/PPT, embedded map, accepted outcome oraz
proposals downstream. Chat/Teresa może otworzyć mapę z kontekstem, ale nie
tworzy accepted nodes bez review.

## 11. Role, stany i bezpieczeństwo

Owner/Editor może zmieniać strukturę; Contributor dodaje i komentuje w zakresie;
Viewer czyta. Restricted evidence nie może pojawić się w labelu, AI summary,
export ani liczniku. Przy utracie source node zostaje oznaczony, nie usunięty.

Stany dodatkowe: orphan nodes, invalid edge type, layout running, source stale,
AI proposal conflict, map too large i snapshot restore preview.

## 12. MVP i później

P0: node/edge/frame, podstawowe layouty, save/history, sources, comments, AI
proposal review, transform do Table/Flow/Whiteboard, export PNG/PDF i handoff.

P1: sub-maps, branch compare, advanced provenance overlay, presentation scenes,
PPT i collaboration hardening. P2: 3D, zaawansowane heatmaps, what-if simulation
i rozbudowane analytics — tylko po stabilnym golden flow.

## 13. Test odbiorczy

`create from Interview source → build/AI-expand branches → attach evidence →
resolve contradiction → snapshot → transform selection to Table → compare
derived mapping → create Initiative Proposal Draft → owner read-back`.

## 14. Pierwszeństwo dokumentów

Ten plik definiuje cel, model domenowy i granice Mind Map. Wspólny shell Ideas
definiuje zachowania wspólne, a dokument Interaction and Visual Standard
definiuje szczegółowe zachowania Mind Map. W przypadku różnicy bardziej
szczegółowy kontrakt ma pierwszeństwo, o ile nie narusza provenance, approval,
ACL ani owner read-back.

## 15. AS-IS, MVP, wejścia/wyjścia i pytania

Macierz dowodów, braków i decyzji `MM-Q01..05` znajduje się w
[`IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md).
Do ich zamknięcia nie uznajemy katalogu template, large-map UX,
multi-artifact storage ani pełnego downstream read-back za gotowe.
