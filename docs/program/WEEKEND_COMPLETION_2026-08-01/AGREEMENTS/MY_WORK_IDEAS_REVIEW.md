---
agreement_id: MW-IDEAS-AGR-01
module: My Work
function: Ideas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# My Work — Ideas

## 1. Obietnica

Ideas jest przestrzenią, w której użytkownik przechodzi od nieuporządkowanej
myśli do sprawdzonego i możliwego do wykorzystania rezultatu. Może wybrać taki
format pracy, jaki najlepiej odpowiada problemowi:

- **Mind Map** — relacje, obszary, przyczyny i zależności;
- **Table** — porównanie, klasyfikacja, scoring i selekcja;
- **Process Flow** — przebieg, decyzje, role i handoffy;
- **Whiteboard** — swobodna praca, warsztat i wspólna synteza.

Ideas nie jest portfelem inicjatyw, systemem zadań, bazą danych ani silnikiem
workflow. Przygotowuje kontrolowane propozycje dla systemów właścicielskich.

## 2. Model współpracy czterech narzędzi

Jedna `Idea` jest kontenerem wspólnego kontekstu. Wewnątrz może posiadać wiele
powiązanych artefaktów każdego typu.

```text
Idea Context
├── Mind Map artifacts
├── Table artifacts
├── Process Flow artifacts
└── Whiteboard artifacts
```

Artefakty współdzielą purpose, source pack, uczestników, tags, AI context,
activity, outcome register i lineage. Zachowują jednak własne modele danych.

Przełączenie narzędzia nie udaje bezstratnego renderowania. Użytkownik może:

- otworzyć istniejący artefakt;
- utworzyć pusty artefakt w tym samym kontekście;
- wykonać transformację całego artefaktu albo zaznaczenia;
- porównać source i derived artifact;
- wrócić bez utraty wcześniejszej wersji.

## 3. Lifecycle Idea

`Captured → Exploring → Structured → Needs evidence → Review ready → Outcome
accepted → Handed off → Archived / Reopened`

Status Idea nie jest statusem Initiative. `Outcome accepted` oznacza, że wynik
pracy został zaakceptowany wewnątrz workspace, nie że downstream object powstał.

## 4. Idea Context Packet

Każde narzędzie otrzymuje:

- `ideaId`, purpose, problem/opportunity i owner;
- organization/project scope i participants;
- source objects, files, excerpts i evidence refs;
- accepted facts, assumptions, hypotheses i open questions;
- active artifacts oraz relations między nimi;
- constraints, terminology i language;
- AI policy, privacy i permissions;
- accepted outcomes, decisions i unresolved conflicts;
- target tool/owner module przy transformacji lub handoffie.

## 5. Wspólny układ pracy

1. powrót do listy Ideas oraz breadcrumb;
2. tytuł, status, owner, save state i collaborators;
3. przełącznik czterech narzędzi i lista artefaktów;
4. canvas/table jako główny obszar;
5. kontekstowe właściwości zaznaczenia;
6. Teresa, sources, comments, history i activity w panelach;
7. transform, review, export i handoff jako jawne akcje;
8. save, exit, resume, undo/redo i snapshots.

Ten sam kanon nawigacji, kolorów, zaznaczenia, provenance i AI obowiązuje we
wszystkich czterech narzędziach.

## 6. Teresa

Teresa pracuje w rolach zależnych od etapu:

| Etap | Rola | Przykładowe działania |
| --- | --- | --- |
| Capture | Facylitator | doprecyzowuje cel i proponuje format |
| Explore | Research partner | rozwija obszary, pytania i alternatywy |
| Structure | Architect | grupuje, porządkuje i proponuje model |
| Challenge | Challenger | szuka luk, bias, sprzeczności i kontrdowodów |
| Converge | Synthesizer | proponuje outcomes i warianty |
| Handoff | Translator | mapuje wynik do kontraktu systemu docelowego |

Każde działanie AI ma nazwany cel, zakres, źródła i preview zmian. Teresa nie
stosuje zmian, nie wykonuje konwersji i nie zapisuje downstream bez akceptacji.

## 7. Outcomes i handoff

Zaakceptowany element lub zestaw może utworzyć proposal dla:

- Task;
- Decision Case;
- Initiative Proposal Draft;
- Material/report/presentation input;
- Tool albo Assessment input;
- Notebook page;
- nowego artefaktu Ideas.

Handoff zawiera source artifact/version, selected element IDs, evidence,
assumptions, accepted outcome, target intent i blockers. Sukces jest pokazany
dopiero po read-backu systemu docelowego.

## 8. Cross-tool transforms

| Źródło → cel | Typowe zastosowanie |
| --- | --- |
| Whiteboard → Mind Map | uporządkowanie warsztatowych karteczek w relacje |
| Whiteboard → Table | zamiana pomysłów/wyników głosowania na rejestr |
| Mind Map → Table | porównanie węzłów według wspólnych kryteriów |
| Mind Map → Flow | zamiana zależności lub user journey na przebieg |
| Table → Mind Map | pokazanie relacji, klastrów i konfliktów |
| Table → Flow | zamiana wybranych rekordów/kroków w sekwencję |
| Flow → Table | rejestr kroków, ról, ryzyk i usprawnień |
| Flow → Whiteboard | warsztat przeprojektowania procesu |

Transformacja tworzy `derived artifact`; nie nadpisuje źródła. Preview pokazuje
mapping, elementy pominięte, wygenerowane assumptions i spodziewaną utratę
struktury. Wynik stratny ma status `Needs review`.

## 9. Role i współpraca

- Owner zarządza Idea i zatwierdza outcomes/handoffs;
- Editor edytuje dozwolone artefakty;
- Contributor dodaje elementy, komentarze i evidence;
- Viewer czyta;
- Facilitator prowadzi Whiteboard/session;
- Reviewer zatwierdza wynik, jeśli wymaga tego workspace policy.

Komentarze, mentions, cursors i activity nie mogą zastąpić Tasks/Decisions.
Konflikt równoczesnej edycji jest widoczny i możliwy do rozwiązania.

## 10. AS-IS i luki

Repo zawiera rozbudowane runtime oraz wiele zaawansowanych fragmentów dla
wszystkich czterech narzędzi. Największym ryzykiem nie jest brak funkcji, lecz
ich mnogość, niespójna dojrzałość i niepełne spięcie.

Priorytety:

1. jeden stabilny Idea lifecycle i Context Packet;
2. jeden format switcher i artifact library;
3. niezawodne save/exit/resume/version history;
4. pełne transform preview oraz provenance;
5. jeden AI proposal pattern;
6. owner-module read-back;
7. usunięcie lub ukrycie funkcji bez pełnego backendu/testu;
8. E2E `capture → work → transform → outcome → handoff`.

## 11. Golden flow

`create Idea → define purpose → choose/start tool → work manually or with
Teresa → add sources/evidence → transform to second tool → review differences →
accept outcomes → hand off selected outcome → receive owner read-back`

## 12. Dokumenty narzędzi

- [`IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md`](IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md)
  — obowiązkowa wspólna anatomia, menu, stany i mechanika;
- [`IDEAS_MIND_MAP_CONTRACT.md`](IDEAS_MIND_MAP_CONTRACT.md)
- [`IDEAS_MIND_MAP_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_MIND_MAP_INTERACTION_AND_VISUAL_STANDARD.md)
  — precyzyjne menu, sterowanie, grafika, template i trzy sposoby pracy;
- [`IDEAS_TABLE_CONTRACT.md`](IDEAS_TABLE_CONTRACT.md)
- [`IDEAS_TABLE_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_TABLE_INTERACTION_AND_VISUAL_STANDARD.md)
  — precyzyjne menu, siatka, views, formuły, grafika i 12 template;
- [`IDEAS_PROCESS_FLOW_CONTRACT.md`](IDEAS_PROCESS_FLOW_CONTRACT.md)
- [`IDEAS_PROCESS_FLOW_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_PROCESS_FLOW_INTERACTION_AND_VISUAL_STANDARD.md)
  — język procesu, sterowanie, lanes, walidacja, AS-IS/TO-BE i Run Agent;
- [`IDEAS_WHITEBOARD_CONTRACT.md`](IDEAS_WHITEBOARD_CONTRACT.md)
- [`IDEAS_WHITEBOARD_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_WHITEBOARD_INTERACTION_AND_VISUAL_STANDARD.md)
  — canvas, facylitacja, timer, spotlight, voting, privacy i 12 template.

## 13. Granica wspólne vs odrębne

| Wspólne | Odrębne |
| --- | --- |
| Idea Context, artifact identity, save/exit/resume | model elementów i ich semantyka |
| Menu 2, układ Menu 3 i inspector | środkowe kontrolki Menu 3 |
| Sources, evidence, comments i history | toolbar tworzenia obiektów |
| Teresa proposal/review pattern | domenowe akcje AI |
| transform/handoff shell | walidacja jakości artefaktu |
| role, ACL, collaboration i audit | template i sposoby prezentacji |
| lifecycle oraz accepted outcomes | import/export specyficzny dla formatu |

Pełny standard wspólny ma pierwszeństwo przed lokalnymi implementacjami. Kontrakt
narzędzia może dodać funkcję, ale nie może zmienić reguł provenance, approval,
save, access ani owner read-back.

## 14. MVP rodziny

Ideas wchodzi do MVP jako kompletny golden flow, nie jako suma demonstracyjnych
kontrolek. Szczegółowa wspólna bramka znajduje się w dokumencie shellu. Każde z
czterech narzędzi ma ponadto własny zakres P0/P1/P2 i test odbiorczy.

## 15. Remanent, luki i otwarte pytania

Dowody AS-IS, różnice względem MVP, kompletne wejścia/wyjścia, backlog oraz
rejestr decyzji znajdują się w
[`IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md).

Najważniejsza luka architektoniczna: aktualny runtime przechowuje formaty we
wspólnym dokumencie mapy i extensions, podczas gdy model docelowy wymaga wielu
wersjonowanych `IdeaArtifact`. Migracja musi być kompatybilna i odwracalna.
