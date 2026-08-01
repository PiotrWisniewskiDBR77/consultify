# Consultinity — dokumentacja

> Aktualny punkt wejścia: [`ssot/README.md`](ssot/README.md).
>
> Ten rozbudowany indeks zawiera również materiały historyczne. Dawne
> deklaracje gotowości, pokrycia testami i liczby testów nie są traktowane jako
> aktualny dowód bez ponownego wykonania bramki na wskazanym commicie.

---

## Documentation Authority

- `docs/ssot/README.md` is the complete, curated application knowledge entrypoint.
- `docs/SOURCE_OF_TRUTH.md` is the single entrypoint that explains which
  authority answers each kind of question across the application.
- `docs/FUNCTIONAL_DOCUMENTATION.md` is the canonical functional navigation,
  ordered exactly like the user-visible application menu.
- `docs/product/DOCUMENTATION_REGISTRY.md` is the canonical registry for product behavior and readiness packages.
- `docs/ui-standards/README.md` and `docs/ui-standards/FROZEN_LAYOUTS.md` are the canonical UI/UX authority.
- `docs/strategy/README.md` is the canonical strategy index.
- `docs/plans/README.md` explains working and historical plan material.
- `docs/cleanup/README.md` is the canonical repository hygiene and cleanup index.

Historical parallel trees are preserved, but they are not the default source of truth:

- `wdrozenia/` = tracked implementation history
- `Consulitinity przegląd/` = tracked audit evidence

---

## �� Executive Navigation (For Investors & Leadership)

### Quick Start for VC Due Diligence

1. **[Executive Summary](executive/EXECUTIVE_SUMMARY.md)** - 2-page technical overview
2. **[Tech DD Checklist](due-diligence/TECH_DD_CHECKLIST.md)** - Pre-answered common DD questions
3. **[Quality Metrics](metrics/QUALITY_METRICS.md)** - 96% coverage, 100% pass rate
4. **[Compliance Matrix](security-compliance/COMPLIANCE_MATRIX.md)** - GDPR/SOC2 status

### Executive Documentation

- [Executive Summary](executive/EXECUTIVE_SUMMARY.md) - Platform overview & differentiation
- [Technical Metrics Dashboard](metrics/QUALITY_METRICS.md) - KPIs & quality metrics
- [Compliance Status](security-compliance/COMPLIANCE_MATRIX.md) - GDPR, SOC2, ISO27001

---

## ��️ Technical Architecture

### Core Architecture

- [System Architecture](architecture/SYSTEM_ARCHITECTURE.md) - High-level design & components
- [Service Architecture](architecture/SERVICE_ARCHITECTURE.md) - Service decomposition & boundaries
- [Infrastructure](architecture/INFRASTRUCTURE.md) - Cloud architecture & scalability
- [Architecture Map](architecture/ARCHITECTURE_MAP.md) - Map of major subsystems
- [Architecture Notes](architecture/ARCHITECTURE.md) - Additional architecture notes
- [**MyWork Architecture**](architecture/MYWORK_ARCHITECTURE.md) - MyWork module: components, API, AI, DB
- [Partner Payout Integration](architecture/PARTNER_PAYOUT_INTEGRATION.md) - Stripe/partner payouts integration

---

## 📦 Product & Features

- [Product Overview](product/) - Product specifications & modules
- [Feature Catalog](product/modules/) - Complete feature inventory
  - [Admin Module](product/modules/admin/) - Enterprise management
  - [AI Module](product/modules/ai/) - AI consulting engine
  - [Partner Module](product/modules/partner/) - Partner ecosystem
  - [Revenue Module](product/modules/revenue/) - Billing & payments
  - [Analytics Module](product/modules/analytics/) - Metrics & reporting
  - [Content Module](product/modules/content/) - Content management

### My Work Module (Personal Hub)

- [**My Work Specification**](MYWORK_MODULE_SPECIFICATION.md) - Canonical spec (8 tabs, 120+ components, 60+ endpoints)
- [My Work Architecture](architecture/MYWORK_ARCHITECTURE.md) - Component tree, API reference, AI services, DB schema
- [My Work Dashboard Flow](flows/core/MYWORK_DASHBOARD_FLOW.md) - User flow diagrams & tab architecture
- [Living Notebook Module](modules/LIVING_NOTEBOOK_MODULE.md) - Notebook product vision

### MVP v3 — Operating Model (SSOT)

- [Operating Model v3](product/OPERATING_MODEL_V3.md) - Kanoniczny model pracy klienta: moduły, role visibility, output packages
- [Tools Catalog v3](product/TOOLS_CATALOG_V3.md) - Katalog narzędzi v3: surfaces UI, artefakty, konwersje, biblioteki
- [Requirements v3 (SSOT)](product/REQUIREMENTS_V3_SSOT.md) - Jedna checklista wymagań produktu + UI/UX (punkt wyjścia do backlogu)
- [Interview Form Engine v3 (SSOT)](product/INTERVIEW_FORM_ENGINE_V3.md) - Templates + runtime + assignments + approval + attachments (premium “one question per screen”)
- [Notebook v3 (SSOT)](product/NOTEBOOK_V3.md) - Notebook jako kontekst systemu: embedded refs, used-in, create-from-note, AI/research/voice
- [Link Graph v3 (SSOT)](product/LINK_GRAPH_V3.md) - Kontrakt embedded references + platform-wide backlinks (“Used in”)
- [Workspace v3 (SSOT)](product/TOOLS_CATALOG_V3.md) - Definicja Workspace jako multi-mode visual engine (sekcja 3.2 “WORKSPACE v3 — SSOT”)
- [Financial Analysis v3](product/FINANCIAL_ANALYSIS_V3.md) - 5 zakładek + artefakty + integracje (model/analysis/forecast/valuation/capex)
- [Reports & Presentations v3](product/PRESENTATIONS_AND_REPORTS_V3.md) - Biblioteki + generatory (Gamma-like UX), traceability, export
- [**Report Generator v3 (SSOT)**](product/REPORT_GENERATOR_V3.md) - Kanoniczne raporty R1–R4, wizard/builder, AI narrative, quality gate, eksport (PDF/DOCX/PPTX)
- [**Presentation Generator v3 (SSOT)**](product/PRESENTATION_GENERATOR_V3.md) - Kompletny flow: Wizard, Deck Builder, AI Agent, ContextPack, templates, media library, learning, animations, eksport (PDF/PPTX/PNG)
- [Meeting tool v3](product/MEETING_TOOL_V3.md) - Narzędzie “Meeting” jako event + agenda + decyzje + follow-ups (planned)

### AI Module — Technical Specs (SSOT)

- [Deep Thinking Module](modules/ai/DEEP_THINKING_MODULE.md)
- [Agent Audit Layer (Post-DT)](modules/ai/AGENT_AUDIT_LAYER.md)

---

## ⚙️ Engineering Standards

- [Quick Start](engineering/QUICK_START.md) - Fast setup guide
- [Development Guide](engineering/DEVELOPMENT.md) - Local development and environment
- [Development Workflow](engineering/DEVELOPMENT_WORKFLOW.md) - Branching/review/release workflow
- [LLM Provider Setup](engineering/LLM_PROVIDER_SETUP.md) - AI provider configuration
- [Branch Protection Setup](engineering/BRANCH_PROTECTION_SETUP.md) - GitHub branch protection
- [TypeScript Migration Guide](engineering/typescript-migration-guide.md) - Backend/service migration guide
- [Migration Verification Report](engineering/migration-verification-report.md) - Current migration state
- [Build Optimization Guide](engineering/build-optimization-guide.md) - Build performance tips

---

## 🎨 UI/UX Standards

- [UI/UX Standards](ui-standards/README.md) - Kanoniczne źródło wszystkich standardów UI/UX
- [Module Hub Standard](ui-standards/03-modules/module-hub-standard.md) - Global layout patterns
- [App Table Standard](ui-standards/03-modules/app-table-standard.md) - Decisions/Report Templates table pattern
- [View Modes Standard](ui-standards/03-modules/view-modes-standard.md) - Table/Cards/Kanban/Timeline/Calendar (układ zestawień)

---

## 📄 Reports & Exports

- [Report Builder Export Standard](REPORT_BUILDER_EXPORTS_STANDARD.md) - PDF/DOCX/PPTX export baseline + quality conventions

---

## 🚀 Operations & SRE

**Critical for Enterprise:**

- [SLA/SLO](operations/SLA_SLO.md) - **99.9% uptime target** ⭐
- [Staging and Production Operating Model](operations/STAGING_PRODUCTION_OPERATING_MODEL.md) - Canonical branch and release policy
- [Deployment Guide](operations/DEPLOYMENT_GUIDE.md) - Legacy deployment notes and historical examples
- [Local to Staging Runbook](operations/LOCAL_TO_STAGING_RUNBOOK.md) - Safe local work against staging
- [Staging to Production Runbook](operations/STAGING_TO_PRODUCTION_RUNBOOK.md) - Release promotion flow
- [Production Deployment Checklist](operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md) - Go-live checklist
- [Monitoring Dashboard](operations/MONITORING_DASHBOARD.md) - Monitoring & observability entry point
- [Incident Response Playbook](operations/INCIDENT_RESPONSE_PLAYBOOK.md) - Incident response
- [Disaster Recovery](operations/DISASTER_RECOVERY.md) - DR & BCP
- [Load Testing Guide](operations/LOAD_TESTING_GUIDE.md) - Load/perf testing procedures

---

## 🔒 Security & Compliance

**VC DD Critical:**

- [Compliance Matrix](security-compliance/COMPLIANCE_MATRIX.md) - **GDPR/SOC2/ISO27001** ⭐
- [GDPR Compliance Guide](security-compliance/GDPR_COMPLIANCE_GUIDE.md) - Article-by-article mapping
- [SOC2 Implementation Guide](security-compliance/SOC2_IMPLEMENTATION_GUIDE.md) - Control design (TSC)
- [DPIA - AI Processing](security-compliance/DPIA_AI_PROCESSING.md) - AI privacy assessment
- [Encryption Configuration](security-compliance/ENCRYPTION_CONFIGURATION.md) - Crypto & key handling
- [RBAC Audit Report](security-compliance/RBAC_AUDIT_REPORT.md) - RBAC coverage
- [Security Runbooks](security-compliance/SECURITY_RUNBOOKS.md) - Operational security procedures
- [Security Module Audit](security-compliance/SECURITY_MODULE_AUDIT.md) - Module-level gaps & evidence
- [Security Mock Endpoints](security-compliance/SECURITY_MOCK_ENDPOINTS.md) - Known stubs/mocks
- [Security Verification Request](security-compliance/SECURITY_VERIFICATION_REQUEST.md) - Verification checklist

---

## 👥 Organization & Process

- [Team Structure](organization/TEAM_STRUCTURE.md) - Engineering organization
- [CIIAA Execution Guide](organization/CIIAA_EXECUTION_GUIDE.md) - **IP assignment execution** ⭐
- [DPO Job Description](organization/DPO_JOB_DESCRIPTION.md) - DPO role definition (Q1 2026)
- [Business Metrics Collection](organization/BUSINESS_METRICS_COLLECTION.md) - Metrics program & ownership

---

## 📈 Metrics & Performance

**VC DD Metrics:**

- [Quality Metrics](metrics/QUALITY_METRICS.md) - **96% coverage, 100% pass rate** ⭐
- [Business Metrics](metrics/BUSINESS_METRICS.md) - Example business metric set
- [Business Metrics Example](metrics/BUSINESS_METRICS_EXAMPLE.md) - Worked examples

---

## 📋 Due Diligence Data Room

**For VC Technical DD:**

- [DD Checklist](due-diligence/TECH_DD_CHECKLIST.md) - **Pre-answered DD questions** ⭐
- [Open Source Licenses](due-diligence/OPEN_SOURCE_LICENSES.md) - OSS inventory
- [Third-Party Services](due-diligence/THIRD_PARTY_SERVICES.md) - Vendor dependencies
- [IP Documentation](due-diligence/IP_DOCUMENTATION.md) - Intellectual property

---

## 🗺️ Quick Navigation by Role

### For Developers

1. [Quick Start](engineering/QUICK_START.md)
2. [Development Guide](engineering/DEVELOPMENT.md)
3. [Development Workflow](engineering/DEVELOPMENT_WORKFLOW.md)

### For Operations/SRE

1. [SLA/SLO](operations/SLA_SLO.md)
2. [Staging and Production Operating Model](operations/STAGING_PRODUCTION_OPERATING_MODEL.md)
3. [Production Deployment Checklist](operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md)
4. [Incident Response Playbook](operations/INCIDENT_RESPONSE_PLAYBOOK.md)

### For Security/Compliance

1. [Compliance Matrix](security-compliance/COMPLIANCE_MATRIX.md)
2. [GDPR Compliance Guide](security-compliance/GDPR_COMPLIANCE_GUIDE.md)
3. [SOC2 Implementation Guide](security-compliance/SOC2_IMPLEMENTATION_GUIDE.md)

### For Investors/VC

1. [Executive Summary](executive/EXECUTIVE_SUMMARY.md)
2. [Tech DD Checklist](due-diligence/TECH_DD_CHECKLIST.md)
3. [Quality Metrics](metrics/QUALITY_METRICS.md)
4. [Compliance Matrix](security-compliance/COMPLIANCE_MATRIX.md)

---

## 📊 Platform Status

| Metric            | Value              | Status           |
| ----------------- | ------------------ | ---------------- |
| **Test Coverage** | 96%                | ✅ Excellent     |
| **Pass Rate**     | 100% (5,826/5,826) | ✅ Perfect       |
| **TypeScript**    | 85%+               | ✅ Strong        |
| **Compliance**    | GDPR/SOC2 Ready    | 🟡 Audit Q1 2026 |
| **SLA**           | 99.9% target       | 🟡 Baseline TBD  |

---

## 🔄 Documentation Standards

- **Single Source of Truth (SSOT)**: All docs version-controlled
- **Review Cycle**: Quarterly for executive docs, as-needed for technical
- **Last Updated**: Maintained in each document
- **Ownership**: Assigned per section

---

## 📞 Contact

- **Technical DD inquiries**: engineering@company.com
- **Compliance questions**: security@company.com
- **General documentation**: docs@company.com

---

**Last Updated**: February 24, 2026
**Documentation Version**: Enterprise 1.1
**Status**: ✅ VC DD Ready
