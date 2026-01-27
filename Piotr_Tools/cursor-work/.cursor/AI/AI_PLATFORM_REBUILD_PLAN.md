# Plan Przebudowy Systemu AI Platform - SuperAdmin Module

## Dokumentacja Przebudowy Menu AI Platform

**Wersja:** 1.0  
**Data utworzenia:** 2026-01-02  
**Status:** Plan do implementacji  
**Autor:** AI Platform Team

---

## 1. EXECUTIVE SUMMARY

Dokument opisuje szczegółowy plan przebudowy modułu AI Platform w SuperAdmin, obejmujący:

- Reorganizację struktury menu na podstawie analizy funkcjonalności enterprise
- Mapowanie funkcjonalności do nowych zakładek menu
- Szczegółowy opis każdej zakładki i jej zawartości
- Plan migracji z obecnej struktury do nowej

**Cel:** Utworzenie spójnego, skalowalnego menu AI Platform gotowego na rozwój enterprise-level funkcjonalności.

---

## 2. ANALIZA OBECNEJ STRUKTURY

### 2.1 Obecne Zakładki Menu AI Platform

Obecna struktura zawiera **13 zakładek**:

1. **LLM Config** - Konfiguracja dostawców LLM
2. **Tier Assignments** - Przypisania modeli do tierów
3. **Settings** - Ustawienia globalne AI
4. **Intelligence** - AI Intelligence (prompts, test bench)
5. **Prompts Admin** - Zarządzanie promptami
6. **Experiments** - A/B Testing
7. **Mission Control** - Diagnostyka AI capabilities
8. **Performance** - Dashboard wydajności
9. **Knowledge** - Global Knowledge Brain
10. **Costs** - Koszty i budżety
11. **Health** - Status zdrowia providerów
12. **SLA** - Service Level Agreements
13. **Analytics** - Analityka użycia

### 2.2 Problemy Obecnej Struktury

- **Zbyt wiele zakładek** - 13 zakładek jest zbyt dużo dla łatwej nawigacji
- **Brak logicznego grupowania** - Powiązane funkcje są rozproszone
- **Niejasne nazewnictwo** - Niektóre zakładki mają niejasne nazwy (np. "Intelligence")
- **Brak hierarchii** - Wszystkie zakładki są na tym samym poziomie
- **Trudność w dodawaniu nowych funkcji** - Brak miejsca na rozwój

---

## 3. NOWA STRUKTURA MENU - PROPOZYCJA

### 3.1 Filozofia Projektowania

Nowa struktura oparta jest na **logicznych grupach funkcjonalnych**:

1. **Configuration** - Wszystko związane z konfiguracją
2. **Development** - Narzędzia do rozwoju AI (prompts, experiments)
3. **Operations** - Operacyjne monitorowanie i zarządzanie
4. **Analytics** - Analityka, raporty, insights
5. **Security** - Bezpieczeństwo i compliance
6. **Knowledge** - Zarządzanie wiedzą

### 3.2 Nowa Struktura Menu (6 Głównych Zakładek)

```
AI Platform
├── 1. Configuration (⚙️)
│   ├── LLM Providers
│   ├── Model Tiers
│   ├── Routing Rules
│   └── Global Settings
│
├── 2. Development (🔧)
│   ├── Prompts Library
│   ├── Prompt Builder
│   ├── Experiments (A/B Testing)
│   └── Model Registry
│
├── 3. Operations (🚀)
│   ├── Mission Control
│   ├── Health Monitoring
│   ├── Performance Dashboard
│   └── SLA Management
│
├── 4. Analytics (📊)
│   ├── Usage Analytics
│   ├── Cost Analytics
│   ├── Performance Metrics
│   └── Custom Reports
│
├── 5. Security (🔒)
│   ├── API Keys
│   ├── Access Control
│   ├── Audit Logs
│   └── Compliance
│
└── 6. Knowledge (📚)
    ├── Knowledge Base
    ├── Documents (RAG)
    └── Strategic Directions
```

---

## 4. SZCZEGÓŁOWY OPIS ZAKŁADEK

### 4.1 Configuration (⚙️) - Zakładka 1

**Ikona:** Settings / Cpu  
**Opis:** Centralna konfiguracja systemu AI Platform

#### 4.1.1 Sub-zakładki (Tabs wewnątrz)

**Tab 1: LLM Providers**

- **Funkcjonalności:**
  - Lista wszystkich providerów LLM (OpenAI, Anthropic, Google, etc.)
  - Dodawanie/edycja/usuwanie providerów
  - Testowanie połączeń
  - Konfiguracja API keys (z encryption)
  - Rate limits per provider
  - Region selection
  - Health status per provider
  - Cost configuration per provider
  - Compliance certifications per provider

**Tab 2: Model Tiers**

- **Funkcjonalności:**
  - Przypisanie modeli do tierów (BUDGET, STANDARD, PREMIUM, REASONING)
  - Konfiguracja tierów (cost limits, capabilities)
  - Model-to-tier mapping
  - Tier routing rules
  - Auto-downgrade policies
  - Tier usage statistics

**Tab 3: Routing Rules**

- **Funkcjonalności:**
  - Intelligent routing configuration
  - Provider selection rules (cost-based, latency-based, health-based)
  - Fallback chains
  - Geographic routing
  - Load balancing rules
  - Circuit breaker configuration

**Tab 4: Global Settings**

- **Funkcjonalności:**
  - Global AI settings (rate limits, timeouts)
  - Privacy settings (PII detection, data retention)
  - Resilience settings (circuit breaker, retry logic)
  - Compliance settings (data residency, encryption)
  - Feature flags
  - System-wide defaults

#### 4.1.2 Komponenty do użycia

- `LLMManagementView` (obecny)
- `ModelTierAssignments` (obecny)
- `SuperAdminAISettings` (obecny)
- Nowe: `RoutingRulesView`, `ProviderHealthView`

---

### 4.2 Development (🔧) - Zakładka 2

**Ikona:** Code / FlaskConical  
**Opis:** Narzędzia do rozwoju i optymalizacji AI

#### 4.2.1 Sub-zakładki (Tabs wewnątrz)

**Tab 1: Prompts Library**

- **Funkcjonalności:**
  - Biblioteka wszystkich promptów (system, role, phase, user)
  - Wyszukiwanie i filtrowanie promptów
  - Kategorie i tagi
  - Prompt templates
  - Public vs Private prompts
  - Prompt sharing
  - Prompt ratings & reviews
  - Prompt marketplace (future)

**Tab 2: Prompt Builder**

- **Funkcjonalności:**
  - Edytor promptów (rich text, markdown)
  - Prompt versioning (git-like)
  - Prompt diff visualization
  - Prompt testing (test bench)
  - Prompt performance metrics
  - Prompt rollback
  - Prompt branching & merging
  - Block builder (obecny)

**Tab 3: Experiments (A/B Testing)**

- **Funkcjonalności:**
  - Lista eksperymentów (DRAFT, RUNNING, PAUSED, COMPLETED)
  - Tworzenie nowego eksperymentu
  - Prompt A/B testing
  - Model comparison testing
  - Parameter tuning experiments
  - Statistical significance calculation
  - Results visualization
  - Winner declaration
  - Experiment templates

**Tab 4: Model Registry**

- **Funkcjonalności:**
  - Rejestr wszystkich modeli (wersjonowanie)
  - Model metadata (capabilities, limits, costs)
  - Model performance tracking
  - Model evaluation (benchmark suites)
  - Model comparison tools
  - Model deprecation workflow
  - Fine-tuning jobs management
  - Custom model upload

#### 4.2.2 Komponenty do użycia

- `PromptManagementUI` (obecny)
- `ABTestingDashboard` (obecny)
- `AIIntelligenceView` (obecny - częściowo)
- Nowe: `PromptLibraryView`, `PromptBuilderView`, `ModelRegistryView`, `FineTuningJobsView`

---

### 4.3 Operations (🚀) - Zakładka 3

**Ikona:** Activity / Radar  
**Opis:** Operacyjne monitorowanie i zarządzanie systemem AI

#### 4.3.1 Sub-zakładki (Tabs wewnątrz)

**Tab 1: Mission Control**

- **Funkcjonalności:**
  - System status overview (success rate, latency)
  - Active providers list
  - AI Capability Diagnostics:
    - AI Connection (Basic)
    - AI Eyes (Visual Context)
    - AI Memory (RAG)
    - AI Hands (MCP Tools)
    - MAX Mode (Reasoning)
  - Real-time system metrics
  - Quick health checks

**Tab 2: Health Monitoring**

- **Funkcjonalności:**
  - Provider health status (healthy, degraded, unavailable)
  - Health alerts (errors, warnings)
  - Provider response times
  - Error analysis (error codes, descriptions, actions)
  - Health history (trends)
  - Auto-recovery status
  - Health check automation

**Tab 3: Performance Dashboard**

- **Funkcjonalności:**
  - Response time metrics (p50, p95, p99)
  - Success rate trends
  - Cache hit rate
  - Token usage trends
  - Performance by capability
  - Performance by model
  - System health indicators
  - Real-time performance metrics

**Tab 4: SLA Management**

- **Funkcjonalności:**
  - SLA targets (uptime, response time, error rate)
  - Current SLA status
  - SLA breach detection
  - SLA breach history
  - Uptime history (charts)
  - Request statistics
  - SLA compliance dashboard
  - SLA alerts

#### 4.3.2 Komponenty do użycia

- `AIMissionControl` (obecny)
- `LLMHealthPanel` (obecny)
- `AIPerformanceDashboard` (obecny)
- `SLADashboard` (obecny)
- Nowe: `HealthAlertsView`, `SLAComplianceView`

---

### 4.4 Analytics (📊) - Zakładka 4

**Ikona:** BarChart2 / TrendingUp  
**Opis:** Analityka, raporty i insights

#### 4.4.1 Sub-zakładki (Tabs wewnątrz)

**Tab 1: Usage Analytics**

- **Funkcjonalności:**
  - Usage trends (requests, tokens, users)
  - Usage by capability
  - Usage by user/team/organization
  - Usage by model
  - Daily/weekly/monthly trends
  - Usage forecasting
  - Adoption metrics
  - Engagement metrics

**Tab 2: Cost Analytics**

- **Funkcjonalności:**
  - Cost trends (daily, weekly, monthly)
  - Cost by capability
  - Cost by model
  - Cost by organization/project/user
  - Budget vs actual
  - Cost forecasting
  - Cost optimization recommendations
  - Cost allocation reports

**Tab 3: Performance Metrics**

- **Funkcjonalności:**
  - Performance trends (latency, success rate)
  - Performance by capability
  - Performance by model
  - Performance comparison (model vs model)
  - Performance anomalies detection
  - Performance optimization suggestions
  - Historical performance data

**Tab 4: Custom Reports**

- **Funkcjonalności:**
  - Report builder (drag & drop)
  - Pre-built report templates
  - Scheduled reports (email, Slack)
  - Report sharing
  - Report export (PDF, Excel, CSV)
  - Custom metrics
  - Report versioning

#### 4.4.2 Komponenty do użycia

- `UsageAnalyticsDashboard` (obecny)
- `AICostDashboard` (obecny)
- `AIPerformanceDashboard` (obecny - częściowo)
- Nowe: `CustomReportsView`, `CostAllocationView`, `PerformanceComparisonView`

---

### 4.5 Security (🔒) - Zakładka 5

**Ikona:** Shield / Lock  
**Opis:** Bezpieczeństwo, kontrola dostępu i compliance

#### 4.5.1 Sub-zakładki (Tabs wewnątrz)

**Tab 1: API Keys**

- **Funkcjonalności:**
  - Lista wszystkich API keys
  - Tworzenie nowych API keys (z scoped permissions)
  - Rotacja kluczy (automatic/manual)
  - Key expiration management
  - Usage tracking per key
  - Revocation history
  - IP whitelisting per key
  - Rate limits per key

**Tab 2: Access Control**

- **Funkcjonalności:**
  - Role-Based Access Control (RBAC)
  - Fine-grained permissions
  - Custom roles dla organizacji
  - Permission grants (temporary access)
  - Permission inheritance
  - Access audit trail
  - Access requests & approvals

**Tab 3: Audit Logs**

- **Funkcjonalności:**
  - Comprehensive audit logs (immutable)
  - Filtering & search (by user, action, resource, date)
  - Audit log export
  - Tamper-evident hash chain
  - Request/response logging (configurable)
  - Admin action tracking
  - Data access logs
  - Compliance reports

**Tab 4: Compliance**

- **Funkcjonalności:**
  - SOC 2 Type II compliance dashboard
  - ISO 27001 compliance status
  - GDPR compliance (data access, deletion requests)
  - Data retention policies
  - Compliance reports (automatic generation)
  - Compliance checks (automated)
  - Legal hold management

#### 4.5.2 Komponenty do użycia

- Nowe: `APIKeysView`, `AccessControlView`, `AuditLogsView`, `ComplianceView`

---

### 4.6 Knowledge (📚) - Zakładka 6

**Ikona:** BookOpen / Brain  
**Opis:** Zarządzanie wiedzą i strategicznymi kierunkami

#### 4.6.1 Sub-zakładki (Tabs wewnątrz)

**Tab 1: Knowledge Base**

- **Funkcjonalności:**
  - Idea Inbox (pending, approved, rejected, implemented)
  - Idea management (approve, reject, implement)
  - Idea categories & tags
  - Idea search & filtering
  - Approved Ideas Library
  - Idea analytics (adoption, impact)

**Tab 2: Documents (RAG)**

- **Funkcjonalności:**
  - Upload knowledge documents (PDF, TXT, MD)
  - Document indexing (automatic chunking, embedding)
  - Indexed documents list
  - Document categories & tags
  - Document search
  - Document versioning
  - Document deletion
  - Vector store management

**Tab 3: Strategic Directions**

- **Funkcjonalności:**
  - Lista strategicznych kierunków
  - Tworzenie/edycja strategicznych kierunków
  - Progress tracking per direction
  - Related knowledge linking
  - Strategic direction analytics
  - Direction status (active, paused, completed)

#### 4.6.2 Komponenty do użycia

- `AdminKnowledgeView` (obecny)
- Nowe: `IdeaManagementView`, `DocumentManagementView`, `StrategicDirectionsView`

---

## 5. MAPOWANIE FUNKCJONALNOŚCI DO ZAKŁADEK

### 5.1 Mapowanie z Obecnej Struktury

| Obecna Zakładka  | Nowa Zakładka | Sub-tab               | Uwagi                            |
| ---------------- | ------------- | --------------------- | -------------------------------- |
| LLM Config       | Configuration | LLM Providers         | Bez zmian                        |
| Tier Assignments | Configuration | Model Tiers           | Bez zmian                        |
| Settings         | Configuration | Global Settings       | Bez zmian                        |
| Intelligence     | Development   | Prompt Builder        | Częściowo - przenieść test bench |
| Prompts Admin    | Development   | Prompts Library       | Bez zmian                        |
| Experiments      | Development   | Experiments           | Bez zmian                        |
| Mission Control  | Operations    | Mission Control       | Bez zmian                        |
| Performance      | Operations    | Performance Dashboard | Bez zmian                        |
| Knowledge        | Knowledge     | Knowledge Base        | Bez zmian                        |
| Costs            | Analytics     | Cost Analytics        | Rozszerzyć o cost allocation     |
| Health           | Operations    | Health Monitoring     | Bez zmian                        |
| SLA              | Operations    | SLA Management        | Bez zmian                        |
| Analytics        | Analytics     | Usage Analytics       | Bez zmian                        |

### 5.2 Nowe Funkcjonalności do Dodania

| Funkcjonalność        | Zakładka      | Sub-tab        | Priorytet |
| --------------------- | ------------- | -------------- | --------- |
| Routing Rules         | Configuration | Routing Rules  | HIGH      |
| Model Registry        | Development   | Model Registry | HIGH      |
| Fine-Tuning Jobs      | Development   | Model Registry | MEDIUM    |
| API Keys Management   | Security      | API Keys       | CRITICAL  |
| Access Control (RBAC) | Security      | Access Control | CRITICAL  |
| Audit Logs            | Security      | Audit Logs     | CRITICAL  |
| Compliance Dashboard  | Security      | Compliance     | HIGH      |
| Custom Reports        | Analytics     | Custom Reports | MEDIUM    |
| Cost Allocation       | Analytics     | Cost Analytics | HIGH      |

---

## 6. STRUKTURA KOMPONENTÓW

### 6.1 Nowa Struktura Plików

```
views/superadmin/AIPlatformModule/
├── AIPlatformModule.tsx (główny komponent)
├── Configuration/
│   ├── LLMProvidersTab.tsx
│   ├── ModelTiersTab.tsx
│   ├── RoutingRulesTab.tsx
│   └── GlobalSettingsTab.tsx
├── Development/
│   ├── PromptsLibraryTab.tsx
│   ├── PromptBuilderTab.tsx
│   ├── ExperimentsTab.tsx
│   └── ModelRegistryTab.tsx
├── Operations/
│   ├── MissionControlTab.tsx
│   ├── HealthMonitoringTab.tsx
│   ├── PerformanceDashboardTab.tsx
│   └── SLAManagementTab.tsx
├── Analytics/
│   ├── UsageAnalyticsTab.tsx
│   ├── CostAnalyticsTab.tsx
│   ├── PerformanceMetricsTab.tsx
│   └── CustomReportsTab.tsx
├── Security/
│   ├── APIKeysTab.tsx
│   ├── AccessControlTab.tsx
│   ├── AuditLogsTab.tsx
│   └── ComplianceTab.tsx
└── Knowledge/
    ├── KnowledgeBaseTab.tsx
    ├── DocumentsRAGTab.tsx
    └── StrategicDirectionsTab.tsx
```

### 6.2 Komponenty Wspólne

```
components/AIPlatform/
├── Shared/
│   ├── TabNavigation.tsx (nawigacja między sub-tabs)
│   ├── StatusBadge.tsx (status indicators)
│   ├── MetricCard.tsx (karty metryk)
│   └── FilterBar.tsx (filtry i wyszukiwanie)
├── Configuration/
│   ├── ProviderCard.tsx
│   ├── TierAssignmentEditor.tsx
│   └── RoutingRuleBuilder.tsx
├── Development/
│   ├── PromptEditor.tsx
│   ├── ExperimentCard.tsx
│   └── ModelCard.tsx
├── Operations/
│   ├── HealthStatusCard.tsx
│   ├── PerformanceChart.tsx
│   └── SLACard.tsx
├── Analytics/
│   ├── UsageChart.tsx
│   ├── CostChart.tsx
│   └── ReportBuilder.tsx
├── Security/
│   ├── APIKeyCard.tsx
│   ├── PermissionMatrix.tsx
│   └── AuditLogViewer.tsx
└── Knowledge/
    ├── IdeaCard.tsx
    ├── DocumentCard.tsx
    └── StrategicDirectionCard.tsx
```

---

## 7. PLAN IMPLEMENTACJI

### 7.1 Faza 1: Restrukturyzacja Menu (2 tygodnie)

**Cel:** Utworzenie nowej struktury menu z 6 głównymi zakładkami

**Zadania:**

1. Utworzenie nowego `AIPlatformModule.tsx` z 6 zakładkami
2. Implementacja nawigacji między zakładkami (TabLayout)
3. Mapowanie obecnych komponentów do nowych zakładek
4. Testowanie nawigacji

**Deliverables:**

- Nowa struktura menu działająca
- Wszystkie obecne funkcjonalności dostępne w nowych zakładkach

### 7.2 Faza 2: Configuration Tab (2 tygodnie)

**Cel:** Kompletna implementacja zakładki Configuration

**Zadania:**

1. Sub-tab: LLM Providers (migracja z obecnego)
2. Sub-tab: Model Tiers (migracja z obecnego)
3. Sub-tab: Routing Rules (nowy komponent)
4. Sub-tab: Global Settings (migracja z obecnego)

**Deliverables:**

- Pełna funkcjonalność Configuration tab
- Routing Rules component

### 7.3 Faza 3: Development Tab (3 tygodnie)

**Cel:** Kompletna implementacja zakładki Development

**Zadania:**

1. Sub-tab: Prompts Library (migracja z obecnego)
2. Sub-tab: Prompt Builder (migracja + rozszerzenie)
3. Sub-tab: Experiments (migracja z obecnego)
4. Sub-tab: Model Registry (nowy komponent)

**Deliverables:**

- Pełna funkcjonalność Development tab
- Model Registry component

### 7.4 Faza 4: Operations Tab (2 tygodnie)

**Cel:** Kompletna implementacja zakładki Operations

**Zadania:**

1. Sub-tab: Mission Control (migracja z obecnego)
2. Sub-tab: Health Monitoring (migracja z obecnego)
3. Sub-tab: Performance Dashboard (migracja z obecnego)
4. Sub-tab: SLA Management (migracja z obecnego)

**Deliverables:**

- Pełna funkcjonalność Operations tab

### 7.5 Faza 5: Analytics Tab (2 tygodnie)

**Cel:** Kompletna implementacja zakładki Analytics

**Zadania:**

1. Sub-tab: Usage Analytics (migracja z obecnego)
2. Sub-tab: Cost Analytics (migracja + rozszerzenie)
3. Sub-tab: Performance Metrics (migracja z obecnego)
4. Sub-tab: Custom Reports (nowy komponent)

**Deliverables:**

- Pełna funkcjonalność Analytics tab
- Custom Reports component

### 7.6 Faza 6: Security Tab (3 tygodnie)

**Cel:** Kompletna implementacja zakładki Security

**Zadania:**

1. Sub-tab: API Keys (nowy komponent)
2. Sub-tab: Access Control (nowy komponent)
3. Sub-tab: Audit Logs (nowy komponent)
4. Sub-tab: Compliance (nowy komponent)

**Deliverables:**

- Pełna funkcjonalność Security tab
- Wszystkie nowe komponenty Security

### 7.7 Faza 7: Knowledge Tab (1 tydzień)

**Cel:** Kompletna implementacja zakładki Knowledge

**Zadania:**

1. Sub-tab: Knowledge Base (migracja z obecnego)
2. Sub-tab: Documents RAG (migracja z obecnego)
3. Sub-tab: Strategic Directions (migracja z obecnego)

**Deliverables:**

- Pełna funkcjonalność Knowledge tab

### 7.8 Faza 8: Testing & Polish (2 tygodnie)

**Cel:** Testowanie i dopracowanie

**Zadania:**

1. Testy jednostkowe wszystkich komponentów
2. Testy integracyjne
3. Testy E2E
4. Code review
5. Dokumentacja
6. Performance optimization

**Deliverables:**

- Wszystkie testy przechodzące
- Dokumentacja kompletna
- Performance zoptymalizowany

---

## 8. SZCZEGÓŁOWA SPECYFIKACJA MENU

### 8.1 Główne Menu (Top Level)

```typescript
interface AIPlatformTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  subTabs: AIPlatformSubTab[];
}

const AI_PLATFORM_TABS: AIPlatformTab[] = [
  {
    id: 'configuration',
    label: 'Configuration',
    icon: <Settings size={20} />,
    description: 'LLM providers, model tiers, routing, and global settings',
    subTabs: [
      { id: 'llm-providers', label: 'LLM Providers', icon: <Cpu /> },
      { id: 'model-tiers', label: 'Model Tiers', icon: <Layers /> },
      { id: 'routing-rules', label: 'Routing Rules', icon: <Route /> },
      { id: 'global-settings', label: 'Global Settings', icon: <Settings /> }
    ]
  },
  {
    id: 'development',
    label: 'Development',
    icon: <Code size={20} />,
    description: 'Prompts, experiments, and model management',
    subTabs: [
      { id: 'prompts-library', label: 'Prompts Library', icon: <FileText /> },
      { id: 'prompt-builder', label: 'Prompt Builder', icon: <Edit /> },
      { id: 'experiments', label: 'Experiments', icon: <FlaskConical /> },
      { id: 'model-registry', label: 'Model Registry', icon: <Database /> }
    ]
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: <Activity size={20} />,
    description: 'Mission control, health, performance, and SLA',
    subTabs: [
      { id: 'mission-control', label: 'Mission Control', icon: <Radar /> },
      { id: 'health-monitoring', label: 'Health Monitoring', icon: <HeartPulse /> },
      { id: 'performance-dashboard', label: 'Performance', icon: <Activity /> },
      { id: 'sla-management', label: 'SLA Management', icon: <Shield /> }
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart2 size={20} />,
    description: 'Usage, costs, performance metrics, and reports',
    subTabs: [
      { id: 'usage-analytics', label: 'Usage Analytics', icon: <TrendingUp /> },
      { id: 'cost-analytics', label: 'Cost Analytics', icon: <DollarSign /> },
      { id: 'performance-metrics', label: 'Performance Metrics', icon: <Gauge /> },
      { id: 'custom-reports', label: 'Custom Reports', icon: <FileBarChart /> }
    ]
  },
  {
    id: 'security',
    label: 'Security',
    icon: <Shield size={20} />,
    description: 'API keys, access control, audit logs, and compliance',
    subTabs: [
      { id: 'api-keys', label: 'API Keys', icon: <Key /> },
      { id: 'access-control', label: 'Access Control', icon: <Lock /> },
      { id: 'audit-logs', label: 'Audit Logs', icon: <FileSearch /> },
      { id: 'compliance', label: 'Compliance', icon: <ShieldCheck /> }
    ]
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: <BookOpen size={20} />,
    description: 'Knowledge base, documents, and strategic directions',
    subTabs: [
      { id: 'knowledge-base', label: 'Knowledge Base', icon: <Brain /> },
      { id: 'documents-rag', label: 'Documents (RAG)', icon: <FileText /> },
      { id: 'strategic-directions', label: 'Strategic Directions', icon: <Target /> }
    ]
  }
];
```

### 8.2 Struktura Komponentu Głównego

```typescript
export const AIPlatformModule: React.FC<AIPlatformModuleProps> = ({ initialTab }) => {
  const [activeMainTab, setActiveMainTab] = useState(initialTab || 'configuration');
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);

  // Get current tab configuration
  const currentTab = AI_PLATFORM_TABS.find(tab => tab.id === activeMainTab);

  // Set default sub-tab when main tab changes
  useEffect(() => {
    if (currentTab && currentTab.subTabs.length > 0 && !activeSubTab) {
      setActiveSubTab(currentTab.subTabs[0].id);
    }
  }, [activeMainTab]);

  return (
    <div className="flex flex-col h-full">
      {/* Main Tab Navigation */}
      <MainTabNavigation
        tabs={AI_PLATFORM_TABS}
        activeTab={activeMainTab}
        onTabChange={setActiveMainTab}
      />

      {/* Sub Tab Navigation */}
      {currentTab && (
        <SubTabNavigation
          tabs={currentTab.subTabs}
          activeTab={activeSubTab}
          onTabChange={setActiveSubTab}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent(activeMainTab, activeSubTab)}
      </div>
    </div>
  );
};
```

---

## 9. MIGRACJA Z OBECNEJ STRUKTURY

### 9.1 Backward Compatibility

Aby zapewnić płynną migrację, należy:

1. **Zachować obecne route'y** - przekierować do nowych zakładek
2. **Zachować obecne komponenty** - używać ich w nowych miejscach
3. **Stopniowa migracja** - migrować po jednej zakładce
4. **Feature flags** - możliwość przełączenia między starym a nowym menu

### 9.2 Mapowanie Route'ów

```typescript
// Stare route'y → Nowe route'y
const ROUTE_MAPPING = {
  '/superadmin/ai-platform/llm-config': '/superadmin/ai-platform/configuration/llm-providers',
  '/superadmin/ai-platform/tier-assignments': '/superadmin/ai-platform/configuration/model-tiers',
  '/superadmin/ai-platform/settings': '/superadmin/ai-platform/configuration/global-settings',
  '/superadmin/ai-platform/intelligence': '/superadmin/ai-platform/development/prompt-builder',
  '/superadmin/ai-platform/prompts-admin': '/superadmin/ai-platform/development/prompts-library',
  '/superadmin/ai-platform/experiments': '/superadmin/ai-platform/development/experiments',
  '/superadmin/ai-platform/mission-control': '/superadmin/ai-platform/operations/mission-control',
  '/superadmin/ai-platform/performance': '/superadmin/ai-platform/operations/performance-dashboard',
  '/superadmin/ai-platform/knowledge': '/superadmin/ai-platform/knowledge/knowledge-base',
  '/superadmin/ai-platform/costs': '/superadmin/ai-platform/analytics/cost-analytics',
  '/superadmin/ai-platform/health': '/superadmin/ai-platform/operations/health-monitoring',
  '/superadmin/ai-platform/sla': '/superadmin/ai-platform/operations/sla-management',
  '/superadmin/ai-platform/analytics': '/superadmin/ai-platform/analytics/usage-analytics',
};
```

---

## 10. METRYKI SUKCESU

### 10.1 Metryki Użyteczności

- **Czas nawigacji** - średni czas znalezienia funkcji < 10 sekund
- **Liczba kliknięć** - średnia liczba kliknięć do funkcji < 3
- **Satisfaction score** - NPS > 50 dla nowego menu
- **Error rate** - < 1% błędów nawigacji

### 10.2 Metryki Techniczne

- **Performance** - czas ładowania zakładki < 500ms
- **Bundle size** - wzrost < 20% w stosunku do obecnego
- **Test coverage** - > 80% coverage dla nowych komponentów
- **Accessibility** - WCAG 2.1 AA compliance

---

## 11. RYZYKA I MITIGACJA

### 11.1 Ryzyka

| Ryzyko                                  | Prawdopodobieństwo | Wpływ  | Mitigacja                               |
| --------------------------------------- | ------------------ | ------ | --------------------------------------- |
| Utrata funkcjonalności podczas migracji | Średnie            | Wysoki | Dokładne testy, backward compatibility  |
| Opór użytkowników wobec zmian           | Średnie            | Średni | Komunikacja, szkolenia, gradual rollout |
| Wydłużenie czasu implementacji          | Wysokie            | Średni | Realistyczne szacunki, priorytetyzacja  |
| Problemy z performance                  | Niskie             | Średni | Code splitting, lazy loading            |

### 11.2 Plan Rollout

1. **Beta testing** - 2 tygodnie z wybranymi użytkownikami
2. **Gradual rollout** - 25% → 50% → 100% użytkowników
3. **Feedback loop** - zbieranie feedbacku na każdym etapie
4. **Quick fixes** - szybka reakcja na problemy

---

## 12. DALSZE KROKI

### 12.1 Po Implementacji

1. **User feedback** - zbieranie feedbacku od użytkowników
2. **Analytics** - analiza użycia nowego menu
3. **Iteracje** - ciągłe ulepszanie na podstawie danych
4. **Dokumentacja** - aktualizacja dokumentacji użytkownika

### 12.2 Przyszłe Rozszerzenia

- **Keyboard shortcuts** - skróty klawiszowe dla szybkiej nawigacji
- **Customizable dashboard** - możliwość personalizacji widoku
- **Recent items** - szybki dostęp do ostatnio używanych funkcji
- **Search** - globalne wyszukiwanie w całym module AI Platform

---

## 13. PODSUMOWANIE

Nowa struktura menu AI Platform:

✅ **6 głównych zakładek** zamiast 13 (lepsza nawigacja)  
✅ **Logiczne grupowanie** funkcjonalności  
✅ **Skalowalna** - łatwe dodawanie nowych funkcji  
✅ **Spójna** - jednolity design i UX  
✅ **Gotowa na rozwój** - miejsce na nowe funkcjonalności enterprise

**Szacowany czas implementacji:** 15-17 tygodni (3.5-4 miesiące)  
**Priorytet:** HIGH  
**Status:** Gotowy do implementacji

---

**Dokument przygotowany:** 2026-01-02  
**Wersja:** 1.0  
**Status:** Final - Ready for Implementation
