import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  pushRecentAttachment,
  readRecentAttachments,
  removeRecentAttachment,
} from '../chatRecentAttachments';

const RECENT_KEY = 'consultify-recent-attachments';

describe('chatRecentAttachments', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  describe('readRecentAttachments', () => {
    it('returns an empty array when storage is empty', () => {
      expect(readRecentAttachments()).toEqual([]);
    });

    it('returns an empty array when storage holds invalid JSON', () => {
      localStorage.setItem(RECENT_KEY, '{not json');
      expect(readRecentAttachments()).toEqual([]);
    });

    it('returns an empty array when the stored value is not an array', () => {
      localStorage.setItem(RECENT_KEY, JSON.stringify({ name: 'x' }));
      expect(readRecentAttachments()).toEqual([]);
    });

    it('drops entries without a name or a valid addedAt', () => {
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([
          { name: '', addedAt: 5 },
          { name: 'ok.pdf', addedAt: 0 },
          { name: 'good.pdf', addedAt: 10 },
        ])
      );
      const read = readRecentAttachments();
      expect(read.map((x) => x.name)).toEqual(['good.pdf']);
    });

    it('returns entries sorted by addedAt descending', () => {
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([
          { name: 'old.pdf', addedAt: 100 },
          { name: 'new.pdf', addedAt: 300 },
          { name: 'mid.pdf', addedAt: 200 },
        ])
      );
      expect(readRecentAttachments().map((x) => x.name)).toEqual(['new.pdf', 'mid.pdf', 'old.pdf']);
    });
  });

  describe('pushRecentAttachment', () => {
    it('adds a new entry that round-trips through storage', () => {
      pushRecentAttachment({ name: 'a.pdf', docId: 'doc-1', mimeType: 'application/pdf' });
      const read = readRecentAttachments();
      expect(read).toHaveLength(1);
      expect(read[0]).toMatchObject({ name: 'a.pdf', docId: 'doc-1', mimeType: 'application/pdf' });
      expect(read[0].addedAt).toBeGreaterThan(0);
    });

    it('ignores a push with a blank name', () => {
      pushRecentAttachment({ name: '   ' });
      expect(readRecentAttachments()).toEqual([]);
    });

    it('places the most recent push first', () => {
      pushRecentAttachment({ name: 'first.pdf', docId: 'd1' });
      pushRecentAttachment({ name: 'second.pdf', docId: 'd2' });
      expect(readRecentAttachments().map((x) => x.name)).toEqual(['second.pdf', 'first.pdf']);
    });

    it('dedupes by docId, upgrading a name-only entry in place', () => {
      pushRecentAttachment({ name: 'report.docx' });
      pushRecentAttachment({ name: 'report.docx', docId: 'doc-9' });
      const read = readRecentAttachments();
      expect(read).toHaveLength(1);
      expect(read[0].docId).toBe('doc-9');
    });

    it('dedupes by name when no docId is present', () => {
      pushRecentAttachment({ name: 'same.pdf' });
      pushRecentAttachment({ name: 'same.pdf' });
      expect(readRecentAttachments()).toHaveLength(1);
    });

    it('caps the stored list at the maximum of 6 entries', () => {
      for (let i = 0; i < 10; i += 1) {
        pushRecentAttachment({ name: `file-${i}.pdf`, docId: `doc-${i}` });
      }
      const read = readRecentAttachments();
      expect(read).toHaveLength(6);
      // newest first → file-9 down to file-4
      expect(read[0].name).toBe('file-9.pdf');
      expect(read[5].name).toBe('file-4.pdf');
    });
  });

  describe('removeRecentAttachment', () => {
    it('removes the entry matching the given docId', () => {
      pushRecentAttachment({ name: 'keep.pdf', docId: 'keep' });
      pushRecentAttachment({ name: 'drop.pdf', docId: 'drop' });
      const remaining = removeRecentAttachment('drop');
      expect(remaining.map((x) => x.name)).toEqual(['keep.pdf']);
      expect(readRecentAttachments().map((x) => x.name)).toEqual(['keep.pdf']);
    });

    it('is a no-op when no entry matches the docId', () => {
      pushRecentAttachment({ name: 'a.pdf', docId: 'a' });
      const remaining = removeRecentAttachment('nonexistent');
      expect(remaining).toHaveLength(1);
    });
  });
});
