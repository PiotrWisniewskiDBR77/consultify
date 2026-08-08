import { describe, expect, it } from 'vitest';

import {
  mapArtifactRegistryListRow,
  resolvePersistedArtifactFormat,
} from '../v8/artifactRegistryService';

function listRow(overrides: Record<string, unknown>) {
  return {
    artifact_id: 'artifact-1',
    organization_id: 'org-1',
    output_type: 'report',
    artifact_family: 'document',
    delivery_state: 'ready',
    title_snapshot: 'Material',
    owner_user_id: 'user-1',
    canonical_home: '/materials',
    visibility_scope: 'organization',
    project_id: null,
    context_snapshot_id: null,
    execution_run_id: null,
    template_family_ref: null,
    source_initiative_id: null,
    ai_governance_preset_ref: null,
    origin_summary_json: '{}',
    is_draft: 0,
    created_by: 'user-1',
    created_at: '2026-08-01T00:00:00.000Z',
    last_transition_at: '2026-08-01T00:00:00.000Z',
    origin_runtime: 'native_artifact',
    origin_record_id: 'native-1',
    report_title: null,
    report_status: null,
    report_type: null,
    report_source_refs_json: '[]',
    report_pdf_path: null,
    report_pptx_path: null,
    latest_completed_export_format: null,
    presentation_title: null,
    presentation_status: null,
    presentation_mode: null,
    presentation_slide_count: null,
    presentation_export_format: null,
    presentation_source_refs_json: '[]',
    publish_state: null,
    publish_reviewers: '[]',
    review_gate_count: 0,
    owner_name: 'Owner',
    ...overrides,
  } as any;
}

describe('artifact registry persisted material format', () => {
  it.each([
    [
      {
        origin_runtime: 'report',
        report_pdf_path: '/exports/report.pdf',
        report_pptx_path: null,
        presentation_export_format: null,
        latest_completed_export_format: null,
      },
      'pdf',
    ],
    [
      {
        origin_runtime: 'report',
        report_pdf_path: null,
        report_pptx_path: '/exports/report.pptx',
        presentation_export_format: null,
        latest_completed_export_format: null,
      },
      'pptx',
    ],
    [
      {
        origin_runtime: 'native_artifact',
        report_pdf_path: null,
        report_pptx_path: null,
        presentation_export_format: null,
        latest_completed_export_format: 'docx',
      },
      'docx',
    ],
    [
      {
        origin_runtime: 'presentation',
        report_pdf_path: null,
        report_pptx_path: null,
        presentation_export_format: 'pptx',
        latest_completed_export_format: null,
        origin_summary_json: '{}',
      },
      'pptx',
    ],
  ] as const)('exposes trustworthy persisted format for %o', (row, expected) => {
    expect(resolvePersistedArtifactFormat(row as any)).toBe(expected);
  });

  it('does not infer format from a generic document runtime without a persisted file', () => {
    expect(
      resolvePersistedArtifactFormat({
        origin_runtime: 'native_artifact',
        report_pdf_path: null,
        report_pptx_path: null,
        presentation_export_format: null,
        latest_completed_export_format: null,
        origin_summary_json: '{}',
      })
    ).toBeNull();
  });

  it.each([
    ['report', { origin_runtime: 'report', report_pdf_path: '/exports/report.pdf' }, 'pdf'],
    [
      'native DOCX',
      { origin_runtime: 'native_artifact', latest_completed_export_format: 'docx' },
      'docx',
    ],
  ])(
    'maps %s authoritative persisted format onto the canonical list item',
    (_label, overrides, expected) => {
      expect(mapArtifactRegistryListRow(listRow(overrides)).exportFormat).toBe(expected);
    }
  );

  it('keeps canonical native list item format empty when no persisted evidence exists', () => {
    expect(mapArtifactRegistryListRow(listRow({})).exportFormat).toBeNull();
  });

  it('maps sheet XLSX only from persisted origin summary export evidence', () => {
    expect(
      mapArtifactRegistryListRow(
        listRow({
          origin_runtime: 'sheet',
          output_type: 'sheet',
          artifact_family: 'sheet',
          origin_summary_json: JSON.stringify({ exportFormat: 'xlsx' }),
        })
      ).exportFormat
    ).toBe('xlsx');
  });

  it('keeps sheet format empty when no persisted export evidence exists', () => {
    expect(
      mapArtifactRegistryListRow(
        listRow({
          origin_runtime: 'sheet',
          output_type: 'sheet',
          artifact_family: 'sheet',
          origin_summary_json: '{}',
        })
      ).exportFormat
    ).toBeNull();
  });
});
