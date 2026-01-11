# Development Tools & Workflow Guide

**Source**: Consultify production environment  
**Purpose**: Your personal playbook for next projects  
**Use This**: Every time you start a new professional project

---

## 🎯 Overview

This guide documents the **exact tools and workflow** that got Consultify to:

- ✅ 96% test coverage
- ✅ 100% test pass rate (5,826 tests)
- ✅ VC Technical Due Diligence ready
- ✅ Enterprise-grade quality

**Copy this setup to your next project!**

---

## 📚 Part 1: Documentation System

### 8-Pillar Enterprise Structure

**Why**: Investors, auditors, and team members need different views of the same system.

```
docs/
├── executive/           # For investors, leadership
│   └── EXECUTIVE_SUMMARY.md
├── architecture/        # System design
│   ├── SYSTEM_ARCHITECTURE.md
│   └── SECURITY_ARCHITECTURE.md
├── product/             # Features, modules
│   └── modules/
├── engineering/         # Dev standards
│   ├── DEVELOPMENT_STANDARDS.md
│   └── TESTING_STANDARDS.md
├── operations/          # SRE, ops
│   ├── SLA_SLO.md
│   └── INCIDENT_MANAGEMENT.md
├── security-compliance/ # GDPR, SOC 2
│   ├── GDPR_COMPLIANCE_GUIDE.md
│   └── SOC2_IMPLEMENTATION_GUIDE.md
├── organization/        # Team, IP
│   └── TEAM_STRUCTURE.md
├── metrics/             # KPIs, quality
│   └── QUALITY_METRICS.md
└── due-diligence/       # DD checklist
    ├── TECH_DD_CHECKLIST.md
    └── 100_PERCENT_DD_READINESS_PLAN.md
```

### Documentation Best Practices

**1. Always Include**:

```markdown
# Document Title

**Last Updated**: YYYY-MM-DD  
**Owner**: Role/Name  
**Status**: 🟢 Current / 🟡 In Progress / 🔴 Outdated

## Quick Links

- Related docs
- Dependencies
- Contact info
```

**2. Update Frequency**:

- Architecture docs: When architecture changes
- API docs: On every API change
- Metrics: Weekly/monthly
- Compliance: Quarterly

**3. Format**:

- Use Markdown (version-controlled)
- Add diagrams (Mermaid, draw.io)
- Link between docs
- Keep README.md as index

**Tools**:

- **Cursor AI**: Generate first draft
- **Antigravity**: Update based on code changes
- **GitHub**: Version control

---

## 🧪 Part 2: Testing System

### Test Stack

**Framework**: Vitest (fast, modern, ESM-native)

```bash
npm install -D vitest @vitest/ui
```

**Config** (`vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.config.*', '**/types/**'],
      // Enforce thresholds
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    // Run tests in parallel
    threads: true,
    // Timeout for slow tests
    testTimeout: 10000,
  },
});
```

### Test Organization

**Structure**:

```
tests/
├── unit/                # Fast, isolated
│   ├── services/
│   ├── utils/
│   └── validation/
├── integration/         # API + DB
│   ├── api/
│   ├── database/
│   └── services/
└── e2e/                 # Full user flows
    ├── auth/
    ├── dashboard/
    └── critical-flows/
```

### The 96% Coverage Strategy

**Consultify's Formula**:

1. **Real Database Tests** (not mocks)

   ```typescript
   import Database from 'better-sqlite3';

   beforeEach(() => {
     db = new Database(':memory:');
     // Run real migrations
     runMigrations(db);
   });

   test('creates user', () => {
     const user = createUser(db, { email: 'test@test.com' });
     // Real SQL query
     const fetched = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
     expect(fetched.email).toBe('test@test.com');
   });
   ```

2. **Comprehensive Coverage**
   - Unit: Business logic (80% of tests)
   - Integration: API + DB (15% of tests)
   - E2E: Critical paths (5% of tests)

3. **Test Every Layer**

   ```
   ✅ Controllers (API endpoints)
   ✅ Services (business logic)
   ✅ Database layer (queries)
   ✅ Middleware (auth, validation)
   ✅ Utilities (helpers)
   ✅ Frontend components
   ```

4. **Quality Over Quantity**
   - Test behavior, not implementation
   - Test edge cases
   - Test error handling
   - Real data scenarios

**Commands**:

```bash
npm run test              # Run all tests
npm run test:coverage     # With coverage report
npm run test:ui           # Visual UI (Vitest UI)
npm run test:watch        # Watch mode
```

### E2E Testing (Playwright)

**Setup**:

```bash
npm install -D @playwright/test
```

**Config** (`playwright.config.ts`):

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Example Test**:

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

**Run**:

```bash
npx playwright test              # Headless
npx playwright test --ui         # Interactive
npx playwright test --debug      # Debug mode
```

---

## ⚙️ Part 3: CI/CD & Quality Gates

### GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npx tsc --noEmit

      - name: Run Tests
        run: npm run test:coverage

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Build
        run: npm run build

      - name: E2E Tests
        run: npx playwright test

  # Optional: Separate job for deployment
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: echo "Deploy script here"
```

### Quality Gates (Must Pass Before Merge)

**1. Linting** (ESLint)

```bash
npm run lint
# Must have 0 errors (warnings ok)
```

**2. Type Safety** (TypeScript)

```bash
npx tsc --noEmit
# Must have 0 type errors
```

**3. Tests**

```bash
npm run test:coverage
# Must pass all tests
# Must maintain >90% coverage
```

**4. Build**

```bash
npm run build
# Must build successfully
```

**5. E2E (Critical Paths)**

```bash
npx playwright test
# Must pass critical user flows
```

### Pre-commit Hooks (Husky)

**Setup**:

```bash
npm install -D husky lint-staged
npx husky init
```

**`.husky/pre-commit`**:

```bash
#!/bin/sh
npx lint-staged
```

**`lint-staged` config** (package.json):

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

**Result**: Code is auto-formatted and linted before every commit.

---

## 🤖 Part 4: AI Assistant Configuration

### Antigravity (This AI!)

**Location**: `.agent/workflows/`

**Example Workflow** (`.agent/workflows/test-audit.md`):

````markdown
---
description: jak zapisać wyniki audytu testów automatycznych
---

# Test Audit Workflow

## Steps

1. Run test suite with coverage

```bash
npm run test:coverage
```

2. Analyze results and create report in `docs/metrics/QUALITY_METRICS.md`

3. Update metrics:
   - Test count
   - Pass rate
   - Coverage percentage
   - Failing tests (if any)

4. Commit report

```bash
git add docs/metrics/QUALITY_METRICS.md
git commit -m "docs: update test metrics"
```
````

**How to Use**:

- Create workflow files for repetitive tasks
- Reference with `/workflow-name` in chat
- AI follows exact steps

**Common Workflows**:

- `/test-audit` - Audit test results
- `/deploy` - Deployment checklist
- `/security-check` - Security review
- `/docs-update` - Update documentation

### Cursor AI

**Location**: `.cursor/` (hidden directory)

**`.cursorrules`**:

```
# Consultify Cursor Rules

## Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Prefer functional components (React)
- Use async/await over promises

## Testing
- Write tests for all new features
- Maintain >90% coverage
- Use real database in integration tests

## Documentation
- Update docs/ when adding features
- Add JSDoc for public APIs
- Keep README.md current

## Commit Messages
- feat: New feature
- fix: Bug fix
- docs: Documentation
- test: Tests
- refactor: Code refactoring
```

**Cursor Plans** (`.cursor/cursor_plans/`):

- Cursor auto-generates planning docs
- Review before implementation
- Keep for historical reference

---

## 🛠️ Part 5: Development Scripts

### Essential Scripts (package.json)

```json
{
  "scripts": {
    // Development
    "dev": "vite",
    "dev:server": "tsx watch server/src/index.ts",

    // Building
    "build": "tsc && vite build",
    "preview": "vite preview",

    // Testing
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",

    // Quality
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",

    // Database
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "npm run db:migrate && npm run db:seed",

    // Utilities
    "check:all": "npm run lint && npm run type-check && npm run test:coverage && npm run build",
    "prepare": "husky install"
  }
}
```

### Custom Utility Scripts

**scripts/check-coverage.ts**:

```typescript
// Enforce coverage thresholds
import { readFileSync } from 'fs';

const coverage = JSON.parse(readFileSync('./coverage/coverage-summary.json', 'utf-8'));
const { lines, functions, branches, statements } = coverage.total;

const thresholds = {
  lines: 90,
  functions: 90,
  branches: 85,
  statements: 90,
};

let failed = false;

Object.entries(thresholds).forEach(([key, threshold]) => {
  const actual = coverage.total[key].pct;
  if (actual < threshold) {
    console.error(`❌ ${key}: ${actual}% < ${threshold}%`);
    failed = true;
  } else {
    console.log(`✅ ${key}: ${actual}%`);
  }
});

process.exit(failed ? 1 : 0);
```

---

## 📊 Part 6: Monitoring & Metrics

### Key Metrics to Track

**Code Quality**:

```bash
# Test coverage
npm run test:coverage

# Type coverage
npx type-coverage

# Lint issues
npm run lint

# Bundle size
npm run build -- --analyze
```

**Performance**:

```bash
# Lighthouse (frontend)
npx lighthouse http://localhost:3000

# API response times
# (use APM tools: Datadog, New Relic)

# Database queries
# (use query logging + EXPLAIN)
```

**Security**:

```bash
# Dependency vulnerabilities
npm audit

# Security scanning
npm run security-check

# Secrets detection
npm run check-secrets
```

### Dashboard Template

**docs/metrics/DASHBOARD.md**:

```markdown
# Consultify Metrics Dashboard

**Last Updated**: 2026-01-11

## Quality Metrics

| Metric           | Current     | Target | Status |
| ---------------- | ----------- | ------ | ------ |
| Test Coverage    | 96%         | >90%   | ✅     |
| Tests Passing    | 5,826/5,826 | 100%   | ✅     |
| TypeScript       | 85%         | 100%   | 🟡     |
| Zero Lint Errors | ✅          | ✅     | ✅     |

## Performance

| Metric       | P95   | Target | Status |
| ------------ | ----- | ------ | ------ |
| API Response | 450ms | <500ms | ✅     |
| Page Load    | 1.2s  | <2s    | ✅     |
| TTFB         | 200ms | <300ms | ✅     |

## Security

| Item               | Status           |
| ------------------ | ---------------- |
| Dependencies Audit | ✅ No critical   |
| GDPR Compliance    | 🟡 90% (Q2 2026) |
| SOC 2 Type I       | 🟡 Q1 2026       |
```

---

## �� Part 7: Git Workflow

### Branch Strategy

```
main            # Production-ready
├── develop     # Integration branch
├── feature/*   # New features
├── fix/*       # Bug fixes
└── hotfix/*    # Emergency fixes
```

### Commit Convention

**Format**: `type(scope): message`

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `chore`: Maintenance
- `perf`: Performance improvement
- `ci`: CI/CD changes

**Examples**:

```bash
feat(auth): add OAuth login
fix(api): resolve CORS issue
docs(readme): update installation steps
test(user): add integration tests
```

### Pull Request Template

`.github/pull_request_template.md`:

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] All tests passing
- [ ] New tests added
- [ ] Manually tested

## Checklist

- [ ] Code follows style guide
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Coverage maintained/improved
```

---

## ✅ Daily Workflow Checklist

### Morning Routine

```bash
# 1. Pull latest
git pull origin develop

# 2. Install new dependencies
npm install

# 3. Run migrations
npm run db:migrate

# 4. Start dev servers
npm run dev          # Terminal 1
npm run dev:server   # Terminal 2
```

### Before Commit

```bash
# 1. Run quality checks
npm run check:all

# 2. Fix any issues
npm run lint:fix
npm run format

# 3. Commit with convention
git add .
git commit -m "feat(module): description"
```

### Before PR

```bash
# 1. Update from develop
git fetch origin
git rebase origin/develop

# 2. Full check
npm run check:all

# 3. Push
git push origin feature/my-feature

# 4. Create PR on GitHub
```

---

## 🎯 Quick Reference

### Common Commands

```bash
# Start development
npm run dev && npm run dev:server

# Run all tests
npm run test:coverage

# Quality gate
npm run check:all

# Fix formatting
npm run lint:fix && npm run format

# Build for production
npm run build

# E2E tests
npx playwright test --ui
```

### File Locations

```
Documentation:    docs/
Tests:            tests/
Scripts:          scripts/
Config:           *.config.{ts,js}
Workflows:        .agent/workflows/
Cursor Rules:     .cursor/.cursorrules
GitHub Actions:   .github/workflows/
```

### Key Files

- `package.json` - Dependencies & scripts
- `tsconfig.json` - TypeScript config
- `vitest.config.ts` - Test config
- `playwright.config.ts` - E2E config
- `.env.example` - Environment variables
- `README.md` - Project overview

---

## 💡 Pro Tips

### 1. Automate Everything

- Pre-commit hooks (lint + format)
- CI/CD (test + build + deploy)
- Documentation generation
- Dependency updates (Dependabot)

### 2. Measure Everything

- Track test coverage over time
- Monitor bundle size
- Log API performance
- Count tech debt

### 3. Document As You Go

- Update docs with code changes
- Write ADRs for big decisions
- Keep CHANGELOG.md
- Screenshots for UI changes

### 4. Test First

- TDD: Write test before code
- High-value tests first
- Real data in tests
- CI must always pass

---

## 📚 Next Steps

1. **Copy this setup** to your next project
2. **Customize** for your needs
3. **Improve** based on learnings
4. **Share** with your team

---

**This is your playbook.** Every time you start a new project, refer back to this guide. These tools and workflows got Consultify to production quality - they'll do the same for you.

Good luck! 🚀
