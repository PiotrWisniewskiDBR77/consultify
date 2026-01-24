---
description: Run complete automated test suite with reporting
---

# Complete Test Suite Workflow

This workflow runs the full IRIS 6.0 test suite with comprehensive reporting.

## Prerequisites
- Node.js 20+ installed
- All dependencies installed (`npm ci`)

## Steps

// turbo-all

1. **Verify environment**
```bash
node --version && npm --version
```

2. **Install dependencies (if needed)**
```bash
npm ci
```

3. **Run lint and type check**
```bash
npm run lint && npm run type-check
```

4. **Run unit tests with coverage**
```bash
npm run test:unit -- --coverage
```

5. **Run component tests**
```bash
npm run test:component
```

6. **Run integration tests**
```bash
npm run test:integration
```

7. **Run security scan**
```bash
npx tsx scripts/testing/security-scan.ts --quick
```

8. **Run performance tests**
```bash
npm run test:performance
```

9. **Run E2E tests** (requires application to be running)
```bash
npm run test:e2e
```

10. **Generate test report**
```bash
npx tsx scripts/testing/test-report-generator.ts
```

11. **Open report in browser**
```bash
open test-results/test-report.html
```

## Quick Commands

| Command | Description |
|---------|-------------|
| `npx tsx scripts/testing/test-runner.ts --all` | Run all tests |
| `npx tsx scripts/testing/test-runner.ts --unit --coverage` | Unit tests with coverage |
| `npx tsx scripts/testing/test-runner.ts --module=wms` | Test specific module |
| `npx tsx scripts/testing/security-scan.ts --full` | Full security scan |
| `npx tsx scripts/testing/performance-audit.ts --compare` | Compare with baseline |

## Pass Rate Targets

| Suite | Target |
|-------|--------|
| Unit | 98%+ |
| Component | 98%+ |
| Integration | 91%+ |
| E2E | 94%+ |
| Security | 100% |

## Troubleshooting

- **SQLite native binding crash**: Run with `--max-concurrency=4`
- **Memory issues**: Set `NODE_OPTIONS=--max-old-space-size=4096`
- **Flaky tests**: Check `test-results/flaky-tests.json`
