# Task Packet — Block C: AI Operator

**Block ID:** `TABELE_BLOCK_C_AI_OPERATOR`
**Template:** `.cursor/TASK_PACKET_TEMPLATE.md`
**Created:** 2026-05-07
**Status:** `PLANNED`
**Lane SSOT:** `DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`

---

## 1) Goal

Make the Tabele lane operate AI as the primary editor for tables across 8 distinct edit levels (cell, record, column, structure, view, relational, methodological, source). Add a `TableQaService` that periodically scores tables on completeness, freshness, source coverage, methodology compliance, and surfaces the report in a `TabeleQaPanel`. Add a `Source Pack Builder` that lets users assemble candidate source records for any new generation. All AI mutations are governed by the proposal → approval → execution → audit pipeline. Token budget enforced per CTO Q4 (soft-warn 70 %, hard cap 100 %).

## 2) Non-Goals

- No table → document/presentation conversion (Block D).
- No form-as-intake-app (Block D).
- No Anygravity P0 trial #2 (Block D).
- No new template content beyond what Block A delivered.
- No new field types beyond Block A's 5.
- No edits to Block A or Block B services except the documented integration points.

## 3) Constraints

### Technical
- Reuse existing `services/llm` provider abstraction; no new LLM SDK integration.
- Reuse existing `ChatToSchemaService` for schema-level proposals (level 4 structure edits).
- All level outputs go through proposal queue: `tp_proposals` rows with `kind ∈ {cell, record, column, structure, view, relational, methodological, source}`.
- Proposal application is idempotent: applying the same proposalId twice is a no-op.
- Token budget: `tp_workspace_settings.ai_daily_token_budget` (default 100 000); `AiUsageService.consume(tokens)` returns `{remaining, capacityWarning}`; hard 429 at 0.

### Product / UX
- `TabeleAiEditorPanel` lives inside `TabeleView` right-rail or as overlay (decided in S0).
- 8 edit levels exposed as a vertical tab strip.
- Each proposed mutation shown as a diff card with apply / reject / refine buttons.
- `TabeleQaPanel` shows a 5-axis health bar + actionable suggestion list.
- `TabeleSourcePackPanel` lists candidate source records from search + provenance graph.
- All actions in Menu 3 (right-side header slot of `KimiWorkspaceShell`).
- DBR77 monochrome.

### Safety / security
- Every level has a hard rule: AI never executes; AI always proposes.
- Token budget enforcement is service-internal; UI cannot bypass.
- Cross-tenant guards on every new endpoint.
- `methodological` and `source` level proposals require super-admin approval.
- Proposal payloads are signed with a server-issued nonce to prevent replay.

## 4) Scope

### In scope — files to CREATE

**Backend**
- `consultify/server/src/services/tablePlatform/TableAiEditorService.ts`
- `consultify/server/src/services/tablePlatform/TableAiEditorLevels/{cell,record,column,structure,view,relational,methodological,source}.ts` (8 files)
- `consultify/server/src/services/tablePlatform/TableQaService.ts`
- `consultify/server/src/services/tablePlatform/SourcePackService.ts`
- `consultify/server/src/services/tablePlatform/AiUsageService.ts`
- `consultify/server/src/services/tablePlatform/migrations/2026_05_block_c_ai_operator.sql` (proposal payloads, qa_reports, ai_usage)
- `consultify/server/src/routes/table-platform.ai-editor.routes.ts`
- `consultify/server/src/routes/table-platform.qa.routes.ts`
- `consultify/server/src/routes/table-platform.source-pack.routes.ts`
- Tests for everything above.

**Frontend**
- `consultify/src/components/AIChat/KimiWorkspace/aiEditor/TabeleAiEditorPanel.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/aiEditor/levels/{Cell,Record,Column,Structure,View,Relational,Methodological,Source}LevelCard.tsx` (8 files)
- `consultify/src/components/AIChat/KimiWorkspace/aiEditor/ProposalDiffCard.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/qa/TabeleQaPanel.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/qa/QaHealthBar.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/qa/QaSuggestionList.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/sourcePack/TabeleSourcePackPanel.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/sourcePack/SourceCandidateCard.tsx`
- Component tests under appropriate paths.

**Docs**
- This packet folder.
- `consultify/docs/product/AI_TABLE_EDITOR_V1.md` (8 levels documented).
- `consultify/docs/product/TABLE_QA_ENGINE_V1.md`.
- `consultify/docs/product/SOURCE_PACK_BUILDER_V1.md`.

### In scope — files to UPDATE (additive only)

- `consultify/server/src/services/tablePlatform/index.ts` — export new services.
- `consultify/server/src/index.ts` — mount new route modules before wildcards.
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` — render right-rail panel slots (additive only; existing flow untouched).
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` — Menu 3 right-slot adds buttons "AI Editor", "QA Report", "Source Pack" when lane=tabele.
- `consultify/public/locales/{en,pl}/translation.json` — ~80 keys.

### Files explicitly OUT OF SCOPE

- `useKimiArtifactPipeline.ts` (Foundation Block).
- `RelationExplainabilityService.ts` (Foundation Block).
- `TabelePreviewLayout.tsx` (Foundation Block; Block B added a column already).
- All non-Tabele lanes.

## 5) Definition Of Done

### Functional
- [ ] 8 edit levels implemented; each proposal goes through `tp_proposals` queue.
- [ ] AI Editor never auto-executes; user approves each proposal.
- [ ] `TableQaService` produces 5-axis report; persists in `tp_qa_reports`.
- [ ] `SourcePackService` returns ranked candidate records.
- [ ] Token budget enforced; soft-warn at 70 %, hard cap 100 %.
- [ ] All Menu 3 buttons live; DBR77 compliant.
- [ ] EN + PL i18n complete.

### Validation
- [ ] All lint / typecheck clean.
- [ ] All unit / component / integration tests green.
- [ ] Cross-tenant 403 on every new endpoint.
- [ ] Token budget calibration recorded.
- [ ] LLM cost report attached for representative workload.

### Evidence
- All filled in `03_BLOCK_CLOSEOUT.md`.
- Demo recording: AI Editor full 8-level walkthrough.
- Screenshot grid: TabeleAiEditorPanel, TabeleQaPanel, TabeleSourcePackPanel.

## 6) Risk Notes

See `02_RISK_REGISTER.md`. Top risks:

- **C-T1 / PR5** Token budget too restrictive or runaway costs. Mitigation: telemetry baseline + adjustable per plan.
- **C-T2** AI proposal payload schema drift between levels. Mitigation: shared `ProposalEnvelope<T>` typed contract.
- **C-S1** AI Editor mutation bypass. Mitigation: hard rule that no level returns "applied" — always returns "proposed".
- **C-S2** Cross-tenant data in LLM context. Mitigation: prompt builder reads only tenant-scoped data; tested with dedicated audit.

### Rollback strategy

- Tier 1: feature flag `featureTableAiOperatorEnabled=false`. Hides UI; endpoints return 404.
- Tier 2: code revert.
- Tier 3: migration rollback (drop `tp_qa_reports`, `tp_ai_usage` tables; existing `tp_proposals` extended in additive way).

---

## Sign-off

- Block lead: ___ (waiting for barrier gate from A+B)
- UI/UX reviewer: ___
- Security reviewer: ___
- Date: ___
