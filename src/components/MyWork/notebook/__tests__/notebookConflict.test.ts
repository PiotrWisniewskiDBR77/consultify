import { describe, expect, it } from 'vitest';

import { extractNotebookConflictPage } from '../notebookConflict';

describe('notebook conflict recovery contract', () => {
  const fresh = {
    id: 'note-1',
    title: 'Server edit',
    updatedAt: '2026-08-15T19:00:00.000Z',
  };

  it('extracts the fresh page from the API client error envelope used by V8 and legacy routes', () => {
    expect(
      extractNotebookConflictPage({
        status: 409,
        data: { error: 'Page was modified elsewhere', code: 'NOTEBOOK_PAGE_CONFLICT', data: fresh },
      })
    ).toEqual(fresh);
  });

  it('keeps compatibility with a direct-page adapter response', () => {
    expect(extractNotebookConflictPage({ status: 409, data: fresh })).toEqual(fresh);
  });

  it('never mistakes an envelope without a valid server version for a page', () => {
    expect(
      extractNotebookConflictPage({
        status: 409,
        data: { error: 'conflict', code: 'NOTEBOOK_PAGE_CONFLICT', data: null },
      })
    ).toBeNull();
  });
});
