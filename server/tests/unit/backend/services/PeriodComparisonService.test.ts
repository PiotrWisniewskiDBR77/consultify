/**
 * PeriodComparisonService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// Use vi.hoisted to ensure mock data is available to vi.mock
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    exec: vi.fn(),
    serialize: vi.fn(),
    close: vi.fn(),
    query: vi.fn(),
  },
}));

// Mock the Database module
vi.mock('../../../../src/database/Database.ts', () => ({
  getDatabase: () => mockDb,
  default: mockDb,
}));

import PeriodComparisonService from '../../../../src/services/periodComparisonService.js';

describe('PeriodComparisonService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPreviousReport', () => {
    it('should find the most recent previous report of same type', async () => {
      const currentReport = {
        id: 'report2',
        organization_id: 'org1',
        project_id: 'proj1',
        report_type: 'TEAM_MEETING',
        scope: 'PROJECT',
        created_at: '2025-12-28T12:00:00Z',
      };

      (mockDb.get as Mock).mockImplementation(
        (sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
          if (sql.includes('FROM management_reports') && params && params[0] === 'report2') {
            callback(null, currentReport);
          } else if (sql.includes('ORDER BY created_at DESC')) {
            callback(null, {
              id: 'report1',
              organization_id: 'org1',
              project_id: 'proj1',
              report_type: 'TEAM_MEETING',
              created_at: '2025-12-21T12:00:00Z',
              content: JSON.stringify({
                statusSummary: { tasksCompletedPeriod: 5, progressPercent: 40 },
              }),
            });
          } else {
            callback(null, null);
          }
        }
      );

      const result = await PeriodComparisonService.getPreviousReport('report2');

      expect(result).not.toBeNull();
      expect(result.id).toBe('report1');
    });
  });

  describe('calculateChanges', () => {
    it('should calculate numeric changes with percentages', () => {
      const currentReport = {
        content: {
          statusSummary: {
            tasksCompletedPeriod: 15,
            progressPercent: 60,
          },
          blockers: [{}, {}],
        },
      };

      const previousReport = {
        content: {
          statusSummary: {
            tasksCompletedPeriod: 10,
            progressPercent: 45,
          },
          blockers: [{}, {}, {}],
        },
      };

      const result = PeriodComparisonService.calculateChanges(currentReport, previousReport);

      expect(result.tasksCompleted.current).toBe(15);
      expect(result.tasksCompleted.previous).toBe(10);
      expect(result.tasksCompleted.change).toBe(5);
      expect(result.tasksCompleted.changePercent).toBe(50);
      expect(result.tasksCompleted.trend).toBe('UP');

      expect(result.blockers.current).toBe(2);
      expect(result.blockers.previous).toBe(3);
      expect(result.blockers.trend).toBe('UP'); // Improvement (fewer is better)
    });
  });

  describe('generateComparisonData', () => {
    it('should generate full comparison data for report', async () => {
      const currentReport = {
        id: 'report2',
        organization_id: 'org1',
        report_type: 'TEAM_MEETING',
        created_at: '2025-12-28T12:00:00Z',
        content: JSON.stringify({
          statusSummary: { tasksCompletedPeriod: 15, progressPercent: 60 },
        }),
      };

      (mockDb.get as Mock).mockImplementation(
        (sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
          if (sql.includes('FROM management_reports') && params && params[0] === 'report2') {
            callback(null, currentReport);
          } else {
            callback(null, {
              id: 'report1',
              content: JSON.stringify({
                statusSummary: { tasksCompletedPeriod: 10, progressPercent: 45 },
              }),
            });
          }
        }
      );

      const result = await PeriodComparisonService.generateComparisonData('report2');

      expect(result.previousReportId).toBe('report1');
      expect(result.changes.tasksCompleted.trend).toBe('UP');
    });
  });
});
