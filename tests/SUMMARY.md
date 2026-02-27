# Podsumowanie Systemu Testow

## Status (stan na 2026-02-27)

System testow jest aktywny i uruchamialny, z rozbudowanymi poziomami L1-L5 oraz gate'ami jakosci.

**Liczba plikow testowych (wg `rg`)**
- Razem w `tests/`: **1022**
- Unit (`tests/unit`): **301**
- Component (`tests/components`): **196**
- Integration (`tests/integration`): **307**
- E2E (`tests/e2e`): **158**
- Security (`tests/security`): **10**
- Performance (`tests/performance`): **7**

**Uwaga o coverage**
Coverage jest obecnie liczony glownie dla backendu (`server/src/**`) zgodnie z `vitest.config.ts`.

## Najwazniejsze gate'y
- `npm run test:quality-check`
- `npm run test:skip-scan`
- `npx tsx scripts/security/verify-security-integrity.ts`

## Uruchamianie (skrot)

```bash
npm run test:all
npm run test:unit
npm run test:component
npm run test:integration
npm run test:e2e:tier0
npm run test:security
npm run test:performance
npm run test:performance:real
MEMORY_TEST_DURATION=5 npm run test:memory-leak
```

## Performance i realna baza danych

Testy performance wymagajace realnej bazy sa skipowane, gdy dziala mock DB.
Aby uruchomic je na prawdziwej bazie:

```bash
RUN_DB_TESTS=1 MOCK_DB=false npm run test:performance
```

## Dokumenty referencyjne
- `tests/README.md` (source of truth)
- `tests/TESTING_GUIDE.md`
- `docs/testing/`
