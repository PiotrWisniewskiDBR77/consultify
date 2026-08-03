import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  table: null as any,
  fields: [] as any[],
  views: [] as any[],
  records: [] as any[],
  queries: [] as string[],
  artifact: null as any,
  origin: null as any,
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string) => {
    state.queries.push(sql);
    if (sql.includes('FROM v8_output_artifacts')) return state.artifact;
    if (sql.includes('FROM v8_artifact_origin_links')) return state.origin;
    return state.table;
  }),
  all: vi.fn(async (sql: string, params: unknown[]) => {
    state.queries.push(sql);
    if (sql.includes('FROM tp_fields')) return state.fields;
    if (sql.includes('FROM tp_views')) return state.views;
    const cursorAt = params[1] as string | null;
    const cursorId = params[3] as string | null;
    const limit = params[4] as number;
    return state.records
      .filter(
        (row) =>
          !cursorAt ||
          row.created_at > cursorAt ||
          (row.created_at === cursorAt && row.id > cursorId!)
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .slice(0, limit);
  }),
}));

import {
  registerArtifactContentAdapter,
  resolveArtifactContent,
} from '../artifacts/artifactContentResolverService.js';
import {
  encodeSheetCursor,
  resolveSheetArtifactContent,
  SHEET_CONTENT_ERROR_CODES,
  sheetArtifactContentAdapter,
} from '../artifacts/sheetArtifactContentAdapter.js';

const params = {
  organizationId: 'org-a',
  artifactId: 'artifact-1',
  originRuntime: 'sheet',
  originRecordId: 'table-1',
};

function record(index: number, data: Record<string, unknown> = { 'field-1': index }) {
  return {
    id: `record-${String(index).padStart(4, '0')}`,
    data,
    created_at: '2026-07-31T10:00:00.000Z',
    updated_at: '2026-07-31T10:00:00.000Z',
  };
}

describe('sheet artifact content adapter', () => {
  beforeEach(() => {
    state.table = {
      id: 'table-1',
      base_id: 'base-1',
      name: 'Data',
      description: null,
      schema_version: 3,
    };
    state.fields = [
      {
        id: 'field-1',
        name: 'Value',
        field_type: 'text',
        options: {},
        is_computed: false,
        field_order: 0,
      },
    ];
    state.views = [
      {
        id: 'view-1',
        name: 'Grid',
        view_type: 'grid',
        visible_field_ids: ['field-1'],
        config: {},
        is_default: true,
        ordinal: 0,
      },
    ];
    state.records = [];
    state.queries = [];
    state.artifact = null;
    state.origin = null;
  });

  it('checks tp_tables → tp_bases tenant ownership first and stops on missing/foreign table', async () => {
    state.table = null;
    await expect(resolveSheetArtifactContent(params)).resolves.toBeNull();
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0]).toContain('JOIN tp_bases b ON b.id = t.base_id');
    expect(state.queries[0]).toContain('b.organization_id = ?');
  });

  it.each([
    ['preview', 50, 50, false],
    ['preview', 51, 50, true],
    ['full', 500, 500, false],
    ['full', 501, 500, true],
  ] as const)('applies %s boundary to %i rows', async (mode, count, expected, truncated) => {
    state.records = Array.from({ length: count }, (_, index) => record(index));
    const result = await resolveSheetArtifactContent({
      ...params,
      mode,
      limit: mode === 'preview' ? 50 : 500,
    });
    const json = result!.envelope.contentJson as any;
    expect(json.records).toHaveLength(expected);
    expect(json.page.hasMore).toBe(truncated);
    expect(Boolean(json.page.nextCursor)).toBe(truncated);
    expect(result!.envelope.projection.completeness).toBe(truncated ? 'truncated' : 'full');
  });

  it('uses the (created_at,id) keyset without skips or duplicates on timestamp ties', async () => {
    state.records = [record(3), record(1), record(2)];
    const first = await resolveSheetArtifactContent({ ...params, limit: 2 });
    const firstJson = first!.envelope.contentJson as any;
    const second = await resolveSheetArtifactContent({
      ...params,
      limit: 2,
      cursor: firstJson.page.nextCursor,
    });
    expect(firstJson.records.map((row: any) => row.id)).toEqual(['record-0001', 'record-0002']);
    expect((second!.envelope.contentJson as any).records.map((row: any) => row.id)).toEqual([
      'record-0003',
    ]);
    await expect(
      resolveSheetArtifactContent({ ...params, cursor: 'not-a-cursor' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: SHEET_CONTENT_ERROR_CODES.INVALID_CURSOR,
    });
  });

  it('canonicalizes JSON object key order but changes page hash for values, schema, views and rows', async () => {
    state.records = [record(1, { 'field-1': { b: 2, a: 1 } })];
    const hash = async () =>
      ((await resolveSheetArtifactContent(params))!.envelope.contentJson as any).revision.pageHash;
    const initial = await hash();
    state.records[0].data = { 'field-1': { a: 1, b: 2 } };
    expect(await hash()).toBe(initial);
    state.records[0].data = { 'field-1': { a: 1, b: 3 } };
    expect(await hash()).not.toBe(initial);
    state.records[0].data = { 'field-1': { a: 1, b: 2 } };
    state.fields[0].name = 'Changed';
    expect(await hash()).not.toBe(initial);
    state.fields[0].name = 'Value';
    state.views[0].name = 'Changed';
    expect(await hash()).not.toBe(initial);
    state.views[0].name = 'Grid';
    state.records.push(record(2));
    expect(await hash()).not.toBe(initial);
  });

  it('labels page hash as weak snapshot semantics and never as datasetRevision', async () => {
    state.records = [record(1)];
    const result = await resolveSheetArtifactContent(params);
    const json = result!.envelope.contentJson as any;
    expect(result!.originRevision).toBeNull();
    expect(result!.envelope.provenance.originRevision).toBeNull();
    expect(json.revision).toMatchObject({
      strength: 'weak',
      scope: 'page-snapshot',
      datasetRevision: null,
    });
    expect(json.revision.pageHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('stops at record boundaries and returns stable 413 for one oversized row', async () => {
    state.records = [record(1, { 'field-1': 'small' }), record(2, { 'field-1': 'also-small' })];
    const bounded = await resolveSheetArtifactContent({ ...params, payloadByteCap: 150 });
    expect((bounded!.envelope.contentJson as any).records).toHaveLength(1);
    expect(bounded!.envelope.projection.completeness).toBe('truncated');

    state.records = [record(1, { 'field-1': 'x'.repeat(500) })];
    await expect(
      resolveSheetArtifactContent({ ...params, payloadByteCap: 100 })
    ).rejects.toMatchObject({
      statusCode: 413,
      code: SHEET_CONTENT_ERROR_CODES.RECORD_TOO_LARGE,
    });
  });

  it('escapes pipes/newlines/null and canonicalizes nested values in Markdown', async () => {
    state.fields = [
      ...state.fields,
      {
        id: 'field-2',
        name: 'Other',
        field_type: 'text',
        options: {},
        is_computed: false,
        field_order: 1,
      },
    ];
    state.records = [record(1, { 'field-1': 'a|b\nc', 'field-2': null, extra: { z: 2, a: 1 } })];
    const result = await resolveSheetArtifactContent(params);
    expect(result!.envelope.contentMd).toContain('a\\|b<br>c');
    expect(result!.envelope.contentMd).toContain('∅');
  });

  it('emits deterministic SQL ordering and cursor shape', async () => {
    state.records = [record(1)];
    await resolveSheetArtifactContent({
      ...params,
      cursor: encodeSheetCursor({ createdAt: record(0).created_at, id: record(0).id }),
    });
    expect(state.queries.find((sql) => sql.includes('FROM tp_fields'))).toContain(
      'field_order ASC, name ASC, id ASC'
    );
    expect(state.queries.find((sql) => sql.includes('FROM tp_views'))).toContain(
      'is_default DESC, ordinal ASC NULLS LAST, name ASC, id ASC'
    );
    expect(state.queries.find((sql) => sql.includes('FROM tp_records'))).toContain(
      '(created_at, id) > (?, ?)'
    );
  });

  it('resolves the exact sheet origin through the artifact registry read-back', async () => {
    state.artifact = { artifact_id: 'artifact-1' };
    state.origin = { origin_runtime: 'sheet', origin_record_id: 'table-1' };
    state.records = [record(1)];
    registerArtifactContentAdapter('sheet', sheetArtifactContentAdapter);
    const resolved = await resolveArtifactContent({
      artifactId: 'artifact-1',
      organizationId: 'org-a',
    });
    expect(resolved.origin).toEqual({ originRuntime: 'sheet', originRecordId: 'table-1' });
    expect(resolved.envelope.canonicalKind).toBe('sheet');
    expect(resolved.envelope.contentMd).toContain('record-0001');
  });
});
