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
});
