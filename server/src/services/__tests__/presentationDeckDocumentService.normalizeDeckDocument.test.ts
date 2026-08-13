import { describe, expect, it } from 'vitest';

import { normalizeDeckDocument } from '../presentationDeckDocumentService.js';

describe('presentationDeckDocumentService.normalizeDeckDocument', () => {
  it('falls back to unified_json when schemaVersion deck_json has empty cards', () => {
    const row = {
      id: 'deck_1',
      organization_id: 'org_1',
      title: 'Deck title',
      status: 'ready',
      deck_json: JSON.stringify({
        schemaVersion: 1,
        deck_id: 'deck_1',
        cards: [],
      }),
      unified_json: JSON.stringify({
        meta: {
          client: 'Org',
          project: 'Unified project',
          date: '2026-05-17',
          author: 'Consultify',
          confidentiality: 'internal',
          language: 'pl',
          template: 'modern',
        },
        slides: [
          {
            intent: 'cover',
            key_message: 'Cover message',
            content: { type: 'cover', title: 'Cover' },
          },
        ],
      }),
      outline_json: JSON.stringify([]),
      source_artifacts: JSON.stringify([]),
      source_refs_json: JSON.stringify([]),
      export_path: null,
      generated_by: 'user_1',
      created_by: 'user_1',
      created_at: '2026-05-17T12:00:00.000Z',
      updated_at: '2026-05-17T12:05:00.000Z',
    };

    const normalized = normalizeDeckDocument(row);
    expect(normalized).toBeTruthy();
    expect(Array.isArray(normalized?.cards)).toBe(true);
    expect(normalized?.cards.length).toBe(1);
    expect(normalized?.cards[0]?.intent).toBe('cover');
    expect(normalized?.title).toBe('Deck title');
  });
});
