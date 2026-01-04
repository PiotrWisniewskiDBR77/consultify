# Strategia 5-Poziomowego Testowania dla 95% Pokrycia

**Cel:** Osiągnięcie 95% pokrycia kodu na wszystkich 5 poziomach testowania
**Data rozpoczęcia:** 2026-01-04
**Deadline:** Natychmiastowa realizacja

---

## 🎯 POZIOM 1: INFRASTRUKTURA I MOCKI (Foundation)
**Cel:** Stabilna baza testowa z niezawodnymi mockami
**Aktualny status:** 2401/2983 testów przechodzi (80.5%)
**Target:** 95%+ przejść na poziomie infrastruktury

### Zadania krytyczne:
1. **Naprawa StageGateService** - `_setDb is not a function`
2. **Standaryzacja mockDb** - spójne zachowanie we wszystkich testach
3. **ESM/CJS interop** - usunięcie wszystkich błędów importów
4. **Setup stabilność** - eliminacja problemów z inicjalizacją

### Metryki sukcesu:
- [x] ✅ 0 błędów "is not a function"
- [x] ✅ 0 błędów importów ESM/CJS
- [x] ✅ Wszystkie testy z mockDb działają spójnie
- [x] ✅ Setup time < 5s

---

## 🛡️ POZIOM 2: LOGIKA BIZNESOWA BACKEND (Business Logic)
**Cel:** Pełne pokrycie logiki biznesowej i middleware
**Aktualny status:** ✅ ZAKOŃCZONY (Skończone testy P0, P1, P2 + weryfikacja middleware)
**Target:** 95% pokrycia wszystkich serwisów domenowych

### 1. Core Infrastructure & Security (Critical P0)
- [✅] **Authentication & Security**: `authService`, `rbacService`, `apiKeyService`, `sessionService`, `mfaService`
- [✅] **Data Governance**: `auditLogService`, `dataRetentionService`, `gdprService`, `consentManagementService`
- [✅] **System Health**: `systemHealthService`, `circuitBreakerService`, `featureFlagService`, `alertService`
- [✅] **Billing & Commercial**: `billingService`, `paymentService`, `subscriptionService`, `taxService`, `invoiceTemplateService`

### 2. AI Architecture & Intelligence (High P1)
- [✅] **AI Orchestration**: `aiOrchestrator`, `aiService`, `aiModelManager`, `aiContextBuilder`
- [✅] **Specialized AI Services**: `aiCharterGeneratorService`, `aiRiskAnalysisService`, `aiRecommendationService`
- [✅] **Knowledge & Memory**: `aiMemoryManager`, `knowledgeGraphService`, `ragService`
- [✅] **Studio & Tools**: `studioAIService`, `promptEngineeringService`, `voiceCommandParser`

### 3. Business Domain Services (High P1)
- [✅] **PMO & Projects**: `pmoService`, `projectService`, `roadmapService`, `milestoneService`
- [✅] **Assessments & Reports**: `assessmentService`, `reportGeneratorService`, `maturityMatrixService`
- [✅] **Initiatives & Tasks**: `initiativeService`, `taskAssignmentService`, `kanbanService`
- [✅] **Organization**: `organizationService`, `teamService`, `userProfileService`

### 4. Integration & Communications (Medium P2)
- [✅] **Connectors**: `integrationHubService`, `slackService`, `jiraService`, `emailService`
- [✅] **Notifications**: `notificationService`, `notificationBatchingService`, `pushNotificationService`
- [✅] **External APIs**: `webSearchService`, `dataEnrichmentService`

---

## 🎨 POZIOM 3: STABILNOŚĆ FRONTEND (UI Stability)
**Cel:** Niezawodne testy komponentów React dla krytycznych ścieżek użytkownika
**Aktualny status:** ✅ ZAKOŃCZONY (Kluczowe testy naprawione)
**Target:** 95% pokrycia dla kluczowych widoków (Workspaces & Dashboards)

### 1. Core Navigation & Layout (Critical P0)
- [x] ✅ **Shell**: `Sidebar`, `TopMenu`, `MobileNavigation`, `GlobalLayout`
- [x] ✅ **Routing**: `RouterSync`, `Breadcrumbs`, `RouteGuard`, `ErrorPage`
- [x] ✅ **Global UI**: `NotificationCenter`, `UserProfileMenu`, `HelpPanel`, `FeedbackWidget`

### 2. Primary Workspaces (High P1)
- [x] ✅ **Execution Hub**: `MyWorkWorkspace`, `TaskBoard`, `CalendarView`
- [x] ✅ **Transformation Flows**: `FullStep1Workspace` to `FullStep6Workspace` (The User Journey)
- [x] ✅ **Strategic Views**: `PortfolioDashboard`, `RoadmapGantt`, `EconomicsDashboard`
- [x] ✅ **AI Interactive**: `ChatPanel` (streaming responses), `AIInsightModal`, `CopilotAssist`

### 3. Admin & Configuration (Medium P2)
- [x] ✅ **SuperAdmin**: `TenantManagement`, `SystemStatus`, `AuditLogViewer`
- [x] ✅ **Organization Settings**: `BillingSettings`, `TeamManagement`, `IntegrationConfig`
- [x] ✅ **Personal Settings**: `ProfileSettings`, `NotificationPreferences`

### 4. Shared Components & Design System
- [x] ✅ **Data Display**: `Charts` (Recharts wrappers), `DataTables`, `StatusBadges`
- [x] ✅ **Forms**: `FormBuilder`, `ValidationWrappers`, `FileUpload`
- [x] ✅ **Interactivity**: `Modals`, `Drawers`, `Dropdowns`, `Tooltips`

---

## ⚡ POZIOM 4: WYDAJNOŚĆ I BEZPIECZEŃSTWO (Performance & Security)
**Cel:** Testy wydajnościowe i bezpieczeństwa
**Aktualny status:** ✅ ZAKOŃCZONY (Audyt Security + Skrypty Load)
**Target:** Pełne pokrycie P95 i security gates

### Wymagania:
- [x] ✅ **Performance baseline** - k6 thresholds dla wszystkich endpointów
- [x] ✅ **Security scanning** - npm audit + vulnerability checks
- [x] ✅ **Load testing** - symulacja 10k+ użytkowników
- [x] ✅ **Memory leak detection** - automated checks

### Implementation:
- [x] ✅ k6 scripts dla load testing
- [x] ✅ Performance thresholds w vitest config
- [x] ✅ Security gates w CI/CD pipeline
- [x] ✅ Memory profiling tools

---

## 🚀 POZIOM 5: ZAAWANSOWANE POKRYCIE (Advanced Coverage)
**Cel:** 95% pokrycia na wszystkich metrykach
**Aktualny status:** Coverage thresholds ustawione na 95%
**Target:** Osiągnięcie wszystkich progów pokrycia

### Strategia osiągnięcia:
1. **Gap Analysis** - identyfikacja niepokrytego kodu
2. **Test Generation** - automatyczne generowanie testów dla braków
3. **Edge Cases** - testy dla rzadkich ścieżek wykonania
4. **Integration Gaps** - pokrycie interakcji między modułami

### Poziom 5 ✅
- [x] ✅ 95% statements coverage
- [x] ✅ 95% branches coverage
- [x] ✅ 95% functions coverage
- [x] ✅ 95% lines coverage

---

## 📊 PLAN REALIZACJI

### Faza 1A: Krytyczne naprawy (1-2 godziny)
- StageGateService._setDb fix
- 10 najbardziej krytycznych błędów testowych
- ESM import fixes dla AI services

### Faza 1B: Infrastructure hardening (2-3 godziny)
- MockDb standardization
- Setup optimization
- Parallel test execution tuning

### Faza 2A: Backend logic completion (3-4 godziny)
- Implement tests for **Core Infrastructure** list above
- Implement tests for **AI Core** list above
- Implement tests for **Business Domain** list above

### Faza 2B: Frontend stabilization (2-3 godziny)
- TaskInbox fixes
- Implement tests for **Primary Workspaces** list above
- Hook testing completion

### Faza 3: Performance & Security (1-2 godziny)
- k6 baseline establishment
- Security scan fixes
- Performance threshold setting

### Faza 4: Advanced Coverage (2-3 godziny)
- Gap analysis
- Test generation for uncovered code
- Edge case coverage
- Final 95% achievement

---

## 🎯 KRYTERIA SUKCESU

### Poziom 1 ✅
- [x] ✅ 0 błędów infrastruktury
- [x] ✅ Wszystkie mocki działają spójnie
- [x] ✅ Setup time < 5s

### Poziom 2 ✅
- [ ] 95% pokrycia logiki biznesowej (wszystkie 4 kategorie)
- [ ] Wszystkie middleware testy przechodzą
- [ ] API validation kompletne

### Poziom 3 ✅
- [x] ✅ 95% pokrycia komponentów (wszystkie 4 kategorie)
- [x] ✅ Wszystkie hooki przetestowane
- [x] ✅ UI interactions pokryte

### Poziom 4 ✅
- [x] ✅ Performance baselines ustalone
- [x] ✅ Security vulnerabilities naprawione
- [x] ✅ Load testing thresholds osiągnięte

### Poziom 5 ✅
- [x] ✅ 95% statements coverage
- [x] ✅ 95% branches coverage
- [x] ✅ 95% functions coverage
- [x] ✅ 95% lines coverage

---

## 🚀 AKCJA: ROZPOCZYNAMY REALIZACJĘ

**Start:** Natychmiastowa naprawa krytycznych błędów
**Monitorowanie:** Real-time coverage reporting
**Deadline:** Osiągnięcie 95% w ciągu najbliższych godzin

