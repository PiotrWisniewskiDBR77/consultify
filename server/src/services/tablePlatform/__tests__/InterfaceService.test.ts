import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { InterfaceService } from '../InterfaceService.js';

describe('InterfaceService', () => {
  let service: InterfaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InterfaceService();
  });

  // -----------------------------------------------------------------------
  // createInterface
  // -----------------------------------------------------------------------

  describe('createInterface', () => {
    it('inserts with base_id and returns row', async () => {
      const row = { id: 'ifc-1', base_id: 'b-1', name: 'Dashboard', description: null };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await service.createInterface('b-1', { name: 'Dashboard' });

      expect(result.id).toBe('ifc-1');
      expect(result.base_id).toBe('b-1');
      expect(result.name).toBe('Dashboard');

      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[0]).toContain('INSERT INTO tp_interfaces');
      expect(insertCall[1][0]).toBe('b-1');
      expect(insertCall[1][1]).toBe('Dashboard');
    });

    it('passes description and createdBy when provided', async () => {
      const row = { id: 'ifc-1', base_id: 'b-1', name: 'Dash', description: 'My dash' };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      await service.createInterface('b-1', {
        name: 'Dash',
        description: 'My dash',
        createdBy: 'user-1',
      });

      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[1][2]).toBe('My dash');
      expect(insertCall[1][3]).toBe('user-1');
    });
  });

  // -----------------------------------------------------------------------
  // updateLayout
  // -----------------------------------------------------------------------

  describe('updateLayout', () => {
    it('stores blocks JSON and returns updated row', async () => {
      const layout = {
        blocks: [
          {
            id: 'blk-1',
            type: 'table_grid' as const,
            config: {},
            position: { x: 0, y: 0, w: 12, h: 6 },
          },
        ],
        theme: { primaryColor: '#3B82F6' },
      };
      const updatedRow = { id: 'ifc-1', layout: JSON.stringify(layout) };
      mockQuery.mockResolvedValueOnce({ rows: [updatedRow] });

      const result = await service.updateLayout('ifc-1', layout);

      expect(result).not.toBeNull();
      expect(result.id).toBe('ifc-1');

      const updateCall = mockQuery.mock.calls[0];
      expect(updateCall[0]).toContain('UPDATE tp_interfaces SET layout');
      expect(updateCall[1][0]).toBe('ifc-1');
      const storedLayout = JSON.parse(updateCall[1][1]);
      expect(storedLayout.blocks).toHaveLength(1);
      expect(storedLayout.theme.primaryColor).toBe('#3B82F6');
    });

    it('returns null when interface not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.updateLayout('nonexistent', { blocks: [] });
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // publishInterface
  // -----------------------------------------------------------------------

  describe('publishInterface', () => {
    it('generates share token (32 hex chars)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.publishInterface('ifc-1');

      expect(result.shareToken).toBeDefined();
      expect(result.shareToken.length).toBe(32); // 16 bytes hex
      expect(/^[a-f0-9]+$/.test(result.shareToken)).toBe(true);

      const updateCall = mockQuery.mock.calls[0];
      expect(updateCall[0]).toContain('published = true');
      expect(updateCall[0]).toContain('share_token');
      expect(updateCall[1][0]).toBe('ifc-1');
    });
  });

  // -----------------------------------------------------------------------
  // getPublicInterface
  // -----------------------------------------------------------------------

  describe('getPublicInterface', () => {
    it('returns only published interfaces by share token', async () => {
      const row = { id: 'ifc-1', published: true, share_token: 'abc123', name: 'Public Dash' };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await service.getPublicInterface('abc123');

      expect(result).not.toBeNull();
      expect(result.id).toBe('ifc-1');
      expect(result.published).toBe(true);

      const selectCall = mockQuery.mock.calls[0];
      expect(selectCall[0]).toContain('published = true');
      expect(selectCall[1]).toEqual(['abc123']);
    });

    it('returns null for non-published or missing token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getPublicInterface('invalid-token');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // unpublishInterface
  // -----------------------------------------------------------------------

  describe('unpublishInterface', () => {
    it('clears share token and sets published to false', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.unpublishInterface('ifc-1');

      const updateCall = mockQuery.mock.calls[0];
      expect(updateCall[0]).toContain('published = false');
      expect(updateCall[0]).toContain('share_token = NULL');
      expect(updateCall[1][0]).toBe('ifc-1');
    });
  });

  // -----------------------------------------------------------------------
  // listInterfaces
  // -----------------------------------------------------------------------

  describe('listInterfaces', () => {
    it('returns all interfaces for a base', async () => {
      const rows = [
        { id: 'ifc-1', base_id: 'b-1', name: 'Dash 1' },
        { id: 'ifc-2', base_id: 'b-1', name: 'Dash 2' },
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.listInterfaces('b-1');
      expect(result).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // deleteInterface
  // -----------------------------------------------------------------------

  describe('deleteInterface', () => {
    it('deletes interface by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.deleteInterface('ifc-1');

      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM tp_interfaces WHERE id = $1', ['ifc-1']);
    });
  });

  // -----------------------------------------------------------------------
  // updateAllowedRoles
  // -----------------------------------------------------------------------

  describe('updateAllowedRoles', () => {
    it('updates allowed_roles array', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.updateAllowedRoles('ifc-1', ['admin', 'editor']);

      const updateCall = mockQuery.mock.calls[0];
      expect(updateCall[0]).toContain('allowed_roles');
      expect(updateCall[1]).toEqual(['ifc-1', ['admin', 'editor']]);
    });
  });
});
