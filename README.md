<div align="center">

# IRIS 6.0

### Industrial Excellence & Digital Transformation Platform

[![VC Technical Due Diligence Ready](https://img.shields.io/badge/VC%20DD-Ready-brightgreen)](docs/due-diligence/TECH_DD_CHECKLIST.md)
[![Test Coverage](https://img.shields.io/badge/Coverage-98%25-brightgreen)](docs/metrics/QUALITY_METRICS.md)
[![Test Pass Rate](https://img.shields.io/badge/Tests-100%25%20Pass-brightgreen)](docs/metrics/QUALITY_METRICS.md)

</div>

**IRIS 6.0** (Industrial Resource & Intelligence System) is an enterprise-grade SaaS platform combining AI intelligence with proven industrial methodologies (SIRI, ADMA, Lean 4.0, CMMI) to guide organizations through digital transformation—from initial assessment to full-scale Industry 4.0 rollout.

## 📚 Documentation - Enterprise Edition

> **✅ VC Technical Due Diligence Ready**  
> **98% Test Coverage | 100% Pass Rate | 19 Industrial Modules**

**Complete Documentation**: [docs/README.md](docs/README.md)

### Quick Links for Investors & VCs

| Document | Description |
|----------|-------------|
| **[Executive Summary](docs/executive/EXECUTIVE_SUMMARY.md)** | 2-page technical overview |
| **[Tech DD Checklist](docs/due-diligence/TECH_DD_CHECKLIST.md)** | Pre-answered common questions |
| **[Quality Metrics](docs/metrics/QUALITY_METRICS.md)** | 98% coverage, 100% pass rate |
| **[Compliance Matrix](docs/security-compliance/COMPLIANCE_MATRIX.md)** | GDPR/SOC2/ISO27001 status |

### Technical Documentation (9-Pillar Enterprise Structure)

1. **[Executive](docs/executive/)** - Technical overview, metrics, roadmap
2. **[Architecture](docs/architecture/)** - System, infrastructure, security, API design
3. **[Product](docs/product/)** - Features, specifications, 19 industrial modules
4. **[Engineering](docs/engineering/)** - Standards, tech stack, CI/CD
5. **[Operations](docs/operations/)** - **SLA/SLO** (99.9%), runbooks, DR
6. **[Security & Compliance](docs/security-compliance/)** - **GDPR/SOC2**, policies, audits
7. **[Organization](docs/organization/)** - Team, **IP assignments**, onboarding
8. **[Metrics](docs/metrics/)** - KPIs, performance, quality
9. **[Due Diligence](docs/due-diligence/)** - DD checklist, OSS licenses, IP docs

### Platform Status

| Metric          | Status                       |
| --------------- | ---------------------------- |
| Test Coverage   | ✅ 98.2%                     |
| Test Pass Rate  | ✅ 100%                      |
| Industrial Modules | ✅ 19/19 Certified        |
| TypeScript Migration | ✅ 100% Backend         |
| GDPR Compliance | 🟡 Ready for cert (Q2 2026)  |
| SOC 2 Type I    | 🟡 Audit scheduled (Q1 2026) |
| Uptime SLA      | 🟡 99.9% target              |

## 🚀 Quick Start (Development)

### Option 1: Using Startup Script (Recommended)

```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Configure Environment**:
    Create `.env.local` file (see [docs/development/DEVELOPMENT.md](docs/development/DEVELOPMENT.md) for detailed instructions).
    Minimum required: `GEMINI_API_KEY` (or other LLM provider key).
3.  **Run Application**:
    ```bash
    npm run dev
    ```

**📖 For complete documentation, see [docs/README.md](docs/README.md)**

## 🧪 Running Tests

```bash
# Full test suite
npm run test:all

# Unit tests only  
npm run test:unit

# Integration tests
npm run test:integration
```

## 🏭 Industrial Modules

IRIS 6.0 provides 19 fully-certified industrial modules:

| Category | Modules |
|----------|---------|
| **Production** | MES, APS, MRP |
| **Logistics** | WMS |
| **Quality** | QMS, CMMS |
| **Safety & ESG** | HSE, ESG |
| **Digital** | IoT, GEMBA, Digital Twin, DATA_AI |
| **Workforce** | HRM, LMS, SKILLS |
| **Business** | PARTNER, ADMIN, SETTINGS, KPI |

## 🔧 Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + TypeScript (100% ES Modules)
- **Database**: SQLite (dev) / PostgreSQL (production)
- **Caching**: Redis (distributed caching)
- **AI**: Multi-provider (Gemini, OpenAI, Claude)
- **Infrastructure**: Docker-ready, cloud-agnostic

---

_IRIS 6.0 - Powered by DBR77 Industrial Excellence Methodology_
