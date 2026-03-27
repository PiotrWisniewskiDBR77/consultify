import { describe, expect, it } from 'vitest';

import { bucketIdeaStageForList, normalizeStageToV5 } from '../../../src/components/MyWork/ideaEntryTypes';

describe('ideaEntryTypes stage normalization', () => {
  it('normalizes legacy and V5 idea stages into one V5 source of truth', () => {
    expect(normalizeStageToV5('incubating')).toBe('framing');
    expect(normalizeStageToV5('shaping')).toBe('structuring');
    expect(normalizeStageToV5('ready')).toBe('ready_to_convert');
    expect(normalizeStageToV5('promoted')).toBe('converted');
    expect(normalizeStageToV5('exploring')).toBe('exploring');
  });

  it('maps normalized V5 stages into the current list buckets without UI drift', () => {
    expect(bucketIdeaStageForList('spark')).toBe('spark');
    expect(bucketIdeaStageForList('incubating')).toBe('incubating');
    expect(bucketIdeaStageForList('framing')).toBe('incubating');
    expect(bucketIdeaStageForList('exploring')).toBe('incubating');
    expect(bucketIdeaStageForList('structuring')).toBe('shaping');
    expect(bucketIdeaStageForList('validating')).toBe('ready');
    expect(bucketIdeaStageForList('ready_to_convert')).toBe('ready');
    expect(bucketIdeaStageForList('converted')).toBe('promoted');
  });
});
