import { describe, expect, it } from 'vitest';

import { chunkText } from '../KnowledgeService.js';

describe('KnowledgeService chunkText', () => {
  it('terminates after emitting the final overlapping chunk', () => {
    const text = 'a'.repeat(2_350);

    const chunks = chunkText(text, { chunkSize: 1_000, overlap: 200 });

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.length)).toEqual([1_000, 1_000, 750]);
  });
});
