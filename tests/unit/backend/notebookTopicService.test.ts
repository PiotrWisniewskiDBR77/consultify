/**
 * notebookTopicService — unit tests (MOCK_DB via queryHelpers mock).
 *
 * Covers:
 *  - deriveTopicsFromText / deriveTopicsForPage (keyword heuristic + persistence)
 *  - aggregateTopic (notes + outputs + initiatives from link_graph_edges)
 *  - pinPageToTopic (insert + idempotent update) / unpin
 *  - createTopic idempotency on slug
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the DB access layer.
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

// Deterministic ids.
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `uuid-${++uuidCounter}`),
}));

import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';
import notebookTopicService, {
  aggregateTopic,
  createTopic,
  deriveTopicsForPage,
  deriveTopicsFromText,
  pinPageToTopic,
  slugifyTopic,
  unpinPageFromTopic,
} from '../../../server/src/services/notebookTopicService';

const mockQueryOne = queryHelpers.queryOne as unknown as ReturnType<typeof vi.fn>;
const mockQueryAll = queryHelpers.queryAll as unknown as ReturnType<typeof vi.fn>;
const mockQueryRun = queryHelpers.queryRun as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  uuidCounter = 0;
  mockQueryRun.mockResolvedValue({ changes: 1 });
});

describe('slugifyTopic', () => {
  it('normalizes diacritics and Polish ł', () => {
    expect(slugifyTopic('Wdrożenie ŁAD')).toBe('wdrozenie-lad');
  });
  it('trims and collapses non-alphanumerics', () => {
    expect(slugifyTopic('  AI  &  Data!! ')).toBe('ai-data');
  });
});

describe('deriveTopicsFromText (heuristic)', () => {
  it('weights tags strongest and title above body', () => {
    const out = deriveTopicsFromText({
      title: 'Automation roadmap',
      contentText: 'We discuss automation and process improvements for the factory floor.',
      tags: ['manufacturing'],
      max: 5,
    });
    expect(out.length).toBeGreaterThan(0);
    // tag is strongest signal → present and top score normalized to 1.
    const slugs = out.map((t) => t.slug);
    expect(slugs).toContain('manufacturing');
    expect(out[0].score).toBe(1);
    // automation appears in title (weight 3) + body → should surface.
    expect(slugs).toContain('automation');
  });

  it('drops stopwords and short tokens', () => {
    const out = deriveTopicsFromText({
      title: 'the and для',
      contentText: 'tak nie jak',
      tags: [],
    });
    expect(out).toHaveLength(0);
  });
});

describe('createTopic', () => {
  it('returns existing topic when slug already present (idempotent)', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 't1',
      organization_id: 'org1',
      name: 'Automation',
      slug: 'automation',
      created_at: '2026-06-20',
    });
    const topic = await createTopic('org1', 'Automation');
    expect(topic.id).toBe('t1');
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('inserts a new topic when slug is unseen', async () => {
    mockQueryOne
      .mockResolvedValueOnce(null) // no existing
      .mockResolvedValueOnce({
        id: 'uuid-1',
        organization_id: 'org1',
        name: 'Pricing',
        slug: 'pricing',
        created_at: '2026-06-20',
      }); // read-back
    const topic = await createTopic('org1', 'Pricing');
    expect(mockQueryRun).toHaveBeenCalledTimes(1);
    expect(topic.slug).toBe('pricing');
    expect(topic.id).toBe('uuid-1');
  });
});

describe('pinPageToTopic', () => {
  it('inserts when no existing link', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const link = await pinPageToTopic({ pageId: 'p1', topicId: 't1', score: 0.5, source: 'manual' });
    expect(link).toEqual({ pageId: 'p1', topicId: 't1', score: 0.5, source: 'manual' });
    const insertCall = mockQueryRun.mock.calls.find((c) => /INSERT INTO notebook_page_topics/.test(c[0]));
    expect(insertCall).toBeDefined();
  });

  it('updates score/source when link already exists (idempotent)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'link-1' });
    await pinPageToTopic({ pageId: 'p1', topicId: 't1', score: 0.9, source: 'ai' });
    const updateCall = mockQueryRun.mock.calls.find((c) => /UPDATE notebook_page_topics/.test(c[0]));
    expect(updateCall).toBeDefined();
    expect(updateCall?.[1]).toEqual([0.9, 'ai', 'link-1']);
  });
});

describe('unpinPageFromTopic', () => {
  it('issues a delete scoped to (page, topic)', async () => {
    await unpinPageFromTopic('p1', 't1');
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM notebook_page_topics/),
      ['p1', 't1']
    );
  });
});

describe('deriveTopicsForPage', () => {
  it('returns [] when page is missing', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const out = await deriveTopicsForPage('missing');
    expect(out).toEqual([]);
  });

  it('derives, upserts topics, and pins the page (persist path)', async () => {
    // 1) load page
    mockQueryOne.mockResolvedValueOnce({
      id: 'p1',
      organization_id: 'org1',
      title: 'Automation roadmap',
      content_text: 'automation automation factory',
      tags_json: '["manufacturing"]',
    });
    // createTopic for each candidate: existing lookup returns null → read-back returns row.
    // pinPageToTopic existing lookup returns null → insert.
    mockQueryOne.mockResolvedValue(null); // every subsequent existing-lookup → null

    const out = await deriveTopicsForPage('p1', { source: 'ai' });

    expect(out.length).toBeGreaterThan(0);
    // at least one INSERT into topics and one INSERT into page_topics happened
    const topicInserts = mockQueryRun.mock.calls.filter((c) => /INSERT INTO notebook_topics/.test(c[0]));
    const pinInserts = mockQueryRun.mock.calls.filter((c) => /INSERT INTO notebook_page_topics/.test(c[0]));
    expect(topicInserts.length).toBeGreaterThan(0);
    expect(pinInserts.length).toBe(out.length);
  });

  it('does not write when persist:false', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'p1',
      organization_id: 'org1',
      title: 'Pricing strategy',
      content_text: 'pricing pricing pricing',
      tags_json: '[]',
    });
    const out = await deriveTopicsForPage('p1', { persist: false });
    expect(out.length).toBeGreaterThan(0);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('refuses to derive across org boundary', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'p1',
      organization_id: 'orgA',
      title: 'x',
      content_text: 'automation',
      tags_json: '[]',
    });
    const out = await deriveTopicsForPage('p1', { orgId: 'orgB' });
    expect(out).toEqual([]);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });
});

describe('aggregateTopic', () => {
  it('returns null when topic not in org', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // getTopicById
    const agg = await aggregateTopic('org1', 'nope');
    expect(agg).toBeNull();
  });

  it('aggregates notes + buckets outputs/initiatives from edges', async () => {
    // getTopicById
    mockQueryOne.mockResolvedValueOnce({
      id: 't1',
      organization_id: 'org1',
      name: 'Automation',
      slug: 'automation',
      created_at: '2026-06-01',
    });
    // notes join
    mockQueryAll.mockResolvedValueOnce([
      { id: 'p1', title: 'Note 1', updated_at: '2026-06-19', score: 0.8, source: 'ai' },
      { id: 'p2', title: 'Note 2', updated_at: '2026-06-20', score: 0.5, source: 'manual' },
    ]);
    // link_graph_edges
    mockQueryAll.mockResolvedValueOnce([
      // page → output (report)
      { source_type: 'notebook_page', source_id: 'p1', target_type: 'report', target_id: 'r1' },
      // initiative → page
      { source_type: 'initiative', source_id: 'i1', target_type: 'notebook_page', target_id: 'p2' },
      // duplicate edge (should dedupe)
      { source_type: 'notebook_page', source_id: 'p1', target_type: 'report', target_id: 'r1' },
      // 'other' artifact (not surfaced in named buckets)
      { source_type: 'notebook_page', source_id: 'p1', target_type: 'comment', target_id: 'c1' },
    ]);

    const agg = await aggregateTopic('org1', 't1');
    expect(agg).not.toBeNull();
    expect(agg!.counts.notes).toBe(2);
    expect(agg!.counts.outputs).toBe(1);
    expect(agg!.counts.initiatives).toBe(1);
    expect(agg!.outputs[0]).toEqual({ type: 'report', id: 'r1', bucket: 'output' });
    expect(agg!.initiatives[0]).toEqual({ type: 'initiative', id: 'i1', bucket: 'initiative' });
    // lastActiveAt = max updated_at across notes
    expect(agg!.lastActiveAt).toBe('2026-06-20');
  });

  it('handles a topic with no notes (no edge query)', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 't2',
      organization_id: 'org1',
      name: 'Empty',
      slug: 'empty',
      created_at: '2026-06-01',
    });
    mockQueryAll.mockResolvedValueOnce([]); // notes
    const agg = await aggregateTopic('org1', 't2');
    expect(agg!.counts).toEqual({ notes: 0, outputs: 0, initiatives: 0 });
    // edges query should NOT run when there are no notes
    expect(mockQueryAll).toHaveBeenCalledTimes(1);
  });
});

describe('default export surface', () => {
  it('exposes the contract methods', () => {
    expect(typeof notebookTopicService.deriveTopicsForPage).toBe('function');
    expect(typeof notebookTopicService.aggregateTopic).toBe('function');
    expect(typeof notebookTopicService.pinPageToTopic).toBe('function');
  });
});
