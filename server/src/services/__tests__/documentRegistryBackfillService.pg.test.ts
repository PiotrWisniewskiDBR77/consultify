/** @vitest-environment node */
/**
 * DOC-0 etap 1 (DEC-594/DEC-595) — `documentRegistryBackfillService` na realnym
 * PostgreSQL: backfill 119 treści bez wiersza listy (idempotentnie) oraz
 * odwracalne zarchiwizowanie wierszy bez treści.
 *
 * Uruchamianie (tylko własny kontener stanowiska C, nigdy staging):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://postgres:qoder@127.0.0.1:6621/consultify_qoder \
 *   npx vitest run src/services/__tests__/documentRegistryBackfillService.pg.test.ts
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  archiveContentlessDocumentRows,
  backfillUnlistedNativeArtifacts,
  findArchivedDoc0OrphanRows,
  findContentlessDocumentRows,
  findUnlistedNativeArtifacts,
  listShapeForNativeArtifactType,
  locateDocumentContent,
  restoreArchivedDocumentRows,
} from '../documentRegistryBackfillService.js';

const url = process.env.DATABASE_URL || '';
const realPg =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && url.startsWith('postgres');

const ORG = 'org-doc0-backfill-test';
const OTHER_ORG = 'org-doc0-backfill-other';

const WAVE5 = {
  sheet: 'w5-doc0-sheet',
  deck: 'w5-doc0-deck',
  report: 'w5-doc0-report',
  research: 'w5-doc0-research',
  linked: 'w5-doc0-linked',
  empty: 'w5-doc0-empty',
  otherOrg: 'w5-doc0-other-org',
} as const;

const LIST = {
  linkedArtifact: 'art-doc0-linked',
  wave5Document: 'art-doc0-wave5-document',
  canvasDocument: 'art-doc0-canvas-document',
  orphan: 'art-doc0-orphan',
  orphanArchived: 'art-doc0-orphan-archived',
} as const;

const CANVAS_DRAFT = 'wc-doc0-draft';

async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

async function insertWave5(
  db: Client,
  params: {
    artifactId: string;
    organizationId: string;
    artifactType: string;
    status: string;
    title: string;
    content: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO wave5_artifacts
       (artifact_id, organization_id, artifact_type, status, title, content, content_md, created_by, created_at, updated_at, current_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'user-doc0', now()::text, now()::text, 1)`,
    [
      params.artifactId,
      params.organizationId,
      params.artifactType,
      params.status,
      params.title,
      params.content,
      params.content || '',
    ]
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
     VALUES ($1,$2,'report','document',$3,$4,'user-doc0', now()::text, now()::text, 0)`,
    [params.artifactId, ORG, params.deliveryState, params.title]
  );
}

async function insertOriginLink(
  db: Client,
  params: { artifactId: string; originRuntime: string; originRecordId: string }
): Promise<void> {
  await db.query(
    `INSERT INTO v8_artifact_origin_links
       (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 1, now()::text)`,
    [params.artifactId, ORG, params.originRuntime, params.originRecordId]
  );
}

async function seed(db: Client): Promise<void> {
  await cleanup(db);

  await insertWave5(db, {
    artifactId: WAVE5.sheet,
    organizationId: ORG,
    artifactType: 'spreadsheet',
    status: 'draft',
    title: 'Doc0 sheet',
    content: '{"sheets":[]}',
  });
  await insertWave5(db, {
    artifactId: WAVE5.deck,
    organizationId: ORG,
    artifactType: 'slide_deck',
    status: 'draft',
    title: 'Doc0 deck',
    content: '{"slides":[]}',
  });
  await insertWave5(db, {
    artifactId: WAVE5.report,
    organizationId: ORG,
    artifactType: 'report',
    status: 'draft',
    title: 'Doc0 report',
    content: '# Doc0 report',
  });
  await insertWave5(db, {
    artifactId: WAVE5.research,
    organizationId: ORG,
    artifactType: 'research_report',
    status: 'committed',
    title: 'Doc0 research',
    content: '# Doc0 research',
  });
  await insertWave5(db, {
    artifactId: WAVE5.linked,
    organizationId: ORG,
    artifactType: 'report',
    status: 'draft',
    title: 'Doc0 already linked',
    content: '# linked',
  });
  await insertWave5(db, {
    artifactId: WAVE5.empty,
    organizationId: ORG,
    artifactType: 'report',
    status: 'draft',
    title: 'Doc0 empty content',
    content: '',
  });
  await insertWave5(db, {
    artifactId: WAVE5.otherOrg,
    organizationId: OTHER_ORG,
    artifactType: 'spreadsheet',
    status: 'draft',
    title: 'Doc0 other org',
    content: '{"sheets":[]}',
  });

  // Already-listed native artifact (must never be picked up by the backfill).
  await insertListRow(db, {
    artifactId: LIST.linkedArtifact,
    deliveryState: 'draft',
    title: 'Doc0 already linked',
  });
  await insertOriginLink(db, {
    artifactId: LIST.linkedArtifact,
    originRuntime: 'native_artifact',
    originRecordId: WAVE5.linked,
  });

  // Document whose content resolves through the shared artifact-content contract.
  await insertListRow(db, {
    artifactId: LIST.wave5Document,
    deliveryState: 'ready',
    title: 'Doc0 report',
  });
  await insertOriginLink(db, {
    artifactId: LIST.wave5Document,
    originRuntime: 'native_artifact',
    originRecordId: WAVE5.report,
  });

  // Document written by the chat canvas: origin_runtime says native_artifact but
  // the record lives in work_canvas_drafts (9 such rows on the staging copy).
  await db.query(
    `INSERT INTO work_canvas_drafts
       (id, organization_id, created_by, conversation_id, kind, title, content_json, content_md,
        save_state, lifecycle_state, dirty_state, visibility, audit_status, created_at, updated_at)
     VALUES ($1,$2,'user-doc0','conv-doc0','document','Doc0 canvas','{}','# Doc0 canvas',
             'saved','active','clean','organization','approved', now()::text, now()::text)`,
    [CANVAS_DRAFT, ORG]
  );
  await insertListRow(db, {
    artifactId: LIST.canvasDocument,
    deliveryState: 'draft',
    title: 'Doc0 canvas',
  });
  await insertOriginLink(db, {
    artifactId: LIST.canvasDocument,
    originRuntime: 'native_artifact',
    originRecordId: CANVAS_DRAFT,
  });

  // The 404 orphans: origin_runtime='report' with no report_builder_reports row.
  await insertListRow(db, {
    artifactId: LIST.orphan,
    deliveryState: 'draft',
    title: 'Doc0 orphan',
  });
  await insertOriginLink(db, {
    artifactId: LIST.orphan,
    originRuntime: 'report',
    originRecordId: 'missing-report-builder-id',
  });
  await insertListRow(db, {
    artifactId: LIST.orphanArchived,
    deliveryState: 'archived',
    title: 'Doc0 orphan archived',
  });
  await insertOriginLink(db, {
    artifactId: LIST.orphanArchived,
    originRuntime: 'report',
    originRecordId: 'missing-report-builder-id-2',
  });
}

async function cleanup(db: Client): Promise<void> {
  const orgs = [ORG, OTHER_ORG];
  await db.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id = ANY($1)`, [orgs]);
  await db.query(`DELETE FROM v8_output_artifacts WHERE organization_id = ANY($1)`, [orgs]);
  await db.query(`DELETE FROM work_canvas_drafts WHERE organization_id = ANY($1)`, [orgs]);
  await db.query(`DELETE FROM wave5_artifacts WHERE organization_id = ANY($1)`, [orgs]);
}

describe.skipIf(!realPg)('DOC-0 documentRegistryBackfillService (real PostgreSQL)', () => {
  beforeAll(async () => {
    await withDb(seed);
  });

  afterAll(async () => {
    await withDb(cleanup);
  });

  it('maps every wave5 artifact_type onto its list family', () => {
    expect(listShapeForNativeArtifactType('spreadsheet')).toEqual({
      outputType: 'sheet',
      artifactFamily: 'sheet',
    });
    expect(listShapeForNativeArtifactType('slide_deck')).toEqual({
      outputType: 'presentation',
      artifactFamily: 'presentation',
    });
    expect(listShapeForNativeArtifactType('report')).toEqual({
      outputType: 'report',
      artifactFamily: 'document',
    });
    expect(listShapeForNativeArtifactType('research_report')).toEqual({
      outputType: 'report',
      artifactFamily: 'document',
    });
    expect(listShapeForNativeArtifactType('unknown_type')).toBeNull();
  });

  it('finds only rows with content and no list row, scoped to the organization', async () => {
    const rows = await findUnlistedNativeArtifacts({ organizationId: ORG });
    expect(rows.map((row) => row.artifactId).sort()).toEqual(
      [WAVE5.deck, WAVE5.research, WAVE5.sheet].sort()
    );

    const otherOrg = await findUnlistedNativeArtifacts({ organizationId: OTHER_ORG });
    expect(otherOrg.map((row) => row.artifactId)).toEqual([WAVE5.otherOrg]);
  });

  it('dry run reports the backfill without writing a single row', async () => {
    const summary = await backfillUnlistedNativeArtifacts({ organizationId: ORG, dryRun: true });
    expect(summary).toMatchObject({ dryRun: true, scanned: 3, inserted: 3, failed: 0 });
    expect(summary.byFamily).toEqual({ sheet: 1, presentation: 1, document: 1 });

    const stillUnlisted = await findUnlistedNativeArtifacts({ organizationId: ORG });
    expect(stillUnlisted).toHaveLength(3);
  });

  it('backfills one list row per artifact with the right family, then is idempotent', async () => {
    const first = await backfillUnlistedNativeArtifacts({ organizationId: ORG });
    expect(first).toMatchObject({ dryRun: false, scanned: 3, inserted: 3, failed: 0 });
    expect(first.byFamily).toEqual({ sheet: 1, presentation: 1, document: 1 });

    const families = await withDb(async (db) => {
      const result = await db.query(
        `SELECT a.artifact_family, a.output_type, a.delivery_state, l.origin_record_id
           FROM v8_output_artifacts a
           JOIN v8_artifact_origin_links l ON l.artifact_id = a.artifact_id
          WHERE a.organization_id = $1 AND l.origin_record_id = ANY($2)
          ORDER BY l.origin_record_id`,
        [ORG, [WAVE5.sheet, WAVE5.deck, WAVE5.research]]
      );
      return result.rows;
    });
    expect(families).toHaveLength(3);
    expect(families.map((row) => `${row.origin_record_id}:${row.artifact_family}/${row.output_type}`)).toEqual(
      [
        `${WAVE5.deck}:presentation/presentation`,
        `${WAVE5.research}:document/report`,
        `${WAVE5.sheet}:sheet/sheet`,
      ].sort()
    );

    const second = await backfillUnlistedNativeArtifacts({ organizationId: ORG });
    expect(second).toMatchObject({ scanned: 0, inserted: 0, failed: 0 });

    const rowCount = await withDb(async (db) => {
      const result = await db.query(
        `SELECT count(*)::int AS n FROM v8_artifact_origin_links
          WHERE organization_id = $1 AND origin_runtime = 'native_artifact'`,
        [ORG]
      );
      return result.rows[0].n;
    });
    expect(rowCount).toBe(6);
  });

  it('locates content in the artifact contract, in the chat canvas, or nowhere', async () => {
    const viaContract = await locateDocumentContent({
      artifactId: LIST.wave5Document,
      organizationId: ORG,
      originRuntime: 'native_artifact',
      originRecordId: WAVE5.report,
    });
    expect(viaContract.registry).toBe('artifact_content');

    const viaCanvas = await locateDocumentContent({
      artifactId: LIST.canvasDocument,
      organizationId: ORG,
      originRuntime: 'native_artifact',
      originRecordId: CANVAS_DRAFT,
    });
    expect(viaCanvas.registry).toBe('work_canvas_drafts');

    const nowhere = await locateDocumentContent({
      artifactId: LIST.orphan,
      organizationId: ORG,
      originRuntime: 'report',
      originRecordId: 'missing-report-builder-id',
    });
    expect(nowhere.registry).toBeNull();
    expect(nowhere.reason).toBeTruthy();
  });

  it('lists exactly the contentless document rows', async () => {
    const rows = await findContentlessDocumentRows({ organizationId: ORG });
    expect(rows.map((row) => row.artifactId).sort()).toEqual(
      [LIST.orphan, LIST.orphanArchived].sort()
    );
  });

  it('archives contentless rows and restores the previous delivery_state', async () => {
    const dryRun = await archiveContentlessDocumentRows({ organizationId: ORG, dryRun: true });
    expect(dryRun).toMatchObject({ dryRun: true, scanned: 2, archived: 1, alreadyArchived: 1 });
    const untouched = await withDb(async (db) => {
      const result = await db.query(
        `SELECT delivery_state FROM v8_output_artifacts WHERE artifact_id = $1`,
        [LIST.orphan]
      );
      return result.rows[0].delivery_state;
    });
    expect(untouched).toBe('draft');

    const archived = await archiveContentlessDocumentRows({ organizationId: ORG });
    expect(archived).toMatchObject({ scanned: 2, archived: 1, alreadyArchived: 1 });
    expect(archived.entries).toEqual([
      {
        artifactId: LIST.orphan,
        organizationId: ORG,
        previousDeliveryState: 'draft',
        title: 'Doc0 orphan',
      },
    ]);

    const state = await withDb(async (db) => {
      const result = await db.query(
        `SELECT delivery_state, origin_summary_json FROM v8_output_artifacts WHERE artifact_id = $1`,
        [LIST.orphan]
      );
      return result.rows[0];
    });
    expect(state.delivery_state).toBe('archived');
    // DEC-595: the orphan label is stamped into the EXISTING origin_summary_json
    // column (no DDL) — this is exactly what `matchesViewFilters` keys on to hide
    // the row from the document list.
    const label = JSON.parse(state.origin_summary_json || '{}') as {
      doc0Orphan?: unknown;
      doc0OrphanReason?: unknown;
      doc0OrphanArchivedAt?: unknown;
    };
    expect(label.doc0Orphan).toBe(true);
    expect(typeof label.doc0OrphanReason).toBe('string');
    expect(label.doc0OrphanArchivedAt).toBeTruthy();

    const second = await archiveContentlessDocumentRows({ organizationId: ORG });
    expect(second).toMatchObject({ scanned: 2, archived: 0, alreadyArchived: 2 });

    const restored = await restoreArchivedDocumentRows(archived.entries);
    expect(restored).toEqual({ restored: 1, failed: 0 });
    const restoredRow = await withDb(async (db) => {
      const result = await db.query(
        `SELECT delivery_state, origin_summary_json FROM v8_output_artifacts WHERE artifact_id = $1`,
        [LIST.orphan]
      );
      return result.rows[0];
    });
    expect(restoredRow.delivery_state).toBe('draft');
    // Positive control: restore reverts delivery_state but KEEPS the label, so the
    // (archived + doc0Orphan) pair breaks and the row is listable again — while the
    // label survives as an audit trail.
    const restoredLabel = JSON.parse(restoredRow.origin_summary_json || '{}') as {
      doc0Orphan?: unknown;
    };
    expect(restoredLabel.doc0Orphan).toBe(true);
  });

  it('findArchivedDoc0OrphanRows is the DB-driven, label-scoped restore source (Wpis 87 P1)', async () => {
    // Re-archive the orphan (the previous test restored it to draft). `--restore`
    // now reads the DATABASE, not the apply log, so this is the authoritative source.
    const archived = await archiveContentlessDocumentRows({ organizationId: ORG });
    expect(archived.entries.map((entry) => entry.artifactId)).toEqual([LIST.orphan]);

    const found = await findArchivedDoc0OrphanRows({ organizationId: ORG });
    // LIST.orphanArchived is delivery_state='archived' but WITHOUT the doc0Orphan
    // label (archive skips already-archived rows) — it must NOT be picked up, so
    // `--restore` can never touch a user's own archive.
    expect(found).toEqual([
      {
        artifactId: LIST.orphan,
        organizationId: ORG,
        previousDeliveryState: 'draft',
        title: 'Doc0 orphan',
      },
    ]);

    // DB-driven restore reverts from these entries alone (no log), then leaves 0.
    const restored = await restoreArchivedDocumentRows(found);
    expect(restored).toEqual({ restored: 1, failed: 0 });
    expect(await findArchivedDoc0OrphanRows({ organizationId: ORG })).toEqual([]);
  });
});
