/**
 * AI External Data Unit Tests
 * Tests external data fetching, caching, and integration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI External Data Service implementation
const createAIExternalDataService = () => {
  const cache = new Map();
  const sources = new Map();
  let counter = 0;

  return {
    registerSource: (name, config) => {
      sources.set(name, {
        name,
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        transform: config.transform || ((data) => data),
        cacheTTL: config.cacheTTL || 300, // 5 min default
      });
    },

    fetch: async (sourceName, query = {}) => {
      const source = sources.get(sourceName);
      if (!source) throw new Error(`Unknown source: ${sourceName}`);

      // Check cache
      const cacheKey = `${sourceName}:${JSON.stringify(query)}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < source.cacheTTL * 1000) {
        return { ...cached.data, cached: true };
      }

      // Simulate fetch
      const rawData = {
        id: `fetch-${Date.now()}-${++counter}`,
        source: sourceName,
        query,
        items: generateMockData(sourceName, query),
        fetchedAt: new Date(),
      };

      // Transform
      const transformed = source.transform(rawData);

      // Cache result
      cache.set(cacheKey, { data: transformed, timestamp: Date.now() });

      return { ...transformed, cached: false };
    },

    getCacheStats: () => ({
      size: cache.size,
      sources: Array.from(sources.keys()),
    }),

    clearCache: (sourceName = null) => {
      if (sourceName) {
        for (const key of cache.keys()) {
          if (key.startsWith(`${sourceName}:`)) {
            cache.delete(key);
          }
        }
      } else {
        cache.clear();
      }
    },

    isSourceRegistered: (name) => sources.has(name),

    enrichContext: async function (context, sourceNames) {
      const enriched = { ...context };
      for (const sourceName of sourceNames) {
        try {
          const data = await this.fetch(sourceName, context);
          enriched[`${sourceName}_data`] = data.items;
        } catch (e) {
          enriched[`${sourceName}_error`] = e.message;
        }
      }
      return enriched;
    },

    validateSource: (config) => {
      const errors = [];
      if (!config.endpoint) errors.push('Endpoint is required');
      if (!config.name) errors.push('Name is required');
      return { valid: errors.length === 0, errors };
    },
  };
};

function generateMockData(source, query) {
  // Simulate different data based on source
  const mockData = {
    weather: [{ temp: 22, condition: 'sunny' }],
    news: [{ title: 'Latest news', summary: 'Summary...' }],
    stocks: [{ symbol: 'AAPL', price: 185.5 }],
  };
  return mockData[source] || [{ type: 'generic', query }];
}

describe('AIExternalDataService', () => {
  let dataService;

  beforeEach(() => {
    dataService = createAIExternalDataService();
  });

  describe('Source Registration', () => {
    it('should register data source', () => {
      dataService.registerSource('weather', {
        endpoint: 'https://api.weather.com',
        apiKey: 'key123',
      });

      expect(dataService.isSourceRegistered('weather')).toBe(true);
    });

    it('should validate source config', () => {
      const valid = dataService.validateSource({ name: 'test', endpoint: 'http://api.com' });
      const invalid = dataService.validateSource({ name: 'test' });

      expect(valid.valid).toBe(true);
      expect(invalid.valid).toBe(false);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data from registered source', async () => {
      dataService.registerSource('weather', { endpoint: 'http://api.test' });

      const result = await dataService.fetch('weather', { city: 'NYC' });

      expect(result.id).toBeDefined();
      expect(result.source).toBe('weather');
      expect(result.cached).toBe(false);
    });

    it('should throw for unknown source', async () => {
      await expect(dataService.fetch('unknown')).rejects.toThrow('Unknown source: unknown');
    });

    it('should apply transform function', async () => {
      dataService.registerSource('custom', {
        endpoint: 'http://api.test',
        transform: (data) => ({ ...data, transformed: true }),
      });

      const result = await dataService.fetch('custom');
      expect(result.transformed).toBe(true);
    });
  });

  describe('Caching', () => {
    it('should cache results', async () => {
      dataService.registerSource('cacheable', { endpoint: 'http://api.test', cacheTTL: 60 });

      const first = await dataService.fetch('cacheable', { q: 'test' });
      const second = await dataService.fetch('cacheable', { q: 'test' });

      expect(first.cached).toBe(false);
      expect(second.cached).toBe(true);
    });

    it('should return cache stats', async () => {
      dataService.registerSource('src1', { endpoint: 'http://api1.test' });
      dataService.registerSource('src2', { endpoint: 'http://api2.test' });
      await dataService.fetch('src1');

      const stats = dataService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.sources).toContain('src1');
    });

    it('should clear cache', async () => {
      dataService.registerSource('src', { endpoint: 'http://api.test' });
      await dataService.fetch('src');

      dataService.clearCache();
      expect(dataService.getCacheStats().size).toBe(0);
    });
  });

  describe('Context Enrichment', () => {
    it('should enrich context with external data', async () => {
      dataService.registerSource('weather', { endpoint: 'http://weather.api' });

      const enriched = await dataService.enrichContext({ userId: 'user-1' }, ['weather']);

      expect(enriched.weather_data).toBeDefined();
    });
  });
});
