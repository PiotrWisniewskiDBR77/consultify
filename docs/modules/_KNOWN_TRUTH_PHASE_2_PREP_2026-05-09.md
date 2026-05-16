---
doc_id: KNOWN_TRUTH_PHASE_2_PREP_2026_05_09
doc_kind: AUDIT_PREP
owner: user
status: active
last_updated: 2026-05-09
---

# Phase 2 Prep — As-Is / Known Truth

## Goal

Prepare the “As-Is / Known Truth” pass for all Consultify modules.

This phase does not use RAW author material as target-state vision. It only describes what is already present in:

- module `SSOT.md`,
- `docs/product/DOCUMENTATION_REGISTRY.md`,
- `docs/modules/MODULE_ROUTING_ARCHITECTURE.md`,
- old product specs,
- current sidebar/routing/component code,
- existing tests and evidence.

## Output

Every module must receive an honest current-state description:

- what is real in code,
- what is documented but partial,
- what is planned or soon,
- what is legacy/deprecated,
- what is duplicated,
- what is missing or unresolved.

The immediate working artifact is:

- `_KNOWN_TRUTH_MODULE_AUDIT_MATRIX_2026-05-09.md`

## Source Hierarchy

Use this order when sources conflict:

1. Real code: sidebar, routes, components, API, tests.
2. `docs/modules/MODULE_ROUTING_ARCHITECTURE.md` for canonical module boundaries.
3. `docs/product/DOCUMENTATION_REGISTRY.md` for canonical vs legacy product documents.
4. Module-local `SSOT.md` as the curated source map.
5. Historical product specs as reference only unless registry marks them canonical.
6. Author RAW files only after this phase, not during known-truth classification.

## Mandatory Code Checkpoints

Each module audit must verify:

- sidebar item in `src/components/navigation/Sidebar/menuConfig.ts`,
- route in `src/routes/routeConfig.ts`,
- rendered route/component in `src/routes/AppRoutes.tsx`,
- AppView mapping in `src/types/core.ts`,
- main component or view path,
- API/service/model paths when present,
- tests/evidence when present.

## Status Vocabulary

Use only these status values:

- `real`: visible in sidebar/routing and renders a module-specific component or hub.
- `partial`: visible/routed but implementation is incomplete, mixed with legacy, or split across old/new components.
- `planned`: documented but not visible as real code path.
- `soon`: visible as sidebar/route but intentionally blocked by coming-soon/contact-required UI.
- `stub`: route exists but renders a generic placeholder.
- `deprecated`: route/code exists only for redirects or backward compatibility.
- `duplicate`: module or route duplicates another canonical module.
- `code_gap`: docs assert behavior that code check cannot confirm.
- `doc_gap`: code has behavior that module docs do not yet capture.

## Per-Module Audit Procedure

For each module folder:

1. Read `SSOT.md`.
2. Extract source docs and check whether files exist.
3. Read relevant entries in `DOCUMENTATION_REGISTRY.md`.
4. Read relevant entries in `MODULE_ROUTING_ARCHITECTURE.md`.
5. Verify sidebar item, route, AppView and rendered component.
6. Search for API/service/model/test coverage.
7. Update the audit matrix with:
   - current status,
   - confirmed facts,
   - contradictions,
   - next edit targets.
8. Only after the matrix is complete, update module `CODEMAP.md`, `STATUS.md` and then `00-07`.

## Known Initial Tensions To Preserve

Do not hide these differences during the audit:

- `MODULE_ROUTING_ARCHITECTURE.md` still documents an older flow: `Chat -> Interview -> Tools -> Assessment -> Initiatives -> Implementation -> Benefits -> Reporting`.
- Current sidebar includes the newer 19-module author catalog: Chat, My Work, Interview, Tools, Initiatives, Execution, Results, Finance, Outputs, Documents, Tables, Presentations, Meeting, MCP IRIS, MCP Marketplace, Organization, Admin, Settings and Partner Portal.
- `Tools` in current sidebar includes `Assessment` as a subitem, while the older routing document treats Assessment as a separate module.
- `Outputs` routes through `/presentations`, while reports redirect into the unified outputs/presentations surface.
- `Documents`, `Tables`, `Presentations`, `Meeting`, `MCP IRIS` and `MCP Marketplace` are visible in sidebar/routing but currently render coming-soon or placeholder surfaces.
- `Finance` has both `/finance` and legacy `/economics` paths using `EconomicsView`.
- `Execution` and `Implementation` both exist as route concepts; the sidebar launches `AppView.IMPLEMENTATION` while route aliases still include `/execution`.

## Gate For Moving To Contract Updates

Do not update target-state contracts until:

- all 19 modules have an audit row,
- every row has a code status,
- every row lists doc/code mismatches,
- no missing source link is silently accepted,
- RAW files remain untouched as target-state material.

## Final Deliverable Of This Phase

After audit completion:

- each module `CODEMAP.md` reflects real routing/component/API/test facts,
- each module `STATUS.md` honestly classifies implementation state,
- each module `00-07` is corrected only where current sources support it,
- contradictions are documented instead of resolved by guesswork.
