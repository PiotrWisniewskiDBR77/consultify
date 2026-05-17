---
doc_id: AS_IS_FULL_MODULE_DOCUMENTATION_2026_05_09
doc_kind: AS_IS_AUDIT
owner: user
status: active
last_updated: 2026-05-09
---

# As-Is Full Module Documentation

## Goal

Provide one complete As-Is baseline for all 19 modules so further design can be developed safely from RAW inputs later (contract 2.0), without mixing target-state assumptions into current-state truth.

## Scope

This document covers, for each module:

- current source-of-truth coverage,
- current functionality and workflow role,
- current UI/UX state in code,
- current code readiness status,
- documentation completeness assessment.

This document is based on:

- `_KNOWN_TRUTH_PHASE_2_PREP_2026-05-09.md`,
- `_KNOWN_TRUTH_MODULE_AUDIT_MATRIX_2026-05-09.md`,
- current sidebar/routing code (`menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`),
- module contracts in `01_*` to `19_*` folders.

## Completeness Scale

- `HIGH`: module docs are mostly specific, source-backed, and aligned with current routing/component behavior.
- `MEDIUM`: module docs are usable but still generic in key sections and/or partially misaligned with code.
- `LOW`: module docs are mostly baseline/generic and not yet sufficient for implementation-level decisions without extra source/code passes.

## Global Findings (As-Is)

- All 19 module folders exist and contain the full contract file set.
- Module contracts are structurally complete but content is still baseline-heavy in many `03-07` files.
- `CODEMAP.md` often uses contract-level route/app labels that are not yet reconciled with current router aliases and component wiring.
- `STATUS.md` is present and useful, but many modules still need factual code-backed expansion.
- Several modules are visible in sidebar but route to `V4ComingSoonView` (or equivalent placeholders), so code readiness is intentionally limited.
- Main architecture tension remains: legacy flow docs vs current 19-module operating model and route aliases.

---

## Module-by-Module As-Is

### 01 — Czat (`01_czat`)

- **Code readiness:** `real` + `doc_gap`
- **Current role:** conversational entrypoint and runtime orchestration for Teresa/chat flows.
- **Workflow place:** starts system loop; feeds My Work, Interview/Tools, and artifact workflows.
- **UI/UX in code:** `/chat`, `/chat/:conversationId`, plus internal runtime route; active module, not placeholder.
- **Source coverage:** strong (Chat v8 and Teresa-oriented product docs are linked).
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** `CODEMAP.md` needs explicit mapping of runtime variants and chat-to-module handoffs.

### 02 — Moja Praca (`02_moja-praca`)

- **Code readiness:** `real` + `doc_gap`
- **Current role:** user execution inbox/work queue and cross-module follow-up surface.
- **Workflow place:** receives actions from chat/meeting/other modules and routes user next steps.
- **UI/UX in code:** `/my-work/*` with dedicated `MyWorkView`.
- **Source coverage:** good (task/decision/runtime references present).
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** stronger mapping to task/decision objects, notifications, and outputs bridge.

### 03 — Wywiad (`03_wywiad`)

- **Code readiness:** `real` + `partial`
- **Current role:** structured interview and discovery workflow.
- **Workflow place:** converts conversational/context input into findings for downstream modules.
- **UI/UX in code:** aliases `/discovery`, `/interview`, and legacy mapping to interview hub.
- **Source coverage:** strong (Interview v3 + redesign target docs).
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** explicit canonical URL and legacy alias policy must be locked in docs.

### 04 — Narzędzia (`04_narzedzia`)

- **Code readiness:** `real` + `duplicate` (Tools/Assessment split tension)
- **Current role:** tools runtime and assessment entry points.
- **Workflow place:** supports analysis and evidence generation before initiatives/execution.
- **UI/UX in code:** `/discovery-tools/*` plus `/assessment/*` under Tools umbrella.
- **Source coverage:** good.
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** define internal sub-surface contract for Assessment inside module boundary (without separate author module folder).

### 05 — Inicjatywy (`05_inicjatywy`)

- **Code readiness:** `partial` + `doc_gap`
- **Current role:** initiative portfolio and decision/governance layer.
- **Workflow place:** converts findings into governed initiatives and hands off execution.
- **UI/UX in code:** canonical launch is `/portfolio`; `/initiatives` and `/roadmap` remain active related surfaces.
- **Source coverage:** strong (initiative, governance, role, capability docs).
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** keep legacy/related surfaces documented without changing canonical launch ownership.

### 06 — Realizacja (`06_realizacja`)

- **Code readiness:** `partial` + `duplicate`
- **Current role:** execution and delivery control.
- **Workflow place:** receives initiatives, manages delivery, feeds results/finance/meeting.
- **UI/UX in code:** canonical launch is `/implementation`; `/execution` and `/rollout` remain active related/legacy surfaces.
- **Source coverage:** strong (execution and operator/control docs).
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** maintain explicit legacy/related route semantics in all module docs.

### 07 — Rezultaty (`07_rezultaty`)

- **Code readiness:** `real` + `partial`
- **Current role:** KPI/value realization layer.
- **Workflow place:** measures outputs of execution and connects to finance.
- **UI/UX in code:** `/benefits` plus `/kpi-okr`.
- **Source coverage:** good.
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** normalize naming: Results vs Benefits vs KPI/OKR surface.

### 08 — Finanse (`08_finanse`)

- **Code readiness:** `real` + `deprecated` alias present
- **Current role:** financial modeling and economics interpretation.
- **Workflow place:** connects KPI/results with model assumptions and financial decisions.
- **UI/UX in code:** canonical route is `/finance`; legacy alias `/economics` remains active.
- **Source coverage:** medium-good.
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** keep alias policy synchronized across codemap/status and global docs.

### 09 — Outputs (`09_outputs`)

- **Code readiness:** `real` + `partial`
- **Current role:** unified outputs library and packaging layer.
- **Workflow place:** packages approved work into deliverables and exports.
- **UI/UX in code:** `/presentations` as unified outputs hub; reports routes redirect or remain as legacy builder paths.
- **Source coverage:** good (V8.1 artifact runtime and outputs docs).
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** preserve locked ownership: `/presentations` stays in Outputs while `/prezentacje` remains separate generator lane.

### 10 — Dokumenty (`10_dokumenty`)

- **Code readiness:** `soon` + `code_gap`
- **Current role:** Document Studio contract exists in docs, but routed UI is currently blocked/coming soon.
- **Workflow place:** should receive work from Outputs and provide document artifact production/review.
- **UI/UX in code:** sidebar module present; route currently placeholder.
- **Source coverage:** good at product doc level.
- **Documentation completeness:** `LOW`
- **Main gaps:** reconcile rich product SSOT with current placeholder code state.

### 11 — Tabele (`11_tabele`)

- **Code readiness:** `soon` + `code_gap`
- **Current role:** Table Studio contract exists in docs, but main route is currently placeholder.
- **Workflow place:** should support structured/tabular artifact workflows and finance/outputs linkage.
- **UI/UX in code:** sidebar module present; route currently placeholder.
- **Source coverage:** good at product doc level.
- **Documentation completeness:** `LOW`
- **Main gaps:** align contract depth with real route behavior and explicit readiness state.

### 12 — Prezentacje (`12_prezentacje`)

- **Code readiness:** `partial` + `duplicate`
- **Current role:** standalone presentation generator contract overlaps with Outputs-driven presentation workflows.
- **Workflow place:** should produce deck artifacts, but ownership currently split.
- **UI/UX in code:** `/prezentacje` is standalone generator lane (currently placeholder); `/presentations/...` flows are owned by Outputs.
- **Source coverage:** medium-good.
- **Documentation completeness:** `LOW` to `MEDIUM`
- **Main gaps:** keep split explicit in docs: generator lane vs Outputs-owned presentations runtime.

### 13 — Meeting (`13_meeting`)

- **Code readiness:** `soon` + `code_gap`
- **Current role:** meeting/follow-up contract exists but runtime route is placeholder.
- **Workflow place:** should close loop with follow-up tasks and decisions.
- **UI/UX in code:** sidebar entry exists; `/meeting` placeholder.
- **Source coverage:** weaker than core modules.
- **Documentation completeness:** `LOW`
- **Main gaps:** confirm whether imported meeting implementation is active, planned, or legacy.

### 14 — MCP IRIS (`14_mcp-iris`)

- **Code readiness:** `stub` + `planned`
- **Current role:** integration execution/trust layer contract.
- **Workflow place:** intended external tool execution with governance controls.
- **UI/UX in code:** sidebar and route exist; runtime placeholder.
- **Source coverage:** limited compared with core modules.
- **Documentation completeness:** `LOW`
- **Main gaps:** missing concrete implementation mapping and runtime evidence.

### 15 — MCP Marketplace (`15_mcp-marketplace`)

- **Code readiness:** `stub` + `planned`
- **Current role:** integration catalog/discovery contract.
- **Workflow place:** should publish available integration capabilities and hand off execution to MCP IRIS.
- **UI/UX in code:** sidebar and route exist; runtime placeholder.
- **Source coverage:** limited.
- **Documentation completeness:** `LOW`
- **Main gaps:** clarify data model and explicit boundary vs MCP IRIS.

### 16 — Organizacja (`16_organizacja`)

- **Code readiness:** `real` + `partial`
- **Current role:** organization context and memory/knowledge layer.
- **Workflow place:** cross-cutting context provider for many modules.
- **UI/UX in code:** `/organization/*` is canonical owner surface; `/context/*` remains transitional/legacy context-builder route family.
- **Source coverage:** medium-good.
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** ensure all docs treat `/context` as transitional surface, not separate ownership module.

### 17 — Panel Administratora (`17_panel-administratora`)

- **Code readiness:** `real` + security-critical scope
- **Current role:** tenant/admin governance and control surface.
- **Workflow place:** global policy and role boundaries.
- **UI/UX in code:** `/admin/*` active with role guard.
- **Source coverage:** good for governance context.
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** explicitly document relation and boundary to SuperAdmin plane.

### 18 — Ustawienia (`18_ustawienia`)

- **Code readiness:** `real`
- **Current role:** user/workspace preferences and settings runtime.
- **Workflow place:** cross-cutting UX and preference layer.
- **UI/UX in code:** `/settings/*` active.
- **Source coverage:** moderate, narrower than core business modules.
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** deeper module-specific permission and data persistence mapping.

### 19 — Portal Partnerski (`19_portal-partnerski`)

- **Code readiness:** `real` + `partial`
- **Current role:** partner-facing business track with protected and public flows.
- **Workflow place:** separate partner journey and linked deliverables/business ops.
- **UI/UX in code:** `/partner/*` protected portal plus additional public partner routes.
- **Source coverage:** moderate.
- **Documentation completeness:** `MEDIUM`
- **Main gaps:** unify legacy/new portal references and clarify route ownership.

---

## As-Is Documentation Readiness Summary

### Strongest today

- `01_czat`, `03_wywiad`, `04_narzedzia`, `05_inicjatywy`, `06_realizacja`, `07_rezultaty`, `09_outputs`.

### Medium but requires factual deepening

- `02_moja-praca`, `08_finanse`, `16_organizacja`, `17_panel-administratora`, `18_ustawienia`, `19_portal-partnerski`.

### Lowest readiness for implementation-level work

- `10_dokumenty`, `11_tabele`, `12_prezentacje`, `13_meeting`, `14_mcp-iris`, `15_mcp-marketplace`.

## Mandatory Before RAW 2.0

1. Update each module `CODEMAP.md` with factual code links:
   - sidebar id,
   - route(s),
   - AppView,
   - concrete component path,
   - API/service/model paths,
   - test/evidence paths.
2. Update each `STATUS.md` with current state and risk notes tied to real code behavior.
3. Expand `03_BEHAVIOR.md` and `04_UI_UX.md` from generic baseline to module-specific runtime, states and handoffs.
4. Expand `07_ACCEPTANCE_AND_TESTS.md` with real test matrix and evidence pointers.
5. Keep locked ownership decisions consistent across module contracts and route docs:
   - Inicjatywy launch: `/portfolio` (with `/initiatives`, `/roadmap` as related surfaces),
   - Realizacja launch: `/implementation` (with `/execution`, `/rollout` as related/legacy),
   - `/presentations` owned by Outputs (`09_outputs`); `/prezentacje` is standalone generator lane,
   - Finance canonical route: `/finance` with `/economics` legacy alias,
   - Organizacja owns `/organization` and org context; `/context` is transitional legacy surface.

## Decision Gate

This As-Is baseline is sufficient to continue Phase 2 work.

It is not yet sufficient to claim implementation-ready module contracts for all modules. Further deepening is required before using RAW to generate contract 2.0 changes.
