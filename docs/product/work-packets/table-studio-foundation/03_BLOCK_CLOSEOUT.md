# Block Closeout — Table Studio Foundation Block

> **STATUS: CLOSED — `DONE_WITH_CONSTRAINTS`**
> Template basis: `.cursor/BLOCK_CLOSEOUT_TEMPLATE.md`

---

## Block ID / Name

`TABLE_STUDIO_FOUNDATION_BLOCK` — Table Studio (Tabele) artifact lane foundation, Word-canvas idiom, parity with Wordy/Excele/Prezentacje.

## Goal

Deliver the Table Studio (`Tabele`) foundation as a first-class KIMI artifact lane: `/tabele` route, Word-style document canvas, schema/record/relation/rationale preview, governed schema intent routing, relation explainability, builder deep-link, EN/PL i18n, and focused validation evidence.

## Outcome

- **Status:** `DONE_WITH_CONSTRAINTS`
- **Summary:** Users can now enter `/tabele`, generate or reopen operational table artifacts, review them in a Word-like canvas, trigger governed table intents from chat, and open the Table Builder via `/my-work/sheets/:workspaceId/tables/:tableId`. Focused validation is green; full repository lint/typecheck/i18n remain constrained by existing non-Tabele baseline failures.

## Decisions taken (Sprint 0 hard-stop)

- **D1 (route target):** `<TabeleView />` direct route at `/tabele`.
- **D2 (backend scope):** reused existing `ChatToSchemaService` + `AuditService`; added only relation explainability.
- **D3 (ACL audit handling):** initial hard stop found P0 schema proposal ACL leaks; user approved `TBL-SEC-1`; P0 was patched and audit now passes.

## Changes Made

> File-by-file diff summary (auto-generated from `git diff main...HEAD --stat` + manual annotation).

### Created
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` — full KIMI orchestrator.
- `consultify/src/components/AIChat/KimiWorkspace/tabeleSystemPrompt.ts` — governance-aware table system prompt.
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx` — Word-canvas preview.
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleSchemaBlock.tsx` — schema block with governance status.
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRelationChip.tsx` — keyboard-focusable relation tooltip.
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRationaleSection.tsx` — AI rationale/proposal status section.
- `consultify/tests/components/AIChat/KimiWorkspace/TabeleView.test.tsx` — orchestrator and intent routing tests.
- `consultify/tests/components/AIChat/KimiWorkspace/tabelePreview/*.test.tsx` — preview component tests.
- `consultify/tests/e2e/smoke/tabele-foundation.spec.ts` — focused smoke spec.
- `consultify/src/utils/tabeleArtifactOpen.ts` — builder deep-link + CSV download utility.
- `consultify/src/types/tabeleArtifact.ts` — Tabele preview payload types.
- `consultify/server/src/services/tablePlatform/RelationExplainabilityService.ts` — ACL-filtered relation rationale service.
- `consultify/server/src/routes/table-platform.relations-explain.routes.ts` — relation explainability route.
- `consultify/server/src/services/tablePlatform/__tests__/RelationExplainabilityService.test.ts` — service tests.
- `consultify/server/src/routes/__tests__/table-platform.relations-explain.test.ts` — route tests.
- `consultify/server/src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts` — governance ACL audit.
- `consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md` — lane SSOT.
- `consultify/docs/product/work-packets/follow-ups/TBL-FU-*.md` — follow-up cards.
- `consultify/docs/product/work-packets/table-studio-foundation/evidence/sprint-6/qa-report.md` — QA report.

### Updated (additive only)
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` — Tabele lane, sky config, preview switch.
- `consultify/src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` — Tabele branch and templates.
- `consultify/src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` — Tabele lane mapping and preview shape.
- `consultify/src/types/core.ts`, `consultify/src/types/workspace.ts` — `AppView.TABELE`.
- `consultify/src/routes/AppRoutes.tsx`, `consultify/src/routes/routeConfig.ts` — `/tabele`.
- `consultify/src/components/navigation/Sidebar/menuConfig.ts` — sidebar entry.
- `consultify/src/services/api/tablePlatform.api.ts` — typed clients and corrected `/schema/propose` path.
- `consultify/server/src/Gateway.ts`, `consultify/server/src/routes/index.ts` — relation route mount/export.
- `consultify/server/src/routes/table-platform.routes.ts` — P0 ACL hotfix guards for schema proposal routes.
- `consultify/public/locales/en/translation.json`, `consultify/public/locales/pl/translation.json` — Tabele EN/PL keys.
- `consultify/docs/product/TABLE_V8_SSOT.md` — Table Studio appendix.
- `consultify/docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md` — delivered status note.

### Untouched (verified zero diff)
- `consultify/src/components/MyWork/table/{ViewRouter,TableDataProvider,TableToolbar,TableTabStrip,tableTypes}.{ts,tsx}`
- `consultify/server/src/services/tablePlatform/{TableContextService,ChatToSchemaService,AuditService,RelationService}.ts`
- `consultify/src/components/AIChat/KimiWorkspace/{WordyView,PrezentacjeView,ExceleView}.tsx`
- `consultify/src/components/ReportsAndPresentations/*`

## Validation Performed

> Fill from `01_VALIDATION_MATRIX.md` execution log. Format: `L#.# — PASS/FAIL — evidence link`.

### Automated checks
- L1.1 lint — `PASS scoped`, `FAIL repo-wide baseline`.
- L1.2 frontend typecheck — `FAIL repo-wide baseline`, no Tabele errors in output.
- L1.3 backend typecheck — `FAIL repo-wide baseline` in presentation modules.
- L1.4 DBR77 hex scan — `PASS`, 0 hits in Tabele source.
- L1.5 untouched-files guard — `PASS` for explicitly untouched product/code paths; unrelated dirty DocumentStudio files existed and were left untouched.
- L2.1/L4.1-L4.4 backend focused tests — `PASS`, 32/32.
- L2.4/L3.1/L3.3/L3.4 frontend focused tests — `PASS`, 28/28.
- L5.* e2e smoke — `PASS`, 3/3 focused Playwright tests.
- L7.* security/tenant — `PASS focused`; P0 ACL audit now 9/9.
- L8.* performance — `PASS_WITH_P2` via component render durations in focused tests; no dedicated perf benchmark added.

### Manual checks
- L6.1 Anygravity P0 trial — not executed in this CLI run.
- L6.2 DBR77 visual review — code-level token/hex audit passed; screenshot not captured.
- L6.3 Menu 3 placement audit — code-level audit passed: no AI actions added inside canvas; actions remain shell callbacks.
- L6.4 Word-canvas idiom parity vs Wordy — component structure matches sectioned document canvas; screenshot not captured.

### UI/UX evidence
- Screenshot evidence was not captured in this run. Automated component/e2e evidence is linked in `evidence/sprint-6/qa-report.md`.

## Gate Result

- **DoD:** `PASS_WITH_P2`
- **Security/Tenant:** `PASS`
- **Release impact:** `LOW` (additive lane + focused backend route + ACL hotfix)
- **Sprint Exit Gate recommendation:** `GO_WITH_CONSTRAINTS`

## Remaining Risks

> From `02_RISK_REGISTER.md` — list realized risks + open mitigations + ownership.

- Full repo lint/typecheck/i18n remain red due to existing non-Tabele baseline issues; tracked in Sprint 6 QA report.
- Manual screenshot evidence remains to capture before a formal product demo.
- Relation explainability cache is bounded in-memory and should get persistence backing.
- Proposal review queue is surfaced lightly but not a full in-canvas approval UI.

## Follow-ups (next blocks)

- **TBL-FU-1** Persistence backing for `RelationExplainabilityService` reasoning cache.
- **TBL-FU-2** Schema proposals ACL regression guard.
- **TBL-FU-3** Artifact lane production parity audit.
- **TBL-FU-4** Schema proposal review queue in canvas.
- **TBL-FU-5** Computed columns / formula engine / automation engine for Tabele lane.

## Next Step

> Single-line recommendation for the next block.

- Open a baseline quality block for repo-wide lint/typecheck/i18n cleanup, then start `TBL-FU-4` if product wants proposal review directly inside the Tabele canvas.

---

## Sign-off

- Block lead: Cursor agent
- UI/UX reviewer: pending human screenshot review
- Security reviewer: focused ACL audit passed
- QA reviewer: focused automated QA passed; repo-wide baseline constraints recorded
- Date closed: 2026-05-07
