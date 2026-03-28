import { describe, expect, it } from 'vitest';

import { getNotebookConvertedOutputSummary } from '@/components/MyWork/notebook/notebookConvertedOutputSummary';

describe('getNotebookConvertedOutputSummary', () => {
  it('returns visible converted output types with an extra count', () => {
    expect(
      getNotebookConvertedOutputSummary(
        [
          { type: 'report', id: 'report-1' },
          { type: 'presentation', id: 'deck-1' },
          { type: 'assessment', id: 'assessment-1' },
        ],
        2
      )
    ).toEqual({
      total: 3,
      visibleTypes: ['report', 'presentation'],
      extraCount: 1,
    });
  });

  it('keeps first-seen order and shows multiplicity for repeated output types', () => {
    expect(
      getNotebookConvertedOutputSummary([
        { type: 'report', id: 'report-1' },
        { type: 'report', id: 'report-2' },
        { type: 'presentation', id: 'deck-1' },
      ])
    ).toEqual({
      total: 3,
      visibleTypes: ['report ×2', 'presentation'],
      extraCount: 0,
    });
  });
});
