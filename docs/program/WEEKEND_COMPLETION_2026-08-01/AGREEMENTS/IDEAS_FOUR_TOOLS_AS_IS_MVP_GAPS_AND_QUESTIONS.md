---
document_id: IDEAS-FOUR-TOOLS-AS-IS-MVP-GAPS-QUESTIONS
module: My Work / Ideas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Ideas — remanent czterech narzędzi, MVP, luki i pytania

## 1. Skala oceny

- **EVIDENCED** — kod i test potwierdzają zachowanie;
- **PARTIAL** — działa fragment, ale brakuje pełnego flow lub jakości;
- **UNVERIFIED** — powierzchnia istnieje bez wystarczającego odbioru;
- **MISSING** — brak funkcji docelowej;
- **HIDE** — ukryć w MVP do czasu domknięcia.

Istnienie komponentu nie jest dowodem gotowości produktu.

## 2. Wspólna architektura AS-IS i TO-BE

AS-IS posiada CRUD Ideas, `IdeaMapWorkspace`, cztery tool modes, zapis
`/map`/`/map/sync`, AI, snapshots, comments, activity, presence, exports,
transforms i convert endpoints oraz liczne testy.

Formaty współdzielą jednak jeden dokument `my_idea_maps`; dane formatowe są
przechowywane w mapie i extensions. Backend ma zabezpieczenia przed wzajemnym
nadpisywaniem extensions przez runtimes. To wartościowa kompatybilność, ale nie
docelowy model wielu artefaktów wewnątrz jednej Idea.

TO-BE wymaga `IdeaArtifact` z własnym ID, type, version i payload. Transformacja
tworzy derived artifact. Compatibility adapter czyta stary dokument, migracja
jest odwracalna, a stare dane nie są usuwane przed porównaniem i odbiorem.

## 3. Mind Map — stan

| Obszar | Ocena | Uzasadnienie |
| --- | --- | --- |
| node/edge/map i persistence | EVIDENCED | runtime, API map/sync i liczne testy |
| toolbars/interaction | EVIDENCED/PARTIAL | testy istnieją; spójność/estetyka wymaga odbioru |
| AI expand/suggestions/gaps | EVIDENCED | endpoints i AI proposal tests |
| snapshots/comments/activity | EVIDENCED | działające endpoints |
| layout/virtualization | EVIDENCED/PARTIAL | testy istnieją; brak jednego XL UX gate |
| exports | EVIDENCED/PARTIAL | PPT/JSON/Markdown; visual QA nadal potrzebne |
| trzy tryby startu | PARTIAL | mechanizmy istnieją, brak jednego starter flow |
| 12 template | MISSING/PARTIAL | fragmenty są, brak zatwierdzonego katalogu |
| wiele map w Idea | MISSING | obecnie wspólny dokument |
| pełny downstream read-back | PARTIAL | convert istnieje, brak całego E2E |

## 4. Table — stan

| Obszar | Ocena | Uzasadnienie |
| --- | --- | --- |
| table runtime/edit/views | EVIDENCED | komponent, tests i E2E |
| fields/filter/sort/group | EVIDENCED/PARTIAL | szeroki runtime, potrzeba macierzy typów/mobile QA |
| AI action/fill | EVIDENCED/PARTIAL | endpoints i honesty test; brak pełnego proposal E2E |
| formula/scoring/heatmap | PARTIAL | kod istnieje; zakres i poprawność do odbioru |
| CSV | EVIDENCED | dedykowany endpoint |
| XLSX round-trip | UNVERIFIED | brak pełnego dowodu w Ideas flow |
| connector editing | MISSING | widoczny komunikat `coming soon` |
| transform/read-back | PARTIAL | transform test; owner E2E niepełny |
| wiele tabel w Idea | MISSING | wspólny document/config |

## 5. Process Flow — stan

| Obszar | Ocena | Uzasadnienie |
| --- | --- | --- |
| node/edge/lane editor | EVIDENCED | komponenty i M07 E2E |
| persistence/collaboration | EVIDENCED | unit i E2E |
| menu/panels/interactions | EVIDENCED/PARTIAL | testy; wspólny shell wymaga visual QA |
| AI proposals | EVIDENCED/PARTIAL | testy; source-to-flow flow do odbioru |
| validation/readiness | PARTIAL | reguły fragmentaryczne, brak jednego raportu |
| AS-IS/TO-BE compare | PARTIAL/UNVERIFIED | brak pełnego golden flow |
| export | EVIDENCED/PARTIAL | unit evidence, visual/semantic QA potrzebne |
| Run Agent handoff | PARTIAL | conversion istnieje, executable gate niepełny |
| wiele flow w Idea | MISSING | wspólny document/extensions |

## 6. Whiteboard — stan

| Obszar | Ocena | Uzasadnienie |
| --- | --- | --- |
| nodes/drawing/selection | EVIDENCED | smoke/E2E i unit tests |
| comments/reactions/images | EVIDENCED | UI i upload route tests |
| observer/read-only | EVIDENCED | canon i UI test |
| collaboration/presence | EVIDENCED/PARTIAL | hooks/E2E; load/reconnect do testu |
| snapshots/activity | EVIDENCED/PARTIAL | endpoints, restore depth do odbioru |
| AI brainstorm/cluster | EVIDENCED/PARTIAL | actions/tests, proposal flow do odbioru |
| phases/timer/voting | PARTIAL | fragmenty, brak jednego workshop flow |
| anonymous contribution | UNVERIFIED | brak zamkniętej policy i leakage testu |
| export | EVIDENCED/PARTIAL | test istnieje; formaty/ACL do odbioru |
| wiele boards w Idea | MISSING | wspólny document/extensions |

## 7. Wejścia

| Źródło | Minimalny payload | Typowe cele |
| --- | --- | --- |
| manual/voice/chat | text, author, time, scope | wszystkie |
| Notebook | page/version, blocks, links, ACL | Map/Table/Board, Flow po mappingu |
| Interview/Meeting | approved excerpts/insights, privacy, version | wszystkie |
| Tools/Assessment/Audit | approved output/finding/evidence | wszystkie zależnie od celu |
| Materials/files | file/version, extracted blocks, licence, confidentiality | wszystkie po preview |
| Idea artifact | artifact/version, selected IDs, relations, sources | cross-tool transform |
| CSV/XLSX | file, sheet/range, schema mapping, unsupported items | Table |
| outline/Markdown/OPML | hierarchy, source, parse warnings | Mind Map |
| SOP/process description | sections, actors, steps, uncertainty | Flow |

Import zwraca `accepted`, `transformed`, `skipped`, `unsupported` i
`needs review`. ACL/privacy przechodzi razem z treścią.

## 8. Wyjścia

| Wyjście | Minimalny payload | Właściciel |
| --- | --- | --- |
| Derived Artifact | source/version, selected IDs, mapping, loss report | Ideas |
| Accepted Outcome | statement, sources, evidence, owner, decision | Ideas |
| Task Proposal | result, source, suggested owner/due, acceptance | Tasks/owner module |
| Decision Proposal | question, options, evidence, decider, due | Decisions |
| Initiative Proposal Draft | problem, outcome, evidence, assumptions, scope | Ideas → Initiatives |
| Material Input | render/blocks, sources, confidentiality | Materials |
| Method Input | accepted context/evidence/scope | Tools/Assessment |
| Run Agent Proposal | flow version, steps, IO, permissions, failure policy | Run Agent |
| Export/share | format, artifact/version, selection, source notice, ACL | user/external |

## 9. Backlog MVP

### P0 wspólne

1. rozstrzygnąć i wdrożyć `shared map → IdeaArtifact` z kompatybilnością;
2. ujednolicić shell/menu/command model;
3. udowodnić save/exit/resume/conflict recovery;
4. spiąć Sources/Evidence i AI provenance;
5. transform preview z loss report;
6. read-back Task/Decision/Initiative/Material;
7. tenant/ACL/leakage tests;
8. ukryć dead/coming-soon actions.

### P0 per narzędzie

- Mind Map: trzy starty, core edit/layout/collapse/search, 12 template;
- Table: schema/edit/views/validation/scoring oraz potwierdzony CSV/XLSX scope;
- Flow: graph/lanes/conditions/validation/AS-IS-TO-BE;
- Whiteboard: objects/collaboration/facilitation/voting/synthesis.

P1 obejmuje zaawansowane import/export, presentation, compare, Meeting/Run
Agent i mobile hardening. P2/HIDE obejmuje 3D, eksperymentalne symulacje,
marketplace oraz kontrolki bez persistence/API/test.

## 10. Pytania wspólne

| ID | Pytanie | Rekomendacja |
| --- | --- | --- |
| IDE-Q01 | Czy Idea ma wiele artefaktów tego samego typu? | Tak; model docelowy. |
| IDE-Q02 | Czy derived artifact aktualizuje się automatycznie? | Nie; stale + preview refresh/merge. |
| IDE-Q03 | Kto zatwierdza outcome? | Idea Owner; opcjonalny Reviewer według policy. |
| IDE-Q04 | Czy prywatna Idea może być zespołowa? | Tak, po share impact preview. |
| IDE-Q05 | Czy artifact ma osobnego ownera? | Editor może być inny; Idea Owner pozostaje nadrzędny. |
| IDE-Q06 | Retencja snapshots/kosza? | Policy organizacji; decyzja w Admin później. |

## 11. Pytania narzędzi

### Mind Map

- `MM-Q01`: modifier free-move/reparent — dobrać prototypem Mac/Windows;
- `MM-Q02`: delete parent — dialog `branch/promote children/cancel`;
- `MM-Q03`: 12 globalnych template — tak, osobno templates użytkownika;
- `MM-Q04`: limit S/M/L/XL — ustalić pomiarem;
- `MM-Q05`: jeden primary root; dodatkowe drzewa jako cluster lub osobny artifact.

### Table

- `TB-Q01`: zakres formuł — mały jawny zestaw, bez obietnicy Excela;
- `TB-Q02`: XLSX — dane tak, pełny workbook należy do Materials/Sheets;
- `TB-Q03`: relations — tylko typowane i permission-checked;
- `TB-Q04`: connector `coming soon` — wdrożyć albo ukryć;
- `TB-Q05`: scoring zmienia Owner/Editor, wersjonowanie unieważnia stare wyniki.

### Process Flow

- `PF-Q01`: formalny BPMN — nie w core MVP;
- `PF-Q02`: simulate path nie wykonuje procesu;
- `PF-Q03`: TO-BE zatwierdza Process Owner + wymagani lane reviewers;
- `PF-Q04`: subprocess może być linked Flow artifact;
- `PF-Q05`: czasy/metryki tylko manual/source-linked bez udawania process mining.

### Whiteboard

- `WB-Q01`: rozdzielić pseudonymous i strict anonymous — decyzja privacy;
- `WB-Q02`: voting tworzy input, nie decyzję;
- `WB-Q03`: Facilitator prowadzi, Owner/Reviewer akceptuje outcomes;
- `WB-Q04`: limit boardu ustalić testem collaboration/render;
- `WB-Q05`: Meeting tworzy board tylko jawną akcją i z consent.

## 12. Co naprawdę blokuje

Przed implementacją P0 wymagają decyzji `IDE-Q01..03` i `WB-Q01`. Pozostałe
można zamknąć prototypem, testem wydajności lub odbiorem UX. Do tego czasu
niepewność pozostaje jawna w backlogu, a nie jest uzupełniana założeniem kodera.
