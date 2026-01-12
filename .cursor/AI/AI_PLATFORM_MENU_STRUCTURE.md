# AI Platform Menu Structure - Visual Reference

## Quick Reference Guide

**Wersja:** 1.0  
**Data:** 2026-01-02

---

## Struktura Menu - Wizualizacja

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI PLATFORM MODULE                            │
│  LLM configuration, prompts, experiments, intelligence, and     │
│                      monitoring                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [Configuration] [Development] [Operations] [Analytics]         │
│  [Security] [Knowledge]                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. CONFIGURATION (⚙️)

```
Configuration
├── LLM Providers
│   ├── Provider List
│   ├── Add/Edit Provider
│   ├── Test Connection
│   ├── API Keys Management
│   ├── Rate Limits
│   ├── Region Selection
│   └── Health Status
│
├── Model Tiers
│   ├── Tier Configuration
│   ├── Model-to-Tier Mapping
│   ├── Tier Routing Rules
│   ├── Auto-Downgrade Policies
│   └── Tier Usage Stats
│
├── Routing Rules
│   ├── Intelligent Routing Config
│   ├── Provider Selection Rules
│   ├── Fallback Chains
│   ├── Geographic Routing
│   └── Load Balancing
│
└── Global Settings
    ├── Rate Limits
    ├── Privacy Settings
    ├── Resilience Settings
    ├── Compliance Settings
    └── Feature Flags
```

**Ikony:** Settings, Cpu, Layers, Route  
**Kolor:** Blue (#3B82F6)

---

## 2. DEVELOPMENT (🔧)

```
Development
├── Prompts Library
│   ├── Prompt List (System, Role, Phase, User)
│   ├── Search & Filter
│   ├── Categories & Tags
│   ├── Prompt Templates
│   ├── Public vs Private
│   ├── Prompt Sharing
│   └── Ratings & Reviews
│
├── Prompt Builder
│   ├── Rich Text Editor
│   ├── Prompt Versioning
│   ├── Prompt Diff
│   ├── Test Bench
│   ├── Performance Metrics
│   ├── Rollback
│   └── Block Builder
│
├── Experiments (A/B Testing)
│   ├── Experiment List
│   ├── Create Experiment
│   ├── Prompt A/B Testing
│   ├── Model Comparison
│   ├── Parameter Tuning
│   ├── Statistical Analysis
│   └── Results Visualization
│
└── Model Registry
    ├── Model List (Versioned)
    ├── Model Metadata
    ├── Performance Tracking
    ├── Model Evaluation
    ├── Model Comparison
    ├── Fine-Tuning Jobs
    └── Custom Model Upload
```

**Ikony:** Code, FileText, Edit, FlaskConical, Database  
**Kolor:** Purple (#8B5CF6)

---

## 3. OPERATIONS (🚀)

```
Operations
├── Mission Control
│   ├── System Status Overview
│   ├── Success Rate (Last 50)
│   ├── Avg Latency
│   ├── Active Providers
│   └── Capability Diagnostics
│       ├── AI Connection (Basic)
│       ├── AI Eyes (Visual Context)
│       ├── AI Memory (RAG)
│       ├── AI Hands (MCP Tools)
│       └── MAX Mode (Reasoning)
│
├── Health Monitoring
│   ├── Provider Health Status
│   ├── Health Alerts
│   ├── Response Times
│   ├── Error Analysis
│   ├── Health History
│   └── Auto-Recovery Status
│
├── Performance Dashboard
│   ├── Response Time Metrics (p50, p95, p99)
│   ├── Success Rate Trends
│   ├── Cache Hit Rate
│   ├── Token Usage Trends
│   ├── Performance by Capability
│   ├── Performance by Model
│   └── System Health Indicators
│
└── SLA Management
    ├── SLA Targets
    ├── Current SLA Status
    ├── SLA Breach Detection
    ├── Breach History
    ├── Uptime History
    └── Request Statistics
```

**Ikony:** Activity, Radar, HeartPulse, Shield  
**Kolor:** Green (#10B981)

---

## 4. ANALYTICS (📊)

```
Analytics
├── Usage Analytics
│   ├── Usage Trends
│   ├── Usage by Capability
│   ├── Usage by User/Team/Org
│   ├── Usage by Model
│   ├── Daily/Weekly/Monthly Trends
│   ├── Usage Forecasting
│   └── Adoption Metrics
│
├── Cost Analytics
│   ├── Cost Trends
│   ├── Cost by Capability
│   ├── Cost by Model
│   ├── Cost by Org/Project/User
│   ├── Budget vs Actual
│   ├── Cost Forecasting
│   ├── Cost Optimization Recommendations
│   └── Cost Allocation Reports
│
├── Performance Metrics
│   ├── Performance Trends
│   ├── Performance by Capability
│   ├── Performance by Model
│   ├── Model Comparison
│   ├── Anomaly Detection
│   └── Optimization Suggestions
│
└── Custom Reports
    ├── Report Builder
    ├── Report Templates
    ├── Scheduled Reports
    ├── Report Sharing
    └── Report Export
```

**Ikony:** BarChart2, TrendingUp, DollarSign, Gauge, FileBarChart  
**Kolor:** Orange (#F59E0B)

---

## 5. SECURITY (🔒)

```
Security
├── API Keys
│   ├── API Key List
│   ├── Create API Key
│   ├── Key Rotation
│   ├── Expiration Management
│   ├── Usage Tracking
│   ├── Revocation History
│   ├── IP Whitelisting
│   └── Rate Limits per Key
│
├── Access Control
│   ├── Role-Based Access Control (RBAC)
│   ├── Fine-Grained Permissions
│   ├── Custom Roles
│   ├── Permission Grants
│   ├── Permission Inheritance
│   ├── Access Audit Trail
│   └── Access Requests & Approvals
│
├── Audit Logs
│   ├── Comprehensive Audit Logs
│   ├── Filtering & Search
│   ├── Audit Log Export
│   ├── Tamper-Evident Hash Chain
│   ├── Request/Response Logging
│   ├── Admin Action Tracking
│   └── Data Access Logs
│
└── Compliance
    ├── SOC 2 Type II Dashboard
    ├── ISO 27001 Status
    ├── GDPR Compliance
    ├── Data Retention Policies
    ├── Compliance Reports
    ├── Compliance Checks
    └── Legal Hold Management
```

**Ikony:** Shield, Key, Lock, FileSearch, ShieldCheck  
**Kolor:** Red (#EF4444)

---

## 6. KNOWLEDGE (📚)

```
Knowledge
├── Knowledge Base
│   ├── Idea Inbox
│   │   ├── Pending Ideas
│   │   ├── Approved Ideas
│   │   ├── Rejected Ideas
│   │   └── Implemented Ideas
│   ├── Idea Management
│   ├── Categories & Tags
│   ├── Search & Filter
│   └── Approved Ideas Library
│
├── Documents (RAG)
│   ├── Upload Documents
│   ├── Document Indexing
│   ├── Indexed Documents List
│   ├── Categories & Tags
│   ├── Document Search
│   ├── Document Versioning
│   └── Vector Store Management
│
└── Strategic Directions
    ├── Strategic Directions List
    ├── Create/Edit Direction
    ├── Progress Tracking
    ├── Related Knowledge Linking
    └── Direction Analytics
```

**Ikony:** BookOpen, Brain, FileText, Target  
**Kolor:** Indigo (#6366F1)

---

## Mapowanie Funkcjonalności

### Obecne → Nowe

| Obecna Zakładka | Nowa Zakładka | Sub-tab |
|----------------|---------------|---------|
| LLM Config | Configuration | LLM Providers |
| Tier Assignments | Configuration | Model Tiers |
| Settings | Configuration | Global Settings |
| Intelligence | Development | Prompt Builder |
| Prompts Admin | Development | Prompts Library |
| Experiments | Development | Experiments |
| Mission Control | Operations | Mission Control |
| Performance | Operations | Performance Dashboard |
| Knowledge | Knowledge | Knowledge Base |
| Costs | Analytics | Cost Analytics |
| Health | Operations | Health Monitoring |
| SLA | Operations | SLA Management |
| Analytics | Analytics | Usage Analytics |

---

## Ikony i Kolory

### Configuration
- **Ikona główna:** Settings / Cpu
- **Kolor:** Blue (#3B82F6)
- **Ikony sub-tabs:** Cpu, Layers, Route, Settings

### Development
- **Ikona główna:** Code / FlaskConical
- **Kolor:** Purple (#8B5CF6)
- **Ikony sub-tabs:** FileText, Edit, FlaskConical, Database

### Operations
- **Ikona główna:** Activity / Radar
- **Kolor:** Green (#10B981)
- **Ikony sub-tabs:** Radar, HeartPulse, Activity, Shield

### Analytics
- **Ikona główna:** BarChart2 / TrendingUp
- **Kolor:** Orange (#F59E0B)
- **Ikony sub-tabs:** TrendingUp, DollarSign, Gauge, FileBarChart

### Security
- **Ikona główna:** Shield / Lock
- **Kolor:** Red (#EF4444)
- **Ikony sub-tabs:** Key, Lock, FileSearch, ShieldCheck

### Knowledge
- **Ikona główna:** BookOpen / Brain
- **Kolor:** Indigo (#6366F1)
- **Ikony sub-tabs:** Brain, FileText, Target

---

## Przykładowa Nawigacja

### Scenariusz 1: Konfiguracja nowego providera
1. Kliknij **Configuration** (główna zakładka)
2. Kliknij **LLM Providers** (sub-tab)
3. Kliknij **+ Add Provider**
4. Wypełnij formularz i zapisz

**Liczba kliknięć:** 3

### Scenariusz 2: Sprawdzenie kosztów
1. Kliknij **Analytics** (główna zakładka)
2. Kliknij **Cost Analytics** (sub-tab)
3. Wybierz okres i filtry

**Liczba kliknięć:** 2 (+ filtry)

### Scenariusz 3: Utworzenie eksperymentu A/B
1. Kliknij **Development** (główna zakładka)
2. Kliknij **Experiments** (sub-tab)
3. Kliknij **+ New Experiment**
4. Wypełnij formularz i uruchom

**Liczba kliknięć:** 3

---

## Responsive Design

### Desktop (> 1024px)
- Główne zakładki: poziomy pasek na górze
- Sub-tabs: poziomy pasek pod głównymi zakładkami
- Zawartość: pełna szerokość

### Tablet (768px - 1024px)
- Główne zakładki: poziomy pasek z możliwością scrollowania
- Sub-tabs: poziomy pasek z możliwością scrollowania
- Zawartość: pełna szerokość

### Mobile (< 768px)
- Główne zakładki: dropdown menu
- Sub-tabs: dropdown menu lub accordion
- Zawartość: pełna szerokość

---

## Accessibility

- **Keyboard navigation:** Tab, Enter, Arrow keys
- **Screen reader:** ARIA labels dla wszystkich elementów
- **Focus indicators:** Widoczne focus states
- **Color contrast:** WCAG 2.1 AA compliance
- **Skip links:** Szybki dostęp do głównej zawartości

---

**Dokument przygotowany:** 2026-01-02  
**Wersja:** 1.0
