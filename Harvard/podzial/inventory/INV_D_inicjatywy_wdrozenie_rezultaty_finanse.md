# Inwentarz funkcjonalności D — INICJATYWY + WDROŻENIE + REZULTATY + FINANSE

Część mapy modułów V2. Zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`.

**Przekrojowe:** (a) na consultify.ai widoczne tylko Chat/Interview/My Work/Inicjatywy/Wdrożenie/Settings — Rezultaty i Finanse ukryte + route-gated; (b) beta-lock egzekwowany w nawigacji, NIE na routach — bezpośredni URL omija plate poza public prod; (c) w Inicjatywach całe tworzenie z poziomu huba (New/AI Wizard/Charter) wyłączone „w przygotowaniu" — żywe ścieżki to deep-link `?new=1` i generator z insightów wywiadu.

---

## MODUŁ: INICJATYWY

**Trasy:** `/initiatives` → `InitiativesHub` (2364 l.); aliasy `/portfolio`, `/roadmap`→redirect. W core-liście public prod. **Serwer:** `pmo/initiatives.routes.ts` (2558 l.) + additive/generator/governance. **SSOT:** `docs/initiatives/INITIATIVE_FORMULA.md`.

1. **Widok Portfolio — tabela z preview** (`InitiativePreviewV3`). [DZIAŁA]
2. **Kanban** — drag&drop statusów. [DZIAŁA]
3. **Timeline** — [DZIAŁA]
4. **Grid (kafle)** — [DZIAŁA]
5. **Dokument inicjatywy** — rejestr ~30 sekcji (overview, problemDefinition, targetState, scope, tasks, decisions, RAID, gates, financial*, KPIs, competency, pilot, comments, history + control/team/RACI/timeline/resources/stakeholders/dependencies/attachments/tags/reminders). [DZIAŁA] `sections/registry.ts`
6. **Zakładka Analysis (V3-F02)** — 5 podwidoków: resources/feasibility/logic/timeline/completeness + graf zależności + auto-fix. [DZIAŁA]
7. **Charter wizard (Tryb A)** — działa, ALE przycisk w hubie **disabled „w przygotowaniu"**; realnie odpalany z Interview→InsightViewer. [WIDOCZNE-ALE-WYŁĄCZONE w hubie / DZIAŁA z insightów]
8. **AI Initiative Wizard (Tryb B)** — modal zwired, przycisk disabled, nic nie ustawia `true` → nieosiągalny z UI huba. [UKRYTE]
9. **Generator propozycji z insightów** — Proposal Board → Charter; używany w InsightViewer. [DZIAŁA]
10. **Modal „Nowa inicjatywa"** — CTA disabled; deep-link `/initiatives?new=1` otwiera. [UKRYTE — tylko deep-link]
11. **Bulk edit + eksport CSV** — [DZIAŁA]
12. **Archiwizacja + przejścia statusów** — preflight przez `initiativeWriteTruth`. [DZIAŁA]
13. **Filtry/wyszukiwanie + detekcja duplikatów** — [DZIAŁA]
14. **Integracja V8 Planning** — chip pending decision chains + snapshot, cichy fallback. [DZIAŁA z degradacją]
15. **Czat Teresy z kontekstem inicjatywy** — [DZIAŁA]
16. **ROI view `/roi`** — `FullROIView` (490 l.): realny dashboard z `/api/economics/analyses` (NPV/ROI%/payback); **już NIE „Under Construction"**; brak wejścia z sidebara. [DZIAŁA, słabo wyeksponowane]
17. **Dane demo (Atelier Toys)** — przy `shouldAllowDemoData()`. [ZA FLAGĄ demo]
18. **Blokada pilota (VTS)** — tworzenie/bulk zablokowane. [DZIAŁA]
19. **`InitiativeConflictsPanel.tsx`** — [MARTWY KOD]

## MODUŁ: WDROŻENIE (Execution)

**Trasy:** `/implementation` (+ `/execution`) → `ExecutionHub` (5048 l.); `/rollout` = redirect do `?tab=rollout` (legacy SplitLayout wycofane). **Serwer:** `/api/execution*`, `/api/rollout/*`, `/api/executive/aggregate`, v8 execution-control z fallbackiem.

1. **Portfolio — executive dashboard** — Health Score + snapshot z lokalnym fallbackiem. [DZIAŁA]
2. **Widoki: tabela / kanban / timeline** — kanban dnd-kit, inline status. [DZIAŁA]
3. **Timeline z sygnałami opóźnień i ryzyk** — [DZIAŁA]
4. **Action Queue** — przeterminowane decyzje, ryzyka P×I, przeterminowane taski. [DZIAŁA]
5. **RAID log + Decisions** — liczniki pending/overdue. [DZIAŁA]
6. **Panel boczny + pełny dokument inicjatywy** (reuse). [DZIAŁA]
7. **Zakładka Rollout** — Plan / KPI / Risks / Change / Closure na `/api/rollout/*` (dane trwałe; zastąpiło 7 in-memory komponentów). [DZIAŁA]
8. **Zakładka Raporty** — katalog z RAG, generowanie realnej treści z live-data, wizard. [DZIAŁA]
9. **Zakładka Manager (people_change)** — action-queue/decisions/blockers/workload/risk/people-change + AI recommendation panel. [DZIAŁA]
10. **Czat Teresy z kontekstem egzekucji** — [DZIAŁA]
11. **V8 execution-control z fallbackiem** — [DZIAŁA]
12. **Blokada pilota** — [DZIAŁA]
13. **Dead/legacy:** `ExecutionDetailPanel.tsx`, `views/ExecutionView.tsx`, `ImplementationView.tsx` (SplitLayout). [MARTWE]

## MODUŁ: REZULTATY (Results / Benefits Realization)

**Trasy:** `/benefits` → **`ResultsHub`** (1610 l.); `/kpi-okr` → redirect. **Beta CLOSED dla wszystkich** (sidebar lock; route bez beta-guarda). **Serwer:** `/api/results`, `/api/benefits`, v8 `/api/v8/results`.

1. **Zakładka Initiatives** — tracked initiatives z filtrami lifecycle/health. [ZA FLAGĄ beta]
2. **Zakładka KPI — 4 tryby** — overview / queue (needs entry, discrepancy) / catalog / scorecards + signal sheet, time-series drawer, create modal. [ZA FLAGĄ beta]
3. **Zakładka Reports — 5 trybów enterprise** — tracked / reports / schedules (cron + **approval gating serwerowy**) / wallboards / connectors. [ZA FLAGĄ beta]
4. **Zakładka ROI** — portfolio summary (V8→fallback `/benefits/roi/portfolio/summary`), edytor założeń. [ZA FLAGĄ beta]
5. **Zakładka ROI Analysis** — [ZA FLAGĄ beta]
6. **Showcase/demo-data** — `shouldUseResultsShowcaseData()` podstawia dane pokazowe gdy realne puste. [ZA FLAGĄ demo]
7. **Dual-runtime V8 → legacy** — z ostrzeżeniem konsolowym. [DZIAŁA z fallbackiem]
8. **`BenefitsHub.tsx`** (8 zakładek) — lazy-importowany, **nigdy nie renderowany**; jego workspace'y (Budget/FinancialAnalysis/Valuation) żyją w FinanceHub. [MARTWY KOD]

## MODUŁ: FINANSE (Economics / Financial Analysis v3)

**Trasy:** `/finance` (i `/economics`) → **`FinanceHub`** (2381 l.); deep-linki `/finance/{statements,models,analyses}/:id`. **Beta CLOSED dla wszystkich.** **Serwer:** `/api/economics`, `/api/finance-statements`, `/api/financial-modeling`, v8 `/api/v8/finance`. **SSOT:** `docs/product/FINANCIAL_ANALYSIS_V3.md`.

1. **Statements** — paczki sprawozdań, import wizard (Excel), workspace (canonical table, mapping editor, ratio panel, validation, explain). [ZA FLAGĄ beta]
2. **Modele finansowe** — lista + create + workspace. [ZA FLAGĄ beta]
3. **Analiza** — analizy finansowe + create. [ZA FLAGĄ beta]
4. **Predykcja** — forecasty modeli + budżety. [ZA FLAGĄ beta]
5. **Wycena przedsiębiorstw** — valuations + workspace. [ZA FLAGĄ beta]
6. **Analiza inwestycyjna** — investment_case. [ZA FLAGĄ beta]
7. **Runtime V8 za flagą** — `useV8FeatureFlag('finance')` + degradacja do legacy. [ZA FLAGĄ v8]
8. **Degraded banner + lane strip** — [DZIAŁA]
9. **Export do Outputs** — [ZA FLAGĄ beta]
10. **Czat Teresy** — [DZIAŁA]
11. **BILLING NIE JEST TU** — powierzchnie billingowe w superadminie (`BillingCenterView`, `RevenueModule`); token-billing endpointy = 503-stub gdy brak serwisu/kluczy Stripe. [STUB serwerowy]
12. **AddCardModal — mock `pm_..._mock` USUNIĘTY** — karta za kill-switchem `billingSelfServeFlag` (default OFF → „honest manual billing"; ON wymaga realnego Stripe SetupIntent). [ZA FLAGĄ `VITE_BILLING_SELF_SERVE`, default OFF]
13. **Dead code w Economics/:** AnalysisCatalog, BusinessCaseGenerator, DigitizationToolTab, AIRecommendationsPanel, BenefitsTrackingDashboard, AnalysisCompareView itd. [MARTWE]
