## Automation — Finance V3

Poniżej są **sprawdzone** komendy do walidacji jakości dla finansów V3. Uruchamiaj je z root repo.

### Fast (developer loop)

```bash
npm run type-check
npx eslint src/components/Economics/FinanceHub.tsx \
  src/components/Finance/FinancialModelWorkspace.tsx \
  server/src/services/financialModelingService.ts \
  src/components/Results/ResultsKpiReportsView.tsx \
  src/components/shared/workspace/types.ts
npx vitest run --environment node tests/unit/backend/results/kpiReportSnapshotService.test.ts
npx vitest run --environment node tests/unit/backend/services/financialModelingService.computeModel.test.ts
```

### Full (quality gate)

```bash
npm run test:unit
npm run test:integration
```

### Uwaga o globalnym `npm run lint`

W tym repo `npm run lint` raportuje bardzo dużo istniejących naruszeń (nie związanych z finansami) i kończy się kodem błędu.  
Dla walidacji modułu finansowego używaj **lintowania “scoped”** (komenda w sekcji Fast) na dotkniętych plikach.

### Smoke (UI compliance)

```bash
npm run smoke:a03-ui-compliance
```

### DB-gated (staging/local Postgres)

Jeśli odpalasz testy, które realnie dotykają Postgresa, ustaw:

```bash
export RUN_DB_TESTS=1
export DB_TYPE=postgres
export DATABASE_URL="...staging railway..."
```

Uwaga: część testów w repo jest celowo DB-gated i będzie “skipped” bez `RUN_DB_TESTS=1`.

