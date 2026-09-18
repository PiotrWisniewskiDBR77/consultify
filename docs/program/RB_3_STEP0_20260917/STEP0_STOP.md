# RB-3 Step 0 — STOP for CTO review

Date: 2026-09-17

Track: B / Codex-2

Original measured base: `487605f93fcc6bd38c9552252896105e2a44be12`.

GO base after Wpis 228/229 and `git fetch origin`:
`e05ea74752eee242ad38f64c036cf50f4b2e3f73` (`origin/integracja/20260911`).

Scope: navigation and integration design only; **zero production code changed**.

## Decision requested

Approve one Report Builder artifact shell with three global modes:

1. **Write** — edit the report and its blocks.
2. **Review** — inspect the whole report, comments and review decisions.
3. **Publish** — final read-only view, readiness, export and sharing.

The modes live in the SPEC-A internal navigation area and keep one stable report URL. Under `VITE_REPORT_BUILDER_NAV_V2=OFF`, behavior stays byte-for-byte on the current shell. Wpis 228 grants explicit `RB-3 GO`; the two start dependencies below are present on the GO base.

## Wpis 228 GO amendments — binding before production code

### Start condition verified

RB-3 starts only when **DOC-0 1b v2 and RB-1 v2 are both integrated**. The GO base satisfies
the conjunction:

| Dependency | Integrated commit | Ancestor of GO base |
|---|---|---|
| DOC-0 1b v2 | `7ca293cc81` | yes |
| RB-1 v2 | `b8250edb22` | yes |

The earlier Step 0 observation that the viewer was outside the line is historical and superseded
by this verified start condition. RB-3 consumes the accepted contracts and does not rebuild them.

### Five components from Wpis 93 — connect/remove decision

Import measurement on the GO base used:

```text
rg "(import .*<Name>|<<Name>\\b|from ['\"][^'\"]*<Name>)" src dev-render tests --glob '*.{ts,tsx}'
```

| Component | Measured live import/render sites | Decision for RB-3 | Why |
|---|---:|---|---|
| `ExportSharePanel` | 4 sites in 2 files (`ReportEditor`, `ReviewEditStep`) | **CONNECT / KEEP** | It closes Publish: rehost the existing export/share contract in the Publish right rail; do not copy its endpoints. |
| `BrandVoicePanel` | 0 | **REMOVE** | It closes none of Write/Review/Publish; Configure remains owned by the existing Settings contract. |
| `EntityLinksPanel` | 0 | **REMOVE** | It closes none of the three modes; the live editor already exposes backlinks/relations through its current inspector data. |
| `SourceTraceabilityPanel` | 0 | **REMOVE** | It closes none of the three mode acceptance criteria; source identity stays in the existing report/source read model. |
| `ScheduleReportModal` | 0 | **REMOVE** | Scheduling is not part of RB-3 Write/Review/Publish and already belongs to Management Reports automation. |

The four removals are source deletions backed by zero-import proof, not replacement components.
`ExportSharePanel` is the only one connected because it directly closes Publish.

## Binding contract

- The Wave 2 plan places RB-3 in Fala 2 because it is a navigation rebuild and must follow DOC-0 (`~/Developer/cto-codex/plan-mvp-fala2-20260916/PLAN.md:42,58-59`).
- The executable plan row requires **Write / Review / Publish** (`PLAN.md:267`).
- The accepted RB-3 brief requires one global navigation, one block card, one kebab for Configure/AI/Comments, one Regenerate action, whole-document View, icon rails for TOC/right panel with per-user state, token migration, and the default-OFF `VITE_REPORT_BUILDER_NAV_V2` flag (`~/Developer/cto-codex/KANAL.md`, Wpis 93).
- SPEC-A puts internal artifact navigation in Menu 3 and preserves one artifact header, one center and one right panel (`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md:740-750,766-770`). Archetype B defines Menu 3 as Read/Edit, Comments and Versions (`ARTIFACT_ANATOMY_STANDARD.md:1053`); RB-3 maps those responsibilities into the clearer plan language Write/Review/Publish without adding another shell.

## Current-line measurement

### Entry routes and view dispatch

| Entry | Current behavior | Evidence |
|---|---|---|
| `/reports` | Redirects to `/presentations?tab=all`; the report list does not mount the builder. | `src/routes/AppRoutes.tsx:2688-2698` |
| `/reports/builder` | Mounts `ReportBuilderView` inside `MainLayout`; used for redirect-to-library, new-report wizard, library-template flow and composer management. | `src/routes/AppRoutes.tsx:2700-2724`; `src/views/ReportBuilderView.tsx:505-583` |
| `/reports/builder/:reportId` | Mounts the same `ReportBuilderView`; the view resolves a path id or legacy `?reportId=` and renders `ReportEditor`. | `src/routes/AppRoutes.tsx:2725-2749`; `src/views/ReportBuilderView.tsx:445-461,585-596` |
| builder with no actionable query/id | Redirects to Materials Documents. | `src/views/ReportBuilderView.tsx:599-600` |
| template composer | `?tab=composer|blocks|templates|profiles` is a separate `ReportsComposer`; its visible tabs are Blocks and Templates. | `src/views/ReportBuilderView.tsx:505-550`; `src/components/ReportBuilder/ReportsComposer.tsx:195-208,239-253` |
| close editor | Returns to decoded `returnUrl` or `/presentations?tab=documents`. | `src/views/ReportBuilderView.tsx:527-531` |

`routeConfig` classifies every `/reports/...` path other than Management Reports as `FULL_STEP6_REPORTS`; there is no route-level Write/Review/Publish concept (`src/routes/routeConfig.ts:883-888`). No `VITE_REPORT_BUILDER_NAV_V2` implementation exists on the measured line.

### Current editor navigation

The editor currently has four independent navigation layers instead of one lifecycle navigation:

1. Header actions: Save and a View dropdown that mixes web preview with PDF/PPTX/DOCX export (`ReportEditor.tsx:2333-2441`).
2. Menu 2 with Sections and AI (`ReportEditor.tsx:2444-2471`).
3. Left `ChapterNavigation` TOC, visible only when enabled and the report has more than three blocks; collapse is component state only (`ReportEditor.tsx:2473-2490`, initial state at `:574`).
4. Right `ArtifactRightPanel`, fixed at 320 px, where the first accordion embeds Settings, Export, Review and Versions; Properties still contains placeholder owner/priority/period/created values (`ReportEditor.tsx:2690-2734`).

There are no global Write/Review/Publish tabs. Review is nested inside Settings, while publish/export is split between the header dropdown and Settings.

### Current block card

- Each block has a visible Generate/Regenerate button in its header (`BlockCard.tsx:1486-1531`).
- The block kebab contains Add below, Enable/Disable, Copy and Remove, but not Configure/AI/Comments (`BlockCard.tsx:1557-1620`).
- Configure, AI, Preview and Comments are four persistent tabs inside every expanded card (`BlockCard.tsx:1634-1669`).
- AI mode contains another Regenerate action (`BlockCard.tsx:1937-2013`), and Preview contains a third Regenerate action (`BlockCard.tsx:2307-2323`).

This is the exact duplication RB-3 must remove: one card should expose its content directly, keep a single Regenerate action, and move Configure/AI/Comments into its single kebab. Preview belongs to the global Publish/View mode, not to every block.

### Current review lifecycle

`ReviewPanel` already models report states including `GENERATED`, `IN_REVIEW`, `APPROVED`, `PUBLISHED` and `REJECTED` (`src/components/ReportBuilder/ReportEditor/ReviewPanel.tsx:90-97`). It can submit selected reviewers and a message, and the current generated state exposes a Review action (`ReviewPanel.tsx:235-270,390-420,565-670`). RB-3 should reuse these commands and state, not create a second review engine.

## DOC-0 reuse and integrated handoff

### What is reusable on the GO base

1. **One open-path authority.** `resolveArtifactOpenPath` first honors the server-provided `governance.openPath`, protects assessment-origin documents from empty builders, and otherwise maps document/presentation/sheet to their canonical path (`src/components/ReportsAndPresentations/artifactNavigation.ts:8-40`).
2. **One Materials open funnel.** Double-click, Open and Open full converge on `openRow`; document/presentation routing passes through the resolver (`src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx:632-657,668-674`).
3. **Canonical report identity.** Registry backfill links `report_builder_reports.id` as origin runtime `report`, preserves delivery state, owner, project and source summary (`server/src/services/v8/artifactRegistryService.ts:1821-1869`).
4. **One list-item join.** Artifact list reads join the primary origin to the report row and its publish record, including state, reviewers and gate count (`artifactRegistryService.ts:3116-3175`). This is the right read model for deciding whether Materials opens the editor or a read-only viewer.

DOC-0 is integrated through `7ca293cc81`. Its reusable contract now includes
`resolveArtifactOpenTarget`, the full-screen `DocumentViewer`, Edit back to the canonical origin
path, and filtering of contentless DOC-0 orphans. These are compile-time dependencies on the GO
base. The first RB-3 production commit still must not edit `artifactNavigation.ts`,
`OutputsAggregateTabContent.tsx` or `artifactRegistryService.ts`.

## Proposed single SPEC-A navigation

### Stable shell and URL

Use the existing canonical editor route:

```text
/reports/builder/:reportId?mode=write|review|publish
```

The report id and optional `returnUrl` remain unchanged. `mode` is view state, not a new resource or lifecycle status. Unknown mode values fall back safely. With the flag ON and no mode:

- editable draft/generated/reopened report → `write`;
- in-review report opened by a reviewer → `review`;
- approved/published report → `publish`;
- all legacy deep links still resolve to the same report and can switch modes when authorized.

With the flag OFF, `mode` is ignored and the present editor renders unchanged.

### Menu 1

Retain one SPEC-A artifact header: Back, report icon/title, lifecycle status, saved state and one state-aware primary action.

| Mode | Primary action |
|---|---|
| Write | `Submit for review` when the report is eligible; otherwise Save remains an explicit utility action. |
| Review | Reviewer gets `Approve` or `Send back`; author sees review status without decision authority. |
| Publish | `Export`/`Share`; an authorized owner/admin sees `Reopen` when the RB-2 lock contract allows it. |

### Menu 3: Write / Review / Publish

Render one underline navigation inside the artifact, following SPEC-A. Each item changes `mode` in the URL and preserves report identity and `returnUrl`.

| Mode | Center | Left rail | Right rail |
|---|---|---|---|
| **Write** | Editable block cards. Each card shows content, one Regenerate and one kebab containing Configure, AI and Comments plus existing structural actions. | TOC icon rail; expanded TOC uses existing `ChapterNavigation`. | Inspector icon rail; expanded panel exposes Properties, Sources, Relations and History. Review/export/version controls leave the inspector. |
| **Review** | Whole report in reading order, change/comment markers and selected-block discussion. No content edits. | TOC icon rail. | Review rail with reviewer list, message/history and Approve/Send back controls backed by the existing `ReviewPanel` commands. |
| **Publish** | Whole-document View, using the same rendered report representation as final viewing. | TOC icon rail. | Readiness, versions and Export/Share. No block configuration. |

TOC and right-panel expanded/collapsed preferences use a user-scoped key such as `report-builder-nav-v2` in the existing `user_preferences` mechanism. The saved payload contains only shell preferences (`tocExpanded`, `rightPanelExpanded`, optional last mode), never report lifecycle state. A local state fallback may cover failed preference reads, but persistence must not be keyed only by browser when the requirement says per user.

### DOC-0 handoff

After DOC-0 is merged:

- Materials Open for an approved document stays owned by DOC-0 and opens the read-only viewer.
- Viewer Edit uses its canonical origin path. For a report, RB-3 normalizes that destination to the same `/reports/builder/:id` shell; approved reports land in Publish until an authorized Reopen transition succeeds.
- RB-3 does not add a second document viewer, does not decide approved status from UI labels, and does not edit the Materials resolver during its first implementation commit.

## Implementation file plan under `RB-3 GO`

### RB-3-owned changes

| File | Planned change |
|---|---|
| `src/utils/reportBuilderNavV2Flag.ts` | New fail-closed parser for `VITE_REPORT_BUILDER_NAV_V2`; default OFF. |
| `src/views/ReportBuilderView.tsx` | Parse and normalize `mode`; preserve legacy routes and `returnUrl`; pass mode to the editor only when flag ON. |
| `src/components/ReportBuilder/ReportEditor/ReportEditor.tsx` | Compose the SPEC-A shell and render Write/Review/Publish centers and rails. Keep existing shell as the flag-OFF branch. |
| `src/components/ReportBuilder/ReportEditor/ReportWorkspaceModeBar.tsx` | New focused component for the global three-mode Menu 3 contract. |
| `src/components/ReportBuilder/ReportEditor/BlockCard.tsx` | Flag-ON card contract: content + one Regenerate + one kebab for Configure/AI/Comments; retain current card byte-for-byte when OFF. |
| `src/components/ReportBuilder/ReportEditor/ChapterNavigation.tsx` | Expose rail/expanded presentation without changing the current TOC data model. |
| `src/components/ReportBuilder/ReportEditor/ReviewPanel.tsx` | Rehost existing review controls in Review mode; do not duplicate endpoints or state transitions. |
| `src/components/ReportBuilder/ReportEditor/SettingsPanel.tsx` | Split reusable inspector, versions and export slots so they can be placed in the appropriate global mode. |
| `src/hooks/useReportBuilderShellPreferences.ts` | User-scoped load/save of the two rail states, with a fail-soft in-memory fallback. |
| `server/src/routes/settings.routes.ts` or the existing settings preference route selected after code-level contract check | Persist the `report-builder-nav-v2` preference without a new table. |
| `public/locales/en/translation.json`, `public/locales/pl/translation.json` | Mode, rail and state-aware action labels. |
| `Dockerfile.api` and the deploy flag manifest used by the active line | Declare/pass the build arg while retaining OFF as the deployment default. |
| `src/components/ReportBuilder/ReportEditor/{BrandVoicePanel,EntityLinksPanel,SourceTraceabilityPanel}.tsx`, `src/components/ReportBuilder/ScheduleReportModal.tsx` | Delete after repeating the zero-import check; no replacement components. |

### Contract tests and acceptance evidence

| Test | Contract |
|---|---|
| `ReportBuilderView.navV2.test.tsx` | OFF parity; route id, legacy `reportId`, new/template/composer flows and `returnUrl` remain intact; ON accepts only three modes. |
| `ReportEditor.navV2.test.tsx` | Exactly one Write/Review/Publish nav; one center and one right rail; role/status availability. |
| `BlockCard.navV2.test.tsx` | One Regenerate and one kebab; Configure/AI/Comments reachable; existing mutations call the same handlers. |
| `reportBuilderShellPreferences` unit/route test | Per-user isolation, readback, malformed value fallback and no cross-tenant read. |
| integration test after DOC-0 merge | Materials approved report → DOC-0 viewer → Edit/Reopen → same Report Builder id; draft report → Write; flag OFF → old open path. |
| visual evidence | 1440×900 light/dark for all three modes, TOC and right rail both collapsed/expanded; no overlap and no horizontal viewport overflow. |

The acceptance gate must also count raw Tailwind palette classes in touched Report Builder files and prove the delta moves toward `c-*`; the current measured `ReportEditor.tsx` still contains 30 raw palette-class occurrences across 14 distinct tokens. The brief's historical `213+47` number should be remeasured across the exact implementation file set before coding rather than copied as a current fact.

## Collision matrix and sequencing

| Shared area | Qoder C DOC-0 1b candidate | RB-3 plan | Rule |
|---|---|---|---|
| `artifactNavigation.ts` | +53 lines: viewer target resolver and approved-status gating. | No edit required for first RB-3 implementation. | DOC-0 owns; consume after merge. |
| `OutputsAggregateTabContent.tsx` | +56/-4 lines: viewer state, centralized target selection, full-screen overlay and Edit handoff. | No edit required. | DOC-0 owns; cover integration from an RB-3 test outside this file. |
| `artifactRegistryService.ts` | +15 lines: DOC-0 orphan filtering; branch also relies on registry content/backfill contracts. | Read-only dependency. | DOC-0 owns; no RB-3 registry change without a separate CTO decision. |
| `Dockerfile.api` | Qoder branch also changes it for `VITE_DOC0_DOCUMENT_VIEWER`. | RB-3 needs one new build arg. | Rebase after DOC-0 merge; add only the RB-3 arg to the resulting sorted block. |
| translations / baselines | Qoder branch changes both locale files and standard baselines. | RB-3 needs new labels and may affect token baselines. | Rebase first, then add unique keys; regenerate baselines only from measured delta. |

Required order:

1. **Done:** DOC-0 1b v2 and RB-1 v2 are integrated and verified as ancestors.
2. Commit these Step 0 amendments before production code.
3. First production commit keeps the three DOC-0-owned files unchanged.
4. Implement behind the default-OFF flag; prove OFF parity before ON acceptance.
5. Deliver screenshots and behavior-level tests for CTO acceptance. No staging or public deploy in the code package unless separately assigned.

## Risks and CTO choices

1. **DOC-0/RB-1 collision risk is now bounded.** Both are on the GO base; the first production commit preserves their three explicitly protected files.
2. **Status versus mode.** `mode` must remain navigation state. Report status stays server-authoritative; the UI must not mutate lifecycle merely by switching tabs.
3. **Review controls are currently deeply nested.** Rehosting must call the same existing handlers. Copying the ReviewPanel logic would recreate the double workflow RB-2 removed.
4. **Publish mode needs one renderer.** Approve reuse of the current whole-report preview as the first renderer, then converge it with the accepted DOC-0 representation. A second independent viewer is rejected by design.
5. **Per-user rail state needs an owner.** Recommendation: existing `user_preferences`, one namespaced JSON value, no migration. Confirm this contract in the GO instruction if a server endpoint extension is acceptable.
6. **Feature flag ARG.** Recommendation: add both build-time declaration and runtime/test override pattern used by current feature flags; acceptance must prove unset/false renders the old shell.

## STOP boundary

This amended artifact changes no production code, schema, flag, route or deployment state.
**Wpis 228 grants RB-3 GO after this amendment is committed.**
