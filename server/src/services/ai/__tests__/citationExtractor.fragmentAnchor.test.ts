/**
 * M01-006 (Chat citation panel) — server-side half of the fragment-anchor
 * chain (GF-CHAT-02). The client half (`CitationList.tsx` opening the
 * fragment inline on click) already has a test:
 * `tests/components/AIChat/CitationList.fragmentAnchorAndAcl.test.tsx`. That
 * test only proves the UI reacts correctly to a `fragmentIndex`/`excerpt` the
 * component is HANDED — it never touches `citationExtractor`, the module that
 * actually derives those fields from the real RAG chunk
 * (`knowledge_chunks.chunk_index`/`content`, threaded through
 * `ragService.searchRelevantChunks`/`hybridSearch`, see comments on
 * `fragmentIndex`/`fragmentExcerpt` in citationExtractor.ts). No test existed
 * for that derivation before this packet. This closes that gap.
 */
import { describe, expect, it } from 'vitest';

import { citationExtractor } from '../citationExtractor.js';

describe('citationExtractor — fragment anchor (GF-CHAT-02)', () => {
  it('attaches the real chunk ordinal + excerpt to an [A1]-style attachment citation', () => {
    const ragChunks = [
      {
        content: 'Five workstreams are governed by one supervisor.',
        chunkIndex: 2,
        metadata: { documentId: 'doc-1', title: 'Operating Model.docx' },
      },
    ];
    const { citations } = citationExtractor.extract('See [A1] for details.', [], ragChunks);

    expect(citations).toHaveLength(1);
    expect(citations[0].fragmentIndex).toBe(2);
    expect(citations[0].fragmentExcerpt).toBe('Five workstreams are governed by one supervisor.');
    expect(citations[0].sourceId).toBe('doc-1');
    expect(citations[0].sourceTitle).toBe('Operating Model.docx');
  });

  it('never fabricates fragmentIndex 0 when no chunk data backs the citation', () => {
    // Numeric citation marker [1] with no corresponding ragChunks entry.
    const { citations } = citationExtractor.extract('See [1] for details.', [], []);

    expect(citations).toHaveLength(1);
    expect(citations[0].fragmentIndex).toBeUndefined();
    expect(citations[0].fragmentExcerpt).toBeUndefined();
  });

  it('keeps two citations to DIFFERENT fragments of the SAME document distinct (dedup key includes fragmentIndex)', () => {
    const ragChunks = [
      { content: 'Fragment one content.', chunkIndex: 0, metadata: { documentId: 'doc-9' } },
      { content: 'Fragment two content.', chunkIndex: 1, metadata: { documentId: 'doc-9' } },
    ];
    const { citations, totalFound } = citationExtractor.extract(
      'First point [A1]. Second point [A2].',
      [],
      ragChunks
    );

    expect(totalFound).toBe(2);
    expect(citations.map((c) => c.fragmentIndex).sort()).toEqual([0, 1]);
    expect(citations.map((c) => c.fragmentExcerpt)).toEqual([
      'Fragment one content.',
      'Fragment two content.',
    ]);
  });
});
