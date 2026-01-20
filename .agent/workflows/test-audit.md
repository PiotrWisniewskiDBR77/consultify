---
description: Run standardized test audit and record results
---

# Test Audit Workflow

This workflow runs a comprehensive test audit across all 5 levels and records results in the TEST_AUDIT_REGISTRY.

## Prerequisites
- Node.js 20+ installed
- All dependencies installed (`npm ci`)

## Steps

// turbo-all

1. **Verify environment**
```bash
node --version && npm --version
```

2. **Clean up test artifacts first**
```bash
node scripts/testing/cleanup-test-artifacts.js
```

3. **Run quick audit (Unit + Component only)**
```bash
npx tsx scripts/testing/run-audit.ts --quick
```

4. **Or run full audit (all levels)**
```bash
npx tsx scripts/testing/run-audit.ts --full --report --update-registry
```

5. **View the generated report**
```bash
open test-results/audit-report.html
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `npx tsx scripts/testing/run-audit.ts --quick` | Quick audit (L1-L2 only) |
| `npx tsx scripts/testing/run-audit.ts --full` | Full audit (L1-L5) |
| `npx tsx scripts/testing/run-audit.ts --full --report` | Full audit with HTML report |
| `npx tsx scripts/testing/run-audit.ts --full --update-registry` | Full audit and update registry |

## Pass Rate Targets

| Level | Name | Target |
|-------|------|--------|
| L1 | Unit | 98%+ |
| L2 | Component | 98%+ |
| L3 | Integration | 91%+ |
| L4 | E2E | 90%+ |
| L5 | Security+Perf | 95%+ |

## After Audit

1. Review `test-results/audit-report.html` for detailed breakdown
2. Check `tests/TEST_AUDIT_REGISTRY.md` for historical trends
3. Address any failing tests before merging

## Troubleshooting

- **SQLite native binding crash**: Run with `NODE_OPTIONS=--max-old-space-size=4096`
- **Integration test failures**: Check database connection
- **E2E failures**: Ensure application is not running on port 3000
