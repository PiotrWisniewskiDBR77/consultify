# Mapa tabel organizacji DBR77 - runda 2

Pomiar: 2026-09-06, wylacznie lokalny PostgreSQL 127.0.0.1:54400/consultify_noc, organizacja cc9db573-260f-4a19-927f-f3cc1fbaea38. information_schema zawiera 1 276 tabel z kolumna organization_id; 105 ma co najmniej jeden wiersz tej organizacji (lacznie 5 185). Ponizsza mapa obejmuje pelny niepusty mianownik. Pozostale 1 171 tabel ma 0 wierszy DBR77 - nie sa kandydatami do czyszczenia.

Klasy: A - czytane na sciezce ekranow MVP z par. 3; B - pomocnicze, administracyjne, audytowe albo poza MVP (zostaja); C - zapis bez rozstrzygnietego konsumenta. C bez jednoznacznej sciezki oznacza niepewne, zostaje i nie trafia do ORPHAN_TABLES. D jest klasyfikacja rekordow wewnatrz A; lokalny dry-run wykryl 6 pustych watkow conversations.

Lancuchy ekranowe: montaz tras server/src/Gateway.ts:73-80,129-145,166-179,200-218,278-294; wolacze/render: src/components/assessment/AssessmentOutputsTab.tsx:98, src/components/Economics/FinanceHub.tsx:3832, src/components/AIChat/MessageRenderer.tsx:2140, src/components/Initiatives/initiativeRegisterProjection.ts:329, src/components/MyWork/TaskDetailView.tsx:1902. Dowod w wierszu wskazuje najblizszego statycznego konsumenta lub repozytorium; wzmianka testowa nie jest zgoda na usuniecie.

Podsumowanie wierszy: A=3009, B=2400, C-niepewne=15; D=6 (podzbior A).

| tabela | klasa | wiersze DBR77 | dowod konsumenta / decyzja |
|---|---:|---:|---|
| action_cards | A | 1 | server/src/services/actionCard/actionCardService.ts:88: FROM action_cards ac |
| activity_logs | B | 32 | src/views/superadmin/analytics/SavedReportsView.tsx:95:             FROM activity_logs |
| ai_actions | B | 2 | src/services/funnelAnalytics.ts:382:  \| 'ai_actions_view_opened' |
| ai_audit_logs | B | 1 | server/src/database/DatabaseInitializer.ts:152:  'ai_audit_logs', |
| ai_chat_runs | B | 16 | server/src/services/ai/chatTraceService.ts:9: * Uses the `ai_chat_runs` and `ai_chat_run_events` tables when available, |
| ai_cost_usage | B | 13 | server/src/services/retentionPolicyService.ts:111:    await cleanup('ai_cost_usage', `organization_id=? AND created_at<?`, [orgId], policy.costUsage); |
| ai_org_memory | B | 1 | server/src/services/ai/industryTemplateService.ts:76:  const orgMemory = (await dbGet(`SELECT industry FROM ai_org_memory WHERE organization_id = ?`, [ |
| ai_quality_metrics | B | 13 | server/src/routes/ai/aiLearning.ts:136:        FROM ai_quality_metrics |
| ai_run_ledger | B | 2 | server/src/services/wave7ConnectorRuntimeService.ts:467:    `SELECT run_id, organization_id, status FROM ai_run_ledger |
| ai_security_audit_log | B | 4 | server/src/services/retentionPolicyService.ts:106:      'ai_security_audit_log', |
| ai_usage_logs | B | 20 | server/src/utils/archSanityCheck.ts:55:      'ai_usage_logs', |
| api_logs | B | 2053 | server/src/routes/superadmin.routes.ts:3373:        `SELECT COUNT(*) as count FROM api_logs WHERE status_code >= 500 AND created_at > datetime('now', '-15 minutes')`, |
| artifact_evidence | A | 14 | server/src/services/evidence/evidenceContract.ts:12: *     `artifact_evidence`. Ma `sources`/`assumptions`/`confidence`(numeric)/`toVerify`, ale |
| artifact_lifecycle_events | A | 3 | server/src/types/finance/Operation.ts:192://     at the per-mutation grain (mirrors `artifact_lifecycle_events`'s |
| assessment_reports | A | 4 | src/services/report/drdReportClient.ts:16: * `assessment_reports` stores DRD MATURITY LEVELS (0..axis.levelCount, i.e. |
| assessments | A | 4 | src/store/useChatProjectStore.ts:9: * - PMO Project (projectId): BUSINESS projects with assessments, initiatives, tasks |
| attribution_events | B | 1 | server/src/services/attributionService.ts:156:    `INSERT INTO attribution_events (id, organization_id, user_id, source_type, source_id, campaign, partner_code, medium, metadata) |
| canonical_inbox_items | A | 54 | server/src/utils/dbSchema.ts:11:  canonical_inbox_items: [ |
| compute_job_outputs | B | 1 | src/services/api/financeV2.api.ts:631: * `compute_job_outputs` nie ma czytnika w serwisie) — po `succeeded` trzeba |
| compute_jobs | B | 1 | server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts:620:          `SELECT id, status FROM compute_jobs WHERE id = ?`, |
| conclusion_source_packs | A | 1 | server/src/services/conclusions/ConclusionService.ts:221:        `CREATE TABLE IF NOT EXISTS conclusion_source_packs ( |
| conclusions | A | 1 | src/store/useToolStore.ts:1401:    description: 'Convert the matrix into tensions, applied conclusions, and strategic moves', |
| conversations | A; D=6 pustych watkow | 13 | src/store/useAppStore.ts:21: *   useConversationStore (52k) — Unified AI conversations     ⚠ HIGH overlap with chatSlice |
| conversion_events | B | 1 | server/src/routes/analytics-superadmin.routes.ts:83: * Demo/trial funnel analytics from conversion_events |
| decisions | A | 35 | src/contracts/tableSurface/surfaceRegister.ts:215:    persistKey: 'my-work.decisions', |
| document_lifecycle_states | A | 13 | server/src/services/documentStudio/__tests__/documentVersionLineage.pg.test.ts:208:          'document_lifecycle_states', |
| document_studio_editor_audit | A | 16 | server/src/services/documentStudio/__tests__/documentVersionLineage.pg.test.ts:207:          'document_studio_editor_audit', |
| document_version_snapshots | A | 8 | server/src/services/vault/vaultDocumentVersionService.ts:25: * (`document_version_snapshots`, 776_document_studio_wave5_persistence.sql) ani |
| finance_analysis_definitions | A | 1 | server/src/routes/v8/finance-v2/__tests__/derivedAnalysisSelection.routes.pg.test.ts:175:        await tx.queryRun(`DELETE FROM finance_analysis_definitions WHERE organization_id = ?`, [ |
| finance_analysis_kpi_values | A | 36 | src/labels/financeKpiCommentLabels.ts:7: * `finance_analysis_kpi_values.interpretation_text` wprost, a to pole niesie |
| finance_artifact_aliases | A | 1 | src/services/api/financeV2.types.ts:420: * `LegacyBridgeQuarantinedDto.reason` (= `finance_artifact_aliases.mapping_reason`, |
| finance_artifacts | A | 3 | src/components/Economics/hooks/useFinanceSelection.ts:806:   * a kanoniczna analiza (`HISTORICAL_ANALYSIS`) ma id z `finance_artifacts`. To DWIE różne |
| finance_business_versions | A | 3 | server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts:203:        `UPDATE finance_business_versions SET status = 'APPROVED', approved_by = ?, approved_at = now() |
| finance_legacy_usage_events | A | 109 | server/src/services/financeLegacyCutover.ts:73:    `INSERT INTO finance_legacy_usage_events |
| finance_lineage_edges | A | 1 | src/services/api/financeV2.types.ts:1822: * enum of every kind a `finance_lineage_edges` row can carry), so known codes get a real Polish |
| finance_stmt_calendars | A | 1 | server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts:102:        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by) |
| finance_stmt_entities | A | 1 | server/src/services/__tests__/statementOwnerAcceptance.pg.test.ts:994:        `INSERT INTO finance_stmt_entities |
| finance_stmt_lines | A | 238 | server/src/types/finance/Operation.ts:16: * `finance_stmt_lines_enforce_parent_immutability`, WP-D01 section 4.5), |
| finance_stmt_periods | A | 4 | src/hooks/useFinanceBaselineWorkspaceFlag.ts:26: * `finance_stmt_periods` (dowód na realnej bazie 8/8, w tym mutacyjny: |
| finance_working_revisions | A | 3 | server/src/routes/v8/finance-v2/__tests__/mount-proof.pg.test.ts:110:           (SELECT count(*) FROM finance_working_revisions WHERE organization_id = ?)::int + |
| financial_ratio_snapshots | A | 68 | server/src/services/ratioAnalysisService.ts:1127:  await dbRun(`DELETE FROM financial_ratio_snapshots WHERE statement_id = ?`, [statementId]); |
| financial_statement_packs | A | 1 | src/services/api/financeV2.types.ts:389:  'financial_statement_packs', |
| financial_statements | A | 6 | server/src/services/financeAggregateScopeService.ts:294:    `SELECT id, statement_type FROM financial_statements WHERE statement_pack_id = ?`, |
| initiative_budgets | C | 15 | brak jednoznacznego statycznego konsumenta - niepewne, zostaje |
| initiative_milestones | A | 16 | server/src/scripts/u03OwnerBackedExecutionRealDbProof.ts:5:await pool.query(`CREATE TABLE transformation_cases(transformation_case_id text primary key,organization_id text,project_id text);CREATE TABLE transformation_case_artifact_links(transformation_case_id text,organization_id text,artifact_type text,artifact_id text);CREATE TABLE project_members(project_id text,user_id text);CREATE TABLE raid_items(id text primary key,organization_id text,initiative_id text,type text,title text,description text,status text,probability text,impact text,mitigation_plan text,owner_id text,due_date text,created_at timestamptz,updated_at timestamptz);CREATE TABLE tasks(id text primary key,organization_id text,initiative_id text,title text,due_date text,status text);CREATE TABLE initiative_milestones(id text primary key,organization_id text,initiative_id text,name text,target_date text,status text);CREATE TABLE v8_calendar_items(calendar_item_id text primary key,organization_id text,source_id text,item_type text,source_system text,source_object_ref text,title text,start_at text,end_at text,all_day int,timezone text,visibility_class text,edit_authority text,recurrence_model_json text,sync_state text,etag text,created_at timestamptz,updated_at timestamptz);`); |
| initiatives | A | 71 | src/store/useToolStore.ts:8: * - AI suggestions and generated initiatives |
| interview_assignments | A | 8 | server/src/scripts/t01InterviewRealDbProof.ts:241:    CREATE TABLE interview_assignments ( |
| interview_insights | A | 14 | server/src/scripts/t01InterviewRealDbProof.ts:236:    CREATE TABLE interview_insights ( |
| interview_library_templates | A | 4 | server/src/database/PostgresDatabase.ts:326:  interview_library_templates: ['is_active', 'is_system'], |
| interview_questions | A | 40 | server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts:71:      `INSERT INTO interview_questions |
| interview_sessions | A | 10 | server/src/controllers/InterviewController.ts:892:  const cols = await getTableColumns('interview_sessions'); |
| knowledge_graph_entities | B | 2 | server/src/services/knowledgeGraph/unifiedKGService.ts:199:      `SELECT id, mentions FROM knowledge_graph_entities |
| legacy_cutover_identity_denominator | B | 1 | server/src/services/legacyCutover/__tests__/legacyCutoverDenominator.pg.test.ts:3: * CLAUDE-NEXT-LEGACY-CUTOVER / T12 — proof for `legacy_cutover_identity_denominator` |
| my_idea_maps | A | 3 | server/src/jobs/ideaMapAutoSnapshotJob.ts:4: * Periodically snapshots idea workspace maps (`my_idea_maps`) into the |
| my_ideas | A | 23 | server/src/services/organizationContext/__tests__/orgPinnedConsumersMounted.pg.test.ts:78:    await pool.query(`INSERT INTO my_ideas (id,user_id,organization_id,title,body,tags) VALUES ($1,$2,$3,'Pinned Idea','Pinned body','[]')`, [ideaId, ownerA, orgA]); |
| notebook_pages | A | 6 | server/src/routes/v8/notebookTopics.routes.ts:34:       FROM notebook_pages WHERE id = ? LIMIT 1`, |
| notification_dedup | B | 9 | server/src/scripts/t01InterviewRealDbProof.ts:962:        (SELECT COUNT(*)::int FROM notification_dedup |
| notifications | A | 27 | src/store/useAppStore.ts:142:        delete (next as any).notifications; |
| okr_vnext_checkin_occurrences | A | 2 | server/src/services/resultsVnext/okr/okrCheckInCommands.ts:211:         JOIN okr_vnext_checkin_occurrences occ ON occ.cycle_id = s2.cycle_id AND occ.organization_id = kr2.organization_id |
| okr_vnext_checkins | A | 28 | src/components/ResultsVNext/okr/okrCheckInMappers.ts:65: * engine computes a `reason` at insert time but `okr_vnext_checkins` has no |
| okr_vnext_cycles | A | 2 | server/src/validators/resultsVnextOkr.validators.ts:85:/** `okr_vnext_cycles`' ten TIMESTAMPTZ columns and `start_date`/`end_date` |
| okr_vnext_key_results | A | 28 | server/src/routes/__tests__/day170.checkin-occurrences.pg.test.ts:361:         FROM okr_vnext_key_results kr |
| okr_vnext_objectives | A | 10 | server/src/services/v8/teresaCopilotCanon.ts:330: * `okr_vnext_objectives`. Same shape as KPI's `draft_quality_review` |
| okr_vnext_program_policy_versions | A | 1 | server/src/services/resultsVnext/__tests__/seedWynikiDbr77.pg.test.ts:155:    await safe(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]); |
| okr_vnext_programs | A | 1 | server/src/routes/resultsVnext/__tests__/day325.komunikaty-pl.gateway.pg.test.ts:47:      `INSERT INTO okr_vnext_programs (program_id, organization_id, name, status, created_by) |
| okr_vnext_sets | A | 3 | server/src/services/resultsVnext/okr/okrCheckInCommands.ts:188:    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`, |
| organization_context | A | 1 | server/src/jobs/orgContextRebuildJob.ts:38:         FROM organization_context_claims c |
| organization_limits | A | 1 | server/src/routes/auth.routes.ts:1886:            await dbRun(`DELETE FROM organization_limits WHERE organization_id = ?`, [orgId]).catch( |
| organization_members | A | 1 | server/src/middleware/admin.middleware.ts:204:          `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`, |
| presentation_decks | A | 3 | server/src/utils/storagePaths.ts:133: * — e.g. `presentation_decks.export_path`) do NOT go through this helper: |
| project_role_templates | B | 12 | server/src/database/DatabaseInitializer.ts:907:      `CREATE TABLE IF NOT EXISTS project_role_templates ( |
| projects | A | 2 | src/contexts/TrialContext.tsx:20:    projects: number; |
| raid_items | A | 16 | server/src/utils/security.utils.ts:129:  'raid_items', |
| report_builder_reports | A | 12 | src/toolPacks/readiness/manifests.ts:120:  'wiersz report_builder_reports utworzony (scratch test, uruchomiony i usunięty, log w ' + |
| results_writer_observations | B | 7 | server/src/services/results/resultsWriterObservationService.ts:3: * `results_writer_observations` (migration 20261014). |
| rvn_kpi_definition_versions | A | 138 | server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts:254:      LEFT JOIN rvn_kpi_definition_versions dv |
| rvn_kpi_definitions | A | 138 | src/components/ResultsVNext/kpiApi.ts:107:/** Wire shape of `rvn_kpi_definitions`, camelCased server-side by `toKpiDefinition`. */ |
| rvn_kpi_deviation_cases | A | 1 | server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts:321:               SELECT COUNT(*) FROM rvn_kpi_deviation_cases dc |
| rvn_kpi_measurements | A | 1099 | src/components/ResultsVNext/kpiApi.ts:162:/** Wire shape of `rvn_kpi_measurements`, camelCased server-side by `toKpiMeasurement`. */ |
| rvn_kpi_scorecard_items | A | 180 | src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts:222: * (`rvn_kpi_scorecard_items` itself "carries NO KPI-fact column", migration's |
| rvn_kpi_scorecards | A | 3 | src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts:81:// `20260812_rvn_kpi_scorecards.sql`, re-declared client-side per this |
| rvn_platform_events | A | 13 | src/services/apiUtils.ts:12:// and from there into `rvn_platform_events.correlation_id` — a Postgres |
| rvn_platform_obligations | A | 6 | server/src/routes/__tests__/day170.checkin-occurrences.pg.test.ts:255:         (SELECT count(*)::int FROM rvn_platform_obligations WHERE organization_id = $2 AND obligation_type = 'check_in') AS obligations`, |
| rvn_platform_projection_checkpoints | A | 1 | server/src/services/resultsVnext/platform/myworkProjectionConsumer.ts:203: * Courtesy advance of `rvn_platform_projection_checkpoints` (design §5: |
| rvn_platform_resource_visibility | A | 147 | server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts:45: * their own `rvn_platform_resource_visibility` row — `createScorecard` |
| rvn_platform_visibility_policies | A | 3 | server/src/routes/__tests__/day168.kpi-bootstrap.pg.test.ts:77:         FROM rvn_platform_visibility_policies |
| rvn_roi_assumptions | A | 12 | server/src/services/resultsVnext/roi/roiEconomicModelTypes.ts:118:// rvn_roi_assumptions |
| rvn_roi_baselines | A | 3 | server/src/validators/resultsVnextRoi.validators.ts:37: * `rvn_roi_baselines.baseline_period_start`/`baseline_period_end`/ |
| rvn_roi_benefit_lines | A | 5 | server/src/services/legacyCutover/registry/results.ts:102:        "INSERT initiative_kpis via createKpiDefinition (results.routes.ts:4212) plus UPDATE initiative_benefits SET status='promoted' (results.routes.ts:4227-4232), from results.routes.ts:4143-4239. No route under /api/vnext/results/roi or /kpi composes the combined benefit-promote-to-KPI operation against rvn_roi_benefit_lines + rvn_kpi_definitions together, so successor is null even though the KPI half alone has a sibling (RESULTS-W01).", |
| rvn_roi_calculation_policy | A | 3 | server/src/services/resultsVnext/platform/__tests__/roiOpenOrgBackfillVariantB.realdb.test.ts:247:    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]); |
| rvn_roi_calculation_runs | A | 2 | server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts:261:        `SELECT run_id FROM rvn_roi_calculation_runs |
| rvn_roi_cases | A | 3 | server/src/services/flowTransform/flowTransformLineageService.ts:252:        `SELECT case_id,current_actual_snapshot_id FROM rvn_roi_cases |
| rvn_roi_cost_lines | A | 4 | server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts:433:        `SELECT * FROM rvn_roi_cost_lines |
| rvn_roi_scenarios | A | 5 | server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts:456:        `SELECT * FROM rvn_roi_scenarios |
| rvn_roi_visibility_governance | A | 1 | server/src/services/resultsVnext/__tests__/seedWynikiDbr77.pg.test.ts:141:    // Sprzątanie jest best-effort: `rvn_roi_visibility_governance` jest |
| tasks | A | 84 | src/store/useChatProjectStore.ts:9: * - PMO Project (projectId): BUSINESS projects with assessments, initiatives, tasks |
| teresa_proposals | B | 2 | server/src/services/v8/teresaCopilotService.ts:247:      `CREATE TABLE IF NOT EXISTS teresa_proposals ( |
| usage_counters | B | 2 | server/src/cron/TrialCron.ts:144:      const result = await DbPromise.run(`DELETE FROM usage_counters WHERE counter_date < ?`, [ |
| users | B | 31 | server/src/cron/InvoiceReminderCron.ts:156:    `SELECT email, first_name FROM users |
| v8_artifact_origin_links | A | 88 | server/src/scripts/agentMigrationsIdempotencyRealDbProof.ts:89:    CREATE TABLE v8_artifact_origin_links ( |
| v8_canonical_object_states | A | 6 | server/src/services/v8/myWorkRoofService.ts:183:    `INSERT INTO v8_canonical_object_states ( |
| v8_output_artifacts | A | 88 | server/src/scripts/t01FinalOutputRealDbProof.ts:176:    CREATE TABLE IF NOT EXISTS v8_output_artifacts ( |
| wave5_artifact_versions | B | 13 | server/src/services/ideaHandoff/__tests__/ideaHandoffService.pg.test.ts:161:      `DELETE FROM wave5_artifact_versions WHERE artifact_id IN ( |
| wave6_context_ledger | B | 144 | server/src/services/wave6ContextLearningService.ts:206:      CREATE TABLE IF NOT EXISTS wave6_context_ledger ( |
| wave6_context_snapshots | B | 16 | server/src/services/wave6ContextLearningService.ts:190:      CREATE TABLE IF NOT EXISTS wave6_context_snapshots ( |

## Werdykt klasy C

Nie znaleziono tabeli, dla ktorej jednoczesnie da sie dowiesc zapisu oraz braku czytnika bez ryzyka dynamicznego SQL lub importu. initiative_budgets nie ma jednoznacznego literalnego konsumenta w skanie statycznym, dlatego pozostaje jako C-niepewne i skrypt jej nie usuwa.
