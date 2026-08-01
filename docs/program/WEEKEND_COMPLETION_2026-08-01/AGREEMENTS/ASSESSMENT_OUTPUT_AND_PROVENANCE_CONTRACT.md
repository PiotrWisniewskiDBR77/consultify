---
document_id: ASSESSMENT-OUTPUT-PROVENANCE-CONTRACT
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment — Output, Deliverable, Initiative i provenance

## 1. Rozdzielenie obiektów

- Assessment Output — immutable wynik zamrożonej sesji;
- Deliverable — raport/deck/sheet publikowany przez Materials;
- Initiative Proposal Draft — propozycja wynikająca z findings;
- Registered Initiative — obiekt Initiatives dopiero po Source Validation.

Output i Deliverable mogą powstać niezależnie; raport nie jest warunkiem
utworzenia Proposal Draft.

## 2. Assessment Output

Zawiera methodology/version, scope, snapshot id, current/target/gap,
aggregation, visual model, evidence completeness, limitations, findings,
prioritisation result i lineage. Jest read-only; revision pochodzi z nowego
freeze.

## 3. Finding

Zawiera unit, score/gap, supporting i contradicting evidence, business meaning,
root-cause hypothesis, risk/opportunity, recommendation, prerequisite,
expected outcome, KPI proposal, confidence i source locators.

## 4. Grafika

Matrix/radar/heatmap/gap chart w Workbench, Output i Deliverable są renderami
tego samego snapshot data model. Presentation Studio otrzymuje semantic
PresentationSourceBlocks, nie screenshoty bez provenance.

## 5. Initiative Draft

Zachowuje source assessment, output snapshot, findings, rationale, expected
outcome, KPI proposal, dependencies, risks i evidence links. Teresa może
grupować/deduplikować i proponować; człowiek wybiera `Register as Initiative`.

## 6. Impact i unieważnienie

Reopen nie modyfikuje starego Outputu. Nowy freeze tworzy nową wersję, a
wcześniejsze Deliverables/Drafts dostają status `superseded/source updated`,
bez cichego przepisania treści.
