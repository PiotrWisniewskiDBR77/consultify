import { describe, expect, it } from 'vitest';

import { CitationExtractorService } from '../../../server/src/services/ai/citationExtractor.js';

describe('CitationExtractorService attachments', () => {
  it('extracts attachment-style [A1] citations from RAG chunks', () => {
    const extractor = new CitationExtractorService();

    const result = extractor.extract('Wniosek z raportu [A1].', [], [
      {
        text: 'Robot density increased in the US market.',
        metadata: {
          documentId: 'doc-us-robots',
          title: 'Report US Robots Market.pdf',
          sourceType: 'document',
        },
      },
    ]);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toEqual(
      expect.objectContaining({
        text: '[A1]',
        sourceId: 'doc-us-robots',
        sourceTitle: 'Report US Robots Market.pdf',
        sourceType: 'document',
      })
    );
  });
});
