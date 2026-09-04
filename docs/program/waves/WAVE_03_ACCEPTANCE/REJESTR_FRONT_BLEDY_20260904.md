# Rejestr front błędy — 2026-09-04

Marker: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`

Mianownik: 642 trafienia komendy `git grep -nE 'data\.error|err\.message|error\.message' -- src/services src/api src/hooks src/components`.

Podsumowanie: NA EKRAN=435, CUDZY TEREN=99, STEROWANIE=74, TYLKO LOG=34.

| Plik | Linia | Trafienie | Klasa | Uzasadnienie |
| --- | ---: | --- | --- | --- |
| `src/components/AIAnalyticsDashboard.tsx` | 153 | `setError(err instanceof Error ? err.message : 'Failed to load analytics');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/AIChat/AgentHubShell.tsx` | 607 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentHubShell.tsx` | 629 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentHubShell.tsx` | 661 | `setLoadError(error instanceof Error ? error.message : 'Failed to load agent plans');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentHubShell.tsx` | 702 | `setTemplatesError(error instanceof Error ? error.message : 'Failed to load templates');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentHubShell.tsx` | 788 | `setActivePlanError(error instanceof Error ? error.message : 'Failed to load plan');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentHubShell.tsx` | 815 | `setCreateError(error instanceof Error ? error.message : 'Failed to create process');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentOperationsPanel.tsx` | 82 | `toast.error(error instanceof Error ? error.message : 'Agent settings failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentOperationsPanel.tsx` | 116 | `toast.error(error instanceof Error ? error.message : 'Agent activation failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentOperationsPanel.tsx` | 142 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentOperationsPanel.tsx` | 148 | `toast.error(error instanceof Error ? error.message : 'Operational snapshot failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentOperationsPanel.tsx` | 182 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentOperationsPanel.tsx` | 188 | `toast.error(error instanceof Error ? error.message : 'Recovery failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentPlanCanvas.tsx` | 474 | `setVaultSafesError(err instanceof Error ? err.message : 'Failed to load vault safes');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentPlanPanel.tsx` | 276 | `setLoadError(error instanceof Error ? error.message : 'Failed to load plan');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentPlanPanel.tsx` | 376 | `setLoadError(error instanceof Error ? error.message : 'Failed to run plan');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentPlanPanel.tsx` | 407 | `setLoadError(error instanceof Error ? error.message : 'Failed to schedule plan');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentPlanPanel.tsx` | 423 | `setLoadError(error instanceof Error ? error.message : 'Failed to approve step');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentPlanPanel.tsx` | 437 | `setLoadError(error instanceof Error ? error.message : 'Failed to cancel plan');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentProcessTemplatesPanel.tsx` | 107 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentProcessTemplatesPanel.tsx` | 113 | `toast.error(error instanceof Error ? error.message : 'Failed to load templates');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentProcessTemplatesPanel.tsx` | 133 | `toast.error(error instanceof Error ? error.message : 'Template transition failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentProcessTemplatesPanel.tsx` | 163 | `toast.error(error instanceof Error ? error.message : 'Template instantiation failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentProcessTemplatesPanel.tsx` | 200 | `toast.error(error instanceof Error ? error.message : 'Template intake failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/AgentProcessTemplatesPanel.tsx` | 220 | `toast.error(error instanceof Error ? error.message : 'Failed to load governance history');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/Artifacts/renderers/DiagramRenderer.tsx` | 58 | `setError(err.message \|\| 'Failed to render diagram');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/CanvasArtifactBlockRenderer.tsx` | 550 | `setVegaError(error instanceof Error ? error.message : 'Vega-Lite render failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/CanvasArtifactBlockRenderer.tsx` | 650 | `setRenderError(error instanceof Error ? error.message : 'Diagram rendering failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts` | 458 | `// CHAT-OWN-016: \`err.message\` moglo niesc tresc dostawcy/sieci.` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` | 481 | `typeof err?.data?.error === 'string' ? err.data.error : 'TEMPLATE_RESOLVE_FAILED';` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/templateLifecycle/TabeleTemplatesGrid.tsx` | 76 | `{error.message}` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | 732 | `error instanceof Error ? error.message : 'presentation_generation_failed'` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | 861 | `err instanceof Error && err.message ? err.message : 'nieznany błąd silnika';` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | 1217 | `error instanceof Error ? error.message : 'Failed to start artifact generation'` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | 1219 | `toast.error(error instanceof Error ? error.message : 'Failed to start artifact generation');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | 1285 | `setStartupError(error instanceof Error ? error.message : 'Failed to advance pipeline');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | 1286 | `toast.error(error instanceof Error ? error.message : 'Failed to advance pipeline');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/TeresaProposalCard.tsx` | 138 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 1349 | `__conversation: err instanceof Error ? err.message : 'Proposal history unavailable.',` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 1383 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 1388 | `[messageId]: err instanceof Error ? err.message : 'Proposal creation failed.',` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 1410 | `[proposalId]: err instanceof Error ? err.message : 'Proposal decision failed.',` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 1446 | `[proposalId]: err instanceof Error ? err.message : 'Document creation failed.',` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 2018 | `// tresc dostawcy (wczesniej zapisywalismy tam \`err.message\`).` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 3415 | `error: err instanceof Error ? err.message : undefined,` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 3735 | `error: err instanceof Error ? err.message : undefined,` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/UnifiedChatPanel.tsx` | 3940 | `error: err instanceof Error ? err.message : undefined,` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 270 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 297 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 313 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 329 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 358 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 374 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 388 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 405 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ArtifactRunControl.tsx` | 422 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/V8ContextIndicator.tsx` | 122 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/WorkCanvasDocumentPanel.tsx` | 1965 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AIChat/aiProviderErrorCopy.ts` | 7 | `* tresc z serwera (\`data.message\`, \`err.message\`). Ta funkcja jest jedynym` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/AISettings/AuditLogViewer.tsx` | 95 | `setError(err instanceof Error ? err.message : 'Unknown error');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Admin/AI/ModelsProvidersTab.tsx` | 241 | `data.error \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Admin/AI/ModelsProvidersTab.tsx` | 283 | `data.error \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Admin/AdminConfigurationVersionsPanel.tsx` | 65 | `error instanceof Error ? error.message : t('admin.ai.configuration-versions.errors.load')` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Admin/AdminConfigurationVersionsPanel.tsx` | 131 | `? error.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Admin/AdminOrganizationDefaultsPanel.tsx` | 72 | `? error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Admin/AdminOrganizationDefaultsPanel.tsx` | 93 | `? error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Admin/AdminOrganizationDefaultsPanel.tsx` | 119 | `? error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Admin/AdminOrganizationDefaultsPanel.tsx` | 149 | `? error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Admin/AdminRiskSummaryPanel.tsx` | 92 | `? error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Benefits/LessonsLearnedPanel.tsx` | 221 | `toast.error(error.message \|\| 'Failed to add lesson');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Benefits/ValuationWorkspace.tsx` | 254 | `toast.error(error instanceof Error ? error.message : t('valuation.inputs.failed','Canonical valuation inputs unavailable'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Benefits/ValuationWorkspace.tsx` | 397 | `toast.error(error instanceof Error ? error.message : t('valuation.assumptions.failed', 'Failed to save assumptions'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Benefits/ValuationWorkspace.tsx` | 411 | `toast.error(error instanceof Error ? error.message : t('valuation.comps.failed', 'Failed to save comps'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Benefits/ValuationWorkspace.tsx` | 420 | `try{const computed=await computeCanonicalLegacyValuation(selectedId);const cold=await fetchValuation(selectedId);if(!cold?.dcf\|\|cold.businessVersionId!==computed.businessVersionId\|\|Number(cold.dcf.enterpriseValue)!==Number(computed.enterpriseValue)\|\|Number(cold.dcf.equityValue)!==Number(computed.equityValue))throw new Error(t('valuation.compute.readbackMismatch','Canonical valuation result readback mismatch'));confirmCanonicalLegacyValuationComputeReadback(selectedId);toast.success(t('valuation.compute.ok','Valuation computed'));setActiveStep('results');onValuationChanged?.();}catch(error){toast.error(error instanceof Error?error.message:t('valuation.compute.failed','Compute failed'));}finally{setBusy(false);}` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/CaseWorkspace/podglad/main.tsx` | 195 | `{String(this.state.error.stack \|\| this.state.error.message)}` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Charts/RechartsWrapper.tsx` | 42 | `<pre className="mt-2 text-xs text-danger-500">{this.state.error.message}</pre>` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Charts/RechartsWrapper.tsx` | 129 | `<pre className="mt-2 text-xs text-danger-500">{error.message}</pre>` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Chat/ChatActionButton.tsx` | 66 | `const msg = err instanceof Error ? err.message : String(err);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Chat/ChatActionCard.tsx` | 83 | `const msg = err instanceof Error ? err.message : String(err);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/CreateTemplateFromArtifactModal.tsx` | 111 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentCommentsPanel.tsx` | 127 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentCommentsPanel.tsx` | 157 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentCommentsPanel.tsx` | 179 | `toast.error(err instanceof Error ? err.message : failureMessage);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 726 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 816 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 844 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 865 | `setError(err instanceof Error ? err.message : 'Failed to rotate share link');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 880 | `setError(err instanceof Error ? err.message : 'Failed to revoke share link');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1020 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1049 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1149 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1191 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1219 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1378 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1535 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1577 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1606 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1630 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1877 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1909 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 1943 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 2307 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 2509 | `err.message \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 2519 | `const detail = err instanceof Error && err.message.trim().length > 0 ? err.message : null;` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 2568 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` | 2713 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioQaPanel.tsx` | 205 | `err instanceof Error ? err.message : t('documentStudio.qa.runFailed', 'Failed to run QA')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 69 | `const code = error instanceof Error ? error.message : String(error ?? '');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 486 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 525 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 543 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 559 | `setError(err instanceof Error ? err.message : 'Failed to validate template');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 573 | `setError(err instanceof Error ? err.message : 'Failed to load version history');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 587 | `setError(err instanceof Error ? err.message : 'Failed to create a new version');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 602 | `setError(err instanceof Error ? err.message : 'Failed to restore template snapshot');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 620 | `setError(err instanceof Error ? err.message : 'Failed to delete draft');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` | 635 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioView.tsx` | 253 | `reason: err.message,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/DocumentStudioView.tsx` | 377 | `? err.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/DocumentStudio/DocumentStudioView.tsx` | 629 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/inline-ai/useDocumentInlineAI.ts` | 84 | `const msg = err instanceof Error ? err.message : 'Nie udało się wywołać propozycji AI.';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/DocumentStudio/inline-ai/useDocumentInlineAI.ts` | 98 | `const msg = err instanceof Error ? err.message : 'Nie udało się zatwierdzić propozycji.';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/BenefitsTrackingDashboard.tsx` | 192 | `toast.error(error.message \|\| 'Failed to save measurement');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/EvidencePanel.tsx` | 139 | `toast.error(err.message \|\| 'Failed to add evidence');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/ExcelImportWizard.tsx` | 115 | `setError(err.message \|\| 'Error occurred during import');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/InitiativeBusinessCaseCard.tsx` | 95 | `const message = err instanceof Error ? err.message : String(err);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/InitiativeFinancialIntegration.tsx` | 162 | `toast.error(error.message \|\| 'Failed to create analysis');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/PDFExportModal.tsx` | 89 | `toast.error(error.message \|\| t('economics.pdfExport.generateFailed'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/VersionHistoryPanel.tsx` | 98 | `toast.error(err.message \|\| 'Failed to create version');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/VersionHistoryPanel.tsx` | 119 | `toast.error(err.message \|\| 'Failed to restore version');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/VersionHistoryPanel.tsx` | 148 | `toast.error(err.message \|\| 'Failed to compare version');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Economics/financeErrorMap.ts` | 25 | `if (error instanceof Error && error.message) {` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Economics/financeErrorMap.ts` | 26 | `return error.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Economics/panels/BankingValuePanel.tsx` | 142 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/BankingValuePanel.tsx` | 161 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/BankingValuePanel.tsx` | 213 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/CashForecastPanel.tsx` | 278 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/DriverTreePanel.tsx` | 162 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/EfficientFrontierPanel.tsx` | 118 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ExtendedRatiosPanel.tsx` | 136 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ExtendedRatiosPanel.tsx` | 155 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ExtendedRatiosPanel.tsx` | 178 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/HeadcountPlannerPanel.tsx` | 148 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/RollingForecastPanel.tsx` | 120 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ScenarioComputePanel.tsx` | 100 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ValueAttributionPanel.tsx` | 140 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ValueCapturePipelinePanel.tsx` | 96 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ValueCapturePipelinePanel.tsx` | 140 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ValueCapturePipelinePanel.tsx` | 160 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ValueLedgerPanel.tsx` | 76 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ValueLedgerPanel.tsx` | 99 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/ValueLedgerPanel.tsx` | 124 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Economics/panels/VarianceNarrationPanel.tsx` | 184 | `? String(err.message)` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ErrorBoundary.tsx` | 38 | `label: \`ErrorBoundary: ${error.message}\`.slice(0, 120),` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/ErrorBoundary.tsx` | 43 | `message: error.message,` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/ErrorBoundary.tsx` | 58 | `message: error.message,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Execution/ManagerModuleView.tsx` | 264 | `error instanceof Error && error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Execution/ManagerModuleView.tsx` | 265 | `? error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Execution/reports-intelligence/ControlLoopReport.tsx` | 90 | `message: error instanceof Error ? error.message : String(error),` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Execution/reports-intelligence/ResourcesCapacityReport.tsx` | 113 | `message: error instanceof Error ? error.message : String(error),` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Execution/reports-intelligence/UnifiedExecutionReportGenerator.tsx` | 69 | `setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx` | 206 | `message: error instanceof Error ? error.message : String(error),` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Feedback/FeedbackSidePanel.tsx` | 242 | `if (prefill.error.message) parts.push(\`Error: ${prefill.error.message}\`);` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Finance/Analysis/analysisKpiCatalog.ts` | 201 | `messagePl: \`Formuła ma niepoprawną składnię: ${err instanceof Error ? err.message : String(err)}\`,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/Prediction/ScenarioResultsView.tsx` | 92 | `covenantError = err instanceof MathUndefinedError ? err.message : 'Błąd obliczenia covenant headroom.';` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Finance/Valuation/ValuationWorkspace.tsx` | 271 | `// ID_BRIDGE (Gate E) fix: honest-UI PL message (CANON §4.1) — było \`err.message\` surowe.` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/Valuation/__tests__/ValuationWorkspace.test.tsx` | 262 | `// \`err.message\` (e.g. a bare fetch/network error string) — CLAUDE.md task brief: "Baseline i` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Finance/Valuation/steps/AdvisorStep.tsx` | 65 | `// ID_BRIDGE (Gate E) fix: honest-UI PL message (CANON §4.1) — było \`err.message\` surowe.` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/Valuation/steps/AssumptionsStep.tsx` | 97 | `// ID_BRIDGE (Gate E) fix: honest-UI PL message (CANON §4.1) — było \`err.message\` surowe.` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/Valuation/steps/MethodsWeightsStep.tsx` | 81 | `// ID_BRIDGE (Gate E) fix: honest-UI PL message (CANON §4.1) — było \`err.message\` surowe.` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/Valuation/steps/SensitivityStep.tsx` | 62 | `// ID_BRIDGE (Gate E) fix: honest-UI PL message (CANON §4.1) — było \`err.message\` surowe.` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/shared/FinanceErrorBoundary.tsx` | 67 | `// backendu jako jedynego komunikatu — tylko \`error.message\`, skrócone,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/shared/FinanceErrorBoundary.tsx` | 69 | `errorMessage: error?.message ? String(error.message).slice(0, 200) : null,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 306 | `if (!cancelled) setLinesState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' });` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 323 | `if (!cancelled) setLineageState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' });` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 342 | `if (!cancelled) setRunsState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' });` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 376 | `setDraftError(err instanceof Error ? err.message : 'Nieznany błąd');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 396 | `setPublishError(err instanceof Error ? err.message : 'Nieznany błąd');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 443 | `.catch((err: unknown) => setLinesState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' }));` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 449 | `.catch((err: unknown) => setLineageState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' }));` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | 455 | `.catch((err: unknown) => setRunsState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' }));` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Import/UnifiedImportWizard.tsx` | 1083 | `error: error.message,` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/components/Import/UnifiedImportWizard.tsx` | 1122 | `error: error.message,` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | 9786 | `\`${isPolish ? section.label.pl : section.label.en}: ${error instanceof Error ? error.message : String(error)}\`` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Initiatives/InitiativeFullView.tsx` | 531 | `// \`err.response.data.error\` is an axios shape this client never` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Initiatives/InitiativesHub.tsx` | 1134 | `// reason). \`error.response.data.error\` is an axios shape this client` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Initiatives/initiativeLoadError.ts` | 5 | `return /failed to fetch\|networkerror\|network request failed\|load failed/i.test(error.message);` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Interview/AssignInterviewModal.tsx` | 541 | `const errData = error?.data?.error \|\| error.response.data.error;` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Interview/AssignInterviewModal.tsx` | 545 | `typeof error.message === 'string' ? error.message : JSON.stringify(error.message);` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Interview/InsightViewer.tsx` | 3442 | `const errMsg = err instanceof Error ? err.message : String(err);` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Interview/InsightViewer.tsx` | 3514 | `const errMsg = err instanceof Error ? err.message : '';` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Interview/interviewErrorCopy.ts` | 19 | `typeof error?.response?.data?.error === 'string' ? error.response.data.error : null,` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Interview/interviewErrorCopy.ts` | 20 | `typeof error?.message === 'string' ? error.message : null,` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/Knowledge/MediaUploader.tsx` | 174 | `if (data.errors?.length > 0) {` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Knowledge/MediaUploader.tsx` | 175 | `data.errors.forEach((e: { filename: string; error: string }) => {` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Knowledge/MediaUploader.tsx` | 183 | `throw new Error(data.error);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Knowledge/MediaUploader.tsx` | 188 | `const message = error instanceof Error ? error.message : 'Upload failed';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Knowledge/MediaUploader.tsx` | 224 | `throw new Error(data.error);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Knowledge/MediaUploader.tsx` | 227 | `const message = error instanceof Error ? error.message : 'YouTube processing failed';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Knowledge/MediaUploader.tsx` | 262 | `throw new Error(data.error);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Knowledge/MediaUploader.tsx` | 265 | `const message = error instanceof Error ? error.message : 'URL processing failed';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/MyWork/Calendar/useCalendarData.ts` | 91 | `setError(err instanceof Error ? err.message : 'Failed to load calendar events');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/ConvertToDialog.tsx` | 91 | `const msg = err instanceof Error ? err.message : 'Failed to create session';` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/Decision/decisionWorkspaceApi.ts` | 51 | `* — so reaching into \`.data.error\` reaches *past* the normalization the` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/Executive/managerSnapshot.ts` | 134 | `error instanceof Error && error.message ? error.message : 'MANAGER_SNAPSHOT_FAILED';` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/Home/useRadarData.ts` | 36 | `setError(err instanceof Error ? err.message : t('myWork.radar.loadError'));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/Home/useRadarTriageData.ts` | 54 | `setError(err instanceof Error ? err.message : t('myWork.radar.loadError'));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/MyIdeasListContent.tsx` | 597 | `? error.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/canvas/workspaceGraphRuntime.ts` | 267 | `setLoadError(err?.message ? String(err.message) : 'idea-map-load-failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/notebook/NotebookHamburgerMenu.tsx` | 359 | `error instanceof Error ? error.message : 'The action failed. Your note was not changed.'` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/processflow/useProcessFlowAIProposal.ts` | 343 | `const message = err instanceof Error && err.message ? err.message : null;` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/processflow/useProcessFlowAIProposal.ts` | 406 | `const message = err instanceof Error && err.message ? err.message : null;` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/processflow/useProcessFlowValidation.ts` | 45 | `onError?.(err instanceof Error ? err.message : 'Validation failed');` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/IdeaDecisionLogPanel.tsx` | 149 | `err instanceof Error ? err.message : String(err)` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/IdeaDecisionLogPanel.tsx` | 151 | `: \`Could not read financial freshness: ${err instanceof Error ? err.message : String(err)}\`,` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/IdeaDecisionLogPanel.tsx` | 231 | `setError(err instanceof Error ? err.message : String(err));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/IdeaDecisionLogPanel.tsx` | 250 | `setError(err instanceof Error ? err.message : String(err));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/PublicFormView.tsx` | 163 | `setError(err.message \|\| t('ideas.table.publicForm.submissionFailed', 'Submission failed'));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/financial/useFinancialCase.ts` | 149 | `setErrorMessage(err instanceof Error ? err.message : String(err));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/financial/useIdeaFinancialCasePersistence.ts` | 151 | `setErrorMessage(err instanceof Error ? err.message : String(err));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/financial/useIdeaFinancialCasePersistence.ts` | 240 | `setErrorMessage(err instanceof Error ? err.message : String(err));` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useAttachments.ts` | 47 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useAuditTrail.ts` | 81 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useSchemaProposal.ts` | 102 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useSchemaProposal.ts` | 133 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useSchemaProposal.ts` | 161 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useSchemaProposal.ts` | 187 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useSchemaProposal.ts` | 213 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useSchemaProposal.ts` | 233 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useTablePlatformBridge.ts` | 344 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/table/useTablePlatformBridge.ts` | 398 | `? err.message` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/MyWork/useIdeaConfidentialityGate.ts` | 168 | `const message = err instanceof Error ? err.message : undefined;` | CUDZY TEREN | kolizja z dyżurem 314/315 |
| `src/components/PMO/GateStatus.tsx` | 76 | `setError(err.message);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/PMOHealthSection.tsx` | 76 | `setError(err.message);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/ProjectTeamPanel.tsx` | 173 | `setError(err.message \|\| 'Failed to load team members');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/ProjectTeamPanel.tsx` | 189 | `alert(err.message \|\| 'Failed to remove member');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/ProjectTeamPanel.tsx` | 201 | `alert(err.message \|\| 'Failed to update role');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/ProjectTeamPanel.tsx` | 211 | `alert(err.message \|\| 'Failed to update invoked flag');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/ProjectTeamPanel.tsx` | 822 | `setError(err.response?.data?.error \|\| err.message \|\| 'Failed to add member');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/RACIMatrix.tsx` | 78 | `setError(err.message \|\| 'Failed to load RACI matrix');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/WorkstreamBoard.tsx` | 91 | `setError(err.message \|\| 'Failed to load workstreams');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/WorkstreamBoard.tsx` | 109 | `alert(err.message \|\| 'Failed to delete workstream');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/WorkstreamBoard.tsx` | 119 | `alert(err.message \|\| 'Failed to update status');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PMO/WorkstreamBoard.tsx` | 547 | `setError(err.response?.data?.error \|\| err.message \|\| 'Failed to save workstream');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 335 | `const message = err instanceof Error ? err.message : 'Unknown error loading admin surface.';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 358 | `? \`Could not parse overrides JSON: ${err.message}\`` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 398 | `const message = err instanceof Error ? err.message : 'Unknown error proposing override.';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 452 | `: err.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 454 | `? err.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 491 | `const message = err instanceof Error ? err.message : 'Unknown error proposing reset.';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 521 | `: err.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx` | 523 | `? err.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/PresentationStudio/PresentationStudioPage.tsx` | 357 | `error: error instanceof Error ? error.message : 'Unknown error loading source artifacts.',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/PresentationStudio/PresentationStudioPage.tsx` | 398 | `error: error instanceof Error ? error.message : 'Unknown error running Studio preview.',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/PresentationStudio/PresentationStudioPage.tsx` | 426 | `: error.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/PresentationStudio/PresentationStudioPage.tsx` | 428 | `? error.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/PresentationStudio/PresentationStudioPage.tsx` | 467 | `: error.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/PresentationStudio/PresentationStudioPage.tsx` | 469 | `? error.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Presentations/DeckBuilder/DeckAuditLogModal.tsx` | 494 | `const code = err instanceof Error ? err.message : 'UNKNOWN';` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/Presentations/DeckBuilder/DeckCommentsPanel.tsx` | 116 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/DeckBuilder/DeckCommentsPanel.tsx` | 145 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/DeckBuilder/DeckCommentsPanel.tsx` | 166 | `toast.error(err instanceof Error ? err.message : failureMessage);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 351 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 400 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 538 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 560 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 579 | `setError(err instanceof Error ? err.message : 'Failed to restore version as a new draft');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 598 | `setError(err instanceof Error ? err.message : 'Failed to compare template versions');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 615 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 681 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Presentations/PresentationTemplateArchitectView.tsx` | 699 | `setError(err instanceof Error ? err.message : 'Failed to delete draft template');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Profile/MFASetup.tsx` | 179 | `err.message \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Profile/MFASetup.tsx` | 216 | `err.message \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Profile/MFASetup.tsx` | 256 | `err.message \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Profile/MFASetup.tsx` | 285 | `err.message \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 247 | `error: err.message \|\| 'Failed to fetch sources',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 295 | `error: err?.error \|\| err.message \|\| 'Failed to create report',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 328 | `error: err?.error \|\| err.message \|\| 'Failed to load report',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 367 | `error: err?.error \|\| err.message \|\| 'Failed to update section config',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 410 | `error: err?.error \|\| err.message \|\| 'Failed to add section',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 436 | `error: err?.error \|\| err.message \|\| 'Failed to remove section',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 474 | `error: err?.error \|\| err.message \|\| 'Failed to generate report',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 514 | `error: err?.error \|\| err.message \|\| 'Failed to generate section',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 547 | `error: err?.error \|\| err.message \|\| 'Failed to save content',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 572 | `error: err?.error \|\| err.message \|\| 'Failed to finalize report',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 595 | `error: err?.error \|\| err.message \|\| 'Failed to approve report',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 618 | `error: err?.error \|\| err.message \|\| 'Failed to send report back',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 641 | `error: err?.error \|\| err.message \|\| 'Failed to mark report as sent internally',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 664 | `error: err?.error \|\| err.message \|\| 'Failed to mark report as sent externally',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 689 | `error: err?.error \|\| err.message \|\| 'Failed to duplicate report',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 719 | `error: err?.error \|\| err.message \|\| 'Failed to export PDF',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 739 | `error: err?.error \|\| err.message \|\| 'Failed to fetch exports',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 776 | `error: err?.error \|\| err.message \|\| 'Failed to create share link',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 802 | `error: err?.error \|\| err.message \|\| 'Failed to fetch share links',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 824 | `error: err?.error \|\| err.message \|\| 'Failed to revoke share link',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 871 | `error: err?.error \|\| err.message \|\| 'Failed to load comments',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 902 | `error: err?.error \|\| err.message \|\| 'Failed to load comment summary',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 946 | `error: err?.error \|\| err.message \|\| 'Failed to create comment',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 989 | `error: err?.error \|\| err.message \|\| 'Failed to update comment',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 1012 | `error: err?.error \|\| err.message \|\| 'Failed to delete comment',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 1048 | `error: err?.error \|\| err.message \|\| 'Failed to resolve comment',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ReportBuilder/useReportBuilder.ts` | 1080 | `error: err?.error \|\| err.message \|\| 'Failed to bulk resolve comments',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Reports/ImportReportModal.tsx` | 155 | `throw new Error(data.error \|\| data.details \|\| 'Import failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Reports/ImportReportModal.tsx` | 171 | `setError(err.message \|\| 'Failed to import report');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Reports/Management/ManagementReportsView.tsx` | 224 | `error.message \|\| t('reports.toast.generateFailed', 'Nie udało się wygenerować raportu')` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Reports/Management/ReportGeneratorDrawer.tsx` | 170 | `error.message \|\| t('reports.toast.generateFailed', 'Nie udało się wygenerować raportu')` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/Reports/ShareModal.tsx` | 50 | `throw new Error(data.error \|\| 'Failed to create share link');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Reports/ShareModal.tsx` | 58 | `setError(err instanceof Error ? err.message : 'An error occurred');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ReportsAndPresentations/TemplateProvenanceApprovalDialog.tsx` | 69 | `setMessage(error instanceof Error ? error.message : 'Nie udało się pobrać kolejki.');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/ReportsAndPresentations/TemplateProvenanceApprovalDialog.tsx` | 105 | `setMessage(error instanceof Error ? error.message : 'Zatwierdzenie zostało odrzucone.');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ResultsVNext/attention/ResultsAttentionPage.tsx` | 149 | `.catch((err) => setKpiError(err instanceof Error ? err.message : String(err)))` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/attention/ResultsAttentionPage.tsx` | 158 | `.catch((err) => setOkrError(err instanceof Error ? err.message : String(err)))` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/attention/ResultsAttentionPage.tsx` | 164 | `.catch((err) => setTeamHealthError(err instanceof Error ? err.message : String(err)))` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx` | 281 | `setAddItemError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx` | 308 | `setRemoveItemError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx` | 342 | `toast.error(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx` | 367 | `setCreateSnapshotError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx` | 393 | `setPublishError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts` | 381 | `const err = new Error(data.error \|\| \`Request failed (${res.status})\`) as Error & {` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ResultsVNext/kpiTool/kpiDeviationApi.ts` | 250 | `/** RN-G5 polish: true when \`.message\` is \`httpErr.data.error\` — a` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ResultsVNext/kpiTool/kpiDeviationApi.ts` | 272 | `message: serverMessage \|\| (err instanceof Error ? err.message : String(err)),` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/ResultsVNext/okr/OkrReviewReflectionView.tsx` | 227 | `setRequestChangesError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/okr/OkrReviewReflectionView.tsx` | 256 | `setCarryForwardError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/okr/OkrReviewReflectionView.tsx` | 274 | `.catch((err) => setError(err instanceof Error ? err.message : String(err)))` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/okr/OkrSetToolPage.tsx` | 69 | `setLoadError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/roi/RoiCaseToolPage.tsx` | 74 | `setLoadError(err instanceof Error ? err.message : String(err));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/roi/RoiPirOutcomesTab.tsx` | 71 | `.catch((err) => setError(err instanceof Error ? err.message : String(err)))` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ResultsVNext/shared/errorMessage.ts` | 14 | `* \`err instanceof Error ? err.message : String(err)\` rendered that string` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/components/ResultsVNext/teresa/TeresaProposalPanel.tsx` | 112 | `if (err instanceof TeresaProposalApiError) return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/ResultsVNext/teresa/TeresaProposalPanel.tsx` | 113 | `if (err instanceof Error) return err.message;` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/RouteErrorBoundary.tsx` | 53 | `message: error.message,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/RouteErrorBoundary.tsx` | 134 | `title: err?.message ? \`Crash: ${String(err.message).slice(0, 100)}\` : 'Awaria strony',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/RouteErrorBoundary.tsx` | 137 | `error: err ? { message: err.message, stack: err.stack } : undefined,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/BulkActions.tsx` | 159 | `message: error instanceof Error ? error.message : 'Operation failed',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/EmailConfigurationPanel.tsx` | 145 | `toast.error(error.message \|\| 'Failed to save configuration');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/EmailConfigurationPanel.tsx` | 164 | `toast.error(error.message \|\| 'Failed to send test email');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/EmailConfigurationPanel.tsx` | 190 | `const errorMessage = error instanceof Error ? error.message : 'DNS verification failed';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/EmailTemplateEditor.tsx` | 146 | `throw new Error(data.error \|\| 'Failed to save template');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/EmailTemplateEditor.tsx` | 154 | `const errorMessage = err instanceof Error ? err.message : 'Failed to save template';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/EmailTemplateEditor.tsx` | 201 | `throw new Error(data.error \|\| 'Failed to send test email');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/EmailTemplateEditor.tsx` | 209 | `const errorMessage = err instanceof Error ? err.message : 'Failed to send test email';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/ModelTierAssignments.tsx` | 258 | `const message = err instanceof Error ? err.message : 'Failed to load tier assignments';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/ModelTierAssignments.tsx` | 323 | `const message = err instanceof Error ? err.message : 'Failed to add model to tier';` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/SuperAdmin/ModelTierAssignments.tsx` | 364 | `const message = err instanceof Error ? err.message : 'Failed to remove model from tier';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/SuperAdminAISettings.tsx` | 286 | `const message = err instanceof Error ? err.message : 'Failed to load AI settings';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/SuperAdminAISettings.tsx` | 329 | `const message = err instanceof Error ? err.message : 'Failed to save settings';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/UsageStatsPanel.tsx` | 75 | `setLoadError(error instanceof Error ? error.message : 'Failed to fetch usage data');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/billing/CreditNotesPanel.tsx` | 100 | `toast.error(error.message \|\| 'Failed to create credit note');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/billing/InvoicesPanel.tsx` | 117 | `const errorMessage = error instanceof Error ? error.message : 'Failed to send invoice';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/billing/InvoicesPanel.tsx` | 128 | `toast.error(error.message \|\| 'Failed to update invoice');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/billing/SubscriptionsPanel.tsx` | 125 | `toast.error(error.message \|\| 'Failed to create subscription');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/billing/SubscriptionsPanel.tsx` | 139 | `toast.error(error.message \|\| 'Failed to cancel subscription');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/billing/SubscriptionsPanel.tsx` | 149 | `toast.error(error.message \|\| 'Failed to change plan');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/integrations/WebhookDeliveriesModal.tsx` | 82 | `const errorMessage = error instanceof Error ? error.message : 'Failed to retry delivery';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/integrations/WebhooksPanel.tsx` | 144 | `toast.error(error.message \|\| 'Failed to save webhook');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/integrations/WebhooksPanel.tsx` | 157 | `toast.error(error.message \|\| 'Failed to delete webhook');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/integrations/WebhooksPanel.tsx` | 173 | `const errorMessage = error instanceof Error ? error.message : 'Failed to send test webhook';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/integrations/WebhooksPanel.tsx` | 192 | `toast.error(error.message \|\| 'Failed to toggle webhook');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/IPAccessRulesPanel.tsx` | 139 | `toast.error(error.message \|\| 'Failed to add IP rule');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/IPAccessRulesPanel.tsx` | 152 | `toast.error(error.message \|\| 'Failed to delete rule');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/IPAccessRulesPanel.tsx` | 172 | `toast.error(error.message \|\| 'Failed to update rule');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/LoginAttemptsPanel.tsx` | 148 | `toast.error(error.message \|\| 'Failed to unlock account');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/SecurityPoliciesPanel.tsx` | 161 | `toast.error(error.message \|\| 'Failed to save policy');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/SecurityPoliciesPanel.tsx` | 179 | `toast.error(error.message \|\| 'Failed to apply preset');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/SessionManagementPanel.tsx` | 112 | `toast.error(error.message \|\| 'Failed to terminate session');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/security/SessionManagementPanel.tsx` | 131 | `toast.error(error.message \|\| 'Failed to terminate sessions');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/system/EnterpriseAuditLog.tsx` | 237 | `setLoadError(error instanceof Error ? error.message : 'Failed to load audit logs');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/SuperAdmin/system/EnterpriseConfigurationPanel.tsx` | 330 | `error instanceof Error ? error.message : 'Failed to load configuration version history'` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/SuperAdmin/system/EnterpriseFeatureFlags.tsx` | 1062 | `setLoadError(error instanceof Error ? error.message : 'Failed to load flag history');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/TemplateBuilder/TemplateBuilder.tsx` | 468 | `error: error instanceof Error ? error.message : 'Nie udało się otworzyć szablonu',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/TemplateBuilder/templateBuilderApi.ts` | 39 | `if (data?.error) msg = String(data.error);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/Trial/TrialTransitionConfirmation.tsx` | 76 | `toast.error(error.message \|\| 'Błąd podczas przejścia');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ai/EvidencePanel.tsx` | 114 | `setError(err instanceof Error ? err.message : 'Failed to load explanation');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/ai/PlaybookStepEvidence.tsx` | 102 | `setError(err instanceof Error ? err.message : 'Failed to load evidence');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/AssessmentHub.tsx` | 2539 | `toast.error(err.message \|\| 'Failed to upload report', { id: toastId });` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/AssessmentQualityReviewPanel.tsx` | 167 | `setLoadError(err instanceof Error ? err.message : 'Nie udało się wczytać danych recenzji');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/AssessmentQualityReviewPanel.tsx` | 194 | `setEvidenceError(err instanceof Error ? err.message : 'Nie udało się dodać dowodu');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/AssessmentQualityReviewPanel.tsx` | 210 | `? err.message` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/assessment/ImportedReportDetailView.tsx` | 153 | `setError(err.message \|\| 'Failed to load import data');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/ImportedReportDetailView.tsx` | 174 | `toast.error(err.message \|\| 'Failed to create assessment', { id: toastId });` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/ImportedReportDetailView.tsx` | 192 | `toast.error(err.message \|\| 'Failed to create initiatives', { id: toastId });` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/ReportEditor.tsx` | 211 | `setError(data.error \|\| 'Nie udało się zapisać');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/ReportEditor.tsx` | 250 | `setError(data.error \|\| 'Nie udało się sfinalizować raportu');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx` | 475 | `setBootError(err instanceof Error ? err.message : 'Nie udało się utworzyć sesji.');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx` | 612 | `return { ok: false, error: err instanceof Error ? err.message : 'Zapis nieudany.' };` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/assessment/modals/TransferToRoadmapModal.tsx` | 137 | `setError(data.error \|\| 'Nie udało się przenieść do roadmapy');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/panels/VersionHistoryPanel.tsx` | 141 | `setError(data.error \|\| 'Nie udało się przywrócić wersji');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/permissions/RequestAccessModal.tsx` | 106 | `setError(err.message \|\| 'Failed to submit request');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/permissions/useAssessmentPermissions.ts` | 192 | `setError(err.message \|\| 'Failed to load permissions');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/assessment/presentation/AssessmentPresentationView.tsx` | 120 | `message: err instanceof Error ? err.message : 'Nieznany błąd pobierania Outputu.',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/assessment/report/AssessmentReportContractView.tsx` | 344 | `: error instanceof MethodCoreApiError && error.message.includes('version')` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/components/assessment/report/AssessmentReportContractView.tsx` | 380 | `const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/assessment/report/reportApi.ts` | 56 | `err instanceof Error ? err.message : 'Network request failed',` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/auth/EmailVerificationBanner.tsx` | 38 | `error.message \|\| t('auth.verificationSendFailed', 'Failed to send verification email')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/auth/MFAChallenge.tsx` | 113 | `setError(data.error \|\| t('mfa.challenge.failed', 'Verification failed'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/auth/MFAChallenge.tsx` | 122 | `setError(err.message \|\| t('mfa.challenge.error', 'An error occurred'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/auth/MFAChallenge.tsx` | 150 | `setError(data.error \|\| t('mfa.challenge.invalidBackupCode', 'Invalid backup code'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/auth/MFAChallenge.tsx` | 159 | `setError(err.message \|\| t('mfa.challenge.error', 'An error occurred'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/auth/MFASetup.tsx` | 40 | `if (!response.ok) throw new Error(data.error);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/auth/MFASetup.tsx` | 44 | `setError(err.message \|\| 'Failed to initialize MFA setup');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/auth/MFASetup.tsx` | 65 | `if (!response.ok) throw new Error(data.error);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/auth/MFASetup.tsx` | 69 | `setError(err.message \|\| 'Verification failed');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/CreditNotesPanel.tsx` | 172 | `setError(err.message \|\| 'Failed to load credit notes');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/CreditNotesPanel.tsx` | 201 | `setError(err.message \|\| 'Failed to apply credit note');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/CreditNotesPanel.tsx` | 211 | `const errorMessage = err instanceof Error ? err.message : 'Failed to refund credit note';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/billing/CreditNotesPanel.tsx` | 222 | `const errorMessage = err instanceof Error ? err.message : 'Failed to void credit note';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/billing/CreditNotesPanel.tsx` | 695 | `setError(err.message \|\| 'Failed to create credit note');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/InvoiceTemplateEditor.tsx` | 88 | `setError(err.message \|\| 'Failed to load templates');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/InvoiceTemplateEditor.tsx` | 115 | `setError(err.message \|\| 'Failed to save template');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/InvoiceTemplateEditor.tsx` | 128 | `setError(err.message \|\| 'Failed to delete template');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/InvoiceTemplateEditor.tsx` | 137 | `setError(err.message \|\| 'Failed to clone template');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/SubscriptionManager.tsx` | 171 | `error.message \|\| t('billing.subscription.changeError', 'Failed to update subscription')` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/components/billing/TaxSettingsPanel.tsx` | 131 | `setError(err.message \|\| 'Failed to load tax rates');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/TaxSettingsPanel.tsx` | 148 | `setValidation({ is_valid: false, error: err.message });` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/billing/TaxSettingsPanel.tsx` | 167 | `setError(err.message \|\| 'Failed to calculate tax');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/TaxSettingsPanel.tsx` | 179 | `setError(err.message \|\| 'Failed to delete tax rate');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/billing/TaxSettingsPanel.tsx` | 194 | `setError(err.message \|\| 'Failed to save tax rate');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/demo/DemoSignupModal.tsx` | 59 | `throw new Error(data.error \|\| 'Registration failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/demo/DemoSignupModal.tsx` | 70 | `setError(err.message \|\| 'Something went wrong');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/governance/AuditLogViewer.tsx` | 89 | `setError(err instanceof Error ? err.message : 'Unknown error');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/governance/AuditLogViewer.tsx` | 130 | `setError(err instanceof Error ? err.message : 'Export failed');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/governance/PermissionManager.tsx` | 72 | `setError(err instanceof Error ? err.message : 'Failed to load permissions');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/governance/PermissionManager.tsx` | 89 | `setError(err instanceof Error ? err.message : 'Failed to load user permissions');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/governance/PermissionManager.tsx` | 174 | `setError(err instanceof Error ? err.message : 'Failed to save changes');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/legal/LegalAcceptanceModal.tsx` | 181 | `setError(err.message \|\| 'Failed to accept documents');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/method-workspace/useMethodWorkspaceSave.ts` | 95 | `setErrorMessage(err instanceof Error ? err.message : 'Nieznany błąd zapisu');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/AIModelSelectionSettings.tsx` | 112 | `error.message \|\| t('settings.ai.modelSelection.error', 'Failed to save model preferences')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/AIParametersSettings.tsx` | 88 | `error.message \|\| t('settings.ai.parameters.error', 'Failed to save AI parameters')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/AISecuritySettings.tsx` | 104 | `setError(err.message);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/AISecuritySettings.tsx` | 133 | `setError(err.message);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/AISecuritySettings.tsx` | 162 | `setError(err.message);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/AISecuritySettings.tsx` | 171 | `setError(err.message);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/AdvancedSettings.tsx` | 220 | `error.message \|\| t('settings.advanced.keyCreateError', 'Failed to create API key')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/ConnectedAppsSettings.tsx` | 886 | `throw new Error(data.error \|\| \`HTTP ${resp.status}\`);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/DNDModeSettings.tsx` | 92 | `error.message \|\| t('settings.notifications.dnd.error', 'Failed to update DND mode')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/DeveloperSettings.tsx` | 368 | `error instanceof Error ? error.message : 'Failed to load feature flags'` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/IntegrationSettings.tsx` | 630 | `toast.error(err.message \|\| 'Failed to connect integration');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/IntegrationSettings.tsx` | 676 | `toast.error(err.message \|\| 'Failed to disconnect integration');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/NotificationDigestSettings.tsx` | 105 | `error.message \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/OrganizationProfileForm.tsx` | 400 | `toast.error(error.message \|\| 'Failed to save profile');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/OrganizationProfileForm.tsx` | 418 | `toast.error(error.message \|\| 'Analysis failed');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/OrganizationSettings.tsx` | 157 | `toast.error(error.message \|\| 'Failed to add member');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/OrganizationSettings.tsx` | 167 | `toast.error(error.message \|\| 'Failed to activate billing');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/OrganizationSettings.tsx` | 188 | `toast.error(error.message \|\| 'Failed to create organization');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/PermissionRequestSection.tsx` | 179 | `error.message \|\| t('settings.permissions.submitError', 'Failed to submit request')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/PrivacyDataSettings.tsx` | 152 | `toast.error(error.message \|\| t('settings.privacy.exportError', 'Failed to export data'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/PrivacyDataSettings.tsx` | 179 | `error.message \|\| t('settings.privacy.deletionError', 'Failed to submit deletion request')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/ProfileBioSettings.tsx` | 104 | `toast.error(error.message \|\| t('settings.profile.bio.error', 'Failed to update bio'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/ProfileSocialSettings.tsx` | 97 | `error.message \|\| t('settings.profile.social.error', 'Failed to update social links')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/ProfileStatusSettings.tsx` | 70 | `toast.error(error.message \|\| t('settings.profile.status.error', 'Failed to update status'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/ProfileWorkHoursSettings.tsx` | 156 | `error.message \|\| t('settings.profile.workHours.error', 'Failed to update work hours')` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/RecoveryOptionsSettings.tsx` | 93 | `setLoadError(error instanceof Error ? error.message : 'Failed to load recovery options');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/SoundNotificationsSettings.tsx` | 121 | `error.message \|\|` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/settings/advanced/KeyboardShortcutsEditor.tsx` | 63 | `setLoadError(error instanceof Error ? error.message : 'Failed to load keyboard shortcuts');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/settings/modules/PersonalAnalyticsModule.tsx` | 86 | `? error.message` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/components/settings/security/WebAuthnSettings.tsx` | 157 | `setError(err.message \|\| 'Failed to register passkey');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/shared/BillingCore.tsx` | 323 | `trackFunnelEvent('checkout_failed', { planId, error: err.message });` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/components/shared/BillingCore.tsx` | 327 | `alert(err.message \|\| t('access.upgrade.checkout.failed', 'Failed to update plan'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/components/shared/BillingCore.tsx` | 346 | `alert(err.message \|\| 'Failed to cancel subscription');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useAISettings.ts` | 106 | `setError(err instanceof Error ? err.message : 'Failed to load AI settings');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useAISettings.ts` | 146 | `setError(err instanceof Error ? err.message : 'Failed to update settings');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useAISettings.ts` | 175 | `setError(err instanceof Error ? err.message : 'Failed to update settings');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useAIStream.ts` | 1495 | `if (error instanceof Error && error.message.startsWith('chat_partial_discovery_failed_')) {` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/hooks/useAssessmentAttachments.ts` | 100 | `const message = err instanceof Error ? err.message : 'Upload failed';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useAssessmentAttachments.ts` | 187 | `const message = err instanceof Error ? err.message : 'Delete failed';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useAssessmentWorkflow.ts` | 134 | `setError(err.message);` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useDemo.ts` | 128 | `setDemoError(error.message \|\| t('demo.toast.toggleError', 'Could not switch demo mode'));` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useDraftApproval.ts` | 92 | `throw new Error(response.data.error \|\| 'Failed to fetch drafts');` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useDraftApproval.ts` | 95 | `setError(err.message \|\| 'Failed to fetch drafts');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useDraftApproval.ts` | 136 | `setError(err.message \|\| 'Failed to approve draft');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useDraftApproval.ts` | 158 | `setError(err.message \|\| 'Failed to reject draft');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useDraftApproval.ts` | 199 | `setError(err.message \|\| 'Failed to create draft');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useGateAi.ts` | 44 | `setError(err instanceof Error ? err.message : 'Gate AI check failed');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useInitiativeGenerator.ts` | 100 | `setError(err instanceof Error ? err.message : 'Unknown error');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useInitiativeGenerator.ts` | 151 | `setError(err instanceof Error ? err.message : 'Unknown error');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useInitiativeGenerator.ts` | 224 | `setError(err instanceof Error ? err.message : 'Unknown error');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useInitiativeGenerator.ts` | 254 | `setError(err instanceof Error ? err.message : 'Unknown error');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useInitiativeGenerator.ts` | 296 | `setError(err instanceof Error ? err.message : 'Unknown error');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useInitiativeGenerator.ts` | 325 | `errors: [err instanceof Error ? err.message : 'Validation error'],` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/hooks/useOrgMemory.ts` | 63 | `const msg = typeof err?.message === 'string' ? err.message : String(err);` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/hooks/useProactiveNudges.tsx` | 64 | `console.debug('[Nudges] Fetch failed:', err.message);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/hooks/useProactiveNudges.tsx` | 75 | `console.debug('[Nudges] Dismiss failed:', err.message);` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/hooks/useProactiveNudges.tsx` | 84 | `console.debug('[Nudges] Act failed:', err.message);` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/hooks/useProactiveNudges.tsx` | 107 | `console.debug('[Nudges] Track failed:', err.message);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/hooks/useReportSections.ts` | 167 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 218 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 275 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 314 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 367 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 434 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 472 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 507 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 537 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 573 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useReportSections.ts` | 606 | `const message = err instanceof Error ? err.message : 'Unknown error';` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useSettingsForm.ts` | 171 | `err instanceof Error ? err.message : t('settings.saveFailed', 'Failed to save settings');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/hooks/useSpeechToText.ts` | 293 | `error: error.message,` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useTextToSpeech.ts` | 274 | `error: error.message,` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useTextToSpeech.ts` | 276 | `onError?.(error.message);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/hooks/useTokenBalance.ts` | 24 | `setError(err instanceof Error ? err.message : 'Failed to load balance');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useToolSessionSync.ts` | 241 | `setError(err instanceof Error ? err.message : 'Save conflict — server state has moved on');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useToolSessionSync.ts` | 245 | `setError(err instanceof Error ? err.message : 'Save failed');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useToolSessionSync.ts` | 337 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/hooks/useUniversalVoice.ts` | 501 | `error: error.message,` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/hooks/useUniversalVoice.ts` | 513 | `: typeof error?.message === 'string' && error.message.length > 0` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/hooks/useUniversalVoice.ts` | 794 | `error: error.message,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/hooks/useUserIntegrations.ts` | 119 | `setError(err instanceof Error ? err.message : 'Failed to load integrations');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useUserIntegrations.ts` | 154 | `setError(err instanceof Error ? err.message : 'Failed to connect');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useUserIntegrations.ts` | 183 | `setError(err instanceof Error ? err.message : 'Failed to disconnect');` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/hooks/useUserIntegrations.ts` | 211 | `error: err instanceof Error ? err.message : 'Test failed',` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/ai/errorMessages.ts` | 28 | `const message = typeof error === 'string' ? error : error.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 1065 | `(data.code === 'DEMO_BLOCKED' \|\| data.errorCode === 'DEMO_ACTION_BLOCKED')` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 1070 | `message: data.message \|\| data.error,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 1085 | `reason: data.error,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 1926 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to upload avatar');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 2874 | `if (data.error) {` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 2876 | `console.error('Stream error from server:', data.error, data.code);` | TYLKO LOG | trafienie w kontekście logowania lub telemetrii |
| `src/services/api.ts` | 2969 | `String(data.error \|\| '').slice(0, 240)` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 2996 | `reason: data.error,` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 3006 | `message: data.error,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3283 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to create super admin');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3303 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to invite user');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3313 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to generate reset link');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3322 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch tables');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3331 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch rows');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3347 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch files');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3377 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to reset password');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3386 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to revert impersonation');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 3417 | `(data && (data.error \|\| data.message)) \|\| \`Failed to impersonate user (HTTP ${res.status})\`;` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 4648 | `if (!res.ok) throw new Error(data.error \|\| 'Indexing failed');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 6276 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to add comment');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 6314 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to create team');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8393 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to suggest tasks');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 8409 | `if (!res.ok) throw new Error(data.error \|\| 'Diagnosis failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8421 | `if (!res.ok) throw new Error(data.error \|\| 'Recommendation failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8433 | `if (!res.ok) throw new Error(data.error \|\| 'Roadmap generation failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8445 | `if (!res.ok) throw new Error(data.error \|\| 'Simulation failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8457 | `if (!res.ok) throw new Error(data.error \|\| 'Validation failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8468 | `if (!res.ok) throw new Error(data.error \|\| 'Verification failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8662 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch AI stats');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8671 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch benchmarks');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8683 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to extract insights');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8692 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch candidates');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8726 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch strategies');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8757 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to toggle strategy');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8782 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch vault safes');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8862 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch docs');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8898 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to upload document');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 8981 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to upload document');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9608 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch usage pricing tiers');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9628 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to create usage pricing tier');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9639 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to update usage pricing tier');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9649 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to delete usage pricing tier');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9657 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get balance');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 9668 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get packages');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9680 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get transactions');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9687 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get API keys');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9703 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to add API key');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9713 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to delete API key');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9724 | `if (!res.ok) throw new Error(data.error \|\| 'Purchase failed');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9732 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get margins');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9743 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to update margin');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9754 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to save package');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 9764 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get analytics');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 12309 | `return { success: false, error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 13174 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch approved ideas');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 13180 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch strategies');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 14794 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to save Google SSO config');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api.ts` | 15485 | `const err: any = new Error(data.error \|\| 'Failed to toggle demo mode');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 16157 | `return { success: false, actions: [], summary: null, error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 16178 | `return { success: false, runs: [], error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 16188 | `return { success: false, audit: null, error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 16207 | `return { success: false, sessions: [], error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 16230 | `return { success: false, session: null, error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 16240 | `return { success: false, session: null, error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 16940 | `return { success: false, error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 16964 | `return { success: false, error: err.message };` | TYLKO LOG | wartość przekazana do wieloliniowego logowania |
| `src/services/api.ts` | 17290 | `return { success: false, error: err.message };` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api.ts` | 17563 | `throw new Error(data.error \|\| 'Failed to remove avatar');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/__tests__/presentationStudioLayoutCapacityAdmin.api.test.ts` | 203 | `expect(err.message).toBe('Permission denied');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 301 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to create super admin');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 312 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to invite user');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 322 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to generate reset link');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 333 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to impersonate user');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/admin.api.ts` | 344 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch tables');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 353 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch rows');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/admin.api.ts` | 364 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch storage stats');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 373 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch files');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 458 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to fetch feature updates');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 472 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to create feature update');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 483 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to update feature update');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 493 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to publish feature update');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/admin.api.ts` | 504 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to archive feature update');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/baseClient.ts` | n/d | `git grep: Binary file matches` | NA EKRAN | klient bazowy propaguje błąd; plik zawiera bajt NUL i wymaga osobnego audytu |
| `src/services/api/billing.api.ts` | 299 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get balance');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/billing.api.ts` | 306 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get packages');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/billing.api.ts` | 318 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to get transactions');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/billing.api.ts` | 329 | `if (!res.ok) throw new Error(data.error \|\| 'Purchase failed');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/financeV2.types.ts` | 1811 | `if (err instanceof Error && err.message === 'Request timed out') {` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/financeV2.types.ts` | 1874 | `detail: err.message \|\| 'Sprawdź dane i spróbuj ponownie.',` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/financeV2.types.ts` | 1886 | `detail: err.message,` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/financeV2.types.ts` | 1893 | `err.message && err.message.length < 160` | NA EKRAN | bezpośrednie ujście stanu lub komunikatu UI |
| `src/services/api/financeV2.types.ts` | 1894 | `? err.message` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/tasks.api.ts` | 176 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to add comment');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/teams.api.ts` | 74 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to create team');` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/api/users.api.ts` | 66 | `throw new Error(data.error \|\| 'Failed to update user status');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/api/users.api.ts` | 86 | `if (!res.ok) throw new Error(data.error \|\| 'Failed to upload avatar');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/apiUtils.ts` | 86 | `(data.code === 'DEMO_BLOCKED' \|\| data.errorCode === 'DEMO_ACTION_BLOCKED')` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/apiUtils.ts` | 91 | `message: data.message \|\| data.error,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/apiUtils.ts` | 104 | `reason: data.error,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/apiUtils.ts` | 107 | `throw new Error(data.error \|\| 'AI Budget Exhausted');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/apiUtils.ts` | 113 | `dispatchAccessBlocked(data, data.error \|\| data.message \|\| defaultError);` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/apiUtils.ts` | 114 | `throw new Error(data.error \|\| data.message \|\| defaultError);` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/apiUtils.ts` | 118 | `const err = new Error(data.error \|\| data.message \|\| defaultError) as Error & {` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/apiUtils.ts` | 134 | `throw new Error(data.error \|\| data.message \|\| defaultError);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/chatActionHandler.ts` | 319 | `const msg = err instanceof Error ? err.message : String(err);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/chatNavigator.ts` | 242 | `const error = err instanceof Error ? err.message : String(err);` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/conversionService.ts` | 70 | `const error = err instanceof Error ? err.message : 'Conversion failed';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/conversionService.ts` | 220 | `const error = err instanceof Error ? err.message : 'Conversion failed';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/errorLogger.ts` | 17 | `message: error.message,` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/feedbackCollector/NetworkBuffer.ts` | 91 | `error: err instanceof Error ? err.message : String(err),` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/feedbackCollector/index.ts` | 56 | `const message = (err && err.message) \|\| event.message \|\| 'Uncaught error';` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationAgentHistory.ts` | 195 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationAlertPlayground.ts` | 136 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationAuditLog.ts` | 123 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationBenchmarkTrend.ts` | 189 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationGovernance.ts` | 126 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationGovernanceAlertSubscriptions.ts` | 237 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationGovernanceWatchlist.ts` | 168 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationOperationsHealth.ts` | 305 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationOperationsHealth.ts` | 358 | `error: isRecord(err) && typeof err.message === 'string' ? err.message : 'navigation_failed',` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationOperationsHealthDrilldown.ts` | 202 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationSubscriberTokens.ts` | 140 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationTemplateGovernance.ts` | 207 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationWatchlistPresetTransfer.ts` | 281 | `const msg = err instanceof Error ? err.message : 'unknown error';` | NA EKRAN | propagacja z klienta lub hooka do ujścia UI |
| `src/services/presentationWatchlistPresets.ts` | 155 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationWatchlistSavedSearches.ts` | 204 | `if (isRecord(err) && typeof err.message === 'string') return err.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationWatchlistSavedSearches.ts` | 316 | `isRecord(err.data) && Array.isArray(err.data.errors)` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/presentationWatchlistSavedSearches.ts` | 317 | `? err.data.errors.filter((e: unknown): e is string => typeof e === 'string')` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/subscriberDashboardClient.ts` | 310 | `const reason = isRecord(err) && typeof err.message === 'string' ? err.message : 'network_error';` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/toolSessionApi.ts` | 123 | `const message = String(err.message \|\| '');` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
| `src/services/toolSessionApi.ts` | 140 | `if (error instanceof Error && error.message) return error.message;` | STEROWANIE | tekst uczestniczy w porównaniu lub rozgałęzieniu |
