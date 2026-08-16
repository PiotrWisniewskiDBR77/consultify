/**
 * F08 — KPI → Finance reconciliation flow
 *
 * Services: resultsROIService, financeIntegrationService
 *
 * Flow: createKPI() (dual-mode) → recordDeviation() → initiateReconciliation()
 *       → recordDeltaEscalation() → createExecutiveReviewPack()
 *       → verify KPI → deviation → reconciliation → escalation → review pack chain
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock DB layer ──────────────────────────────────────────────────────────

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../results/kpiDefinitionService.js', () => ({
  createDefinition: vi.fn(async () => ({ id: 'canonical-kpi-test-id' })),
}));

// ── Real service imports ───────────────────────────────────────────────────

import { recordDeltaEscalation } from '../../../financeIntegrationService.js';
import {
  createExecutiveReviewPack,
  createKPI,
  initiateReconciliation,
  recordDeviation,
} from '../../../resultsROIService.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const INITIATIVE_ID = '00000000-0000-4000-8000-000000000050';
const FINANCE_REF = 'finance-model-001';

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('F08 — KPI → Finance reconciliation', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Create KPI in dual-mode (initiative-linked)
    const kpi = await createKPI({
      organizationId: ORG_ID,
      name: 'Revenue Growth Rate',
      mode: 'initiative_linked',
      initiativeId: INITIATIVE_ID,
      metricType: 'currency',
      baselineValue: 100000,
      targetValue: 150000,
      currentValue: 110000,
      measurementCadence: 'monthly',
    });

    expect(kpi.kpiId).toBeDefined();
    expect(kpi.mode).toBe('initiative_linked');
    expect(kpi.status).toBe('design');
    expect(kpi.initiativeId).toBe(INITIATIVE_ID);

    // Step 2: Record deviation against the KPI
    const deviation = await recordDeviation({
      organizationId: ORG_ID,
      kpiId: kpi.kpiId,
      deviationType: 'underperformance',
      severity: 'high',
      actionRequired: 'Review budget allocation and adjust forecast',
      escalatedTo: 'cfo@org.com',
    });

    expect(deviation.deviationId).toBeDefined();
    expect(deviation.kpiId).toBe(kpi.kpiId);
    expect(deviation.deviationType).toBe('underperformance');
    expect(deviation.severity).toBe('high');

    // Step 3: Initiate reconciliation (Results starts — Decision W6-5)
    const reconciliation = await initiateReconciliation({
      organizationId: ORG_ID,
      kpiId: kpi.kpiId,
      financeRef: FINANCE_REF,
      initiatedBy: 'results',
    });

    expect(reconciliation.reconciliationId).toBeDefined();
    expect(reconciliation.kpiId).toBe(kpi.kpiId);
    expect(reconciliation.financeRef).toBe(FINANCE_REF);
    expect(reconciliation.reconciliationStatus).toBe('pending');
    expect(reconciliation.initiatedBy).toBe('results');

    // Step 4: Record delta escalation (Finance side — Decision W6-9)
    const escalation = await recordDeltaEscalation({
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      financeRef: FINANCE_REF,
      deltaMagnitude: 40000,
      deltaDuration: 90,
      materialityLevel: 'high',
    });

    expect(escalation.escalationId).toBeDefined();
    expect(escalation.initiativeId).toBe(INITIATIVE_ID);
    expect(escalation.deltaMagnitude).toBe(40000);
    expect(typeof escalation.thresholdBreached).toBe('boolean');
    expect(typeof escalation.escalatedToCFO).toBe('boolean');

    // Step 5: Create executive review pack
    const reviewPack = await createExecutiveReviewPack({
      organizationId: ORG_ID,
      reviewPeriod: '2026-Q1',
      kpiSummaries: [
        {
          kpiId: kpi.kpiId,
          name: kpi.name,
          currentValue: kpi.currentValue!,
          targetValue: kpi.targetValue!,
          status: kpi.status,
        },
      ],
      deviationHighlights: [
        {
          deviationId: deviation.deviationId,
          kpiId: deviation.kpiId,
          deviationType: deviation.deviationType,
          severity: deviation.severity,
        },
      ],
      roiSnapshot: {
        totalRealized: 110000,
        entriesCount: 1,
        period: '2026-Q1',
      },
    });

    expect(reviewPack.packId).toBeDefined();
    expect(reviewPack.status).toBe('draft');
    expect(reviewPack.kpiSummaries).toHaveLength(1);
    expect(reviewPack.kpiSummaries[0].kpiId).toBe(kpi.kpiId);
    expect(reviewPack.deviationHighlights).toHaveLength(1);
    expect(reviewPack.deviationHighlights[0].deviationId).toBe(deviation.deviationId);

    // Verify end-to-end chain
    expect(kpi.kpiId).toBe(deviation.kpiId);
    expect(kpi.kpiId).toBe(reconciliation.kpiId);
    expect(kpi.initiativeId).toBe(escalation.initiativeId);
    expect(reconciliation.financeRef).toBe(escalation.financeRef);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // KPI output → deviation input (kpiId)
    const kpi = await createKPI({
      organizationId: ORG_ID,
      name: 'Standalone Cost Reduction',
      mode: 'standalone',
      metricType: 'percentage',
      baselineValue: 0,
      targetValue: 15,
      currentValue: 8,
      measurementCadence: 'quarterly',
    });

    expect(typeof kpi.kpiId).toBe('string');
    expect(kpi.kpiId.length).toBeGreaterThan(0);
    expect(kpi.mode).toBe('standalone');

    // Deviation output → review pack input (deviationId, kpiId, severity)
    const deviation = await recordDeviation({
      organizationId: ORG_ID,
      kpiId: kpi.kpiId,
      deviationType: 'data_quality',
      severity: 'low',
      actionRequired: 'Monitor next quarter',
    });

    expect(deviation.kpiId).toBe(kpi.kpiId);
    expect(deviation.organizationId).toBe(ORG_ID);

    // Reconciliation output → escalation input (financeRef, initiativeId)
    const reconciliation = await initiateReconciliation({
      organizationId: ORG_ID,
      kpiId: kpi.kpiId,
      financeRef: 'finance-model-002',
      initiatedBy: 'results',
    });

    expect(reconciliation.reconciliationStatus).toBe('pending');

    const escalation = await recordDeltaEscalation({
      organizationId: reconciliation.organizationId,
      initiativeId: '00000000-0000-4000-8000-000000000060',
      financeRef: reconciliation.financeRef,
      deltaMagnitude: 5000,
      deltaDuration: 30,
      materialityLevel: 'low',
    });

    expect(escalation.financeRef).toBe(reconciliation.financeRef);
    expect(escalation.organizationId).toBe(reconciliation.organizationId);

    // Review pack aggregates KPI + deviation data
    const pack = await createExecutiveReviewPack({
      organizationId: ORG_ID,
      reviewPeriod: '2026-Q1',
      kpiSummaries: [
        {
          kpiId: kpi.kpiId,
          name: kpi.name,
          currentValue: kpi.currentValue!,
          targetValue: kpi.targetValue!,
          status: kpi.status,
        },
      ],
      deviationHighlights: [
        {
          deviationId: deviation.deviationId,
          kpiId: deviation.kpiId,
          deviationType: deviation.deviationType,
          severity: deviation.severity,
        },
      ],
      roiSnapshot: { totalRealized: 8, entriesCount: 1, period: '2026-Q1' },
    });

    expect(pack.kpiSummaries[0].kpiId).toBe(kpi.kpiId);
    expect(pack.deviationHighlights[0].kpiId).toBe(deviation.kpiId);
  });
});
