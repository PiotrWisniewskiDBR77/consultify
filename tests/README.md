# Consultinity Automated Testing Toolkit

Kompletny zestaw narzedzi do automatycznego testowania platformy Consultinity.

## Status (stan na 2026-02-27)

**Liczba plikow testowych (wg `rg`)**
- Razem w `tests/`: **1022**
- Unit (`tests/unit`): **301**
- Component (`tests/components`): **196**
- Integration (`tests/integration`): **307**
- E2E (`tests/e2e`): **158**
- Security (`tests/security`): **10**
- Performance (`tests/performance`): **7**

**Uwaga o coverage**
Aktualne ustawienia `vitest.config.ts` licza coverage glownie dla backendu (`server/src/**`). Nie jest to globalne coverage calej aplikacji.

## Quick Start (runbook 5-10 komend)

```bash
# Szybkie uruchomienie calosci (unit + component + integration)
npm run test:all

# Unit
npm run test:unit

# Component
npm run test:component

# Integration
npm run test:integration

# E2E (tier-0 smoke)
npm run test:e2e:tier0

# Security
npm run test:security

# Performance (bez memory-leak)
npm run test:performance

# Performance z realna baza (Postgres)
npm run test:performance:real

# Memory leak (osobny, dlugi test)
MEMORY_TEST_DURATION=5 npm run test:memory-leak

# Gaty jakosci
npm run test:quality-check
npm run test:skip-scan

# Impact analysis (targeted)
npm run test:impact
```

## Struktura testow

```
tests/
├── unit/           # Unit testy
├── components/     # Testy komponentow (UI i L2)
├── integration/    # Testy integracyjne
├── e2e/            # E2E Playwright
├── security/       # Testy bezpieczenstwa
└── performance/    # Testy wydajnosci
```

Dodatkowe katalogi testow (pomocnicze) znajduja sie m.in. w:
- `tests/hooks`, `tests/views`, `tests/store`, `tests/utils`, `tests/services`

## Standardy nazewnictwa

- Nie dodajemy plikow z sufiksami `" 2"`, `" 3"` itd.
- Nie dodajemy plikow testowych bez rozszerzenia (np. `.test` bez `.ts/.js`).
- Preferowany format: `*.test.ts` / `*.spec.ts`.

## Narzedzia i gaty jakosci

- `scripts/testing/quality-check.ts` — wykrywa placeholdery i "fake" testy.
- `scripts/testing/skip-scan-gate.ts` — blokuje `.only()` i niedozwolone `.skip()`.
- `scripts/security/verify-security-integrity.ts` — gate dla krytycznych obszarow.

## Zmiany plikow i `--changed-only`

`test-runner` uzywa merge-base (domyslnie `Londyn`) do wyznaczania zmienionych plikow.
Możesz ustawic baze przez zmienna srodowiskowa:

```bash
TEST_CHANGED_BASE=develop npx tsx scripts/testing/test-runner.ts --changed-only
```

## Performance i realna baza danych

Testy performance, ktore wymagaja realnej bazy, sa automatycznie **skipowane** gdy dziala mock DB.
Aby uruchomic je w trybie realnej bazy danych, ustaw:

```bash
RUN_DB_TESTS=1 MOCK_DB=false npm run test:performance
```

Uwaga: obecny backend jest skonfigurowany pod Postgres, wiec wymaga aktywnego DB i poprawnych zmiennych srodowiskowych.

## Dodatkowa dokumentacja

- `tests/TESTING_GUIDE.md`
- `tests/TEST_AUDIT_REGISTRY.md`
- `docs/testing/`
- `docs/testing/CI_TESTING_RUNBOOK.md`
- `docs/testing/TESTING.md`
- `docs/testing/PR_PIPELINE.md`
