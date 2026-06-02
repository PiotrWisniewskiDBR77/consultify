---
doc_id: EXECUTION_PLAN_HARVEY_FOR_CONSULTING_2026_05_09
doc_kind: EXECUTION_PLAN
owner: user
status: active
last_updated: 2026-05-09
---

# Execution Plan — Consultify As Harvey For Consulting

## Mission

Consultify ma być spójnym systemem pracy konsultingowej: od rozmowy, danych i diagnozy do decyzji, inicjatyw, realizacji, KPI/ROI, finansów i gotowych artefaktów dla klienta.

Nie budujemy aplikacji od nowa. Budujemy perfekcyjny kontrakt funkcjonalny, UI/UX i operacyjny na bazie tego, co już jest w repo i w kodzie.

## Non-Negotiable Principles

- `DRD/consultify` jest aktywnym repo.
- `DRD/consultify/docs/modules/` jest kanonicznym katalogiem kontraktów modułów.
- Najpierw opisujemy **known truth / as-is**.
- RAW jest materiałem do docelowego kontraktu 2.0, nie zastępuje obecnego kontraktu.
- Każde wymaganie musi mieć źródło: istniejący SSOT/spec, kod, test/evidence albo decyzję autora.
- Moduły nie mogą być wyspami. Każdy moduł musi mieć inputs, outputs, ownership i handoffs.
- Nie tworzymy drugiego właściciela tego samego obiektu.

## Current Baseline

Already established:

- 19 module folders exist under `DRD/consultify/docs/modules/`.
- Each module has the 14-file contract structure.
- `_AUTHOR_CONTRACT_COVERAGE_2026-05-09.md` records current coverage.
- `_PERFECT_CONSULTIFY_CONTRACT_WORKPLAN_2026-05-09.md` records the high-level program.

## Workstreams

### WS1 — Current Truth Audit

Goal: every module contract reflects what the repo and code already say.

Steps:

1. Read `SSOT.md`.
2. Read linked source docs.
3. Verify route/sidebar/component/API in code.
4. Update `CODEMAP.md`.
5. Update `STATUS.md` as `real`, `partial`, `planned`, `soon`, or `stub`.
6. Update `00-07` only with sourced truth.

Exit criteria:

- No broken `DRD/.../*.md` references.
- No placeholder requirements.
- Every module has known inputs, outputs, owner objects and handoffs.

### WS2 — Application Operating Model

Goal: define Consultify as one consulting work system.

Deliverables:

- `APPLICATION_OPERATING_MODEL.md`
- `MODULE_HANDOFFS.md`
- `OBJECT_GRAPH.md`

Core loop:

`Czat / Teresa -> Moja Praca -> Wywiad / Narzędzia -> Inicjatywy -> Realizacja -> Rezultaty -> Finanse -> Outputs -> Dokumenty / Prezentacje / Tabele -> Meeting / follow-up`

Shared layers:

- `Organizacja`: context, knowledge and memory layer.
- `Panel Administratora`: tenant/admin control.
- `Ustawienia`: user/workspace preferences.
- `MCP IRIS` and `MCP Marketplace`: integrations.
- `Portal Partnerski`: partner business track.

### WS3 — UI/UX Contract

Goal: define UX as a contract, not visual commentary.

Deliverable:

- `UI_UX_CONTRACT_INDEX.md`

Each module `04_UI_UX.md` must define:

- main screen and primary job,
- Menu 2 / Menu 3,
- AI action placement,
- loading / empty / error / degraded / success states,
- source/provenance/evidence UI,
- approval/diff/review UI,
- anti-patterns,
- how the user knows what to do next.

### WS4 — Code Reality Mapping

Goal: connect docs to code without guessing.

For each module:

- sidebar entry,
- route,
- AppView,
- main component,
- main API endpoints,
- data models/types,
- key tests/evidence.

Output:

- `CODEMAP.md` per module becomes factual and implementation-linked.

### WS5 — RAW To Target State

Goal: transform raw author material into target-state contract 2.0.

Rules:

1. RAW stays verbatim.
2. Requirements are classified.
3. Contract updates are written in MUST / SHOULD / MUST NOT language.
4. Behavioral changes update version and changelog.
5. Every target-state change gets acceptance criteria.

## Sprint Plan

### Sprint 1 — Global System Backbone

Create and validate:

- `APPLICATION_OPERATING_MODEL.md`
- `OBJECT_GRAPH.md`
- `MODULE_HANDOFFS.md`
- `UI_UX_CONTRACT_INDEX.md`

Gate:

- Every module appears in the global model.
- Every core object has an owner.
- Every handoff has source and destination.

### Sprint 2 — Code Reality Pass

For all 19 modules:

- verify route,
- verify sidebar entry,
- verify main component,
- verify available tests/evidence,
- update `CODEMAP.md` and `STATUS.md`.

Gate:

- No “route to confirm” remains unless explicitly marked as `CODE_GAP`.

### Sprint 3 — Module Contract Deepening

Deepen `00-07` from source docs in priority order:

1. `01_czat`
2. `05_inicjatywy`
3. `06_realizacja`
4. `07_rezultaty`
5. `08_finanse`
6. `09_outputs`
7. `10_dokumenty`
8. `11_tabele`
9. `12_prezentacje`
10. Remaining modules

Gate:

- Every module answers why / scope / behavior / UI / data / permissions / acceptance without guessing.

### Sprint 4 — RAW Target-State Conversion

Use:

- `DRD/consultify/docs/UI_UX/*_RAW_*.md`
- `DRD/consultify/docs/RAW/`
- module `RAW_INPUT.md`

Output:

- target-state delta per module,
- contract version 2.0 candidates,
- roadmap / epic list,
- acceptance criteria for future implementation.

## Hard Stops

- Stop if a module has no clear owner object.
- Stop if a handoff duplicates canonical storage.
- Stop if security/tenant boundaries are unclear.
- Stop if UI action placement violates Menu 3 governance.
- Stop if a RAW requirement conflicts with current shipped behavior and no version decision exists.

## Definition Of Done

The program is ready when every module has:

- verified sources,
- verified code map,
- clear purpose,
- clear scope,
- clear behavior contract,
- clear UI/UX contract,
- clear object/data contract,
- clear permission/security contract,
- clear acceptance/test contract,
- explicit handoffs to other modules,
- documented contribution to “Harvey for consulting”.
