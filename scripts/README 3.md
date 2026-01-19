# Production Scripts

This directory contains production-ready utility scripts for the Consultify platform.

---

## Scripts

### Testing & Quality

- **check-coverage.ts** - Validate test coverage meets minimum thresholds (96%)
- **test-metrics-collector.ts** - Collect and aggregate test execution metrics
- **test-shard.sh** - Parallelize test suite execution for CI/CD
- **check-performance-budget.js** - Monitor and enforce performance budgets

### Internationalization (i18n)

- **i18n/** - Internationalization tooling
  - `i18n-config.json` - Language configuration (6 languages)
  - `translate-help.ts` - Help system translation automation
  - `translation-cache.json` - Translation cache for performance

### Security

- **check-secrets.js** - Scan codebase for accidentally committed secrets

---

## Usage

These scripts are integrated into the development workflow and CI/CD pipeline:

```bash
# Check test coverage
npm run check:coverage

# Run tests with sharding
./scripts/test-shard.sh

# Generate i18n translations
npm run i18n:translate
```

---

## Custom Development Tools

Personal development utilities and experimental scripts have been moved to:
**`/Piotr_Tools/`**

These are excluded from audit scope and not required for production operations.

---

**Last Updated**: January 11, 2026  
**Maintained By**: Engineering Team
