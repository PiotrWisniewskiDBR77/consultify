/** @vitest-environment node */
/**
 * U-45 (Wpis 92) — „kasowanie własnego szkicu" na realnym PostgreSQL.
 *
 * Defekt zmierzony na kopii stagingu: `DELETE /api/report-builder/:id` (wołany przez
 * akcję listy Materiały → Dokumenty) kasował TREŚĆ i nie dotykał rejestru listowego,
 * więc `v8_output_artifacts` + `v8_artifact_origin_links` zostawały z wierszem,
 * którego otwarcie dawało 404 — 6 takich wierszy (`origin_runtime='report'`,
 * 5 draft + 1 ready).
 *
 * Uruchamianie (tylko własny kontener stanowiska C, nigdy staging):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://postgres:qoder@127.0.0.1:6620/consultify_qoder_doc0 \
 *   npx vitest run src/services/__tests__/reportBuilderDelete.registryConsistency.pg.test.ts
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  archiveRegistryRowForDeletedContent,
  findArchivedDoc0OrphanRows,
  findIrreversibleArchivedDoc0Rows,
} from '../documentRegistryBackfillService.js';
import { deleteReport } from '../reportBuilderService.js';

const url = process.env.DATABASE_URL || '';
const realPg =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && url.startsWith('postgres');

const ORG = 'org-u45-delete-test';
const USER = 'user-u45-delete';
const REPORT = {
  deletable: 'rb-u45-deletable',
  published: 'rb-u45-published',
  unregistered: 'rb-u45-unregistered',
  rollback: 'rb-u45-rollback',
} as const;
const ARTIFACT = {
  deletable: 'art-u45-deletable',
  published: 'art-u45-published',
  rollback: 'art-u45-rollback',
} as const;

async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

async function insertTenant(db: Client): Promise<void> {
  await db.query(
    `INSERT INTO organizations (id, name) VALUES ($1, 'U45 delete test org')
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await db.query(
    `INSERT INTO users (id, email, organization_id) VALUES ($1, 'u45-delete@example.test', $2)
     ON CONFLICT (id) DO NOTHING`,
    [USER, ORG]
  );
}

async function insertReport(
  db: Client,
  params: { id: string; status: string; title: string }
): Promise<void> {
  await db.query(
    `INSERT INTO report_builder_reports
       (id, organization_id, source_type, source_id, title, report_type, status,
        created_by, created_at, updated_at)
     VALUES ($1,$2,'assessment',$1,$3,'standard',$4,$5, now(), now())`,
    [params.id, ORG, params.title, params.status, USER]
  );
  await db.query(
    `INSERT INTO report_builder_sections
       (id, report_id, section_key, section_type, title, order_index, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, 'u45-section', 'text', 'Section', 0, now(), now())`,
    [params.id]
  );
}

async function insertListRow(
  db: Client,
  params: { artifactId: string; deliveryState: string; title: string }
): Promise<void> {
  await db.query(
    `INSERT INTO v8_output_artifacts
       (artifact_id, organization_id, output_type, artifact_family, delivery_state,
        title_snapshot, created_by, created_at, last_transition_at, is_draft)
     VALUES ($1,$2,'report','document',$3,$4,$5, now()::text, now()::text, 0)`,
    [params.artifactId, ORG, params.deliveryState, params.title, USER]
  );
  await db.query(
    `INSERT INTO v8_artifact_origin_links
       (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at)
     VALUES (gen_random_uuid()::text, $1, $2, 'report', $3, 1, now()::text)`,
    [params.artifactId, ORG, params.artifactId.replace('art-', 'rb-')]
  );
}

async function cleanup(db: Client): Promise<void> {
  await db
    .query(`DROP TRIGGER IF EXISTS u45_fail_report_delete ON report_builder_reports`)
    .catch(() => undefined);
  await db.query(`DROP FUNCTION IF EXISTS u45_fail_report_delete()`).catch(() => undefined);
  await db.query(`DELETE FROM report_builder_sections WHERE report_id IN ($1,$2,$3,$4)`, [
    REPORT.deletable,
    REPORT.published,
    REPORT.unregistered,
    REPORT.rollback,
  ]);
  await db.query(`DELETE FROM report_builder_reports WHERE organization_id = $1`, [ORG]);
  await db.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id = $1`, [ORG]);
  await db.query(`DELETE FROM v8_output_artifacts WHERE organization_id = $1`, [ORG]);
  await db.query(`DELETE FROM users WHERE id = $1`, [USER]).catch(() => undefined);
  await db.query(`DELETE FROM organizations WHERE id = $1`, [ORG]).catch(() => undefined);
}

async function registryRow(db: Client, artifactId: string) {
  const res = await db.query(
    `SELECT delivery_state, origin_summary_json FROM v8_output_artifacts
      WHERE artifact_id = $1 AND organization_id = $2`,
    [artifactId, ORG]
  );
  return res.rows[0] as { delivery_state: string; origin_summary_json: string | null } | undefined;
}

describe('U-45 deleteReport (real PostgreSQL)', () => {
  beforeAll(async () => {
    if (!realPg) return;
    await withDb(async (db) => {
      await cleanup(db);
      await insertTenant(db);
      await insertReport(db, {
        id: REPORT.deletable,
        status: 'DRAFT',
        title: 'U45 deletable draft',
      });
      await insertListRow(db, {
        artifactId: ARTIFACT.deletable,
        deliveryState: 'draft',
        title: 'U45 deletable draft',
      });
      await insertReport(db, {
        id: REPORT.published,
        status: 'PUBLISHED',
        title: 'U45 published',
      });
      await insertListRow(db, {
        artifactId: ARTIFACT.published,
        deliveryState: 'ready',
        title: 'U45 published',
      });
      // Content with NO registry row — the delete must still succeed (parity with
      // the old handler) and simply have nothing to close.
      await insertReport(db, {
        id: REPORT.unregistered,
        status: 'GENERATED',
        title: 'U45 unregistered',
      });
      await insertReport(db, {
        id: REPORT.rollback,
        status: 'DRAFT',
        title: 'U45 rollback proof',
      });
      await insertListRow(db, {
        artifactId: ARTIFACT.rollback,
        deliveryState: 'ready',
        title: 'U45 rollback proof',
      });
      await db.query(
        `UPDATE v8_output_artifacts
            SET origin_summary_json = $1
          WHERE artifact_id = $2 AND organization_id = $3`,
        [JSON.stringify({ priorMarker: 'must-survive' }), ARTIFACT.rollback, ORG]
      );
    });
  });

  afterAll(async () => {
    if (!realPg) return;
    await withDb(cleanup);
  });

  it('deleting a draft removes the content AND closes the list-registry row (no orphan)', async () => {
    if (!realPg) {
      console.warn('[skip] RUN_DB_TESTS=1 MOCK_DB=false + DATABASE_URL required');
      return;
    }
    const outcome = await deleteReport(REPORT.deletable, ORG);
    expect(outcome.status).toBe('deleted');
    if (outcome.status !== 'deleted') return;
    expect(outcome.registryClosed).toBe(true);

    await withDb(async (client) => {
      const content = await client.query(`SELECT id FROM report_builder_reports WHERE id = $1`, [
        REPORT.deletable,
      ]);
      expect(content.rows).toHaveLength(0);

      const sections = await client.query(
        `SELECT id FROM report_builder_sections WHERE report_id = $1`,
        [REPORT.deletable]
      );
      expect(sections.rows).toHaveLength(0);

      const row = await registryRow(client, ARTIFACT.deletable);
      expect(row?.delivery_state).toBe('archived');
      const label = JSON.parse(row?.origin_summary_json || '{}') as {
        doc0Orphan?: unknown;
        doc0OrphanReason?: unknown;
        doc0OrphanPreviousDeliveryState?: unknown;
      };
      expect(label.doc0Orphan).toBe(true);
      expect(label.doc0OrphanReason).toBe('REPORT_CONTENT_DELETED');
      expect(label.doc0OrphanPreviousDeliveryState).toBe('draft');

      // The origin link is kept for audit, but deleted owner content is irreversible:
      // the DEC-595 restore source must exclude it and report it separately.
      const link = await client.query(
        `SELECT link_id FROM v8_artifact_origin_links WHERE artifact_id = $1`,
        [ARTIFACT.deletable]
      );
      expect(link.rows).toHaveLength(1);

      const restorable = await findArchivedDoc0OrphanRows({ organizationId: ORG });
      expect(restorable.map((r) => r.artifactId)).not.toContain(ARTIFACT.deletable);
      const irreversible = await findIrreversibleArchivedDoc0Rows({ organizationId: ORG });
      expect(irreversible.map((r) => r.artifactId)).toContain(ARTIFACT.deletable);
    });
  });

  it('rolls the orphan stamp back when DELETE fails between stamp and commit', async () => {
    if (!realPg) return;
    await withDb(async (client) => {
      await client.query(`
        CREATE OR REPLACE FUNCTION u45_fail_report_delete() RETURNS trigger AS $$
        BEGIN
          IF OLD.id = '${REPORT.rollback}' THEN
            RAISE EXCEPTION 'U45_INJECTED_DELETE_FAILURE';
          END IF;
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql
      `);
      await client.query(`
        CREATE TRIGGER u45_fail_report_delete
        BEFORE DELETE ON report_builder_reports
        FOR EACH ROW EXECUTE FUNCTION u45_fail_report_delete()
      `);
    });

    await expect(deleteReport(REPORT.rollback, ORG)).rejects.toThrow('U45_INJECTED_DELETE_FAILURE');

    await withDb(async (client) => {
      const content = await client.query(
        `SELECT id FROM report_builder_reports WHERE id = $1 AND organization_id = $2`,
        [REPORT.rollback, ORG]
      );
      expect(content.rows).toHaveLength(1);
      const sections = await client.query(
        `SELECT id FROM report_builder_sections WHERE report_id = $1`,
        [REPORT.rollback]
      );
      expect(sections.rows).toHaveLength(1);
      const row = await registryRow(client, ARTIFACT.rollback);
      expect(row?.delivery_state).toBe('ready');
      expect(JSON.parse(row?.origin_summary_json || '{}')).toEqual({
        priorMarker: 'must-survive',
      });
      await client.query(`DROP TRIGGER u45_fail_report_delete ON report_builder_reports`);
      await client.query(`DROP FUNCTION u45_fail_report_delete()`);
    });
  });

  it('refuses a non-deletable status and leaves BOTH registries untouched', async () => {
    if (!realPg) return;
    const outcome = await deleteReport(REPORT.published, ORG);
    expect(outcome).toEqual({ status: 'not_deletable', reportStatus: 'PUBLISHED' });

    await withDb(async (client) => {
      const content = await client.query(`SELECT id FROM report_builder_reports WHERE id = $1`, [
        REPORT.published,
      ]);
      expect(content.rows).toHaveLength(1);
      const row = await registryRow(client, ARTIFACT.published);
      expect(row?.delivery_state).toBe('ready');
      expect(row?.origin_summary_json ?? '').not.toContain('doc0Orphan');
    });
  });

  it('404s on an unknown id and tolerates content with no registry row', async () => {
    if (!realPg) return;
    expect(await deleteReport('rb-u45-missing', ORG)).toEqual({ status: 'not_found' });

    const outcome = await deleteReport(REPORT.unregistered, ORG);
    expect(outcome.status).toBe('deleted');
    if (outcome.status !== 'deleted') return;
    // Nothing to close — and that must NOT be reported as a closed registry row.
    expect(outcome.registryClosed).toBe(false);
  });

  it('closing an origin with no registry row is a no-op, not an error', async () => {
    if (!realPg) return;
    const result = await archiveRegistryRowForDeletedContent({
      organizationId: ORG,
      originRuntime: 'report',
      originRecordId: 'rb-u45-never-registered',
      reason: 'REPORT_CONTENT_DELETED',
    });
    expect(result).toEqual({ artifactId: null, archived: false });
  });
});
