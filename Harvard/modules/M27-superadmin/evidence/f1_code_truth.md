# M27 SuperAdmin — FAZA 1: Prawda kodu (control plane)

Branch: feat/deliverables-light. FE `src/views/superadmin/*`, BE `server/src/routes/superadmin.routes.ts` + dedykowane routery (`featureFlags`, `module-access`, `feedback`, `billing`, `ai`).

Werdykt nadrzędny: **moduł w przeważającej części REALNY** — to nie jest fasada. ~60+ zakładek delegują do solidnych komponentów-widoków (300–2000 linii) z prawdziwymi wywołaniami API i persystencją DB. Stuby są marginalne. Oba znane findingi feedbacku z 2026-06-10 **już naprawione w kodzie** (commit 36ceb52c60). Bramki serwerowe superadmin **są** (DB-verified role).

---

## Shell / routing (kontekst)

- `SuperAdminView.tsx` — dedykowany shell, lazy-load 7 modułów, switch po `currentView` (linie 104–246). Wiele AppView legacy zremapowanych na 5 zamontowanych gałęzi.
- `SuperAdminSidebar.tsx` — **tylko 5 sekcji** (`customers / ai-platform / system / content / security`, linie 80–91). Reszta „pozycji" z inwentarza to zakładki wewnątrz tych 5 sekcji albo URL-only.
- **Virtual Workers = UKRYTE (URL-only)** — POTWIERDZONE: `SUPERADMIN_VIRTUAL_WORKERS` routuje do `VirtualWorkersModule` (SuperAdminView.tsx:158–159), ale **brak wpisu w `menuItems`** sidebara. Wejście tylko przez URL/legacy redirect (mapuje na sekcję `ai-platform`, sidebar.tsx:43).
- **Configuration (poz.6) = URL/legacy** — `ConfigurationModule` (Settings/Whitelabel/Legal) bez własnego wpisu w sidebarze; dostęp przez `SUPERADMIN_SETTINGS/WHITELABEL` (SuperAdminView.tsx:226–234), zmapowane do sekcji `system`.

---

## 1a–1d. Werdykty per sekcja (grupowo)

### Sekcja 1 — Tenant & User Ops (`CustomersModule.tsx`, 20 zakładek) — **REALNE ~95%**
`CustomersModule.tsx:152–178` definiuje 20 zakładek; `renderContent` (181–281) montuje konkretne widoki. Próbka subview `customers/*`:
| Zakładka | Widok | Dowód |
|---|---|---|
| Lifecycle | CustomerLifecycleView (853 l.) | `Api.getLifecycleStages/Transitions/Stats`, create/update/delete/transition — Lifecycle.tsx:188–332 |
| Playbooks | CustomerSuccessPlaybooksView (1020 l.) | `Api.getSuccessPlaybooks/Actions/Stats`, execute — Playbooks.tsx:245–373 |
| Contracts | ContractManagementView (942 l.) | `Api.getCustomerContracts/ContractStats/UpcomingRenewals` + CRUD — Contracts.tsx:202–316 |
| Automation | CustomerAutomationView (738 l.) | `Api.getAutomationRules/toggle/createRule/RuleExecutions` — Automation.tsx:161–297 |
| Communication/Analytics/Compliance | dedykowane widoki | `Api.getUsageByOrganization`, `Api.getComplianceSummary` |
| Commercial | RevenueModule (10 pod-zakładek) | patrz niżej |
| Module Access | ModuleAccessControlView | patrz niżej |
„coming soon/placeholder" w tych plikach = **HTML input placeholders**, NIE stuby. Brak mockowych tablic.

### Sekcja 2 — AI Operations (`AIPlatformModule/`, 7 sekcji × ~27 pod-zakładek) — **REALNE ~95%**
`AIPlatformModule/AIPlatformModule.tsx` (598 l.) importuje 27 pod-zakładek z podkatalogów Configuration/Development/Operations/Analytics/Policy/Security/Knowledge/Executive. Większość pod-zakładek to **cienkie wrappery** (14–22 linie) delegujące do realnych komponentów-widoków:
- LLMProvidersTab → `LLMManagementView` (1489 l., 11 API)
- ModelTiersTab → `ModelTierAssignments` (671 l.)
- ExperimentsTab → `ABTestingDashboard` (849 l.) — REALNY: `api.get('/ai/ab-testing/experiments')` (ABTesting:135, mała litera `api` — uwaga, nie `Api`)
- UsageAnalyticsTab → `UsageAnalyticsDashboard` (860 l.), CostAnalyticsTab → `AICostDashboard` (308 l.), APIKeysTab → `APIManagementView` (1098 l.), MissionControlTab → `AIMissionControl`, SLAManagementTab → `SLADashboard` (764 l.)
- AccessControlTab → `PermissionsMatrixView` (817 l.), Policy/Executive single-file (364/782 l.)
**Wzorzec wrapper→realny-widok jest celowy, nie stub.**

### Sekcja 3 — Connector Ops / System (`SystemModule.tsx`, 9 + 5 zakładek) — **REALNE ~100%**
9 paneli `Enterprise*` z `components/SuperAdmin/system/` — wszystkie 675–1209 linii z API:
AnalyticsPanel(2), ApiManagement(8), AuditLog(3), BackupPanel(4), ConfigurationPanel(7), FeatureFlags(6), HealthMonitor(7), IntegrationsHub(6), SecurityPanel(10). Plus 5 widoków presentation-governance (Watchlist/OperationsHealth/BenchmarkTrend/AlertSubscriptions/TemplateGovernance) + APIManagementView.

### Sekcja 4 — Governance & Compliance (`GovernanceModule.tsx`) — **REALNE ~100%**
Overview/AuditTimeline/Approvals/Compliance/Exports/Legal → `ComplianceCenterView` (2057 l., 13 API), `DataExportPanel`, iam/AdminAuditLogsView, ApprovalWorkflowsView, AuditEventsViewer, `SuperAdminLegalView` (557 l.).

### Sekcja 5 — Platform Security (`SecurityModule.tsx`, 15 zakładek) — **REALNE ~95%**
SecurityModule.tsx:40–55 importuje 15 widoków: AIBudgetsView, CustomRolesBuilder, GlobalSecurityPostureView, SSOConfigurationView, SCIMProvisioningView, SecurityPoliciesView, ComplianceCenterView + iam/ (AdminSessions/ApprovalWorkflows/AuditEvents/DLP/PermissionsMatrix/SecurityIncidents/ThreatIntelligence). Widoki iam/ realne (339–1029 l., API):
DLPView(983/7), PermissionsMatrixView(817/8), SecurityIncidentsView(977/5), ThreatIntelligenceView(1029/8), AdminSessionsView(470/4), ApprovalWorkflowsView(728/6).

### Sekcja 6 — Configuration — **REALNE** (URL/legacy)
`ConfigurationModule.tsx` (74 l.) → SystemSettings / WhitelabelStudioView / LegalPanel.

### Sekcja 7 — Virtual Workers — **REALNE ale UKRYTE (URL-only)**
`VirtualWorkersModule/` 10 paneli (3703 l. razem): WorkersList, WorkerProfileEditor(430), ConversationBrowser(442/5 API), EvaluationsPanel, WorkerAnalyticsDashboard(488), ReleasePanel, InsightsPanel, KnowledgeAssignmentPanel, WorkerPreviewPanel, WorkerDetail. Brak wpisu w sidebarze (UKRYTE).

---

## MARTWE / STUBY

- **`src/views/superadmin/AIPlatformModule.tsx` (flat, 152 l.) = MARTWY** — POTWIERDZONE. Jedyne importy `AIPlatformModule` w `src/` to: SuperAdminView.tsx:41 (ładuje **katalog** `./AIPlatformModule/AIPlatformModule`) i `AIPlatformModule/index.ts:5-6`. Plik płaski nie jest importowany nigdzie. Żywy jest katalog `AIPlatformModule/AIPlatformModule.tsx` (598 l.). **Kandydat do usunięcia.**
- `iam/IAMModuleView.tsx` (70 l., 0 API) — prawdopodobnie nieużywany orphan (nie w imporcie SecurityModule). Niski priorytet.
- Brak „coming soon"/placeholder-zakładek udających DZIAŁA — przeszukanie całości nie wykazało fałszywych zakładek.

**Szacunek całości: ~95% z ~60+ zakładek to realne backendy.** Największa „miękka" powierzchnia = nie stuby, lecz delegacje do `components/Admin/*` (część to starsze komponenty admin). To kwestia dojrzałości/danych, nie fasady.

---

## Known finding 2026-06-10 (feedback) — **NAPRAWIONE w kodzie** (commit 36ceb52c60 „feedback-system: full alerting pipeline rebuild")

- **Pulse/Feature 500 (brak tabel prod+staging)** → `feedback.routes.ts:156–198`: `CREATE TABLE IF NOT EXISTS feedback_pulse` (158) i `feature_requests` (177) + indeksy. Komentarz w kodzie: „migration 200 often not applied". Self-healing przy starcie/żądaniu.
- **In-app superadmin feedback martwe (is_active=1 vs TEXT)** → `feedback.routes.ts:465–466`: `AND (CAST(is_active AS TEXT) NOT IN ('0','false','f') OR is_active IS NULL)` — toleruje TEXT/INT/NULL. Bezpośrednia naprawa zgłoszonego buga.
- `feedback_items` też self-heal (94) + ALTER ADD COLUMN dla brakujących kolumn (150).
- **Wymaga weryfikacji LIVE** (FAZA 3): czy deploy 36ceb52c60 jest na prod/staging — finding był z 2026-06-10, fix w tym samym oknie. Status kodu = naprawione; status runtime = do potwierdzenia.

---

## Commercial / RevenueModule — **REALNE, Stripe obecny**

`RevenueModule.tsx` 10 zakładek → BillingCenterView(1758 l.), InvoiceCenterView(1240 l.), UsageStatsPanel, PricingPlansAdvancedView(620), SubscriptionChangesView, RevenueRecognitionView(590), RevenueForecastView(471), PaymentMethodsView, PartnerProgramConfig, PartnerSettlementsView(1136).
- Billing: `Api.get('/billing/admin/revenue|usage|operational-costs|plans|user-plans')` (Billing:204–611), pola `stripe_price_id` (173/562/966).
- **Stripe realny**: `server/src/routes/webhooks/stripe.routes.ts` (786 l.) — `import Stripe from 'stripe'`, subscription lifecycle, `stripe_events` table.
- Tryb invoice-based „grant paid access without Stripe auto-charging" (Billing:1495) — celowy.

## Persystencja platformy — **REALNA**

- **Feature flags**: `featureFlags.routes.ts` — tabele `feature_flags` + `feature_flag_history`, pełny CRUD (INSERT 324, UPDATE 409) + audyt zmian (INSERT history 352/438). FE `EnterpriseFeatureFlags.tsx` (1157 l.) `Api.getFeatureFlags/toggle/update/create/delete/History`. **Persystuje + wersjonuje.**
- **AI providers / tiers**: `superadmin.routes.ts:547` `SELECT ... is_active, health_status FROM` providerów; persist activation (commit e08da376a0 „persist provider activation"). LLMManagementView 11 API.
- **Module Access**: `ModuleAccessControlView` → `module-access.routes.ts` `/admin/grants` GET(150)/POST(179), toggle(296), **bootstrap DBR77** POST `/admin/bootstrap/dbr77` (282). Realne granty per-org/per-user. Bootstrap DBR77 = REALNY (FE:113–117 `apiPost('/module-access/admin/bootstrap/dbr77')`).

---

## SYGNAŁY DLA SEC — bramka serwerowa superadmin

**WERDYKT: control-plane jest serwerowo gated, DB-verified, fail-closed. ADMIN (org-admin) NIE może trafić w cross-org control-plane.**

1. **Router-level gate** `superadmin.routes.ts`:
   - `:340` `router.use(apiAuthRateLimiter)` → `:345` `router.use(verifyToken)` → `:348` `router.use(requireSuperAdmin)` (=`verifySuperAdmin`) → `:353` `requireAudit` → `:356` `superadminAuditMonitor`. **Każda** trasa superadmin przechodzi przez `verifySuperAdmin`.
   - Capability sub-gates (`:357–366`): `/security`→security_ops, `/virtual-workers`→ai_ops, `/ai`→ai_ops, `/impersonate`→support_ops, `/connectors`→platform_ops|security_ops, `/data`→security_ops|platform_ops, `/tenants/:id/purge`→security_ops.

2. **`verifySuperAdmin` (superAdmin.middleware.ts) = mocny, DB-as-truth**:
   - Weryfikuje JWT (HS256, issuer/audience, shape/sanityzacja kontrolnych znaków, :191–296).
   - **ZAWSZE odpytuje DB o rolę** (`SELECT role FROM users WHERE id=?`, :403) i **DB jest źródłem prawdy** (`effectiveRole = dbRole`, :416). Token-role ignorowany dla elewacji — chroni przed stale-privilege token.
   - `normalizeSuperAdminRole(effectiveRole) !== 'superadmin'` → **403 INSUFFICIENT_PLATFORM_ROLE** (:418–426). Org-admin (`admin`) odpada tu.
   - Błąd DB → 403 (fail-closed, :407). Brak/zła JWT → 401.

3. **Dedykowane routery też gated** (nie tylko główny superadmin.routes):
   - `module-access.routes.ts`: `verifySuperAdmin` per-route na `/admin/grants` (153), POST (182), `/admin/bootstrap/dbr77` (285), toggle (299).
   - `featureFlags.routes.ts:237` `router.use(requireSuperAdmin)` (router-level).
   - `feedback.routes.ts`: `verifySuperAdmin` per-route na endpointach superadmin (1353, 1438, 1516, 1726...). Publiczne submit-endpointy (pulse/feature) celowo bez tej bramki (user-facing).

**Do pogłębienia w SEC (FAZA 2)**:
- Zweryfikować, że **wszystkie** dedykowane control-plane routery (billing/admin, ai/ab-testing, virtual-workers szczegóły) mają `verifySuperAdmin` — próbka pozytywna, ale `/billing/admin/*` i `/ai/*` osobnych routerów nie sprawdzono linia-po-linii.
- Capability model: superadmin domyślnie dostaje **wszystkie** capabilities (middleware:167–169), więc sub-gate capability nie ogranicza pełnego superadmina — to depth-in-defense dla scoped tokenów, nie izolacja ról.
- `requireSuperAdminCapability` z pustą listą → 500 (misconfig guard, :519) — dobre.
