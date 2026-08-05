/**
 * M07 Results — golden flows na REALNYM PostgreSQL (Complete MVP acceptance 2026-08-05).
 *
 * Dlaczego realna baza, a nie mock: `NODE_ENV=test` bez `RUN_DB_TESTS=1` daje
 * CICHY mock bazy (Database.ts:81-88), a zielony mock nie dowodzi niczego o SQL,
 * indeksach i izolacji tenantów. Ten plik uruchamiać wyłącznie tak:
 *
 *   RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://…:55707/m07results \
 *     npx vitest run server/src/routes/v8/__tests__/m07-golden-flows.pg.test.ts
 *
 * Schemat w bazie jednorazowej = `pg_dump --schema-only` z DEMO (odczyt), więc
 * testujemy kształt produkcyjny, nie zrekonstruowany z migracji.
 *
 * Trwałość sprawdzamy przez ODCZYT WŁAŚCICIELA realną ścieżką czytania
 * (`getResultsKpiCatalog`), nie przez echo z funkcji zapisującej.
 */
import { randomUUID } from 'crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dbAll, dbGet } from '../../../database/db.js';
import {
  getResultsKpiCatalog,
  getResultsKpiDrawerDetail,
} from '../../../services/v8/resultsROIService.js';
import { recordKpiMeasurement } from '../../../services/results/kpiMeasurementWriterService.js';

const ORG_A = `org-a-${randomUUID().slice(0, 8)}`;
const ORG_B = `org-b-${randomUUID().slice(0, 8)}`;
const USER_A = `user-a-${randomUUID().slice(0, 8)}`;
const INIT_A = `init-a-${randomUUID().slice(0, 8)}`;
const KPI_A = `kpi-a-${randomUUID().slice(0, 8)}`;

const run = async (sql: string, params: any[] = []) => {
  const { getDatabaseAsync } = await import('../../../database/Database.js');
  const db: any = await getDatabaseAsync();
  return db.run(sql, params);
};

describe('M07 golden flows — realny PostgreSQL', () => {
  beforeAll(async () => {
    await run(`INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`, [
      ORG_A,
      'Org A (M07 test)',
    ]);
    await run(`INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`, [
      ORG_B,
      'Org B (M07 test)',
    ]);
    await run(
      `INSERT INTO users (id, email, first_name, last_name, organization_id)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [USER_A, `${USER_A}@m07.test`, 'Anna', 'Kowalska', ORG_A]
    );
    await run(
      `INSERT INTO initiatives (id, name, organization_id, status)
       VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [INIT_A, 'Automatyzacja linii pakowania', ORG_A, 'EXECUTING']
    );
    await run(
      `INSERT INTO initiative_kpis
         (id, initiative_id, organization_id, name, unit, baseline_value, target_value,
          measurement_frequency, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [KPI_A, INIT_A, ORG_A, 'OEE linii pakowania', '%', 62, 78, 'MONTHLY', USER_A]
    );
  });

  afterAll(async () => {
    // Baza jest jednorazowa (kontener m07-results-pg), ale sprzątamy jawnie —
    // dane testowe nigdy nie są twarzą produktu.
    await run(`DELETE FROM kpi_time_series WHERE organization_id IN (?, ?)`, [ORG_A, ORG_B]);
    await run(`DELETE FROM initiative_kpis WHERE organization_id IN (?, ?)`, [ORG_A, ORG_B]);
    await run(`DELETE FROM initiatives WHERE organization_id IN (?, ?)`, [ORG_A, ORG_B]);
    await run(`DELETE FROM users WHERE organization_id IN (?, ?)`, [ORG_A, ORG_B]);
    await run(`DELETE FROM organizations WHERE id IN (?, ?)`, [ORG_A, ORG_B]);
  });

  it('GF-A: baza jednorazowa to REALNY PostgreSQL, nie mock (kontrola wstępna)', async () => {
    const row = await dbGet<{ v: string }>(`SELECT version() AS v`, []);
    expect(String(row?.v || '')).toMatch(/PostgreSQL/);
    const idx = await dbAll<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'kpi_time_series'`,
      []
    );
    // Bez tego indeksu upsert w recordKpiMeasurement degraduje się do duplikatów.
    expect(idx.map((i) => i.indexname)).toContain('ux_kpi_time_series_kpi_period_source');
  });

  it('GF-3: zapis pomiaru KPI → ODCZYT WŁAŚCICIELA realną ścieżką czytania', async () => {
    const written = await recordKpiMeasurement({
      organizationId: ORG_A,
      kpiId: KPI_A,
      value: 74,
      periodStart: '2026-07-01',
      source: 'manual',
      notes: 'M07 golden flow',
      userId: USER_A,
    } as any);
    expect(written).toBeTruthy();

    // NIE ufamy echu z zapisu — czytamy tym samym serwisem, którym czyta UI.
    const catalog: any = await getResultsKpiCatalog(ORG_A, {});
    const kpi = (catalog?.kpis || []).find((k: any) => k.id === KPI_A);
    expect(kpi).toBeTruthy();
    expect(Number(kpi.latestValue)).toBe(74);
    expect(Number(kpi.targetValue)).toBe(78);
    // Świeży odczyt musi też widzieć wynik w samej tabeli pomiarów.
    const rows = await dbAll<{ value: string }>(
      `SELECT value FROM kpi_time_series WHERE kpi_id = ? AND organization_id = ?`,
      [KPI_A, ORG_A]
    );
    expect(rows).toHaveLength(1);
  });

  it('GF-3b: korekta tego samego okresu POPRAWIA wiersz, nie tworzy duplikatu', async () => {
    await recordKpiMeasurement({
      organizationId: ORG_A,
      kpiId: KPI_A,
      value: 76,
      periodStart: '2026-07-01',
      source: 'manual',
      userId: USER_A,
    } as any);

    const rows = await dbAll<{ value: string }>(
      `SELECT value FROM kpi_time_series
       WHERE kpi_id = ? AND organization_id = ? AND period_start = '2026-07-01'`,
      [KPI_A, ORG_A]
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].value)).toBe(76);

    const catalog: any = await getResultsKpiCatalog(ORG_A, {});
    const kpi = (catalog?.kpis || []).find((k: any) => k.id === KPI_A);
    expect(Number(kpi.latestValue)).toBe(76);
  });

  it('GF-T: obca organizacja NIE MOŻE zapisać pomiaru do cudzego KPI', async () => {
    await expect(
      recordKpiMeasurement({
        organizationId: ORG_B,
        kpiId: KPI_A,
        value: 999,
        periodStart: '2026-07-02',
        source: 'manual',
        userId: USER_A,
      } as any)
    ).rejects.toThrow();

    // I nic nie wyciekło do bazy pod obcą organizacją.
    const leaked = await dbAll(
      `SELECT id FROM kpi_time_series WHERE organization_id = ? OR value = 999`,
      [ORG_B]
    );
    expect(leaked).toHaveLength(0);
  });

  it('GF-T2: katalog obcej organizacji NIE zawiera cudzego KPI', async () => {
    const catalogB: any = await getResultsKpiCatalog(ORG_B, {});
    const ids = (catalogB?.kpis || []).map((k: any) => k.id);
    expect(ids).not.toContain(KPI_A);
  });

  /**
   * KONTROLA NEGATYWNA — mutujemy prawdziwy wiersz pomiaru tak, jakby został
   * przypisany do obcego tenantu. Katalog może nadal pokazać bezpieczną,
   * zdenormalizowaną wartość `initiative_kpis.current_value`, dlatego tenantową
   * granicę dowodzimy ścieżką szczegółu, która czyta same pomiary.
   */
  it('GF-NC: kontrola negatywna — odczyt szczegółu odrzuca pomiar z podmienioną organizacją', async () => {
    await run(
      `UPDATE kpi_time_series SET organization_id = ?, value = 999 WHERE kpi_id = ?`,
      [ORG_B, KPI_A]
    );

    const detail = await getResultsKpiDrawerDetail(KPI_A, ORG_A);
    expect(detail.measurements).toHaveLength(0);

    const catalog: any = await getResultsKpiCatalog(ORG_A, {});
    const kpi = (catalog?.kpis || []).find((item: any) => item.id === KPI_A);
    expect(Number(kpi?.latestValue)).toBe(76);
    expect(Number(kpi?.latestValue)).not.toBe(999);

    // Przywracamy stan, żeby kolejne przebiegi startowały czysto.
    await run(
      `UPDATE kpi_time_series SET organization_id = ?, value = 76 WHERE kpi_id = ?`,
      [ORG_A, KPI_A]
    );
    const restored = await getResultsKpiDrawerDetail(KPI_A, ORG_A);
    expect(restored.measurements).toHaveLength(1);
    expect(Number(restored.measurements[0].value)).toBe(76);
  });
});
