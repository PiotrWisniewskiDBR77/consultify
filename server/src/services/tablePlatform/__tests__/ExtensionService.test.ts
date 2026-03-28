import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockClientRelease = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({
    query: mockQuery,
    connect: vi.fn().mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    }),
  }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { ExtensionService } from '../ExtensionService.js';

describe('ExtensionService', () => {
  let service: ExtensionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExtensionService();
  });

  // -----------------------------------------------------------------------
  // registerExtension
  // -----------------------------------------------------------------------

  describe('registerExtension', () => {
    it('creates with draft status', async () => {
      const extensionRow = {
        id: 'ext-1',
        name: 'My Extension',
        description: null,
        version: '1.0.0',
        author: null,
        icon_url: null,
        source_url: 'https://cdn.example.com/ext.js',
        scopes: ['records:read'],
        status: 'draft',
        category: 'utility',
        install_count: 0,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      };
      mockQuery.mockResolvedValueOnce({ rows: [extensionRow] });

      const result = await service.registerExtension({
        name: 'My Extension',
        sourceUrl: 'https://cdn.example.com/ext.js',
      });

      expect(result.status).toBe('draft');
      expect(result.name).toBe('My Extension');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tp_extensions'),
        expect.arrayContaining(['My Extension'])
      );
    });
  });

  // -----------------------------------------------------------------------
  // listPublishedExtensions
  // -----------------------------------------------------------------------

  describe('listPublishedExtensions', () => {
    it('only returns published extensions', async () => {
      const rows = [
        { id: 'ext-1', name: 'Published One', status: 'published', install_count: 10 },
        { id: 'ext-2', name: 'Published Two', status: 'published', install_count: 5 },
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.listPublishedExtensions();

      expect(result).toHaveLength(2);
      const selectSql = mockQuery.mock.calls[0][0] as string;
      expect(selectSql).toContain("status = 'published'");
    });

    it('filters by category when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.listPublishedExtensions('visualization');

      const selectSql = mockQuery.mock.calls[0][0] as string;
      expect(selectSql).toContain('category = $1');
      expect(mockQuery.mock.calls[0][1]).toEqual(['visualization']);
    });
  });

  // -----------------------------------------------------------------------
  // installExtension
  // -----------------------------------------------------------------------

  describe('installExtension', () => {
    it('creates install record and increments count', async () => {
      const installRow = {
        id: 'inst-1',
        extension_id: 'ext-1',
        base_id: 'b-1',
        installed_by: 'user-1',
        config: {},
        created_at: '2025-01-01',
      };
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [installRow] }) // INSERT install
        .mockResolvedValueOnce({ rows: [] }) // UPDATE install_count
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.installExtension('ext-1', 'b-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.extension_id).toBe('ext-1');
      expect(result!.base_id).toBe('b-1');

      const incrementCall = mockClientQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('install_count = install_count + 1')
      );
      expect(incrementCall).toBeDefined();
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('rolls back on error', async () => {
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('constraint violation')) // INSERT fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(service.installExtension('ext-bad', 'b-1')).rejects.toThrow(
        'constraint violation'
      );

      const rollbackCall = mockClientQuery.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0] === 'ROLLBACK'
      );
      expect(rollbackCall).toBeDefined();
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // uninstallExtension
  // -----------------------------------------------------------------------

  describe('uninstallExtension', () => {
    it('removes install record', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'inst-1' }] }) // DELETE RETURNING
        .mockResolvedValueOnce({ rows: [] }); // UPDATE install_count

      const result = await service.uninstallExtension('ext-1', 'b-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tp_extension_installs'),
        ['ext-1', 'b-1']
      );
    });

    it('returns false when no install exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.uninstallExtension('ext-missing', 'b-1');

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // publishExtension
  // -----------------------------------------------------------------------

  describe('publishExtension', () => {
    it('sets status to published', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.publishExtension('ext-1');

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'published'"), [
        'ext-1',
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // getInstalledExtensions
  // -----------------------------------------------------------------------

  describe('getInstalledExtensions', () => {
    it('joins extension data with install config', async () => {
      const rows = [
        {
          id: 'ext-1',
          name: 'Charts',
          status: 'published',
          install_config: { theme: 'dark' },
          installed_at: '2025-01-01',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.getInstalledExtensions('b-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Charts');
      expect(result[0].install_config).toEqual({ theme: 'dark' });

      const selectSql = mockQuery.mock.calls[0][0] as string;
      expect(selectSql).toContain('JOIN tp_extensions');
      expect(mockQuery.mock.calls[0][1]).toEqual(['b-1']);
    });
  });
});
