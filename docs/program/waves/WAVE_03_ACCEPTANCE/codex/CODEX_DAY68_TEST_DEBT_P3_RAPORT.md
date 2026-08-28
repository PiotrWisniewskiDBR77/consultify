# DYŻUR 68 — TEST DEBT P3 — RAPORT

Status: **PARTIAL — naprawialny dług test-local usunięty; pozostały nazwane kontrakty produktu**.

## Tożsamość i środowisko

- Marker: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`.
- Gałąź: `codex/day68-test-debt-p3-20260828`.
- Mianownik: dokładnie 74 istniejące pliki; nie odtworzono trzech usuniętych ścieżek.
- PG: wyłącznie `cx-day68-pg`, port 5940, baza `cx_day68_testdebt`.
- Migracje: pełny istniejący łańcuch 862, drugi przebieg 0; nowych migracji 0.
- Każdy plik uruchomiono oddzielnym procesem, realny lokalny PG, `--retry=0`. Zero zasobów zdalnych.

## Wynik końcowy

- Baseline: 9 PASS / 65 FAIL / 20 markerów unhandled.
- Final wykonawcy: **33 PASS / 41 FAIL / 0 unhandled**. Po domknięciu integratora: **35 PASS / 39 FAIL / 0 unhandled**.
- Czerwone→zielone: 24 pliki. Zielone→czerwone: 0.
- W tej kontynuacji zmieniono 16 licencjonowanych plików testowych; 12 dodatkowych czerwonych plików stało się zielonych, a dwa mocki usunęły unhandled bez osłabiania nadal czerwonych kontraktów.
- Pozostałe 41 plików dochodzi do nazwanych zachowań produktu; ich kontrakty i właściciele są w tabeli.
- OrganizationView nie ma już sprzeczności exit 1 / GREEN: wykonuje 10 testów, 7 jest nazwanych czerwonych.
- Sztucznego wiersza `index/file` nie ma.

## Naprawione klastry

- A: lokalne i18n, selektory, circuit threshold, workbook route i Model Catalog — 7/7 zielone.
- B: aktualne adaptery Document Studio/sheet-template, reset kolejek mocków oraz Node runtime realnych fontów PDF — 4 pliki zielone; TOC DOCX i benefits dedupe pozostają kontraktami produktu.
- C: kompletne lokalne mocki `i18n.language`; 20 markerów unhandled usunięte, kontrakty honesty zachowane.
- D: pełny słownik lokalnego mocka AITableProposal oraz osiągnięcie 10 testów OrganizationView.

Dowody mutacyjne zawierają czerwony wynik kontrolowanej mutacji, zielony po odtworzeniu i zgodne SHA kopii/przywróconych plików: `continuation-a-*`, `continuation-b-*`, `continuation-d-*` w katalogu artefaktów i scratch. Nie użyto stash, retry, skip/todo ani wyciszeń.

## Pin AI

`tests/unit/initiativeDocumentView.section-ai-noop.test.ts` niezmieniony, 3/3 zielone. Werdykt: **KANONIZACJA DZIURY — OWNER_PRODUCT_DECISION**. Cztery handlery AI nie zostały zaimplementowane.

## Kompilacje

- Serwer przez `server/tsconfig.build.json`: exit 0.
- Front: limit 6144 MB, wynik zapisany w `continuation-front-build.log`.

## Tabela 74 plików

| # | plik | exit | czerwone testy | unhandled | pierwsza przyczyna | kategoria | właściciel | status |
|---:|---|---:|---:|---:|---|---|---|---|
| 01 | `tests/integration/partners/m16-final-repair.realdb.test.ts` | 0 | 0 | 0 | GREEN | test | `tests/integration/partners/m16-final-repair.realdb.test.ts` | GREEN_BASELINE |
| 02 | `tests/resultsVnext/okr/alignmentNoScoreMutation.static.test.ts` | 0 | 0 | 0 | GREEN | test | `tests/resultsVnext/okr/alignmentNoScoreMutation.static.test.ts` | GREEN_BASELINE |
| 03 | `tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts` | 0 | 0 | 0 | expected 'Search knowledge' to be 'Szukaj w wiedzy' // Object.is equality | test | `tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts` | FIXED_P3 |
| 04 | `tests/unit/api.test.ts` | 0 | 0 | 0 | expected null not to be null | test | `tests/unit/api.test.ts` | FIXED_P3 |
| 05 | `tests/unit/auth/auth.middleware.private.test.ts` | 0 | 0 | 0 | expected 'superadmin' to be 'owner' // Object.is equality | test | `tests/unit/auth/auth.middleware.private.test.ts` | FIXED_P3 |
| 06 | `tests/unit/components/Admin/AIMissionControl.honesty.test.tsx` | 0 | 0 | 0 | Unable to find an element with the text: /SUCCESS \(250ms\)/i. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/components/Admin/AIMissionControl.honesty.test.tsx` | FIXED_P3 |
| 07 | `tests/unit/components/Admin/AdminRiskSummaryPanel.test.tsx` | 0 | 0 | 0 | Unable to find an element with the text: /Started: Unknown time/. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/components/Admin/AdminRiskSummaryPanel.test.tsx` | FIXED_P3 |
| 08 | `tests/unit/components/MyWork/QuickFilterBar.test.tsx` | 0 | 0 | 0 | expected false to be true // Object.is equality | test | `tests/unit/components/MyWork/QuickFilterBar.test.tsx` | FIXED_P3 |
| 09 | `tests/unit/components/Organization/KnowledgeGraphExplorer.smoke.test.tsx` | 0 | 0 | 0 | t is not a function | test | `tests/unit/components/Organization/KnowledgeGraphExplorer.smoke.test.tsx` | FIXED_P3 |
| 10 | `tests/unit/components/Organization/OrganizationView.smoke.test.tsx` | 1 | 7 | 0 | after complete local sidebar/i18n mocks, current OrganizationView does not expose seven contracted routed surfaces | test | `tests/unit/components/Organization/OrganizationView.smoke.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 11 | `tests/unit/components/ProposalCard.test.tsx` | 0 | 0 | 0 | t is not a function | produkt | `src/components/DiscoveryTools/shared/ProposalCard.tsx` | FIXED_P3 |
| 12 | `tests/unit/components/ReportsAndPresentations/artifactNavigation.test.ts` | 0 | 0 | 0 | expected '/presentations?tab=workbook_templates…' to be '/reports?tab=workbook_templates&workb…' // Object.is equality | środowisko | `tests/unit/components/ReportsAndPresentations/artifactNavigation.test.ts` | FIXED_P3 |
| 13 | `tests/unit/components/SuperAdmin/ModelRegistry/ModelCatalogTable.honesty.test.tsx` | 0 | 0 | 0 | Unable to find an accessible element with the role "button" and name `/Add Model/i` | test | `tests/unit/components/SuperAdmin/ModelRegistry/ModelCatalogTable.honesty.test.tsx` | FIXED_P3 |
| 14 | `tests/unit/components/settings/MappingDriftPanel.honesty.test.tsx` | 0 | 0 | 0 | GREEN | test | `tests/unit/components/settings/MappingDriftPanel.honesty.test.tsx` | GREEN_BASELINE |
| 15 | `tests/unit/config/wave3DotenvIsolation.test.ts` | 0 | 0 | 0 | GREEN | test | `tests/unit/config/wave3DotenvIsolation.test.ts` | GREEN_BASELINE |
| 16 | `tests/unit/createInitiativeFromMove.roundtrip.test.ts` | 0 | 0 | 0 | t is not a function | test | `tests/unit/createInitiativeFromMove.roundtrip.test.ts` | FIXED_P3 |
| 17 | `tests/unit/deliverables/deliverableTemplateService.test.ts` | 0 | 0 | 0 | expected 'doc-template-1787924744032-rxv57rt7' to be 'tpl-doc-1' // Object.is equality | test | `tests/unit/deliverables/deliverableTemplateService.test.ts` | FIXED_P3 |
| 18 | `tests/unit/deliverables/documentDocxGolden.test.ts` | 1 | 1 | 0 | expected '<?xml version="1.0" encoding="UTF-8" …' to contain 'TOC ' | test | `tests/unit/deliverables/documentDocxGolden.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 19 | `tests/unit/deliverables/documentPdfGolden.test.ts` | 0 | 0 | 0 | Not a supported font format or standard PDF font. | produkt | `server/src/services/documentStudio/documentPdfRenderer.ts` | FIXED_P3 |
| 20 | `tests/unit/deliverables/templateCrud.test.ts` | 0 | 0 | 0 | expected "vi.fn()" to be called with arguments: [ StringContaining{…}, …(1) ] | test | `tests/unit/deliverables/templateCrud.test.ts` | FIXED_P3 |
| 21 | `tests/unit/deliverables/workbookBuilderCf.test.ts` | 0 | 0 | 0 | expected '<?xml version="1.0" encoding="UTF-8" …' to contain 'conditionalFormatting' | test | `tests/unit/deliverables/workbookBuilderCf.test.ts` | FIXED_P3 |
| 22 | `tests/unit/execution/benefitsRegisterService.test.ts` | 1 | 1 | 0 | Unhandled dbRun SQL: INSERT INTO initiative_benefits ( id, organization_id, initiative_id, name, description, benefit_type, kpi_id, owner_id, baseline_value, target_value, current_value, measurement_frequency, status, source_tag, created_by, created_at, updated_at ) VALUES (?, ?, ?, ?, NULL, 'quantitative', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) | test | `tests/unit/execution/benefitsRegisterService.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 23 | `tests/unit/execution/reportPdfService.test.ts` | 0 | 0 | 0 | Not a supported font format or standard PDF font. | produkt | `server/src/services/reportPdfService.ts` | FIXED_P3 |
| 24 | `tests/unit/finance/financeFallbackGating.test.ts` | 0 | 0 | 0 | expected 'closed' to be 'open' // Object.is equality | test | `tests/unit/finance/financeFallbackGating.test.ts` | FIXED_P3 |
| 25 | `tests/unit/helpTranslations.test.ts` | 1 | 1 | 0 | DE is missing help translations: | test | `tests/unit/helpTranslations.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 26 | `tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx` | 1 | 1 | 0 | expected null to be 'drafts' // Object.is equality | test | `tests/unit/hooks/useTemplates.canonicalArtifacts.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 27 | `tests/unit/i18n/idea-workspace-required-keys.test.ts` | 1 | 2 | 0 | 15 key(s) used by the Idea Workspace tools are missing from pl translation.json (showing up to 40): | test | `tests/unit/i18n/idea-workspace-required-keys.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 28 | `tests/unit/i18n/s2-locale-added-keys.test.ts` | 1 | 8 | 0 | 2157 key(s) missing from de/translation.json (showing up to 40): | test | `tests/unit/i18n/s2-locale-added-keys.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 29 | `tests/unit/initiativeDocumentView.section-ai-noop.test.ts` | 0 | 0 | 0 | GREEN | test | `tests/unit/initiativeDocumentView.section-ai-noop.test.ts` | GREEN_BASELINE |
| 30 | `tests/unit/initiatives-execution/canonicalInitiativeCardWorkspace.test.tsx` | 0 | 0 | 0 | GREEN | test | `tests/unit/initiatives-execution/canonicalInitiativeCardWorkspace.test.tsx` | GREEN_BASELINE |
| 31 | `tests/unit/initiatives-execution/initiativesHubCanonicalTabs.test.tsx` | 0 | 0 | 0 | GREEN | test | `tests/unit/initiatives-execution/initiativesHubCanonicalTabs.test.tsx` | GREEN_BASELINE |
| 32 | `tests/unit/migrationRunnerOrdering.test.ts` | 1 | 1 | 0 | producenci tool_initiative_links: 20260719_baseline_gap.sql, 291_tools_initiatives.sql, 948_tool_promotion_idempotency.sql, 948_tool_promotion_tenant_idempotency.sql. Decyzja I2: kanoniczny jest wyłącznie 20260719_baseline_gap.sql; 291_tools_initiatives.sql jest historyczny i wykluczony przez runner, a migracja konsumencka NIE MOŻE tworzyć tabeli.: expected [ '20260719_baseline_gap.sql', …(3) ] to deeply equal [ '20260719_baseline_gap.sql', …(1) ] | test | `tests/unit/migrationRunnerOrdering.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 33 | `tests/unit/mindmap/canvasLeftToolbar.test.tsx` | 1 | 3 | 0 | expected undefined to be truthy | test | `tests/unit/mindmap/canvasLeftToolbar.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 34 | `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` | 1 | 3 | 0 | Unable to find an element with the text: Auto-clustering. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 35 | `tests/unit/mindmap/floatingNodeToolbar.test.tsx` | 1 | 2 | 0 | Unable to find an element with the text: Topic. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/mindmap/floatingNodeToolbar.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 36 | `tests/unit/mindmap/floatingToolbarDropdowns.test.tsx` | 1 | 7 | 0 | Unable to find an element with the text: Topic. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/mindmap/floatingToolbarDropdowns.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 37 | `tests/unit/mindmap/hydrationRegression.test.ts` | 1 | 1 | 0 | expected true to be false // Object.is equality | test | `tests/unit/mindmap/hydrationRegression.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 38 | `tests/unit/mindmap/moreToolsPanel.test.tsx` | 1 | 3 | 0 | Unable to find an element with the text: Visual Modes. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/mindmap/moreToolsPanel.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 39 | `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` | 1 | 3 | 0 | expected null to be 70000 // Object.is equality | test | `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 40 | `tests/unit/scripts/adminOwnerFixtureGuard.test.ts` | 0 | 0 | 0 | expected '/private/tmp/consultify-day68-test-de…' to contain 'requires ADMIN_OWNER_FIXTURE_CONFIRM=…' | środowisko | `tests/unit/scripts/adminOwnerFixtureGuard.test.ts` | FIXED_P3 |
| 41 | `tests/unit/scripts/g4FocusMeasurement.contract.test.ts` | 1 | 1 | 0 | expected true to be false // Object.is equality | test | `tests/unit/scripts/g4FocusMeasurement.contract.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 42 | `tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts` | 0 | 0 | 0 | expected 'node:internal/modules/run_main:107\n …' to contain 'adopted runtime database does not exi…' | środowisko | `tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts` | FIXED_P3 |
| 43 | `tests/unit/server/utils/queryHelpers.test.ts` | 0 | 0 | 0 | lokalny mock Logger nie eksportował `info`/`debug` wymaganych przez loadEnv | test | `tests/unit/server/utils/queryHelpers.test.ts` | FIXED_P3 |
| 44 | `tests/unit/services/auditIntegrityService.test.ts` | 0 | 0 | 0 | GREEN | test | `tests/unit/services/auditIntegrityService.test.ts` | GREEN_BASELINE |
| 45 | `tests/unit/services/drdAxisDataGuard.test.ts` | 1 | 1 | 0 | expected 6 to be less than or equal to 5 | test | `tests/unit/services/drdAxisDataGuard.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 46 | `tests/unit/services/ssoAzureAD.test.ts` | 0 | 0 | 0 | GREEN | test | `tests/unit/services/ssoAzureAD.test.ts` | GREEN_BASELINE |
| 47 | `tests/unit/services/v8-execution-control-api.test.ts` | 1 | 1 | 0 | expected false to be true // Object.is equality | test | `tests/unit/services/v8-execution-control-api.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 48 | `tests/unit/services/v8-my-work-api.test.ts` | 1 | 1 | 0 | expected "vi.fn()" to be called with arguments: [ '/my-work/notebook/pages/note-1' ] | test | `tests/unit/services/v8-my-work-api.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 49 | `tests/unit/services/v8-results-api.test.ts` | 1 | 12 | 0 | V8ResultsApi.createKpiTimeSeriesValue is not a function | test | `tests/unit/services/v8-results-api.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 50 | `tests/unit/services/valuationService.defaultAssumptions.test.ts` | 0 | 0 | 0 | expected 8.94 to be 12 // Object.is equality | test | `tests/unit/services/valuationService.defaultAssumptions.test.ts` | FIXED_P3 |
| 51 | `tests/unit/table/AITableProposal.test.tsx` | 0 | 0 | 0 | Unable to find an element with the text: /Apply selected/i. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/table/AITableProposal.test.tsx` | FIXED_P3 |
| 52 | `tests/unit/table/useTableSchema.test.ts` | 0 | 0 | 0 | t is not a function | produkt | `src/components/MyWork/table/useTableSchema.ts` | FIXED_P3 |
| 53 | `tests/unit/table/useTableViews.test.ts` | 0 | 0 | 0 | t is not a function | test | `tests/unit/table/useTableViews.test.ts` | FIXED_P3 |
| 54 | `tests/unit/testing/testDiscoveryGate.test.ts` | 1 | 1 | 0 | Discovery gate FAILED. | test | `tests/unit/testing/testDiscoveryGate.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 55 | `tests/unit/utils/betaAccessGating.test.ts` | 0 | 0 | 0 | expected true to be false // Object.is equality | test | `tests/unit/utils/betaAccessGating.test.ts` | FIXED_P3 |
| 56 | `tests/unit/utils/initiativeWorkflowStatus.test.ts` | 1 | 1 | 0 | expected false to be true // Object.is equality | test | `tests/unit/utils/initiativeWorkflowStatus.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 57 | `tests/unit/utils/myWorkNotebookRbacGates.test.ts` | 1 | 1 | 0 | expected true to be false // Object.is equality | test | `tests/unit/utils/myWorkNotebookRbacGates.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 58 | `tests/unit/utils/publicProduction.test.ts` | 1 | 1 | 0 | expected [ { id: 'AI_CHAT', …(1) }, …(3) ] to deeply equal [ { id: 'AI_CHAT', …(1) }, …(3) ] | test | `tests/unit/utils/publicProduction.test.ts` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 59 | `tests/unit/views/superadmin/AdminAuditLogsView.honesty.test.tsx` | 1 | 2 | 0 | Unable to find an accessible element with the role "button" and name `/Resolve audit log log-1/i` | test | `tests/unit/views/superadmin/AdminAuditLogsView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 60 | `tests/unit/views/superadmin/AdminSessionsView.honesty.test.tsx` | 1 | 4 | 0 | Unable to find an accessible element with the role "button" and name `/Revoke admin session session-1/i` | test | `tests/unit/views/superadmin/AdminSessionsView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 61 | `tests/unit/views/superadmin/ApprovalWorkflowsView.honesty.test.tsx` | 1 | 4 | 0 | Unable to find an accessible element with the role "button" and name `/Delete approval workflow Security approval/i` | test | `tests/unit/views/superadmin/ApprovalWorkflowsView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 62 | `tests/unit/views/superadmin/AuditEventsViewer.honesty.test.tsx` | 1 | 2 | 0 | Unable to find an element with the text: Audit events unavailable. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/views/superadmin/AuditEventsViewer.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 63 | `tests/unit/views/superadmin/DLPView.honesty.test.tsx` | 1 | 7 | 0 | Unable to find an accessible element with the role "button" and name `/Resolve DLP violation violation-1/i` | test | `tests/unit/views/superadmin/DLPView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 64 | `tests/unit/views/superadmin/DeviceManagementView.honesty.test.tsx` | 1 | 1 | 0 | Unable to find an accessible element with the role "button" and name `/Block device device-1/i` | test | `tests/unit/views/superadmin/DeviceManagementView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 65 | `tests/unit/views/superadmin/DocumentsRAGTab.honesty.test.tsx` | 0 | 0 | 0 | lokalny mock API nie eksportował `getMyProjectMemberships` | test | `tests/unit/views/superadmin/DocumentsRAGTab.honesty.test.tsx` | FIXED_P3 |
| 66 | `tests/unit/views/superadmin/IPWhitelistView.honesty.test.tsx` | 1 | 3 | 0 | Unable to find an accessible element with the role "button" and name `/Remove IP 10\.0\.0\.1/i` | test | `tests/unit/views/superadmin/IPWhitelistView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 67 | `tests/unit/views/superadmin/SCIMProvisioningView.honesty.test.tsx` | 1 | 1 | 0 | Unable to find an element with the text: Consultify Admins. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/views/superadmin/SCIMProvisioningView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 68 | `tests/unit/views/superadmin/SecurityEventsView.honesty.test.tsx` | 1 | 5 | 0 | Unable to find an accessible element with the role "button" and name `/Resolve security event event-1/i` | test | `tests/unit/views/superadmin/SecurityEventsView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 69 | `tests/unit/views/superadmin/SecurityIncidentsView.honesty.test.tsx` | 1 | 7 | 0 | Unable to find an accessible element with the role "button" and name `/View incident incident-1/i` | test | `tests/unit/views/superadmin/SecurityIncidentsView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 70 | `tests/unit/views/superadmin/SuperAdminLegalView.honesty.test.tsx` | 1 | 4 | 0 | Unable to find an element with the text: /No legal documents found/i. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/views/superadmin/SuperAdminLegalView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 71 | `tests/unit/views/superadmin/SuperAdminStorageDetailModal.honesty.test.tsx` | 1 | 2 | 0 | Unable to find an accessible element with the role "button" and name `/Delete file reports\/report\.pdf/i` | środowisko | `tests/unit/views/superadmin/SuperAdminStorageDetailModal.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 72 | `tests/unit/views/superadmin/SupportTicketsView.honesty.test.tsx` | 1 | 2 | 0 | Unable to find an element with the title: View ticket details. | test | `tests/unit/views/superadmin/SupportTicketsView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 73 | `tests/unit/views/superadmin/ThreatIntelligenceView.honesty.test.tsx` | 1 | 5 | 0 | Unable to find an accessible element with the role "button" and name `/Block threat threat-1/i` | test | `tests/unit/views/superadmin/ThreatIntelligenceView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |
| 74 | `tests/unit/views/superadmin/components/BulkOperationsView.honesty.test.tsx` | 1 | 1 | 0 | Unable to find an element with the text: Users unavailable. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible. | test | `tests/unit/views/superadmin/components/BulkOperationsView.honesty.test.tsx` | PRODUCT_DEFECT_NOT_AUTHORIZED |

## Najważniejsze briefy produktu

- DOCX: `formattingSchema.toc=true` generuje statyczną listę, nie pole TOC Word.
- Benefits: dedupe czyta `benefits_register`, a zapis handoffu idzie przez `createBenefit` do `initiative_benefits`.
- Migracje: istnieją czterej producenci `tool_initiative_links`.
- Locale: brakujące i niesymetryczne klucze EN/PL/DE/ES/AR/JA wymagają zmian zasobów produktu.
- SuperAdmin honesty: pozostałe kontrakty dotyczą normalizacji wrapped payloadów, read-back po mutacji, bezpiecznych danych i stanu degraded zamiast fałszywego empty/success.
- Mindmap, Results/V8, Organization i discovery gate: pełne nazwy kontraktów znajdują się w zachowanych logach per plik.

## SHA-256

- Agregat SHA-256 wszystkich 74 końcowych logów: `87bb9ef4af64385f5f35a1545100a114939c5690aaa21c4983e4d4d101dd5837`.
- Katalog: `/private/tmp/consultify-day68-test-debt-p3-artifacts/continuation-final2/logs`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano ani nie naprawiono produktu wskazanego przez 39 czerwonych plików; zmiany produktu były poza licencją.
- Nie wykonano osiągalności HTTP ani dowodu wizualnego, ponieważ nie zmieniano runtime/UI.
- Nie rozstrzygnięto decyzji produktowej dla czterech handlerów AI.
- Nie wykonano żadnego testu wobec Railway, demo, stagingu ani produkcji.

## Finalny SHA

## Domknięcie integratora po handoffie

Integrator usunął dwa błędnie sklasyfikowane, małe ogony test-local bez ponownego
przekazywania dyżuru:

- `queryHelpers.test.ts`: lokalny mock Logger nie miał metod `info` i `debug`, których
  `loadEnv.ts` używa podczas importu; po uzupełnieniu **10/10 PASS**;
- `DocumentsRAGTab.honesty.test.tsx`: lokalny mock `Api` nie miał wywoływanego przez
  komponent `getMyProjectMemberships`; po dodaniu eksportu i pustego fixture **3/3 PASS**.

Wspólny celowany regres: **13/13 PASS**, `--retry=0`. Produkt pozostał bez zmian.
Usunięto również sztuczny wiersz parsera `index/file`; tabela zawiera dokładnie 74
rzeczywiste pliki. Końcowy stan po odbiorze integratora: **35 PASS / 39 FAIL / 0 unhandled**.

Pozostałe 39 plików stanowi duży, wielomodułowy klaster zmian produktu lub widocznych
kontraktów. Nie jest rozszerzany w ramach test-local P3; wymaga osobnego planu rozłącznych
dyżurów oraz decyzji właściciela dla widocznych zachowań, w tym czterech handlerów AI.

SHA commita raportu jest podany w końcowym handoffie; nie może być zapisany w treści własnego commita bez zmiany tego SHA.
