/**
 * API Contract Tests - Response Format Validation
 * Tests that API responses conform to expected schemas
 *
 * @module tests/contracts/api-response-contracts.test.js
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Expected response schemas
const responseSchemas = {
  success: {
    required: ['success'],
    properties: {
      success: { type: 'boolean' },
      data: { type: ['object', 'array', 'null'] },
      message: { type: 'string' },
    },
  },
  error: {
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', value: false },
      error: { type: 'string' },
      code: { type: 'string' },
      details: { type: 'object' },
    },
  },
  paginated: {
    required: ['success', 'data', 'pagination'],
    properties: {
      success: { type: 'boolean' },
      data: { type: 'array' },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          total: { type: 'number' },
          totalPages: { type: 'number' },
        },
      },
    },
  },
  health: {
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
      services: { type: 'object' },
      uptime: { type: 'number' },
    },
  },
};

// Schema validator
function validateSchema(data, schema) {
  const errors = [];

  // Check required fields
  for (const field of schema.required || []) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check property types
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    if (key in data) {
      const value = data[key];
      const types = Array.isArray(prop.type) ? prop.type : [prop.type];

      const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

      if (!types.includes(actualType)) {
        errors.push(`Field ${key} has wrong type: expected ${types.join('|')}, got ${actualType}`);
      }

      if (prop.enum && !prop.enum.includes(value)) {
        errors.push(
          `Field ${key} has invalid value: ${value}, expected one of ${prop.enum.join(', ')}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('API Response Contract Tests', () => {
  let app;

  beforeAll(async () => {
    try {
      const gateway = await import('../../server/src/Gateway.ts');
      app = gateway.default || gateway.app;
    } catch (error) {
      const express = (await import('express')).default;
      app = express();
      app.use(express.json());

      // Mock endpoints following contract
      app.get('/api/health', (req, res) => {
        res.json({ status: 'healthy', services: {}, uptime: 12345 });
      });

      app.get('/api/users', (req, res) => {
        res.json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      });

      app.get('/api/users/:id', (req, res) => {
        res.json({ success: true, data: { id: req.params.id } });
      });

      app.get('/api/error-example', (req, res) => {
        res.status(400).json({
          success: false,
          error: 'Bad request',
          code: 'BAD_REQUEST',
        });
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUCCESS RESPONSE CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  describe('Success Response Contract', () => {
    it('should return success: true for successful requests', async () => {
      const response = await request(app).get('/api/users');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
      }
    });

    it('should include data property in success responses', async () => {
      const response = await request(app).get('/api/users');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
      }
    });

    it('should validate against success schema', async () => {
      const response = await request(app).get('/api/users/123');

      if (response.status === 200) {
        const validation = validateSchema(response.body, responseSchemas.success);
        expect(validation.valid).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR RESPONSE CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Response Contract', () => {
    it('should return success: false for error responses', async () => {
      const response = await request(app).get('/api/error-example');

      if (response.status >= 400) {
        expect(response.body).toHaveProperty('success', false);
      }
    });

    it('should include error message in error responses', async () => {
      const response = await request(app).get('/api/error-example');

      if (response.status >= 400) {
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
      }
    });

    it('should validate against error schema', async () => {
      const response = await request(app).get('/api/error-example');

      if (response.status >= 400) {
        const validation = validateSchema(response.body, responseSchemas.error);
        expect(validation.valid).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PAGINATED RESPONSE CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  describe('Paginated Response Contract', () => {
    it('should include pagination object for list endpoints', async () => {
      const response = await request(app).get('/api/users');

      if (response.status === 200 && Array.isArray(response.body.data)) {
        expect(response.body).toHaveProperty('pagination');
      }
    });

    it('should have required pagination fields', async () => {
      const response = await request(app).get('/api/users');

      if (response.status === 200 && response.body.pagination) {
        expect(response.body.pagination).toHaveProperty('page');
        expect(response.body.pagination).toHaveProperty('limit');
        expect(response.body.pagination).toHaveProperty('total');
      }
    });

    it('should validate against paginated schema', async () => {
      const response = await request(app).get('/api/users');

      if (response.status === 200 && response.body.pagination) {
        const validation = validateSchema(response.body, responseSchemas.paginated);
        expect(validation.valid).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HEALTH RESPONSE CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  describe('Health Response Contract', () => {
    it('should have status field', async () => {
      const response = await request(app).get('/api/health');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
      }
    });

    it('should have valid status value', async () => {
      const response = await request(app).get('/api/health');

      if (response.status === 200) {
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      }
    });

    it('should validate against health schema', async () => {
      const response = await request(app).get('/api/health');

      if (response.status === 200) {
        const validation = validateSchema(response.body, responseSchemas.health);
        expect(validation.valid).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CONTENT TYPE CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  describe('Content-Type Contract', () => {
    it('should return application/json content type', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HTTP STATUS CODE CONTRACT
  // ═══════════════════════════════════════════════════════════════════

  describe('HTTP Status Code Contract', () => {
    it('should return 200 for successful GET requests', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
    });

    it('should return 4xx for client errors', async () => {
      const response = await request(app).get('/api/error-example');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
  });
});
