# CI Testing Runbook

## Cel
Ten dokument opisuje aktualny podzial testow w CI, kiedy sa uruchamiane i jakie warunki musza byc spelnione, aby testy byly deterministyczne i wiarygodne.

## Srodowiska uruchomien

### Pull Request (PR)
**Cel:** szybki feedback, gate'y jakosci, stabilnosc.

Uruchamiane kroki:
- Lint + Type Check
- Test Quality (anti-placeholder)
- Skip/Only Gate
- Coverage gates L1-L3
- Unit tests (sharding)
- Component tests
- E2E Tier-0 (smoke)
- Security integrity gate

### Push / Manual
**Cel:** pelna weryfikacja i performance z realna baza.

Uruchamiane kroki:
- Wszystko z PR
- Performance tests na realnej bazie Postgres
- Security tests (pelne)
- L4 smoke (jeżeli skonfigurowane sekrety)

## Performance tests (real DB)

Performance tests uruchamiane w CI korzystaja z realnej bazy Postgres (service container). Wymagane zmienne:
- `DATABASE_URL=postgres://iris:iris_test@localhost:5432/iris_test`
- `RUN_DB_TESTS=1`
- `MOCK_DB=false`

Lokalnie:

```bash
npm run test:performance:real
```

## Memory leak test

`test:memory-leak` jest dlugim testem i NIE uruchamia sie w standardowym `test:performance`.
Uruchamiaj go recznie z kontrola czasu:

```bash
MEMORY_TEST_DURATION=5 npm run test:memory-leak
```

## Wskazowki stabilnosci
- Performance i DB throughput testy sa skipowane, gdy dziala mock DB.
- Aby uruchomic realne performance, ustaw `RUN_DB_TESTS=1`.
- E2E Tier-0 powinny byc zawsze deterministyczne.

## Pliki zrodlowe
- CI workflow: `.github/workflows/test-suite.yml`
- Test runner: `scripts/testing/test-runner.ts`
- Performance config: `vitest.perf.config.ts`
