import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/notificationService.js', () => {
  return {
    default: {
      send: vi.fn(async () => 'notif-1'),
    },
  };
});

import notificationService from '../../../../server/src/services/notificationService.js';
import {
  evaluateKpiPoint,
  handleTimeSeriesRecorded,
} from '../../../../server/src/services/results/kpiDeviationService.js';

describe('kpiDeviationService', () => {
  describe('evaluateKpiPoint', () => {
    it('classifies AMBER for percent thresholds (higher is better)', () => {
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Throughput',
          targetValue: 100,
          direction: 'HIGHER_IS_BETTER',
          thresholdMode: 'PERCENT_FROM_TARGET',
          amberThresholdPct: 0.03,
          redThresholdPct: 0.08,
        },
        95
      );
      expect(res.status).toBe('AMBER');
      expect(res.severity).toBe('AMBER');
    });

    it('classifies RED for percent thresholds (lower is better)', () => {
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Scrap rate',
          targetValue: 100,
          direction: 'LOWER_IS_BETTER',
          thresholdMode: 'PERCENT_FROM_TARGET',
          amberThresholdPct: 0.1,
          redThresholdPct: 0.2,
        },
        120
      );
      expect(res.status).toBe('RED');
      expect(res.severity).toBe('RED');
    });
  });

  describe('handleTimeSeriesRecorded', () => {
    it('creates a deviation case and notifies owner on RED', async () => {
      const sqlCalls: { kind: 'get' | 'run'; sql: string; params: any[] }[] = [];

      const db: any = {
        get: vi.fn(async (sql: string, params: any[]) => {
          sqlCalls.push({ kind: 'get', sql, params });
          if (sql.includes('FROM initiative_kpis')) {
            return {
              id: 'kpi-1',
              organization_id: 'org-1',
              owner_user_id: 'user-1',
              name: 'OEE',
              target_value: 100,
              direction: 'HIGHER_IS_BETTER',
              threshold_mode: 'PERCENT_FROM_TARGET',
              amber_threshold_pct: 0.1,
              red_threshold_pct: 0.2,
              amber_threshold_abs: null,
              red_threshold_abs: null,
            };
          }
          if (sql.includes('FROM kpi_deviation_cases') && sql.includes('LIMIT 1') && !sql.includes('ORDER BY')) {
            return null; // "existing case" lookup
          }
          if (sql.includes('FROM kpi_deviation_cases') && sql.includes('ORDER BY')) {
            return { id: 'case-1' }; // "created case id" lookup
          }
          return null;
        }),
        all: vi.fn(async () => []),
        run: vi.fn(async (sql: string, params: any[]) => {
          sqlCalls.push({ kind: 'run', sql, params });
          return {};
        }),
      };

      const res = await handleTimeSeriesRecorded({
        db,
        orgId: 'org-1',
        kpiId: 'kpi-1',
        value: 70, // 30% below target => RED for higher-is-better with red=20%
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        recordedByUserId: 'recorder-1',
      });

      expect(res.eval.status).toBe('RED');
      expect(res.createdOrUpdatedCaseId).toBe('case-1');

      expect(db.run).toHaveBeenCalled();
      expect((notificationService as any).send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          type: 'KPI_DEVIATION_DETECTED',
          entityType: 'kpi_deviation_case',
          entityId: 'case-1',
          relatedObjectType: 'kpi',
          relatedObjectId: 'kpi-1',
        })
      );

      // Ensure we scoped case by org + periodStart
      const caseLookup = sqlCalls.find((c) => c.kind === 'get' && c.sql.includes('kpi_deviation_cases'));
      expect(caseLookup?.params).toEqual(['org-1', 'kpi-1', '2026-02-01']);
    });
  });
});

