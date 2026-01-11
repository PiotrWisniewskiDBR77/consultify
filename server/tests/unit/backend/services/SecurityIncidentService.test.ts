/**
 * SecurityIncidentService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for SecurityIncidentService - 85%+ coverage target
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../../../src/database/IDatabase.js';
import SecurityIncidentService from '../../../../src/services/securityIncidentService.js';

describe('SecurityIncidentService', () => {
  let mockDb: IDatabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
        const dbObj = {
          ...mockDb,
          changes: 1,
          lastID: 1,
        };
        if (callback) {
          callback(null);
        }
        return dbObj;
      }),
      exec: vi.fn(),
      serialize: vi.fn(),
      close: vi.fn(),
      query: vi.fn(),
    } as unknown as IDatabase;

    if (SecurityIncidentService.setDependencies) {
      SecurityIncidentService.setDependencies({ db: mockDb });
    }
  });

  describe('Service Methods', () => {
    it('should fetch incidents with filters and mapping', async () => {
      const mockRows = [
        {
          id: '1',
          type: 'unauthorized_access',
          severity: 'high',
          status: 'open',
          description: 'Test',
          metadata_json: JSON.stringify({ affectedResources: ['resource1'] }),
          created_at: '2026-01-10T20:00:00Z',
          user_id: null,
        },
      ];
      (mockDb.all as any).mockResolvedValue(mockRows);

      const result = await SecurityIncidentService.getIncidents({ limit: 5 });

      expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [5, 0]);
      expect(result[0].incidentType).toBe('unauthorized_access');
      expect(result[0].affectedResources).toEqual(['resource1']);
    });

    it('should fetch incident statistics as nested object', async () => {
      const mockRow = {
        total: 10,
        open_count: 5,
        in_progress_count: 2,
        resolved_count: 2,
        closed_count: 1,
        critical_count: 2,
        high_count: 3,
        medium_count: 4,
        low_count: 1,
      };
      (mockDb.get as any).mockResolvedValue(mockRow);

      const result = await SecurityIncidentService.getStats();

      expect(result.totalIncidents).toBe(10);
      expect(result.byStatus.open).toBe(5);
      expect(result.bySeverity.critical).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (mockDb.get as any).mockRejectedValue(new Error('Database error'));

      await expect(SecurityIncidentService.getStats()).rejects.toThrow('Database error');
    });
  });
});
