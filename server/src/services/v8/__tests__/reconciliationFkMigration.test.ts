/**
 * ANTI-FALSE-GREEN for the reconciliation FK-violation-500 (M15/M16 split-brain).
 *
 * POST /api/v8/results/reconciliations validates `kpiId` against LEGACY
 * `initiative_kpis`, then initiateReconciliation INSERTs it into
 * `v8_kpi_finance_reconciliations.kpi_id`. But that column carried a FOREIGN KEY
 * to the ORPHAN `v8_kpi_definitions(kpi_id)` (20260323_v8_results_roi.sql:159 +
 * baseline `v8_kpi_finance_reconciliations_kpi_id_fkey`). A real (legacy) KPI id
 * has no matching v8_kpi_definitions row → Postgres 23503 foreign_key_violation
 * → HTTP 500 on every genuine demo reconciliation.
 *
 * This repo's CI test lanes run against a mocked/sqlite DB (no real FK
 * enforcement — see reconciliationOverview.test.ts, resultsROIService.test.ts),
 * so a live 23503→500 cannot be reproduced in CI. The fix is a schema migration
 * that DROPs the orphan-pointing FK. This test asserts that migration exists and
 * is correct: it is RED before the migration file is added (or if it targets the
 * wrong constraint) and GREEN after.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname_esm = dirname(fileURLToPath(import.meta.url));
// server/src/services/v8/__tests__ → server/migrations
const MIGRATION = resolve(
  __dirname_esm,
  '../../../../migrations/20260704_reconciliation_kpi_fk_to_legacy.sql'
);

describe('reconciliation FK → legacy migration (split-brain 500 fix)', () => {
  it('the drop-FK migration file exists', () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  it('drops the orphan-pointing FK idempotently', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    // Idempotent DROP of the exact constraint that pointed kpi_id at the orphan
    // v8_kpi_definitions read model.
    expect(sql).toMatch(
      /ALTER\s+TABLE\s+v8_kpi_finance_reconciliations\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+v8_kpi_finance_reconciliations_kpi_id_fkey/i
    );
  });

  it('does NOT re-introduce a FK to v8_kpi_definitions (would re-break real demo KPIs)', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    // A new REFERENCES v8_kpi_definitions would resurrect the split-brain 500.
    expect(sql).not.toMatch(/REFERENCES\s+v8_kpi_definitions/i);
  });

  it('has a filename the migration runner will pick up (^\\d{8}_.*\\.sql$)', () => {
    // DatabaseInitializer runs files matching /^(7\d{2}|\d{8})_.*\.sql$/.
    expect(/^\d{8}_.*\.sql$/.test('20260704_reconciliation_kpi_fk_to_legacy.sql')).toBe(true);
  });
});
