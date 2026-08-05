import { describe, expect, it } from 'vitest';

import { CitationExtractorService } from '../../../server/src/services/ai/citationExtractor.js';

/**
 * M01-P04B — GF-CHAT-02 fragment anchor.
 *
 * `Citation.fragmentIndex` must be the REAL chunk ordinal
 * (`knowledge_chunks.chunk_index`, threaded through
 * `ragService.searchRelevantChunks` → the `ragChunks` argument here as
 * `chunkIndex`), not a fabricated constant. Two citations built from chunks
 * at different positions in their source document MUST end up with
 * different `fragmentIndex` values — otherwise every citation looks like it
 * anchors to the same (first) fragment, which is exactly the "citation opens
 * the document, not a specific fragment" gap the packet exists to close.
 */
describe('CitationExtractorService fragment anchor (M01-P04B / GF-CHAT-02)', () => {
  it('assigns the real, distinct chunkIndex from each RAG chunk as fragmentIndex', () => {
    const extractor = new CitationExtractorService();

    const result = extractor.extract('See [A1] and also [A2].', [], [
      {
        content: 'First fragment content.',
        chunkIndex: 0,
        metadata: { documentId: 'doc-1', title: 'Doc One' },
      },
      {
        content: 'Fourth fragment content, much further into the document.',
        chunkIndex: 3,
        metadata: { documentId: 'doc-1', title: 'Doc One' },
      },
    ]);

    expect(result.citations).toHaveLength(2);
    const [first, second] = result.citations;
    expect(first.fragmentIndex).toBe(0);
    expect(second.fragmentIndex).toBe(3);
    // The core anti-regression assertion: fragments must be distinguishable.
    expect(first.fragmentIndex).not.toBe(second.fragmentIndex);
    // Fragment excerpt is the REAL chunk content, not the citation marker text.
    expect(first.fragmentExcerpt).toBe('First fragment content.');
    expect(second.fragmentExcerpt).toContain('Fourth fragment content');
  });

  it('leaves fragmentIndex undefined (never a fabricated 0) when no chunk data is available', () => {
    const extractor = new CitationExtractorService();
    // NAMED_RE match — no ragChunks involved at all.
    const result = extractor.extract('[Source: Some External Doc]', [
      { id: 'ext-1', title: 'Some External Doc', type: 'document' },
    ]);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].fragmentIndex).toBeUndefined();
  });

  /**
   * NEGATIVE CONTROL (a) — required by the M01-P04B packet: "test fragment
   * anchora pada, gdy handler zwróci offset 0 dla każdego cytowania". This
   * reproduces exactly that broken handler shape (every citation hardcoded
   * to fragmentIndex 0, mirroring the pre-fix behavior where `startOffset`/
   * `endOffset` — response-text marker positions — were the only "offset"
   * available and `fragmentIndex` did not exist) and asserts the SAME
   * distinctness check above fails against it. Run once to confirm RED
   * against the broken shape, independent of whether the real extractor is
   * fixed — this is the control, not the extractor test.
   */
  it('[negative control] a handler that hardcodes fragmentIndex=0 for every citation fails the distinctness assertion', () => {
    const brokenCitations = [
      { id: 'cit_1', fragmentIndex: 0 },
      { id: 'cit_2', fragmentIndex: 0 },
    ];
    expect(() => {
      expect(brokenCitations[0].fragmentIndex).not.toBe(brokenCitations[1].fragmentIndex);
    }).toThrow();
  });
});
