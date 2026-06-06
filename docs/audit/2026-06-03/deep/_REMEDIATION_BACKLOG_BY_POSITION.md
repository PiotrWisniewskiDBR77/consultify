# Consultify — Fix Backlog by Position (master, do naprawy pozycja-po-pozycji)

**Data:** 2026-06-04 · **Bazuje na:** deep 4-dim audit + naprawy sesji nocnej (27 fixów + 4 paczki) + SuperAdmin assessment.
**Jak używać:** każdy wiersz `FIX-NNN` to JEDNA niezależnie naprawialna pozycja. Kolumny: stan, akcja, priorytet (P0=blocker / P1=wartość / P2=polish), wysiłek (S<2h / M<1d / L>1d / XL wielodniowe), ryzyko, pliki.
**Status:** ✅ done (ta/nocna sesja) · ⏳ open · ⏸️ deferred (wymaga nadzoru + testu).

---

## A. Scoreboard (stan po naprawach)

### Moduły aplikacji (19)
| # | Moduł | Ocena | Tier |
|---|---|---|---|
| 01 | Czat | 89 | Production |
| 02 | Moja Praca | 72 | Beta+ |
| 03 | Wywiad | 87 | Strong |
| 04 | Narzędzia | 72 | Beta+ |
| 05 | Inicjatywy | 78 | Strong- |
| 06 | Realizacja | 76 | Beta+ |
| 07 | Rezultaty | 79 | Strong- |
| 08 | Finanse | 78 / 68 (model/billing) | Beta+ / Beta |
| 09 | Outputs | 84 | Strong |
| 10 | Dokumenty | 78 | Strong- |
| 11 | Tabele | 82 | Strong |
| 12 | Prezentacje | 79 | Strong- |
| 13 | Meeting | 82 | Strong |
| 14 | MCP / Iris | 22 | Deferred (D7) |
| 15 | MCP Marketplace | 14 | Deferred (D7) |
| 16 | Organizacja | 84 | Strong |
| 17 | Admin | 76 | Beta+ |
| 18 | Ustawienia | 82 | Strong |
| 19 | Partner | 73 | Beta+ |

**Średnia 17 aktywnych: ~79/100.**

### SuperAdmin (7 modułów / 5 sekcji)
| Sekcja | Moduł | Ocena |
|---|---|---|
| Tenant & User Ops | CustomersModule | 92 |
| AI Operations | AIPlatformModule | 88 |
| AI Operations | VirtualWorkersModule | 90 |
| Connector Ops | SystemModule | 88 |
| Connector Ops | ConfigurationModule | 85 |
| Governance & Compliance | GovernanceModule | 85 |
| Platform Security | SecurityModule | 86 |

**Średnia SuperAdmin: ~87/100.**

---

## B. Fix backlog — pozycje (każda osobno)

### Moduł 01 — Czat
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-001 | `/task` `/decision` fetch bez AbortController/timeout (silent hang) | ✅ | AbortController + 20s timeout (commit 9a2953d949) | P1 | S | `src/components/AIChat/UnifiedChatPanel.tsx` |
| FIX-002 | `useAIStream` brak resetu stanu przy abort (spinner-freeze) | ✅ | Reset isStreaming/isBotTyping w gałęzi abort (commit 8119360f2a) | P1 | S | `src/hooks/useAIStream.ts` |
| FIX-003 | Wave5–9 panele lazy-imported | ✅ NOT-A-BUG | Realne komponenty (548/565 linii), podpięte do tras AI_OS + nawigowalne z menuConfig/AIOSHub — nie martwe | P2 | — | `src/routes/AppRoutes.tsx` |
| FIX-004 | `OrganizationMemoryPanel`/`useOrgMemory` disabled | ✅ | Usunięto martwy zakomentowany kod (commit b885db0de3). Re-surface panelu = decyzja produktowa Piotra (placement) | P2 | S | `src/components/AIChat/UnifiedChatPanel.tsx` |

### Moduł 02 — Moja Praca
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-010 | Martwy chat↔canvas bridge (`useIdeasTeresaBridge` 0 importerów) | ⏳ | Podpiąć bridge tak by czat sterował canvasem, lub usunąć | P1 | M | `src/hooks/useIdeasTeresaBridge.ts` |
| FIX-011 | `idea-tool-status` back-channel 0 emiterów | ⏳ | Emitować status z narzędzi Ideas lub usunąć | P2 | S | (grep `idea-tool-status`) |
| FIX-012 | Facilitation `Promise.all` bez guardu | ⏳ | Owinąć w `allSettled` + obsługa błędu | P2 | S | `src/components/.../IdeaWhiteboardTool.tsx:1061` |
| FIX-013 | `MyTasksList.tsx` dead (zły endpoint) | ⏳ | Usunąć lub przepiąć na poprawny endpoint | P2 | S | `src/components/MyWork/MyTasksList.tsx` |
| FIX-014 | Radar literal-map vision niezbudowany | ⏳ | Zaprojektować + zbudować widok mapy radaru | P2 | L | (Radar) |

### Moduł 03 — Wywiad
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-020 | ConversationalPanel zamontowany | ✅ | — (zrobione, A2) | — | — | `Interview/RuntimeModeSelector.tsx` |
| FIX-021 | Brak proaktywnego follow-up Teresy (no `suggest-followup`) | ⏳ | Dodać endpoint `suggest-followup` (LLM) + UI trigger | P1 | M | `server/.../InterviewController.ts` |
| FIX-022 | Bridge `.catch` połyka błędy publish | ⏳ | Logować + surfacować błąd publishu | P2 | S | `server/.../v8/interview-insights.routes.ts:246` |

### Moduł 04 — Narzędzia
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-030 | 9 martwych przycisków AI ukrytych | ✅ | — (zrobione, A4 allowlist) | — | — | `src/components/DiscoveryTools/toolAiActions.ts` |
| FIX-031 | 9 narzędzi bez apply-handlera (pełna wartość) | ⏳ | Dopisać `applyXxxPendingAction` dla 9 narzędzi + rozszerzyć allowlist | P1 | L | `src/hooks/discovery/useToolAI.ts:448-453` |
| FIX-032 | Migracja megatrends ordering-fragile (`.sql.sql`, hyphen) | ⏳ | Zmienić nazwę pliku na pattern `_` + zależność v2 baseline | P2 | S | `server/migrations/20251212-create-megatrends.sql.sql` |

### Moduł 05 — Inicjatywy
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-040 | Generator LLM (zamiast JSON.stringify) | ✅ | — (zrobione, A5) | — | — | `server/.../initiative-generator.routes.ts` |
| FIX-041 | Wizard `generateCandidates` wciąż heurystyka | ⏳ | Wpiąć LLM w generację kandydatów | P1 | M | `server/.../initiativeWizardService.ts:258-713` |
| FIX-042 | 3 dead endpointy (`/ai/generate-initiatives`, `/ai/prioritize-initiatives`, `/api/initiatives/generate-from-assessments`) | ⏳ | Zaimplementować lub usunąć wywołania | P1 | M | `src/hooks/useAssessmentAI.ts:399,411`, `GapAnalysisDashboard.tsx:59` |
| FIX-043 | Brak `/initiatives/:id` deep-route | ⏳ | Dodać route detalu (obecnie tylko `?open=`) | P2 | S | `src/routes/AppRoutes.tsx` |
| FIX-044 | DELETE na `generated_initiatives` brak | ⏳ | Dodać DELETE endpoint | P2 | S | `server/.../initiative-generator.routes.ts` |

### Moduł 06 — Realizacja
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-050 | SQLite `NOW()` w 5 rollout UPDATE (crash) | ✅ | — (zrobione, B10a) | — | — | `server/.../rollout.routes.ts` |
| FIX-051 | Dead `managerMetrics`/`interventionSuggestions` | ✅ | — (zrobione, PKG2 cleanup) | — | — | `src/components/Execution/ExecutionHub.tsx` |
| FIX-052 | Execution→Results CTA | ✅ | — (zrobione, A9) | — | — | `ExecutionHub.tsx` |
| FIX-053 | Report PDF tylko `window.print` (brak server PDF/audit) | ⏳ | Server-generated PDF endpoint + audit trail | P2 | M | `src/.../executionReports.ts:358` |
| FIX-054 | 06→07 handoff struct (`sourceRefs`/`evidenceRefs`) brak | ⏳ | Przekazać envelope przy zakończeniu execution | P2 | M | (RAW_TARGET_STATE_2_0_PACKET) |
| FIX-055 | Rollout tables brak w SQLite cold-start bootstrap | ⏳ | Dodać CREATE do initDb path | P1 | S | `server/migrations/20260608_rollout_tables.sql` |

### Moduł 07 — Rezultaty
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-060 | Teresa canon `results/kpi/roi` dodane | ✅ | — (zrobione, A10) | — | — | `teresaCopilotCanon.ts` |
| FIX-061 | Results→Outputs CTA | ✅ | — (zrobione, D3) | — | — | `ResultsHub.tsx` |
| FIX-062 | `LATERAL JOIN` na SQLite (crash benefits) | ✅ | — (zrobione, B10b) | — | — | `server/.../benefits.routes.ts` |
| FIX-063 | ROI „AI insights" = threshold count, nie LLM (label fraud) | ⏳ | Zamienić `belowPlanCount>=3` na realny LLM call | P1 | M | `src/components/Results/ROIAnalysisView.tsx:376-381,531` |
| FIX-064 | ROIAssumptionEditor `disabled` nie dochodzi z lock-path | ⏳ | Przekazać `disabled` do edytora przy locku | P1 | S | `src/.../ROIDetailDrawer.tsx:377-381` |
| FIX-065 | Legacy POST `/kpi-reports` omija finalization guard | ⏳ | Dodać `findKpiReportFinalizationViolation` do legacy route | P1 | S | `server/.../results-kpi-reports.routes.ts:309,358` |
| FIX-066 | Snapshot guard org-scoped nie KPI-scoped (over-blocks) | ⏳ | Zawęzić guard do KPI-set | P2 | S | `server/.../results.routes.ts:200` |

### Moduł 08 — Finanse
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-070 | teresaPrompt konsumowany (composer prefill) | ✅ | — (zrobione, A11) | — | — | `FinanceHub.tsx`, `useOpenChatWithContext.ts` |
| FIX-071 | ORG_FINANCIAL_SUMMARY odsłonięty (governance) | ✅ | — (zrobione, A11) | — | — | `contextGovernance.ts` |
| FIX-072 | Stripe mocki guard-owane prod | ✅ | — (zrobione, B8) | — | — | `BillingCommandService.ts` |
| FIX-073 | Billing bez realnego flow gdy brak Stripe (3 mock paths) | ⏳ | Zaprojektować manual-invoice fallback flow | P1 | L | `BillingCommandService.ts:440,1209,1408` |
| FIX-074 | Business-case „AI" = template stub (no LLM) | ⏳ | Wpiąć LLM w business-case generację | P2 | M | `server/.../economics.routes.ts:1165-1216` |
| FIX-075 | Finance export gubi `relatedInitiativeIds` | ⏳ | Dodać pole initiative do FinanceRow + przekazać do ExportToOutputDialog | P2 | M | `FinanceHub.tsx:2362`, `financeTypes.ts` |

### Moduł 09 — Outputs
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-080 | Document Studio rejestracja w Outputs (G5) | ✅ | — (zrobione, PKG4) | — | — | `document-studio.routes.ts` |
| FIX-081 | „Generate with Teresa" prefill | ✅ | — (zrobione, A11) | — | — | `OutputsAggregateTabContent.tsx` |
| FIX-082 | 3 z 7 tabów omija aggregate view | ⏳ | Skonsolidować format-lane taby do aggregate | P2 | M | `ReportsAndPresentationsHub.tsx:161,166` |
| FIX-083 | `notifyContextOfNewArtifact` log-only (push) | ⏳ | (opcjonalne — pull już działa) realny push do context | P2 | M | `artifactRegistryService.ts:1197` |

### Moduł 10 — Dokumenty
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-090 | `useLlm` default ON | ✅ | — (zrobione, A3a) | — | — | `DocumentStudioView.tsx:41` |
| FIX-091 | Document→Outputs edge | ✅ | — (zrobione, PKG4) | — | — | `document-studio.routes.ts` |
| FIX-092 | Free-form Teresa NL router słaby (intent był test-only) | ⏳ | Podpiąć `documentTeresaIntent` w produkcie głębiej | P2 | M | `src/.../documentTeresaIntent.ts` |

### Moduł 11 — Tabele
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-100 | 8 flag OFF → ON (apply chain żywy) | ✅ | — (zrobione, A7) | — | — | `FeatureFlags.ts`, `tabeleAiEditorFlag.ts` |
| FIX-101 | `requireTablePlatform` brak `.catch()` (wiszący request) | ✅ | — (zrobione, PKG3) | — | — | `table-platform.routes.ts:82` |
| FIX-102 | Brak testów E2E apply-chain | ⏳ | Dodać E2E dla 8-level MutationExecutor | P2 | M | `tests/e2e/` |

### Moduł 12 — Prezentacje
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-110 | `applyPresentationEditPlan` = regex, nie LLM | ⏸️ | Zamienić heurystykę na `modelRouter` structured edit-plan | P0 | L | `server/.../presentationAgentEditService.ts:46,308` |
| FIX-111 | Narrative LLM tylko 4 z 15 intentów | ⏳ | Rozszerzyć LLM na pozostałe 11 intentów | P1 | L | `server/.../presentationGeneratorService.ts:1245` |
| FIX-112 | Brak LLM outline endpoint | ⏳ | Dodać LLM outline generation | P2 | M | `server/.../presentations.routes.ts` |

### Moduł 13 — Meeting
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-120 | llmClient null → lazy OpenAI | ✅ | — (zrobione, A1) | — | — | `meetingIntelligenceService.ts` |
| FIX-121 | generate-notes route + UI | ✅ | — (zrobione, PKG1) | — | — | `meeting.routes.ts`, `MeetingHub.tsx` |
| FIX-122 | Live transcript (Fireflies/Whisper unwired) | ⏳ | Wpiąć źródło transkrypcji (Whisper `VoiceService` istnieje) | P1 | L | `server/.../VoiceService.ts:73` |
| FIX-123 | Decyzje siloed w `decisions_json`, nie shared `decisions` table | ⏳ | Cross-post meeting decisions do shared decisions table | P2 | M | `meetingService.ts:357` |
| FIX-124 | Follow-up→task brak cross-post | ⏳ | Tworzyć task w Moja Praca z follow-upu | P2 | M | `meetingService.ts:326` |
| FIX-125 | Operator brief rule-based (`prepSummary` hardcoded) | ⏳ | Wpiąć LLM w operator brief | P2 | M | `aiOperatorService.ts:691` |

### Moduł 14 / 15 — MCP / Iris / Marketplace (deferred D7)
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-130 | Tabele MCP brak w `DatabaseInitializer` (SQLite silent-fail) | ⏸️ | Dodać CREATE do DatabaseInitializer | P1 | S | `server/.../DatabaseInitializer.ts` |
| FIX-131 | `$1` (PG) vs `?` (SQLite) adapter mismatch | ⏸️ | Ujednolicić placeholdery | P1 | M | `mcp.routes.ts`, `module-interest.routes.ts` |
| FIX-132 | Marketplace Browse UI cała brakuje | ⏸️ | Zbudować MarketplaceView (po v1, zależność DBR77) | P2 | XL | (nowy) |

### Moduł 16 — Organizacja
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-140 | InvitationSendingService SMTP | ✅ | — (zrobione, C1) | — | — | `InvitationSendingService.ts` |
| FIX-141 | KG omija governance filter | ⏳ | Wpiąć KG context w `filterContextByPolicy` | P1 | M | `AIPipeline.ts:1264` |
| FIX-142 | Dual-path context builder (legacy `@ts-nocheck`) | ⏸️ | Skonsolidować legacy z kanonikiem | P1 | L | `server/src/ai/aiContextBuilder.ts` |
| FIX-143 | Podwójny widget kontekstu (double-fetch) | ⏳ | Usunąć duplikat OrgContextSummaryBanner/Overview | P2 | S | `OrganizationView.tsx:251-256` |
| FIX-144 | `isAdmin` po nazwie sekcji, nie roli | ⏳ | Użyć roli usera | P2 | S | `OrganizationView.tsx:253` |

### Moduł 17 — Admin
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-150 | 5 sub-tabów AI zamontowanych (Access&Limits gap) | ✅ | — (zrobione, B4) | — | — | `AIModule.tsx` |
| FIX-151 | B3: UI budżetów pisze do innej tabeli niż Pipeline czyta | ⏸️ | Spiąć Admin UI write → `ai_budgets` (lub Pipeline czyta `organization_limits`) | P0 | M | `adminP32.routes.ts:943-961`, `ai.routes.ts` |
| FIX-152 | Backup routes 503 | ⏳ | Zaimplementować backup endpoints | P2 | M | `backup.routes.ts:52-168` |
| FIX-153 | Per-org email stub (`billing@example.com`) | ⏳ | Użyć realnego per-org email | P2 | S | `adminP32.routes.ts:1236,1243` |
| FIX-154 | 3 pozostałe Admin/AI sub-taby niezamontowane | ⏳ | Zamontować pozostałe (Health/Usage/OrgProvider jeśli sensowne) | P2 | S | `AIModule.tsx` |

### Moduł 18 — Ustawienia
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-160 | GDPR delete za bramką hasła | ✅ | — (zrobione, B1) | — | — | `api.ts` |
| FIX-161 | AI settings sterują Teresą | ✅ | — (zrobione, A8) | — | — | `AIPipeline.ts`, `ai.routes.ts` |
| FIX-162 | Calendar 501 → „coming soon" | ✅ | — (zrobione, C4) | — | — | `CalendarSyncSettings.tsx` |
| FIX-163 | BYOK keys plaintext w DB | ⏸️ | Scentralizować decrypt-on-load (klucze czytane w 10+ pkt modelRouter) + szyfrować zapis | P1 | L | `settings.routes.ts:614`, `modelRouter.ts` (298,541,663,702,730,741,844,880,899) |
| FIX-164 | Audit brak dla profile/webhooks/working-hours | ⏳ | Dodać adminAuditService.logAction | P2 | S | `settings.routes.ts` |
| FIX-165 | „Usage by Tier" chart hardcoded | ⏳ | Podpiąć realne dane | P2 | S | `AISettings.tsx:737-754` |

### Moduł 19 — Partner
| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-170 | Dead buttons (CSV/QR/Preview) | ✅ | — (zrobione, C3) | — | — | `EarningsSection.tsx`, `ReferralToolsSection.tsx` |
| FIX-171 | `@ts-nocheck` na live `partners.routes.ts` (2898 linii) | ⏸️ | Zdjąć `@ts-nocheck`, naprawić typy payout/auth | P0 | XL | `server/.../partners.routes.ts:1` |
| FIX-172 | 9 stub-503 endpointów (clients/employees/stats/licenses/invoices) | ⏳ | Zaimplementować lub ukryć ich UI triggery | P1 | L | `partners.routes.ts:1284-1925` |
| FIX-173 | 6 orphan sub-views (lazy, never routed) | ⏳ | Podpiąć Route lub usunąć | P2 | S | `AppRoutes.tsx:261-284` |
| FIX-174 | Martwy `usePartnerEcosystem` (hardcoded mock, 0 consumers) | ⏳ | Usunąć martwy hook + 3 niewyrenderowane komponenty | P2 | M | `usePartnerEcosystem.ts:19-67` |

---

## C. SuperAdmin — pozycje

| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-200 | 3 orphan stuby (hardcoded arrays) w security.routes — NIE w SuperAdmin UI | ⏳ | Usunąć martwe `/threats`,`/dlp`,`/incidents` (legacy org-level) | P2 | S | `server/.../security.routes.ts:397,415,433` |
| FIX-201 | ~5 najmniej używanych AIPlatform analytics — niezweryfikowane end-to-end | ⏳ | Spot-verify SLA/ABTest/Performance dashboardy do realnych routes | P2 | M | `src/views/superadmin/AIPlatformModule/` |
| FIX-202 | Invoice tab 503 gdy billing tables nieskonfigurowane | ⏳ | (intencjonalne fail-closed — opcjonalnie lepszy empty-state) | P2 | S | `superadmin.routes.ts` (respondSchemaUnavailable) |

---

## D. Cross-cutting (dotyka wielu modułów)

| ID | Pozycja | Stan | Akcja | P | Wysiłek | Pliki |
|---|---|---|---|---|---|---|
| FIX-300 | Pamięć: write-back loop user/org factual | ✅ | — (zrobione, A0) | — | — | `ai.routes.ts` |
| FIX-301 | Pamięć: history rehydration server-side | ✅ | — (zrobione, A0-rest) | — | — | `AIPipeline.ts` |
| FIX-302 | `ai_user_memory` schema collision (075 vs 250) | ⏳ | Ujednolicić schemat | P1 | M | migracje 075/250 |
| FIX-303 | Governance fail-OPEN → fail-CLOSED | ✅ | — (zrobione, B7) | — | — | `aiContextBuilder.ts` |
| FIX-304 | Governance UI (backend istnieje, 0 frontendu) | ⏳ | Zbudować UI dla `ai-governance.routes.ts` | P1 | M | `ai-governance.routes.ts:82-126` |
| FIX-305 | RAG bez pgvector (brute-force JS cosine) | ⏳ | Migracja do pgvector | P2 | L | `ragService.ts:691` |
| FIX-306 | Design-system: pełny token sweep slate→navy | ⏳ | Codemod + visual review (część zrobiona) | P2 | L | (cross-cutting) |
| FIX-307 | **Google Drive sync na folderze repo** (cofa edycje, churn .git) | ⏳ | Przenieść repo poza Google Drive (`~/dev/consultify`) | P0 | S | (środowisko) |
| FIX-308 | **EPIC: Panel synchronizacji MCP / praca z innymi środowiskami i urządzeniami** (decyzja właściciela 2026-06-04) | ⏳ EPIC | Zbudować całą formułę MCP sync z zewn. środowiskami. Obejmuje: (a) cloud provider rows BROKEN — contract mismatch `cloud.routes.ts:390` brak pola `connected` + id `google_drive` vs hook `google-drive`; (b) composer „Recent" attachments = stub („cannot be reattached") → realna reattachacja; (c) „Manage cloud sources" SPA nav zamiast `window.location.assign`; (d) szerszy panel sync multi-device | P2 | XL | `cloud.routes.ts`, `useCloudIntegrations.ts`, `AddFilesMenu.tsx`, (nowy panel) |

---

## E. Sugerowana kolejność ataku (do 98/100)

1. **FIX-307** (środowisko) — przenieść repo poza Drive. Odblokowuje stabilną pracę. **Najpierw.**
2. **P0 z nadzorem** (para + testy): FIX-110 (Presentations regex→LLM), FIX-151 (Admin budget linkage), FIX-171 (Partner @ts-nocheck), FIX-163 (BYOK), FIX-142 (dual-path context).
3. **P1 wartość**: FIX-031 (9 tool apply-handlers), FIX-021 (Interview follow-up), FIX-063 (ROI real LLM), FIX-122 (Meeting transcript), FIX-141 (KG governance), FIX-304 (governance UI), FIX-302 (memory schema), FIX-172 (partner stubs).
4. **P2 polish + cleanup**: reszta (dead-code removal, audity, deep-routes, design-system sweep).
5. **Deferred po v1**: FIX-130/131/132 (MCP/Marketplace).

> Łącznie open/deferred pozycji: ~55. Zrobione tej i nocnej sesji: 31 (oznaczone ✅).
