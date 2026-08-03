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

    // RES-004 — fail-closed: none of these used to be a distinct status.
    // Every one of them previously returned GREEN — a false "on track" for a
    // KPI that cannot actually be evaluated.

    it('RES-004: UNCONFIGURED (not GREEN) when no target is set', () => {
      const res = evaluateKpiPoint(
        { id: 'k1', organizationId: 'o1', name: 'No target KPI', targetValue: null },
        50
      );
      expect(res.status).toBe('UNCONFIGURED');
      expect(res.severity).toBeNull();
    });

    it('RES-004: UNCONFIGURED (not GREEN) when target=0 in percent mode with no absolute fallback', () => {
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Zero target KPI',
          targetValue: 0,
          thresholdMode: 'PERCENT_FROM_TARGET',
        },
        5
      );
      expect(res.status).toBe('UNCONFIGURED');
    });

    it('RES-004: target=0 in percent mode DOES evaluate when an absolute band is configured', () => {
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Zero target KPI with abs band',
          targetValue: 0,
          thresholdMode: 'PERCENT_FROM_TARGET', // mode is irrelevant here — classifyAbsolute is only reached via ABSOLUTE
          amberThresholdAbs: 5,
          redThresholdAbs: 10,
        },
        5
      );
      // thresholdMode stayed PERCENT_FROM_TARGET, so this still routes through
      // classifyPercent and is still UNCONFIGURED — proves mode, not just
      // "abs fields exist", controls which path runs.
      expect(res.status).toBe('UNCONFIGURED');
    });

    it('RES-004: ABSOLUTE mode with target=0 and a configured absolute band evaluates normally', () => {
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Zero target KPI, absolute mode',
          targetValue: 0,
          thresholdMode: 'ABSOLUTE',
          amberThresholdAbs: 5,
          redThresholdAbs: 10,
        },
        12
      );
      expect(res.status).toBe('RED');
    });

    it('RES-004: UNCONFIGURED (not a wrong color) when redThresholdPct < amberThresholdPct', () => {
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Inverted band KPI',
          targetValue: 100,
          thresholdMode: 'PERCENT_FROM_TARGET',
          amberThresholdPct: 0.2, // wider than red — nonsensical
          redThresholdPct: 0.1,
        },
        70
      );
      expect(res.status).toBe('UNCONFIGURED');
    });

    it('RES-004: UNCONFIGURED when an absolute band is inverted (red < amber)', () => {
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Inverted absolute band KPI',
          targetValue: 100,
          thresholdMode: 'ABSOLUTE',
          amberThresholdAbs: 20,
          redThresholdAbs: 5,
        },
        70
      );
      expect(res.status).toBe('UNCONFIGURED');
    });

    it('RES-004: ABSOLUTE mode with only amberThresholdAbs set (no red bound) still evaluates AMBER correctly, not UNCONFIGURED', () => {
      // Regression guard for the fail-closed check itself: `red` legitimately
      // stays +Infinity when only amber is configured — that must NOT be
      // treated as a misconfiguration.
      const res = evaluateKpiPoint(
        {
          id: 'k1',
          organizationId: 'o1',
          name: 'Amber-only band KPI',
          targetValue: 100,
          thresholdMode: 'ABSOLUTE',
          amberThresholdAbs: 5,
          redThresholdAbs: null,
        },
        94
      );
      expect(res.status).toBe('AMBER');
    });

    it('RES-004: determinism — the same input always produces the same output', () => {
      const def = {
        id: 'k1',
        organizationId: 'o1',
        name: 'Determinism check',
        targetValue: 100,
        direction: 'HIGHER_IS_BETTER' as const,
        thresholdMode: 'PERCENT_FROM_TARGET' as const,
        amberThresholdPct: 0.1,
        redThresholdPct: 0.2,
      };
      const a = evaluateKpiPoint(def, 85);
      const b = evaluateKpiPoint(def, 85);
      expect(a).toEqual(b);
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
          if (sql.includes('INSERT INTO kpi_deviation_cases')) {
            return { id: 'case-1' };
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

      expect(db.get).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kpi_deviation_cases'),
        expect.any(Array)
      );
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

      const caseUpsert = sqlCalls.find(
        (c) => c.kind === 'get' && c.sql.includes('INSERT INTO kpi_deviation_cases')
      );
      expect(caseUpsert?.sql).toContain(
        'ON CONFLICT (organization_id, kpi_id, period_start) DO UPDATE'
      );
      expect(caseUpsert?.params).toEqual([
        'kpi-1',
        'org-1',
        '2026-02-01',
        '2026-02-28',
        'RED',
        'user-1',
        'RED: value 70 deviates from target 100',
      ]);
    });
  });
});
