<div align="center">
<img width="1200" height="475" alt="Consultinity Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Consultinity

### AI-Powered Digital Transformation Platform

</div>

**Consultinity** serves as a digital executive consultant, guiding organizations through the complex journey of digital maturity—from initial assessment to full-scale rollout.

## 📚 Documentation - Enterprise Edition

> **✅ VC Technical Due Diligence Ready**  
> **96% Test Coverage | 100% Pass Rate | 5,826 Tests**

**Complete Documentation**: [docs/README.md](docs/README.md)

### Quick Links for Investors & VCs

- **[Executive Summary](docs/executive/EXECUTIVE_SUMMARY.md)** - 2-page technical overview
- **[Tech DD Checklist](docs/due-diligence/TECH_DD_CHECKLIST.md)** - Pre-answered common questions
- **[Quality Metrics](docs/metrics/QUALITY_METRICS.md)** - 96% coverage, 100% pass rate
- **[Compliance Matrix](docs/security-compliance/COMPLIANCE_MATRIX.md)** - GDPR/SOC2/ISO27001 status

### Technical Documentation (8-Pillar Enterprise Structure)

1. **[Executive](docs/executive/)** - Technical overview, metrics, roadmap
2. **[Architecture](docs/architecture/)** - System, infrastructure, security, API design
3. **[Product](docs/product/)** - Features, specifications, modules
4. **[Engineering](docs/engineering/)** - Standards, tech stack, CI/CD
5. **[Operations](docs/operations/)** - **SLA/SLO** (99.9%), runbooks, DR
6. **[Security & Compliance](docs/security-compliance/)** - **GDPR/SOC2**, policies, audits
7. **[Organization](docs/organization/)** - Team, **IP assignments**, onboarding
8. **[Metrics](docs/metrics/)** - KPIs, performance, quality
9. **[Due Diligence](docs/due-diligence/)** - DD checklist, OSS licenses, IP docs

### Platform Status

| Metric          | Status                       |
| --------------- | ---------------------------- |
| Test Coverage   | ✅ 96%                       |
| Test Pass Rate  | ✅ 100% (5,826/5,826)        |
| GDPR Compliance | 🟡 Ready for cert (Q2 2026)  |
| SOC 2 Type I    | 🟡 Audit scheduled (Q1 2026) |
| Uptime SLA      | 🟡 99.9% target              |

## 🚀 Quick Start (Development)

### Recommended: Stable Dev Mode (less lag / no backend resets)

This repo contains many macOS/iCloud duplicate files (e.g. `Foo 2.tsx`, `Bar 13.ts`) which can cause file-watch “storms”
and make `vite` + `tsx watch` feel laggy or unstable.

Run the stable mode:

```bash
npm run dev:stable
```

Diagnostics:

```bash
npm run doctor
```

Optional (safe) cleanup: move iCloud duplicates into `_quarantine/` (undoable by moving them back):

```bash
npm run cleanup:quarantine-duplicates
```

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
npm run test:all
```

## 🔧 Backend TypeScript Migration

The backend is being migrated from JavaScript (CommonJS) to TypeScript (ES Modules).

### Migration Status

- ✅ **Routes:** Fully migrated to TypeScript
- ✅ **Middleware:** Fully migrated to TypeScript
- ✅ **Database Layer:** Fully migrated to TypeScript
- ✅ **Config Layer:** Fully migrated to TypeScript
- ⚠️ **Services:** Mostly migrated (wrappers in place, full migration in progress)
- ⚠️ **Cron Jobs:** Migration in progress

### Building Backend

```bash
cd server
npm run build          # Full build
npm run build:fast     # Incremental build (faster)
npm run build:watch    # Watch mode
npm run typecheck      # Type check only
```

### Migration Documentation

- [Migration Plan](docs/typescript-migration-plan.md) - Detailed migration strategy
- [Migration Guide](docs/typescript-migration-guide.md) - How to migrate services
- [Build Optimization](docs/build-optimization-guide.md) - Build performance tips
- [Verification Report](docs/migration-verification-report.md) - Current migration status

---

## 🚢 Deployment

### Environment Configuration

1. Copy `.env.example` to `.env` and fill in values:
   ```bash
   cp .env.example .env
   ```
2. **Required variables**:
   - `JWT_SECRET` — generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
   - `GEMINI_API_KEY` or `OPENAI_API_KEY` — at least one AI provider
   - `DATABASE_URL` — for PostgreSQL production mode
3. See [.env.production.example](.env.production.example) for full production template.

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up --build
```

For PostgreSQL mode with pgvector:
```bash
docker-compose -f docker-compose.postgres.yml up -d   # Start PostgreSQL
docker-compose up --build                               # Start application
```

### Option 2: Railway

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) and [RAILWAY_SETUP.md](RAILWAY_SETUP.md) for configuration details.

Configure Railway environment variables from `.env.production.example`.

### Option 3: Manual Deployment

```bash
npm ci                  # Install dependencies
npm run build           # Build frontend + backend
cd server && npm run build  # Build backend
npm start               # Start production server
```

### Architecture

| Component  | Technology | Port |
|-----------|-----------|------|
| Frontend  | React + Vite | 3000 |
| Backend   | Node.js + Express | 3005 |
| Database  | SQLite (dev) / PostgreSQL (prod) | 5432 |
| Cache     | Redis (optional) | 6379 |

---

_For legacy documentation, see [consultinity/legacy_archive](consultinity/legacy_archive/)._
