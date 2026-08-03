---
doc_kind: UI_COMPONENT_EVIDENCE_MATRIX
spec_status: APPROVED_SPEC
runtime_status: MISSING
owner: Piotr Wisniewski
last_updated: 2026-08-02
authority: docs/ui-standards/CANON.md
---

# Macierz evidence i odbioru komponentów

## 1. Statusy

- `SPEC_READY`: karta ma metrykę i 20 sekcji.
- `FIXTURE_READY`: istnieją dane normal/empty/long/error/no-access.
- `VISUAL_READY`: baseline light/dark 1440 oraz wymagane stany.
- `A11Y_READY`: keyboard + screen reader + focus + contrast.
- `REFERENCE_READY`: wszystkie poprzednie oraz zatwierdzenie odbierającego.
- `CANONICAL`: runtime skonsolidowany, konsumenci zmigrowani, brak aktywnego duplikatu.

## 2. Obowiązkowe identyfikatory evidence

`<COMPONENT_ID>__<STATE>__<THEME>__<VIEWPORT>__<LOCALE>`, np. `UI-TABLE-01__POPULATED__LIGHT__1440__PL`.

Każdy rekord wskazuje: fixture path, story/test route, screenshot path, test ID, audited commit, audit date, reviewer i wynik.

## 3. Minimalna macierz per rodzina

| Pakiet | Wymagane przypadki |
|---|---|
| data | normal, empty-first, empty-filtered, long text, many records, partial, error, no-access |
| interaction | default, hover, focus, pressed, selected, editing, saving, success, failure, recovery |
| environment | light, dark, PL, EN, 1280, 1440, 1920, 125%, 200%, reduced motion |
| accessibility | keyboard-only, screen-reader smoke, focus restore, contrast, target size |
| async | slow 2 s, timeout, retry, cancellation, stale response, conflict |

## 4. Rejestr 26 rodzin

| ID | Spec | Fixture | Visual | A11y | Runtime | Referencja |
|---|---|---|---|---|---|---|
| UI-SHELL-01 | SPEC_READY | planned | audit only | planned | partial | Tasks/Decisions shell candidate |
| UI-HUB-01 | SPEC_READY | planned | audit only | planned | partial | Tasks/Decisions hub candidate |
| UI-TABLE-01 | SPEC_READY | planned | audit only | planned | partial | Tasks/Decisions table candidate |
| UI-PREVIEW-01 | SPEC_READY | planned | audit only | planned | partial | Tasks/Decisions preview candidate |
| UI-ACTION-01 | SPEC_READY | planned | audit only | planned | partial | Tasks/Decisions actions candidate |
| UI-CARD-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-KANBAN-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-CALENDAR-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-OVERLAY-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-FORM-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-CREATE-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-STATE-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-STATUS-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-NOTIFY-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-REL-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-PERM-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-NMODE-01 | SPEC_READY | planned | audit only | planned | partial | Tasks/Decisions candidate |
| UI-EDITOR-01 | SPEC_READY | planned | audit only | planned | partial | Notebook audit evidence |
| UI-SHEET-01 | SPEC_READY | planned | audit only | planned | partial | — |
| UI-CANVAS-01 | SPEC_READY | planned | audit only | planned | partial | — |
| UI-IDEA-01 | SPEC_READY | planned | audit only | planned | partial | — |
| UI-ART-01 | SPEC_READY | planned | audit only | planned | partial | — |
| UI-DECK-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-TOOL-01 | SPEC_READY | planned | audit only | planned | partial | — |
| UI-AI-01 | SPEC_READY | planned | planned | planned | partial | — |
| UI-HELP-01 | SPEC_READY | planned | planned | planned | partial | — |

Status `audit only` nie oznacza akceptacji. Macierz jest aktualizowana wyłącznie na podstawie rzeczywistych plików i testów, nie deklaracji.
