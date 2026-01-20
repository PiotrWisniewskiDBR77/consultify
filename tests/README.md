# IRIS 6.0 Automated Testing Toolkit

Kompletny zestaw narzędzi do automatycznego testowania platformy IRIS 6.0.

## 📊 Obecny Status

| Metryka | Wartość |
|---------|---------|
| Pliki testów | 1,096+ |
| Pass Rate (Unit) | 98.9% |
| Pass Rate (Blended) | 96.4% |
| Pokrycie | 85%+ |

## 🚀 Quick Start

```bash
# Wszystkie testy
npx tsx scripts/testing/test-runner.ts --all

# Unit testy z pokryciem
npx tsx scripts/testing/test-runner.ts --unit --coverage

# Skan bezpieczeństwa
npx tsx scripts/testing/security-scan.ts --quick

# Audyt wydajności
npx tsx scripts/testing/performance-audit.ts --baseline

# Generowanie raportu
npx tsx scripts/testing/test-report-generator.ts
```

## 🛠️ Dostępne Narzędzia

### Test Runner (`scripts/testing/test-runner.ts`)

Unified CLI do wszystkich operacji testowych:

```bash
# Wyświetl pomoc
npx tsx scripts/testing/test-runner.ts --help

# Opcje
--all, -a           Wszystkie testy
--unit, -u          Tylko unit testy
--integration, -i   Testy integracyjne
--component, -c     Testy komponentów
--e2e, -e           Testy E2E (Playwright)
--security, -s      Testy bezpieczeństwa
--performance, -p   Testy wydajności
--coverage, --cov   Generuj raport pokrycia
--watch, -w         Watch mode
--changed-only      Tylko zmienione pliki
--failed-first      Najpierw failed testy
--module=<name>     Konkretny moduł (np. --module=mes)
--shard=<n/total>   Sharding dla CI (np. --shard=1/4)
--report, -r        Generuj raport HTML
--verbose, -v       Verbose output
```

### Security Scan (`scripts/testing/security-scan.ts`)

Orkiestrator testów bezpieczeństwa:

```bash
--full, -f     Pełny skan (wszystkie testy)
--quick, -q    Szybki skan (krytyczne testy)
```

**Sprawdzane elementy:**
- SQL Injection (`tests/security/sql-injection.test.ts`)
- XSS Prevention (`tests/security/xss-prevention.test.ts`)
- CSRF Protection (`tests/security/csrf-protection.test.ts`)
- npm audit (CVE)

### Performance Audit (`scripts/testing/performance-audit.ts`)

Audyt wydajności z porównaniem baseline:

```bash
--baseline, -b    Zapisz baseline
--compare, -c     Porównaj z baseline
```

**Metryki:**
- Latency (p50, p95, p99)
- Memory (heap used/total)
- Bundle size

### Flaky Test Tracker (`scripts/testing/flaky-test-tracker.ts`)

Śledzenie niestabilnych testów:

```bash
--report, -r              Raport flaky testów
--quarantine=<test>       Kwarantanna testu
--unquarantine=<test>     Usuń z kwarantanny
```

### Report Generator (`scripts/testing/test-report-generator.ts`)

Generator raportów HTML/JSON:

```bash
--html    Tylko raport HTML
--json    Tylko raport JSON
```

## 📁 Struktura Testów

```
tests/
├── unit/           # Unit testy (442 files)
├── components/     # Testy komponentów (251 files)
├── integration/    # Testy integracyjne (180 files)
├── e2e/            # E2E Playwright (170 files)
├── security/       # Testy bezpieczeństwa
│   ├── sql-injection.test.ts
│   ├── xss-prevention.test.ts
│   └── csrf-protection.test.ts
└── performance/    # Testy wydajności
    ├── memory-leak-detector.test.ts
    ├── api-latency-baseline.test.ts
    └── bundle-size.test.ts
```

## 📋 npm Scripts

```bash
npm run test:unit           # Unit testy
npm run test:component      # Testy komponentów
npm run test:integration    # Testy integracyjne
npm run test:e2e            # E2E (Playwright)
npm run test:security       # Testy bezpieczeństwa
npm run test:performance    # Testy wydajności
npm run test:all            # Unit + Component + Integration
npm run test:complete       # Wszystko + E2E + Security
npm run test:coverage       # Z pokryciem
```

## 🔧 Konfiguracje

| Plik | Opis |
|------|------|
| `vitest.config.ts` | Główna konfiguracja Vitest |
| `vitest.security.config.ts` | Konfiguracja testów security |
| `vitest.perf.config.ts` | Konfiguracja testów wydajności |
| `playwright.config.ts` | Konfiguracja E2E |

## 🎯 Progi Jakości

| Metryka | Próg |
|---------|------|
| Coverage (global) | 85% |
| Coverage (critical) | 95% |
| Unit pass rate | 98% |
| Integration pass rate | 91% |
| E2E pass rate | 94% |
| p95 latency | <200ms |
| Bundle size | <500KB |

## 🚨 Troubleshooting

### SQLite binding crash (`napi_throw`)
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run test:integration -- --max-concurrency=4
```

### Memory issues
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Flaky testy
```bash
# Sprawdź registry
cat test-results/flaky-tests.json

# Raport
npx tsx scripts/testing/flaky-test-tracker.ts --report
```

## 📚 Więcej Informacji

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Szczegółowy przewodnik
- [TEST_AUDIT_REGISTRY.md](./TEST_AUDIT_REGISTRY.md) - Rejestr audytów
- [docs/testing/](../docs/testing/) - Dokumentacja testów
