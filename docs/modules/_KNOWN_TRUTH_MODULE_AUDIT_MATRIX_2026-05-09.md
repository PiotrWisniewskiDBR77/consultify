---
doc_id: KNOWN_TRUTH_MODULE_AUDIT_MATRIX_2026_05_09
doc_kind: AUDIT_MATRIX
owner: user
status: active
last_updated: 2026-05-09
---

# Known Truth Module Audit Matrix

## Purpose

This is the working matrix for the “As-Is / Known Truth” pass.

It captures what the current repo and code say before RAW material is used for target-state contract 2.0.

## Evidence Sources Checked

- `docs/modules/*/SSOT.md`: 19 files exist.
- `docs/product/DOCUMENTATION_REGISTRY.md`: canonical product registry.
- `docs/modules/MODULE_ROUTING_ARCHITECTURE.md`: canonical routing and module-boundary document, currently older than the 19-module author catalog in some areas.
- `src/components/navigation/Sidebar/menuConfig.ts`: current sidebar structure.
- `src/routes/routeConfig.ts`: route constants and AppView mapping.
- `src/routes/AppRoutes.tsx`: rendered route/component mapping.
- `src/types/core.ts`: `AppView` enum.

## Legend

- `real`: visible in sidebar/routing and renders a module-specific component or hub.
- `partial`: visible/routed but implementation is incomplete, mixed with legacy, or split across old/new components.
- `planned`: documented but not visible as real code path.
- `soon`: visible as sidebar/route but intentionally blocked by coming-soon/contact-required UI.
- `stub`: route exists but renders a generic placeholder.
- `deprecated`: route/code exists only for redirects or backward compatibility.
- `duplicate`: module or route duplicates another canonical module.
- `code_gap`: docs assert behavior that code check cannot confirm.
- `doc_gap`: code has behavior that module docs do not yet capture.

## Audit Matrix

| # | Module | Module folder | SSOT | Registry signal | Routing architecture signal | Code/sidebar signal | Current status | Known mismatches / next checks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Czat / Teresa | `01_czat` | Exists | Registry has large Chat v8 / Teresa suite, including application-agent, proposal, voice and recovery docs. | Older architecture lists Chat as conversation context feeding Interview. | Sidebar `AI_CHAT`, `AppView.AI_CHAT`, `/chat`, `/chat/:conversationId`; renders `AIChatWelcomeView` and `UnifiedChatPanel`; dashboard redirects to chat. | `real` + `doc_gap` | Need check whether module `CODEMAP.md` captures `/internal/v10-runtime`, conversation route sync and Teresa-specific docs. |
| 2 | Moja Praca | `02_moja-praca` | Exists | Registry references MyWork across task/decision runtime and outputs bridge. | Not part of older core flow; author catalog places it after Chat. | Sidebar `MY_WORK`, `AppView.MY_WORK`, `/my-work/*`; renders `MyWorkView`. | `real` + `doc_gap` | Need map task, decision, notification and output bridge components/services. |
| 3 | Wywiad | `03_wywiad` | Exists | Registry has Interview v3 as-is and v6 redesign/target docs. | Older architecture lists Interview as producer of Insights; code also has legacy Discovery Consultant alias. | Sidebar `INTERVIEW`, `AppView.DISCOVERY_CONSULTANT`, `/discovery`; `/interview` also renders `InterviewHub`; `PROJECT_INTELLIGENCE` routes to Interview. | `real` + `partial` | Need document alias split: `/discovery`, `/interview`, `/project-intelligence`; distinguish current shipped vs V6 target docs. |
| 4 | Narzędzia | `04_narzedzia` | Exists | Registry includes Tools/Assessment docs and Teresa adapter references. | Older architecture separates Discovery Tools and Assessment; v3 note consolidates them under Tools. | Sidebar `TOOLS` with subitems Library and Assessment; `AppView.DISCOVERY_TOOLS`, `/discovery-tools`; Assessment subitem maps `AppView.ASSESSMENT_OVERVIEW`; renders `DiscoveryToolsHub` and `AssessmentHub`. | `real` + `duplicate` | Need preserve Tools vs Assessment consolidation tension; update docs without creating separate Assessment module folder. |
| 5 | Inicjatywy | `05_inicjatywy` | Exists | Registry has extensive Initiative, task, decision, governance, role and capability docs. | Older architecture treats Initiatives as portfolio planning + decisions. | Sidebar `MODULE_INITIATIVES`, but viewId is `AppView.PORTFOLIO_ROADMAP`; `/portfolio` renders `PortfolioView`, `/initiatives` renders `InitiativesHub`, `/roadmap` renders `FullRoadmapView`. | `partial` + `doc_gap` | Need decide canonical code map: sidebar currently launches `/portfolio`, while `/initiatives` exists as hub. |
| 6 | Realizacja | `06_realizacja` | Exists | Registry has Execution docs, control tower, risk, capacity and evidence docs. | Older architecture maps Implementation to Task, Decision and economic updates. | Sidebar `MODULE_EXECUTION`, viewId `AppView.IMPLEMENTATION`; `/implementation` renders `ExecutionHub`; `/execution` renders `FullExecutionView`; `/rollout` renders `FullRolloutView`. | `partial` + `duplicate` | Need classify `/execution` vs `/implementation` ownership and legacy state. |
| 7 | Rezultaty | `07_rezultaty` | Exists | Registry includes KPI/Results/Finance bridge docs. | Older architecture calls this Benefits tracking records. | Sidebar `MODULE_BENEFITS`, `AppView.BENEFITS_REALIZATION`, `/benefits`; renders `ResultsHub`; `/kpi-okr` renders `KpiOkrView`. | `real` + `partial` | Need map Results vs Benefits terminology and KPI/OKR subroute. |
| 8 | Finanse | `08_finanse` | Exists | Registry references Economics workflow and KPI-to-Finance linkage. | Older architecture says economics is supporting capability, not core sequential flow. | Sidebar `MODULE_ECONOMICS`, label Finance, `AppView.ECONOMICS`; `/finance` and `/economics` render `EconomicsView`; nested `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`. | `real` + `deprecated` | Need document `/economics` as legacy/canonical alias tension and confirm finance services/models. |
| 9 | Outputs | `09_outputs` | Exists | Registry includes V8.1 artifact runtime, Outputs Library, reports/presentations evidence and management report deprecations. | Older architecture calls Reporting an aggregator that does not introduce new artifacts. | Sidebar `MODULE_PRESENTATIONS`, label Outputs, `AppView.PRESENTATIONS`; `/presentations` renders `ReportsAndPresentationsHub`; `/reports` redirects to `/presentations?tab=documents`; report builder routes still exist. | `real` + `partial` | Need capture unified outputs hub and legacy report routes without treating Reports as a separate module. |
| 10 | Dokumenty | `10_dokumenty` | Exists | Registry lists Document Studio v1 as canonical document runtime. | Not in older core sidebar list as separate module. | Sidebar `MODULE_WORDY`, `AppView.WORDY`, `/wordy`; route renders `V4ComingSoonView` despite code importing `WordyView`. | `soon` + `code_gap` | Need classify product docs as canonical/planned while code is contact-required/coming-soon. |
| 11 | Tabele | `11_tabele` | Exists | Registry has Table V8 readiness, SSOT, schema/workflow and missing-capabilities docs. | Not in older core sidebar list as separate module; catalog notes Table Studio duplicate is omitted. | Sidebar `MODULE_EXCELE`, `AppView.EXCELE`, `/excele`; route renders `V4ComingSoonView` despite code importing `ExceleView`. | `soon` + `code_gap` | Need reconcile rich table code/tests with sidebar route currently blocking as coming-soon. |
| 12 | Prezentacje | `12_prezentacje` | Exists | Registry has Reports & Presentations v3 and Presentation Generator docs. | Older architecture has Reporting, not standalone Prezentacje. | Sidebar `MODULE_PREZENTACJE_GEN`, `AppView.PREZENTACJE_GEN`, `/prezentacje`; route renders `V4ComingSoonView`; `/presentations/wizard` and `/presentations/builder/:deckId` render presentation components under Outputs. | `partial` + `duplicate` | Need separate Outputs library vs standalone Prezentacje generator vs deck builder routes. |
| 13 | Meeting | `13_meeting` | Exists | Registry signal not yet confirmed in first pass. | Not in older core module flow. | Sidebar `MODULE_MEETING`, `AppView.MEETING`, `/meeting`; route renders `V4ComingSoonView`; `MeetingHub` import exists but route uses placeholder. | `soon` + `code_gap` | Need search Meeting specs/components/tests and decide whether `MeetingHub` is unused, legacy or pending. |
| 14 | MCP IRIS | `14_mcp-iris` | Exists | Registry includes MCP trust/admission/execution policy docs. | Not in older core module flow. | Sidebar `MCP_IRIS`, `AppView.MCP_IRIS_COMING_SOON`, `/mcp/iris`; route renders `V4ComingSoonView`. | `stub` + `planned` | Need map trust model, remote tool execution and any MCP service code. |
| 15 | MCP Marketplace | `15_mcp-marketplace` | Exists | Registry includes MCP provider catalog/connector installation/runtime model docs. | Not in older core module flow. | Sidebar `MCP_MARKETPLACE`, `AppView.MCP_MARKETPLACE_COMING_SOON`, `/mcp/marketplace`; route renders `V4ComingSoonView`. | `stub` + `planned` | Need decide boundary between marketplace catalog and MCP IRIS execution. |
| 16 | Organizacja | `16_organizacja` | Exists | Registry and context-loading index point to Organization Context Engine source of truth. | Older architecture treats organization/context as supporting area, not core flow. | Global menu item `ORGANIZATION`, `AppView.ORGANIZATION_PROFILE`, `/organization/*`; renders `OrganizationView`; also context builder routes exist under `/context/*`. | `real` + `partial` | Need map Organization vs Context Builder and knowledge/memory ownership. |
| 17 | Panel Administratora | `17_panel-administratora` | Exists | Registry has roles, permissions and admin/governance-related docs. | Supporting/admin layer outside older consulting flow. | Admin menu item `ADMIN`, `AppView.ADMIN_DASHBOARD`, `/admin/*`; protected by `requiredRole="ADMIN"`; renders `AdminView`; SuperAdmin is separate route. | `real` + `security-critical` | Need map tenant/admin controls and clarify SuperAdmin exclusion from 19-module catalog. |
| 18 | Ustawienia | `18_ustawienia` | Exists | Registry signal not yet confirmed in first pass. | Supporting settings layer outside older consulting flow. | Settings menu item `SETTINGS`, `AppView.SETTINGS_PROFILE_MODULE`, `/settings/*`; protected route renders `SettingsView`. | `real` | Need map settings subroutes and distinguish preferences from admin policy. |
| 19 | Portal Partnerski | `19_portal-partnerski` | Exists | Registry signal not yet confirmed in first pass. | Not in older core consulting flow; partner business track in author operating model. | Partner menu item `PARTNER_PORTAL`, `AppView.PARTNER_LANDING`, `/partner/*`; protected route renders `PartnerPortalViewNew`; additional public partner routes exist. | `real` + `partial` | Need map protected portal vs public partner acquisition/onboarding/pricing routes. |

## Immediate Update Targets

### First Pass: CODEMAP + STATUS

Update these first because they are factual and reduce drift:

1. `01_czat/CODEMAP.md` and `01_czat/STATUS.md`
2. `03_wywiad/CODEMAP.md` and `03_wywiad/STATUS.md`
3. `04_narzedzia/CODEMAP.md` and `04_narzedzia/STATUS.md`
4. `05_inicjatywy/CODEMAP.md` and `05_inicjatywy/STATUS.md`
5. `06_realizacja/CODEMAP.md` and `06_realizacja/STATUS.md`
6. `09_outputs/CODEMAP.md` and `09_outputs/STATUS.md`
7. `10_dokumenty/CODEMAP.md` and `10_dokumenty/STATUS.md`
8. `11_tabele/CODEMAP.md` and `11_tabele/STATUS.md`
9. `12_prezentacje/CODEMAP.md` and `12_prezentacje/STATUS.md`

### Second Pass: Contract 00-07

Only after CODEMAP/STATUS are factual:

- update `00_META.md` with owner/status facts,
- update `02_SCOPE.md` with current in/out boundaries,
- update `03_BEHAVIOR.md` with implemented behavior only,
- update `04_UI_UX.md` with actual states and Menu 2/Menu 3 facts,
- update `05_DATA_AND_INTEGRATIONS.md` with confirmed data/API paths,
- update `06_PERMISSIONS_AND_SECURITY.md` with confirmed role/tenant boundaries,
- update `07_ACCEPTANCE_AND_TESTS.md` with existing tests/evidence and gaps.

## Resolved Decisions (As-Is Canon)

- Inicjatywy canonical launch route is `/portfolio`; `/initiatives` and `/roadmap` remain active related surfaces.
- Realizacja canonical launch route is `/implementation`; `/execution` and `/rollout` remain active related/legacy surfaces.
- `/presentations` ownership is `09_outputs`; `12_prezentacje` is standalone generator lane on `/prezentacje` and is currently placeholder.
- Finanse canonical route is `/finance`; `/economics` remains active legacy alias.
- `16_organizacja` owns `/organization` and organization context; `/context` remains transitional/legacy context-builder surface and is not separate module ownership.

