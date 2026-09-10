/** @vitest-environment node */

/**
 * P5 (kryterium 12, S2.7) — eksport i usunięcie danych organizacji.
 *
 * Realny PostgreSQL, nie atrapa (`server/src/database/Database.ts:686` zwraca
 * `changes:1` dla każdego UPDATE niezależnie od WHERE — testy kasowania na
 * atrapie kłamią). Bezpiecznik `assertRealPostgresTestEnvironment` wymaga
 * jawnego `RUN_DB_TESTS=1`+`MOCK_DB=false`, inaczej test PADA, nie jest
 * pomijany.
 *
 * NAJWAŻNIEJSZA ASERCJA W TYM PLIKU: usunięcie organizacji NIE MOŻE ruszyć
 * wierszy wzorcowych (`organization_id IN ('*','__system__','__global__','')`).
 * 09.09.2026 dokładnie taka operacja (inna, ale tego samego kształtu — kasowanie
 * po dopasowaniu do organizacji) skasowała `ie_governance_policies` baseline i
 * wywaliła tworzenie inicjatyw produkcyjnie (`server/tests/dane-sieroty/wzorcowe.test.ts`
 * jest bezpiecznikiem na predykat; ten plik jest bezpiecznikiem na REALNE wywołanie).
 */
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import {
  assertNotReservedOrganizationId,
  deleteOrganizationDataInTransaction,
  exportOrganizationData,
  organizationExportToCsv,
  RESERVED_ORGANIZATION_IDS,
} from '../organizationLifecycleService.js';

const NO_RETRY = { retry: 0 } as const;

describe('P5 — organizationLifecycleService (realny PostgreSQL)', NO_RETRY, () => {
  let pool: Pool;
  const orgId = `org-p5-realpg-${randomUUID()}`;
  const orgName = 'P5 RealPG Test Org';
  const userId = `user-p5-realpg-${randomUUID()}`;
  const projectId = `proj-p5-realpg-${randomUUID()}`;
  const initiativeId = `init-p5-realpg-${randomUUID()}`;
  const taskId = `task-p5-realpg-${randomUUID()}`;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL) });

    await pool.query(
      `INSERT INTO organizations (id, name, plan, status, organization_type, is_active)
       VALUES ($1, $2, 'professional', 'active', 'PAID', 1)`,
      [orgId, orgName]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES ($1, $2, $3, '$2a$10$abcdefghijklmnopqrstuv', 'Real', 'PG', 'admin', 'active')`,
      [userId, orgId, `${userId}@p5test.local`]
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, description, status)
       VALUES ($1, $2, 'Real PG project', 'seed', 'active')`,
      [projectId, orgId]
    );
    await pool.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Real PG initiative', 'DRAFT')`,
      [initiativeId, orgId]
    );
    await pool.query(
      `INSERT INTO tasks (id, organization_id, title, status) VALUES ($1, $2, 'Real PG task', 'todo')`,
      [taskId, orgId]
    );
  });

  afterAll(async () => {
    if (!pool) return;
    // Sprzątanie: jeśli test deletion padł przed zakończeniem, nie zostawiaj
    // organizacji-śmiecia w bazie współdzielonej.
    await pool.query('DELETE FROM tasks WHERE organization_id = $1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM initiatives WHERE organization_id = $1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM projects WHERE organization_id = $1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM users WHERE organization_id = $1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => undefined);
    await pool.end();
  });

  it('odmawia operowania na identyfikatorach wzorcowych', () => {
    for (const reserved of RESERVED_ORGANIZATION_IDS) {
      expect(() => assertNotReservedOrganizationId(reserved)).toThrow();
    }
    expect(() => assertNotReservedOrganizationId(orgId)).not.toThrow();
  });

  it('eksport zwraca realne dane organizacji (users/projects/initiatives/tasks), nie pustą kopertę', async () => {
    const client: PoolClient = await pool.connect();
    try {
      const result = await exportOrganizationData(client, orgId);
      expect(result.organization?.id).toBe(orgId);
      expect(result.tables.users?.some((r) => r.id === userId)).toBe(true);
      expect(result.tables.projects?.some((r) => r.id === projectId)).toBe(true);
      expect(result.tables.initiatives?.some((r) => r.id === initiativeId)).toBe(true);
      expect(result.tables.tasks?.some((r) => r.id === taskId)).toBe(true);
      expect(result.totalRows).toBeGreaterThanOrEqual(4);

      const csv = organizationExportToCsv(result);
      expect(csv).toContain('table,row_index,data_json');
      expect(csv).toContain(userId);
      expect(csv).toContain(projectId);
    } finally {
      client.release();
    }
  });

  it('usunięcie kasuje WSZYSTKIE wiersze organizacji, NIE rusza wierszy wzorcowych, i baseline produktu przechodzi po usunięciu pełny zapis', async () => {
    // Dowód "przed": baseline istnieje z wartością wzorcową '*', a nie realnym id.
    const baselinePrzed = await pool.query(
      `SELECT organization_id FROM ie_governance_policies WHERE organization_id = '*'`
    );
    expect(baselinePrzed.rowCount).toBeGreaterThan(0);

    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await deleteOrganizationDataInTransaction(client, orgId);
      await client.query('COMMIT');

      expect(result.organizationName).toBe(orgName);
      expect(result.deletedCounts.users).toBeGreaterThanOrEqual(1);
      expect(result.deletedCounts.projects).toBeGreaterThanOrEqual(1);
      expect(result.deletedCounts.initiatives).toBeGreaterThanOrEqual(1);
      expect(result.deletedCounts.tasks).toBeGreaterThanOrEqual(1);
      expect(result.deletedCounts.organizations).toBe(1);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    // Wiersze organizacji naprawdę zniknęły.
    const org = await pool.query('SELECT 1 FROM organizations WHERE id = $1', [orgId]);
    expect(org.rowCount).toBe(0);
    const users = await pool.query('SELECT 1 FROM users WHERE organization_id = $1', [orgId]);
    expect(users.rowCount).toBe(0);
    const tasks = await pool.query('SELECT 1 FROM tasks WHERE organization_id = $1', [orgId]);
    expect(tasks.rowCount).toBe(0);

    // ★ SEDNO BEZPIECZEŃSTWA: wiersz wzorcowy PRZETRWAŁ, dokładnie tak samo jak przed.
    const baselinePo = await pool.query(
      `SELECT organization_id FROM ie_governance_policies WHERE organization_id = '*'`
    );
    expect(baselinePo.rowCount).toBe(baselinePrzed.rowCount);

    // ★ Pełny przepływ zapisu PO usunięciu: nowa organizacja musi umieć założyć
    // inicjatywę — dokładnie ten przepływ, który 09.09 kończył się HTTP 500
    // "Product baseline is missing" po skasowaniu baseline'u.
    const freshOrgId = `org-p5-postdelete-${randomUUID()}`;
    const freshInitiativeId = `init-p5-postdelete-${randomUUID()}`;
    try {
      await pool.query(
        `INSERT INTO organizations (id, name, plan, status, organization_type, is_active)
         VALUES ($1, 'P5 post-delete write check', 'professional', 'active', 'PAID', 1)`,
        [freshOrgId]
      );
      await pool.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Post-delete write check', 'DRAFT')`,
        [freshInitiativeId, freshOrgId]
      );
      const check = await pool.query('SELECT id FROM initiatives WHERE id = $1', [
        freshInitiativeId,
      ]);
      expect(check.rowCount).toBe(1);
    } finally {
      await pool.query('DELETE FROM initiatives WHERE organization_id = $1', [freshOrgId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [freshOrgId]);
    }
  });

  it('odrzuca usunięcie/eksport wartości wzorcowej zamiast próbować dopasować wzorcem', async () => {
    const client: PoolClient = await pool.connect();
    try {
      await expect(exportOrganizationData(client, '*')).rejects.toThrow();
      await client.query('BEGIN');
      await expect(deleteOrganizationDataInTransaction(client, '__system__')).rejects.toThrow();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
