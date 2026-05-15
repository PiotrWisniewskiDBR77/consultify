/**
 * Contract tests for notebookService
 *
 * Tests the public API of the notebook service, focusing on
 * the pure/testable surface first, with todo stubs for DB-heavy methods.
 */

import { describe, expect, it } from 'vitest';

import notebookService, { buildNotebookContextSnapshot } from '../notebookService.js';

describe('notebookService — contract tests', () => {
  describe('buildNotebookContextSnapshot', () => {
    it('builds a snapshot with required fields', () => {
      const snap = buildNotebookContextSnapshot('note-1', 'org-1');
      expect(snap.noteId).toBe('note-1');
      expect(snap.organizationId).toBe('org-1');
      expect(snap.retrievalScope).toBe('org');
      expect(snap.capturedAt).toBeDefined();
      expect(typeof snap.capturedAt).toBe('string');
    });

    it('applies optional overrides', () => {
      const snap = buildNotebookContextSnapshot('note-2', 'org-2', {
        retrievalScope: 'personal',
      });
      expect(snap.retrievalScope).toBe('personal');
      expect(snap.noteId).toBe('note-2');
    });

    it('generates a valid ISO timestamp', () => {
      const snap = buildNotebookContextSnapshot('n', 'o');
      const date = new Date(snap.capturedAt);
      expect(date.getTime()).not.toBeNaN();
    });
  });

  describe('NotebookService class', () => {
    it.todo('capture() — ingests content from upload source');
    it.todo('capture() — ingests content from url source');
    it.todo('listPages() — returns paginated notebook pages');
    it.todo('getPage() — returns a single page with content');
    it.todo('updatePage() — updates page content and title');
    it.todo('deletePage() — soft-deletes a notebook page');
    it.todo('addAttachment() — links a file to a notebook page');
    it.todo('removeAttachment() — unlinks an attachment');
  });
});
