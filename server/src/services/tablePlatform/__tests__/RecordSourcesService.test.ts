/**
 * Unit tests for RecordSourcesService (Block B · EPIC-T8 · Sprint 2).
 *
 * Coverage:
 *   - resolveRecordOrganizationId: happy path, missing record
 *   - listSourcesForRecord: filter shape, archived filter, sourceType filter, invalid type
 *   - getSource: tenant scoping
 *   - countActiveSourcesForRecord: SQL shape, integer return
 *   - createSource:
 *       * happy path (audit emit, organization_id from record)
 *       * cross-tenant attempt → RECORD_NOT_FOUND
 *       * record missing → RECORD_NOT_FOUND
 *       * cap exceeded → RECORD_SOURCES_CAP_EXCEEDED
 *       * invalid source_type
 *       * confidence_contribution out of range
 *       * audit emit failure does NOT roll back state mutation
 *   - updateSource: patch shape, no-op on empty patch, archived rejection,
 *     out-of-range confidence
 *   - markVerified: SQL shape + audit emit + tenant scope + archived rejection
 *   - deleteSource: soft-delete idempotency, audit emit
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockLogEvent = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../AuditService.js', () => ({
  default: {
    logEvent: (...args: unknown[]) => mockLogEvent(...args),
  },
}));

import recordSourcesService, { MAX_SOURCES_PER_RECORD } from '../RecordSourcesService.js';

const RECORD_ID = 'rec-uuid-1';
const SOURCE_ID = 'src-uuid-1';
const ORG_ID = 'org-tenant-1';
const OTHER_ORG_ID = 'org-tenant-2';
const ACTOR = 'user-actor-1';

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SOURCE_ID,
    organization_id: ORG_ID,
    record_id: RECORD_ID,
    source_type: 'manual',
    source_uri: 'https://example.org/doc',
    source_metadata: { kind: 'note' },
    confidence_contribution: 0.8,
    created_by: ACTOR,
    created_at: '2026-05-08T12:00:00.000Z',
    last_verified_at: null,
    last_verified_by: null,
    archived_at: null,
    ...overrides,
  };
}

describe('RecordSourcesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogEvent.mockResolvedValue(undefined);
  });

  // ── resolveRecordOrganizationId ────────────────────────────────────────────

  it('resolveRecordOrganizationId returns the org_id chained via tp_records → tp_tables → tp_bases', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ organization_id: ORG_ID }] });

    const result = await recordSourcesService.resolveRecordOrganizationId(RECORD_ID);

    expect(result).toBe(ORG_ID);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/JOIN\s+tp_tables/);
    expect(sql).toMatch(/JOIN\s+tp_bases/);
    expect(params).toEqual([RECORD_ID]);
  });

  it('resolveRecordOrganizationId returns null when record does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await recordSourcesService.resolveRecordOrganizationId(RECORD_ID);
    expect(result).toBeNull();
  });

  it('resolveRecordOrganizationId rejects empty recordId', async () => {
    await expect(recordSourcesService.resolveRecordOrganizationId('')).rejects.toMatchObject({
      message: expect.stringContaining('recordId'),
    });
  });

  // ── listSourcesForRecord ───────────────────────────────────────────────────

  it('listSourcesForRecord scopes on record_id + organization_id and excludes archived by default', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sourceRow()] });

    const result = await recordSourcesService.listSourcesForRecord(RECORD_ID, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(SOURCE_ID);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('record_id = $1');
    expect(sql).toContain('organization_id = $2');
    expect(sql).toContain('archived_at IS NULL');
    expect(params).toEqual([RECORD_ID, ORG_ID]);
  });

  it('listSourcesForRecord includeArchived=true drops the archived_at filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await recordSourcesService.listSourcesForRecord(RECORD_ID, ORG_ID, {
      includeArchived: true,
    });

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain('archived_at IS NULL');
  });

  it('listSourcesForRecord with sourceTypes filter passes typed array', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await recordSourcesService.listSourcesForRecord(RECORD_ID, ORG_ID, {
      sourceTypes: ['document', 'manual'],
    });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('source_type = ANY($3::text[])');
    expect(params[2]).toEqual(['document', 'manual']);
  });

  it('listSourcesForRecord rejects unknown sourceType', async () => {
    await expect(
      recordSourcesService.listSourcesForRecord(RECORD_ID, ORG_ID, {
        sourceTypes: ['nope' as never],
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('Invalid source type') });
  });

  // ── getSource ──────────────────────────────────────────────────────────────

  it('getSource scopes by organization_id (cross-tenant lookup returns null)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await recordSourcesService.getSource(SOURCE_ID, OTHER_ORG_ID);

    expect(result).toBeNull();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('id = $1');
    expect(sql).toContain('organization_id = $2');
    expect(params).toEqual([SOURCE_ID, OTHER_ORG_ID]);
  });

  // ── countActiveSourcesForRecord ────────────────────────────────────────────

  it('countActiveSourcesForRecord returns integer count and filters archived_at IS NULL', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ n: 7 }] });

    const result = await recordSourcesService.countActiveSourcesForRecord(RECORD_ID, ORG_ID);

    expect(result).toBe(7);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('archived_at IS NULL');
  });

  // ── createSource ───────────────────────────────────────────────────────────

  it('createSource happy path: resolves org, checks cap, inserts, audits', async () => {
    // 1: resolveRecordOrganizationId
    mockQuery.mockResolvedValueOnce({ rows: [{ organization_id: ORG_ID }] });
    // 2: countActiveSourcesForRecord
    mockQuery.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    // 3: INSERT
    mockQuery.mockResolvedValueOnce({ rows: [sourceRow()] });

    const created = await recordSourcesService.createSource({
      recordId: RECORD_ID,
      organizationId: ORG_ID,
      sourceType: 'manual',
      sourceUri: 'https://example.org/doc',
      sourceMetadata: { kind: 'note' },
      confidenceContribution: 0.8,
      createdBy: ACTOR,
    });

    expect(created.id).toBe(SOURCE_ID);
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    expect(mockLogEvent.mock.calls[0][0]).toBe('record_source_created');
    expect(mockLogEvent.mock.calls[0][1]).toBe('record_source');
    expect(mockLogEvent.mock.calls[0][2]).toBe(SOURCE_ID);
  });

  it('createSource cross-tenant attempt: actor org differs from record org → RECORD_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ organization_id: OTHER_ORG_ID }] });

    await expect(
      recordSourcesService.createSource({
        recordId: RECORD_ID,
        organizationId: ORG_ID,
        sourceType: 'manual',
        createdBy: ACTOR,
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('Record not found') });

    // No INSERT, no audit.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('createSource record missing → RECORD_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      recordSourcesService.createSource({
        recordId: RECORD_ID,
        organizationId: ORG_ID,
        sourceType: 'manual',
        createdBy: ACTOR,
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('Record not found') });
  });

  it('createSource cap exceeded → RECORD_SOURCES_CAP_EXCEEDED', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ organization_id: ORG_ID }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ n: MAX_SOURCES_PER_RECORD }] });

    await expect(
      recordSourcesService.createSource({
        recordId: RECORD_ID,
        organizationId: ORG_ID,
        sourceType: 'manual',
        createdBy: ACTOR,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining(`cap ${MAX_SOURCES_PER_RECORD}`),
    });
  });

  it('createSource invalid source_type rejected before any DB call', async () => {
    await expect(
      recordSourcesService.createSource({
        recordId: RECORD_ID,
        organizationId: ORG_ID,
        sourceType: 'nope' as never,
        createdBy: ACTOR,
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('Invalid source_type') });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('createSource confidence out of range rejected', async () => {
    await expect(
      recordSourcesService.createSource({
        recordId: RECORD_ID,
        organizationId: ORG_ID,
        sourceType: 'manual',
        createdBy: ACTOR,
        confidenceContribution: 1.5,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('confidence_contribution must be between 0 and 1'),
    });
  });

  it('createSource: audit emit failure does NOT roll back state mutation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ organization_id: ORG_ID }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ n: 0 }] });
    mockQuery.mockResolvedValueOnce({ rows: [sourceRow()] });
    mockLogEvent.mockRejectedValueOnce(new Error('audit down'));

    const created = await recordSourcesService.createSource({
      recordId: RECORD_ID,
      organizationId: ORG_ID,
      sourceType: 'manual',
      createdBy: ACTOR,
    });

    expect(created.id).toBe(SOURCE_ID);
  });

  // ── updateSource ───────────────────────────────────────────────────────────

  it('updateSource patches only provided fields, audits before/after', async () => {
    // getSource (before)
    mockQuery.mockResolvedValueOnce({ rows: [sourceRow()] });
    // UPDATE
    mockQuery.mockResolvedValueOnce({
      rows: [sourceRow({ source_uri: 'https://example.org/doc-v2' })],
    });

    const result = await recordSourcesService.updateSource(SOURCE_ID, ORG_ID, ACTOR, {
      sourceUri: 'https://example.org/doc-v2',
    });

    expect(result.source_uri).toBe('https://example.org/doc-v2');
    const [sql] = mockQuery.mock.calls[1];
    expect(sql).toContain('source_uri = $1');
    expect(sql).toContain('archived_at IS NULL');
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    expect(mockLogEvent.mock.calls[0][0]).toBe('record_source_updated');
  });

  it('updateSource on empty patch returns current state without UPDATE / audit', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sourceRow()] });

    const result = await recordSourcesService.updateSource(SOURCE_ID, ORG_ID, ACTOR, {});

    expect(result.id).toBe(SOURCE_ID);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('updateSource on archived row throws SOURCE_ARCHIVED', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [sourceRow({ archived_at: '2026-05-08T13:00:00.000Z' })],
    });

    await expect(
      recordSourcesService.updateSource(SOURCE_ID, ORG_ID, ACTOR, {
        sourceUri: 'whatever',
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('archived') });
  });

  it('updateSource on missing row throws SOURCE_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      recordSourcesService.updateSource(SOURCE_ID, ORG_ID, ACTOR, { sourceUri: 'x' })
    ).rejects.toMatchObject({ message: expect.stringContaining('Source not found') });
  });

  it('updateSource rejects out-of-range confidence', async () => {
    await expect(
      recordSourcesService.updateSource(SOURCE_ID, ORG_ID, ACTOR, {
        confidenceContribution: -0.1,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('between 0 and 1'),
    });
  });

  // ── markVerified ───────────────────────────────────────────────────────────

  it('markVerified updates last_verified_at/by and audits', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sourceRow()] });
    mockQuery.mockResolvedValueOnce({
      rows: [
        sourceRow({
          last_verified_at: '2026-05-08T13:00:00.000Z',
          last_verified_by: ACTOR,
        }),
      ],
    });

    const result = await recordSourcesService.markVerified(SOURCE_ID, ORG_ID, ACTOR);

    expect(result.last_verified_by).toBe(ACTOR);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(sql).toContain('last_verified_at = now()');
    expect(sql).toContain('archived_at IS NULL');
    expect(params).toEqual([ACTOR, SOURCE_ID, ORG_ID]);
    expect(mockLogEvent.mock.calls[0][0]).toBe('record_source_verified');
  });

  it('markVerified on archived row throws SOURCE_ARCHIVED', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [sourceRow({ archived_at: '2026-05-08T13:00:00.000Z' })],
    });

    await expect(recordSourcesService.markVerified(SOURCE_ID, ORG_ID, ACTOR)).rejects.toMatchObject(
      { message: expect.stringContaining('archived') }
    );
  });

  // ── deleteSource ───────────────────────────────────────────────────────────

  it('deleteSource sets archived_at = now() and audits', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [sourceRow()] });
    mockQuery.mockResolvedValueOnce({
      rows: [sourceRow({ archived_at: '2026-05-08T13:00:00.000Z' })],
    });

    const result = await recordSourcesService.deleteSource(SOURCE_ID, ORG_ID, ACTOR);

    expect(result.archived_at).toBe('2026-05-08T13:00:00.000Z');
    const [sql] = mockQuery.mock.calls[1];
    expect(sql).toContain('archived_at = now()');
    expect(mockLogEvent.mock.calls[0][0]).toBe('record_source_archived');
  });

  it('deleteSource is idempotent on already-archived row (no UPDATE, no audit)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [sourceRow({ archived_at: '2026-05-08T13:00:00.000Z' })],
    });

    const result = await recordSourcesService.deleteSource(SOURCE_ID, ORG_ID, ACTOR);

    expect(result.archived_at).toBe('2026-05-08T13:00:00.000Z');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('deleteSource on missing source throws SOURCE_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(recordSourcesService.deleteSource(SOURCE_ID, ORG_ID, ACTOR)).rejects.toMatchObject(
      { message: expect.stringContaining('Source not found') }
    );
  });
});
