import { describe, expect, it } from 'vitest';

import { getNotebookUploadSourceSummary } from '@/components/MyWork/notebook/notebookCaptureSourceSummary';

describe('getNotebookUploadSourceSummary', () => {
  it('returns a filename-based upload badge when notebook upload metadata is present', () => {
    expect(
      getNotebookUploadSourceSummary(
        'upload',
        { fileOriginalname: 'customer-discovery.xlsx', fileMimetype: 'application/vnd.ms-excel' },
        false
      )
    ).toEqual({
      label: 'File: customer-discovery.xlsx',
      title: 'Note created from file customer-discovery.xlsx',
    });
  });

  it('returns null for non-upload capture sources', () => {
    expect(getNotebookUploadSourceSummary('manual', { fileOriginalname: 'ignored.pdf' }, false)).toBe(null);
  });

  it('returns a web clip badge for web_clipper capture source', () => {
    expect(getNotebookUploadSourceSummary('web_clipper', { url: 'https://example.com' }, false)).toEqual({
      label: 'Web clip',
      title: 'Note created from a clipped page: https://example.com',
    });
  });

  // C4 — Canvas provenance pilot: notes materialized from a Work Canvas draft
  // carry capture_source='api_import' + metadata.sourceType='work_canvas'.
  it('returns a Canvas badge when metadata.sourceType is work_canvas', () => {
    expect(
      getNotebookUploadSourceSummary(
        'api_import',
        { sourceType: 'work_canvas' },
        true
      )
    ).toEqual({
      label: 'Canvas',
      title: 'Source: Canvas (conversation)',
    });
    expect(
      getNotebookUploadSourceSummary('api_import', { sourceType: 'work_canvas' }, false)
    ).toEqual({
      label: 'Canvas',
      title: 'Source: Canvas (conversation)',
    });
  });

  it('keeps the generic API-import badge when sourceType is absent', () => {
    expect(getNotebookUploadSourceSummary('api_import', {}, false)).toEqual({
      label: 'API import',
      title: 'Note created from an external import',
    });
  });
});
