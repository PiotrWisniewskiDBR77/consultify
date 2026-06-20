/**
 * notebookAIEnrichService — Unit Tests (M04, Agent 3)
 *
 * Covers:
 *  - deriveAutoTags: pure heuristic tagger (weighting, stopwords, dedupe, max).
 *  - enrichPage: page load, non-destructive tag merge + persist, topic delegation,
 *    and graceful degradation (page missing, topic module unavailable).
 *
 * queryHelpers and the topic service are mocked — no DB / no real LLM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn(),
  queryRun: vi.fn(),
  queryAll: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Topic service is imported lazily inside enrichPage; mock the module here.
const deriveTopicsForPage = vi.fn();
vi.mock('../../../server/src/services/notebookTopicService.js', () => ({
  deriveTopicsForPage,
}));

import {
  deriveAutoTags,
  enrichPage,
} from '../../../server/src/services/notebookAIEnrichService';
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';

const mocked = queryHelpers as unknown as {
  queryOne: ReturnType<typeof vi.fn>;
  queryRun: ReturnType<typeof vi.fn>;
};

describe('notebookAIEnrichService.deriveAutoTags', () => {
  it('extracts keywords weighting the title over the body', () => {
    const tags = deriveAutoTags({
      title: 'Pricing strategy review',
      contentText: 'We discussed pricing and packaging for the enterprise tier.',
      max: 5,
    });
    expect(tags).toContain('pricing');
    // title word should rank — 'strategy' (title, weight 3) beats single body words
    expect(tags).toContain('strategy');
  });

  it('drops stopwords, short words, and pure numbers', () => {
    const tags = deriveAutoTags({
      title: 'this that 2024 the of a',
      contentText: 'with from have 12345',
      max: 5,
    });
    expect(tags).toHaveLength(0);
  });

  it('respects the max cap and dedupes repeats', () => {
    const tags = deriveAutoTags({
      title: 'roadmap roadmap roadmap',
      contentText: 'planning planning velocity velocity backlog scope cadence retro',
      max: 3,
    });
    expect(tags.length).toBeLessThanOrEqual(3);
    // distinct tags only
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags[0]).toBe('roadmap'); // highest weighted (title x3)
  });

  it('normalizes diacritics (Polish) so accented words still tag', () => {
    const tags = deriveAutoTags({ title: 'Wdrożenie cyfryzacja', contentText: '', max: 5 });
    // ż/ż → z, etc. — should yield ascii-folded tokens, none empty
    expect(tags.every((t) => /^[a-z0-9]+$/.test(t))).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
  });
});

describe('notebookAIEnrichService.enrichPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deriveTopicsForPage.mockResolvedValue([
      { name: 'Pricing', slug: 'pricing', score: 1 },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns degraded result when pageId is empty', async () => {
    const res = await enrichPage('');
    expect(res.degraded).toContain('missing-page-id');
    expect(res.topicsLinked).toBe(false);
    expect(mocked.queryOne).not.toHaveBeenCalled();
  });

  it('reports page-not-found without throwing', async () => {
    mocked.queryOne.mockResolvedValue(null);
    const res = await enrichPage('p1');
    expect(res.degraded).toContain('page-not-found');
    expect(res.addedTags).toEqual([]);
  });

  it('merges new tags into existing tags non-destructively and persists', async () => {
    mocked.queryOne.mockResolvedValue({
      id: 'p1',
      organization_id: 'org1',
      title: 'Pricing strategy',
      content_text: 'enterprise pricing packaging',
      tags_json: JSON.stringify(['manual-tag']),
    });
    mocked.queryRun.mockResolvedValue({});

    const res = await enrichPage('p1', { deriveTopics: false });

    // existing manual tag preserved
    expect(res.tags).toContain('manual-tag');
    // heuristic tags added
    expect(res.addedTags).toContain('pricing');
    // persisted exactly once with merged JSON containing the manual tag
    expect(mocked.queryRun).toHaveBeenCalledTimes(1);
    const [, params] = mocked.queryRun.mock.calls[0];
    expect(String(params[0])).toContain('manual-tag');
    expect(String(params[0])).toContain('pricing');
  });

  it('does not persist when there are no new tags', async () => {
    mocked.queryOne.mockResolvedValue({
      id: 'p1',
      organization_id: 'org1',
      title: 'pricing',
      content_text: '',
      tags_json: JSON.stringify(['pricing']),
    });
    const res = await enrichPage('p1', { deriveTopics: false });
    expect(res.addedTags).toEqual([]);
    expect(mocked.queryRun).not.toHaveBeenCalled();
  });

  it('delegates topic derivation to notebookTopicService and surfaces topics', async () => {
    mocked.queryOne.mockResolvedValue({
      id: 'p1',
      organization_id: 'org1',
      title: 'Pricing',
      content_text: 'pricing',
      tags_json: '[]',
    });
    mocked.queryRun.mockResolvedValue({});

    const res = await enrichPage('p1');

    expect(deriveTopicsForPage).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ orgId: 'org1', source: 'ai' })
    );
    expect(res.topicsLinked).toBe(true);
    expect(res.topics).toEqual([{ name: 'Pricing', slug: 'pricing', score: 1 }]);
  });

  it('degrades gracefully when topic derivation throws', async () => {
    mocked.queryOne.mockResolvedValue({
      id: 'p1',
      organization_id: 'org1',
      title: 'Pricing',
      content_text: 'pricing',
      tags_json: '[]',
    });
    mocked.queryRun.mockResolvedValue({});
    deriveTopicsForPage.mockRejectedValue(new Error('topic module down'));

    const res = await enrichPage('p1');
    expect(res.topicsLinked).toBe(false);
    expect(res.degraded).toContain('topic-service-unavailable');
    // tagging still succeeded
    expect(res.addedTags).toContain('pricing');
  });

  it('reports tag-persist-failed but still attempts topics', async () => {
    mocked.queryOne.mockResolvedValue({
      id: 'p1',
      organization_id: 'org1',
      title: 'Pricing strategy',
      content_text: 'pricing',
      tags_json: '[]',
    });
    mocked.queryRun.mockRejectedValue(new Error('write failed'));

    const res = await enrichPage('p1');
    expect(res.degraded).toContain('tag-persist-failed');
    expect(res.topicsLinked).toBe(true);
  });
});
