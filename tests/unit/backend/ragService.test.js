import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

// Mock DB
const mockDb = {
  get: vi.fn((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    if (callback) callback(null, null);
  }),
  all: vi.fn((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    const p = typeof params === 'function' ? [] : params;
    if (callback) callback(null, []);
  }),
  run: vi.fn((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    if (callback) callback(null);
  }),
  query: vi.fn(),
};

describe('RagService - Integration', () => {
  let RagService;

  beforeAll(async () => {
    console.log('RagService Test: Starting beforeAll');
    vi.resetModules();

    // Mock both potential DB locations
    const mockDbConfig = () => ({
      default: mockDb,
      getDatabase: () => mockDb,
    });

    vi.doMock('../../../server/database.js', mockDbConfig);
    vi.doMock('../../../server/src/database/index.js', mockDbConfig);

    // Mock OpenAI or other internals if needed
    // Assuming RagService imports DB directly or via BaseService

    const mod = await import('../../../server/src/services/ragService.js');
    RagService = mod.default || mod;

  });

  beforeEach(() => {
    vi.clearAllMocks();
    // ★ DAY211 — the global setup clears chained implementations. Reinstall
    // the cheap dependency mocks here after that global beforeEach.
    if (RagService.setDependencies) {
      RagService.setDependencies({
        db: mockDb,
        uuidv4: vi.fn().mockReturnValue('mock-uuid'),
        embeddingService: {
          generateEmbedding: vi.fn().mockResolvedValue([]),
          storeChunk: vi.fn().mockResolvedValue(),
          search: vi.fn().mockResolvedValue([]),
        },
        OpenAI: vi.fn(),
      });
    }
  });

  describe('generateEmbedding', () => {
    it('should return null if no provider configured', async () => {
      // Mock getProvider to return null or no settings
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (cb) cb(null, null); // No settings
      });

      // Note: If RagService calls external APIs, we might need to mock them too
      // But this test specifically checks fallback/null behavior
      const embedding = await RagService.generateEmbedding('test query');
      expect(embedding).toBeNull();
    });
  });

  describe('getContext', () => {
    it('should return context string without throwing', async () => {
      // Mock empty results for context search
      mockDb.all.mockImplementation((sql, params, cb) => {
        if (cb) cb(null, []);
      });

      const context = await RagService.getContext('test query');
      expect(typeof context === 'string').toBe(true);
      expect(context).toBe('');
    });

    it('should accept limit parameter', async () => {
      mockDb.all.mockImplementation((sql, params, cb) => {
        if (cb) cb(null, []);
      });

      const context = await RagService.getContext('test query', 5);
      expect(typeof context === 'string').toBe(true);
    });
  });

  describe('getContextKeyword', () => {
    it('should perform keyword search without throwing', async () => {
      mockDb.all.mockImplementation((sql, params, cb) => {
        if (cb) cb(null, []);
      });

      const context = await RagService.getContextKeyword('digital transformation');
      expect(typeof context === 'string').toBe(true);
    });
  });

  describe('getAxisDefinitions', () => {
    it('should retrieve axis definitions without throwing', async () => {
      // Mock db response for axis definition
      mockDb.get.mockImplementation((sql, params, cb) => {
        if (cb) cb(null, { definition: 'Test definition' });
      });

      const definitions = await RagService.getAxisDefinitions('processes');
      expect(typeof definitions === 'string').toBe(true);
    });
  });
});
