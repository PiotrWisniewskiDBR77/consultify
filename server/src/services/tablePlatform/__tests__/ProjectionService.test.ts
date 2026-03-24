import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import projectionService from '../ProjectionService.js';

describe('ProjectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectionService.clearCache();
  });

  // -----------------------------------------------------------------------
  // resolveBaseId
  // -----------------------------------------------------------------------

  describe('resolveBaseId', () => {
    it('returns baseId and tableId when found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ base_id: 'b-1', table_id: 't-1' }],
      });

      const result = await projectionService.resolveBaseId('idea-1', 'org-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.baseId).toBe('b-1');
      expect(result!.tableId).toBe('t-1');
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await projectionService.resolveBaseId('nonexistent', 'org-1', 'user-1');

      expect(result).toBeNull();
    });

    it('returns null on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection failed'));

      const result = await projectionService.resolveBaseId('idea-1', 'org-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // projectRecordsAsNodes
  // -----------------------------------------------------------------------

  describe('projectRecordsAsNodes', () => {
    it('maps records to GraphNode format', async () => {
      const records = [
        { id: 'rec-1', data: { Name: 'Alice', Status: 'Active' }, created_at: '2025-01-01' },
        { id: 'rec-2', data: { Name: 'Bob', Status: 'Done' }, created_at: '2025-01-02' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: records });

      const nodes = await projectionService.projectRecordsAsNodes('t-1');

      expect(nodes).toHaveLength(2);
      expect(nodes[0]).toEqual({
        id: 'rec-1',
        type: 'table_row',
        data: { Name: 'Alice', Status: 'Active' },
        position: { x: 0, y: 0 },
      });
      expect(nodes[1].position.y).toBe(40);
    });

    it('returns empty array for empty tableId', async () => {
      const nodes = await projectionService.projectRecordsAsNodes('');
      expect(nodes).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('parses stringified JSON data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'rec-1', data: '{"Name":"Test"}', created_at: '2025-01-01' }],
      });

      const nodes = await projectionService.projectRecordsAsNodes('t-1');

      expect(nodes[0].data).toEqual({ Name: 'Test' });
    });

    it('returns empty array on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('query failed'));

      const nodes = await projectionService.projectRecordsAsNodes('t-1');
      expect(nodes).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // projectLinksAsEdges
  // -----------------------------------------------------------------------

  describe('projectLinksAsEdges', () => {
    it('maps links to GraphEdge format', async () => {
      const links = [
        { from_record_id: 'rec-1', from_field_id: 'f-1', to_record_id: 'rec-2' },
        { from_record_id: 'rec-3', from_field_id: 'f-2', to_record_id: 'rec-4' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: links });

      const edges = await projectionService.projectLinksAsEdges('t-1');

      expect(edges).toHaveLength(2);
      expect(edges[0]).toEqual({
        id: 'rec-1-f-1-rec-2',
        source: 'rec-1',
        target: 'rec-2',
        type: 'relation',
      });
    });

    it('returns empty array for empty tableId', async () => {
      const edges = await projectionService.projectLinksAsEdges('');
      expect(edges).toEqual([]);
    });

    it('returns empty array on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('query failed'));

      const edges = await projectionService.projectLinksAsEdges('t-1');
      expect(edges).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // projectTableExtensions
  // -----------------------------------------------------------------------

  describe('projectTableExtensions', () => {
    it('maps fields and views to extensions format', async () => {
      const fields = [
        { id: 'f-1', name: 'Name', field_type: 'single_line_text', options: null, field_order: 0 },
        { id: 'f-2', name: 'Status', field_type: 'single_select', options: '{"choices":["A","B"]}', field_order: 1 },
      ];
      const views = [
        { id: 'v-1', name: 'Grid', view_type: 'grid', config: '{}', visible_field_ids: null },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: fields })
        .mockResolvedValueOnce({ rows: views });

      const ext = await projectionService.projectTableExtensions('b-1', 't-1');

      expect(ext.columns).toHaveLength(2);
      expect(ext.columns[0]).toEqual({
        id: 'f-1',
        key: 'f-1',
        name: 'Name',
        type: 'text',
        options: undefined,
        visible: true,
        width: undefined,
      });
      expect(ext.columns[1].type).toBe('select');
      expect(ext.columns[1].options).toEqual({ choices: ['A', 'B'] });

      expect(ext.views).toHaveLength(1);
      expect(ext.views[0]).toEqual({
        id: 'v-1',
        name: 'Grid',
        type: 'grid',
        config: {},
      });
    });

    it('returns empty columns and views for empty tableId', async () => {
      const ext = await projectionService.projectTableExtensions('b-1', '');
      expect(ext.columns).toEqual([]);
      expect(ext.views).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Cache
  // -----------------------------------------------------------------------

  describe('cache', () => {
    it('returns cached result within TTL', async () => {
      // First call: resolveBaseId + projectRecordsAsNodes + projectLinksAsEdges + projectTableExtensions
      mockQuery
        .mockResolvedValueOnce({ rows: [{ base_id: 'b-1', table_id: 't-1' }] }) // resolveBaseId
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1', data: {}, created_at: '2025-01-01' }] }) // projectRecordsAsNodes
        .mockResolvedValueOnce({ rows: [] }) // projectLinksAsEdges
        .mockResolvedValueOnce({ rows: [] }) // projectTableExtensions: fields
        .mockResolvedValueOnce({ rows: [] }); // projectTableExtensions: views

      const first = await projectionService.getFullProjection('idea-1', 'org-1', 'user-1');
      expect(first).not.toBeNull();

      // Second call should use cache — resolveBaseId still called but rest from cache
      mockQuery
        .mockResolvedValueOnce({ rows: [{ base_id: 'b-1', table_id: 't-1' }] }); // resolveBaseId

      const second = await projectionService.getFullProjection('idea-1', 'org-1', 'user-1');
      expect(second).toEqual(first);

      // Only 6 queries total (5 for first + 1 resolveBaseId for second)
      expect(mockQuery).toHaveBeenCalledTimes(6);
    });
  });

  // -----------------------------------------------------------------------
  // invalidateCache
  // -----------------------------------------------------------------------

  describe('invalidateCache', () => {
    it('clears cache entries for a given baseId', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ base_id: 'b-1', table_id: 't-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await projectionService.getFullProjection('idea-1', 'org-1', 'user-1');

      projectionService.invalidateCache('b-1');

      // After invalidation, next call should re-fetch everything
      mockQuery
        .mockResolvedValueOnce({ rows: [{ base_id: 'b-1', table_id: 't-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await projectionService.getFullProjection('idea-1', 'org-1', 'user-1');

      // 5 (first) + 5 (after invalidation) = 10 queries
      expect(mockQuery).toHaveBeenCalledTimes(10);
    });
  });

  // -----------------------------------------------------------------------
  // clearCache
  // -----------------------------------------------------------------------

  describe('clearCache', () => {
    it('clears all cache entries', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ base_id: 'b-1', table_id: 't-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await projectionService.getFullProjection('idea-1', 'org-1', 'user-1');

      projectionService.clearCache();

      mockQuery
        .mockResolvedValueOnce({ rows: [{ base_id: 'b-1', table_id: 't-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await projectionService.getFullProjection('idea-1', 'org-1', 'user-1');

      expect(mockQuery).toHaveBeenCalledTimes(10);
    });
  });
});
