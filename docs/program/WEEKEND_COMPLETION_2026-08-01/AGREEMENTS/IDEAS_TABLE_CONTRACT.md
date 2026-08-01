---
document_id: IDEAS-TABLE-CONTRACT
module: My Work / Ideas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Ideas — Table

Szczegółowy, normatywny opis startów, modelu danych, Menu 2/3, siatki,
klawiatury, menu kontekstowego, views, formuł, grafiki, 12 template i MVP:
[`IDEAS_TABLE_INTERACTION_AND_VISUAL_STANDARD.md`](IDEAS_TABLE_INTERACTION_AND_VISUAL_STANDARD.md).

## 1. Cel

Table zamienia zbiór pomysłów, hipotez lub obserwacji w porównywalny rejestr.
Pozwala klasyfikować, filtrować, oceniać, deduplikować i wybierać elementy.
Nie jest zamiennikiem Excela ani ogólną bazą danych.

## 2. Obiekty

- Table Artifact, schema/version i saved views;
- rows z stable ID i source relation;
- fields: text, long text, number, unit, score, select, status, owner, date,
  checkbox, source/evidence, relation, formula/derived i AI proposal;
- validation rule, scoring model, filter, sort, group i selection;
- row/field provenance oraz confidence.

## 3. Funkcje

1. start z template, pustej tabeli, source pack lub transformacji;
2. dodawanie/edycja pól i rekordów;
3. sort, filter, group, search, freeze i resize;
4. saved views i role-aware columns;
5. validation, missing values i duplicate detection;
6. scoring/prioritisation z widoczną formułą i wagami;
7. bulk edit/import/export z preview;
8. comments, evidence, owners i relations;
9. transform selected rows do Mind Map, Flow lub Whiteboard;
10. handoff selected rows jako proposals.

## 4. Teresa

Może zaproponować schema, sklasyfikować rekordy, uzupełnić pola na podstawie
źródeł, wykryć duplikaty, zaproponować merge, scoring, priorytety i brakujące
dane. Każda wartość AI ma status, źródło i diff; AI nie nadpisuje wartości
człowieka ani nie ukrywa formuły scoringowej.

## 5. Standard jakości

Tabela ma jeden opisany unit of analysis, jednoznaczne pola, stabilne typy,
brak mieszania facts i recommendations, widoczne missing/invalid, jawne
formuły/wagi oraz source coverage dla elementów kierowanych downstream.

## 6. Typowe template

- idea/opportunity register;
- hypothesis/evidence table;
- options comparison;
- prioritisation matrix;
- risk/assumption register;
- stakeholder needs;
- action/outcome candidates.

Template nie może podszywać się pod Finance model, KPI registry ani canonical
Task/Decision/Initiative registry.

## 7. Golden flow i DoD

`choose unit/template → build/import rows → define fields → validate/deduplicate
→ compare/score → review AI proposals → select outcomes → transform or hand off`

DoD: duże zbiory są wirtualizowane, bulk changes mają preview/undo, schema i
views się zapisują, formula/scoring jest audytowalny, export respektuje ACL, a
pełny handoff zachowuje selected row IDs i evidence.

## 8. Menu i anatomia

Table stosuje wspólny
[`shell Ideas`](IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md).

Specyficzne Menu 3:

- view, density i freeze;
- filter, sort, group i saved views;
- fields/schema;
- validation i quality;
- formula/scoring configuration;
- AI: generate schema/rows, classify, enrich, deduplicate, score, summarize;
- import/export.

Object toolbar działa na cell/row/column/selection. Inspector pokazuje field
definition, source, validation, formula, confidence, comments i change history.

## 9. Pełny katalog funkcji

| Grupa | Funkcje |
| --- | --- |
| Start | template, blank, paste/import, source-to-table, transform |
| Schema | add/type/configure/reorder/hide fields, validation, defaults |
| Records | create/edit/duplicate/delete, bulk update, relations, attachments |
| Views | filter, sort, group, search, freeze, density, saved/private/shared views |
| Analyse | formulas, weighted scoring, compare, duplicates, gaps, distributions |
| AI | schema proposal, extraction, classification, enrichment, merge and scoring proposals |
| Govern | provenance per cell/row, confidence, manual override, validation report |
| Collaborate | comments, mentions, owners, presence and activity |
| Exchange | CSV/XLSX import-export, copy, Material embed/render |
| Transform/Handoff | rows → Map/Flow/Board oraz downstream proposals |

## 10. Wejścia, wyjścia i integracje

Wejścia: CSV/XLSX/table paste, documents, Idea artifacts, Interview insights,
Tool Outputs i Notebook lists. Spreadsheet import nie obiecuje pełnego silnika
Excela; unsupported formula jest jawna.

Wyjścia: CSV/XLSX/render, derived artifacts i selected-row proposals. Finance,
KPI, Tasks i Initiatives zachowują własne rejestry — Ideas Table wysyła payload,
nie staje się ich bazą.

## 11. Role, stany i bezpieczeństwo

Field/view permissions nie mogą ujawniać hidden values przez filter counts,
sort, AI ani export. Bulk write wymaga preview i undo. Formula error, invalid
value, source stale, sync conflict, partial import i large-table mode są jawne.

## 12. MVP i później

P0: podstawowe typy pól, schema, editing, filter/sort/group, saved view,
validation, simple formula/weighted scoring, sources, AI proposals, CSV/XLSX,
transform i handoff.

P1: richer relations, shared view permissions, advanced import mapping i chart
summary. P2: database-like automations oraz rozbudowane analytics nie wchodzą do
MVP; nie mogą zaciemniać roli narzędzia myślenia.

## 13. Test odbiorczy

`transform Whiteboard cluster → define schema → validate/classify rows → inspect
AI values and sources → configure transparent score → choose rows → transform
to Flow → hand off Decision/Initiative proposals → verify read-back`.

## 14. AS-IS, MVP, wejścia/wyjścia i pytania

Macierz dowodów, braków i decyzji `TB-Q01..05` znajduje się w
[`IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md).
Zakres formuł/XLSX, relation fields, scoring governance i akcja connector
`coming soon` wymagają jawnego rozstrzygnięcia.
