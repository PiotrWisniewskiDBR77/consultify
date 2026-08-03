import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ wave: null as any, report: null as any, sections: [] as any[] }));

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM wave5_artifacts')) {
      return state.wave?.artifact_id === params[0] && state.wave?.organization_id === params[1]
        ? state.wave
        : null;
    }
    if (sql.includes('FROM report_builder_reports')) {
      return state.report?.id === params[0] && state.report?.organization_id === params[1]
        ? state.report
        : null;
    }
    return null;
  }),
  all: vi.fn(async (sql: string) =>
    sql.includes('FROM report_builder_sections') ? state.sections : []
  ),
}));

import { wave5ArtifactContentAdapter } from '../artifacts/wave5ArtifactContentAdapter.js';

const params = {
  organizationId: 'org-1',
  artifactId: 'registry-1',
  originRuntime: 'native_artifact',
  originRecordId: 'wave-1',
};

describe('Wave5 content authority quarantine', () => {
  beforeEach(() => {
    state.wave = null;
    state.report = null;
    state.sections = [];
  });

  it('keeps native non-mirror Wave5 content authoritative and tenant scoped', async () => {
    state.wave = {
      artifact_id: 'wave-1',
      organization_id: 'org-1',
      artifact_type: 'report',
      canonical_format: 'markdown',
      content: '# Native',
      content_md: '# Native',
      content_json_native: null,
      content_schema_version: 'wave5/v1',
      current_version: 2,
      updated_at: '2026-08-01T10:00:00Z',
      source_refs_json: '[]',
      provenance_json: '{}',
    };
    const resolved = await wave5ArtifactContentAdapter.resolve(params);
    expect(resolved?.envelope.contentMd).toBe('# Native');
    expect(resolved?.originRevision).toContain('wave5:2:');
    await expect(
      wave5ArtifactContentAdapter.resolve({ ...params, organizationId: 'foreign' })
    ).resolves.toBeNull();
  });

  it('reads a quarantined mirror from its live origin so updates are immediately visible', async () => {
    state.wave = {
      artifact_id: 'wave-1',
      organization_id: 'org-1',
      artifact_type: 'report',
      canonical_format: 'markdown',
      content: 'Legacy artifact mirrored into Wave 5 runtime.',
      content_md: 'placeholder',
      current_version: 1,
      source_refs_json: JSON.stringify([
        { sourceClass: 'legacy_artifact', originRuntime: 'report', originRecordId: 'report-1' },
      ]),
      provenance_json: JSON.stringify({
        metadata: { contentAuthority: 'origin_runtime', quarantineStatus: 'legacy_mirror' },
      }),
    };
    state.report = {
      id: 'report-1',
      organization_id: 'org-1',
      title: 'Live',
      updated_at: '2026-08-01T10:00:00Z',
    };
    state.sections = [
      {
        id: 's1',
        section_key: 'body',
        title: 'Body',
        order_index: 1,
        content_format: 'markdown',
        generated_content: 'Before',
        edited_content: null,
        updated_at: '2026-08-01T10:00:00Z',
      },
    ];
    const before = await wave5ArtifactContentAdapter.resolve(params);
    expect(before?.envelope.contentMd).toContain('Before');
    expect(before?.envelope.contentMd).not.toContain('Legacy artifact mirrored');
    state.sections[0].edited_content = 'After';
    state.sections[0].updated_at = '2026-08-01T11:00:00Z';
    const after = await wave5ArtifactContentAdapter.resolve(params);
    expect(after?.envelope.contentMd).toContain('After');
    expect(after?.originRevision).not.toBe(before?.originRevision);
  });

  it('fails closed when a mirror origin is absent or unsupported', async () => {
    state.wave = {
      artifact_id: 'wave-1',
      organization_id: 'org-1',
      artifact_type: 'report',
      source_refs_json: JSON.stringify([
        { sourceClass: 'legacy_artifact', originRuntime: 'report', originRecordId: 'missing' },
      ]),
      provenance_json: JSON.stringify({ metadata: { contentAuthority: 'origin_runtime' } }),
    };
    await expect(wave5ArtifactContentAdapter.resolve(params)).resolves.toBeNull();
    state.wave.source_refs_json = JSON.stringify([
      { sourceClass: 'legacy_artifact', originRuntime: 'unknown', originRecordId: 'x' },
    ]);
    await expect(wave5ArtifactContentAdapter.resolve(params)).resolves.toBeNull();
  });
});
