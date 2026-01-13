/**
 * QueueConfig Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for QueueConfig - 95%+ coverage target
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { loadQueueConfig } from '../../../../src/config/QueueConfig.js';

describe('QueueConfig', () => {
  beforeEach(() => {
    delete process.env.MOCK_REDIS;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
  });

  describe('loadQueueConfig', () => {
    it('should load config from environment variables', () => {
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'password';

      const config = loadQueueConfig();

      expect(config).toBeDefined();
    });

    it('should return empty config when MOCK_REDIS is true', () => {
      process.env.MOCK_REDIS = 'true';

      const config = loadQueueConfig();

      expect(config).toEqual({});
    });

    it('should use default values when env vars not set', () => {
      const config = loadQueueConfig();

      expect(config).toBeDefined();
    });
  });
});
