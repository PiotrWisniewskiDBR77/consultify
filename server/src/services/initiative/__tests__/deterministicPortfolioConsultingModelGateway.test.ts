import { afterEach, describe, expect, it } from 'vitest';

import {
  parsePortfolioAnalysisItems,
  type PortfolioAnalysisSnapshot,
} from '../../../domain/initiatives-execution/portfolioConsultingAnalysis.js';
import {
  DeterministicPortfolioConsultingModelGateway,
  isDeterministicPortfolioAnalysisModelEnabled,
} from '../deterministicPortfolioConsultingModelGateway.js';

function snapshot(count: number): PortfolioAnalysisSnapshot {
  return {
    snapshotVersion: 1,
    organizationId: 'org-1',
    asOf: '2026-09-14T00:00:00.000Z',
    source: {
      system: 'initiativeUnifiedReader',
      version: '1',
      capturedAt: '2026-09-14T00:00:00.000Z',
    },
    portfolio: {
      scenarioId: 'scenario-1',
      aggregateVersion: 2,
      scenarioVersion: 3,
      facts: {},
    },
    initiatives: Array.from({ length: count }, (_, index) => ({
      initiativeId: `initiative-${index + 1}`,
      initiativeVersion: 1,
      projectId: 'project-1',
      source: 'CANONICAL' as const,
      facts: { name: `Initiative ${index + 1}`, priority: 'HIGH' },
      evidenceRefs: [`initiative:initiative-${index + 1}:1`] as [string],
    })),
    decisionHistory: [],
    runningWork: [],
    organizationContext: {
      snapshotId: 'ctx-1',
      version: 1,
      contentHash: 'hash',
      facts: {},
    },
  };
}

describe('deterministyczna brama modelu analizy portfela (F2-1 E1)', () => {
  const original = process.env.PORTFOLIO_ANALYSIS_DETERMINISTIC_MODEL;
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.PORTFOLIO_ANALYSIS_DETERMINISTIC_MODEL = original;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('zwraca wynik przechodzacy walidator domeny z kompletem 5 kryteriow wlasciciela', async () => {
    const input = snapshot(3);
    const { output, provenance } = await new DeterministicPortfolioConsultingModelGateway().analyze(
      {
        rubricVersion: 'portfolio-consulting-v1',
        requestDigest: 'digest-1',
        snapshot: input,
      }
    );
    const items = parsePortfolioAnalysisItems(output, input);
    expect(new Set(items.map((item) => item.criterion))).toEqual(
      new Set(['COVERAGE_GAP', 'OVERLAP', 'PRIORITY', 'NEW_VS_EXTENSION', 'DECISION_HISTORY'])
    );
    expect(items.filter((item) => item.kind === 'DECISION')).toHaveLength(3);
    expect(provenance.provider).toBe('deterministic');
  });

  it('daje zawsze parking z powodem i warunkiem powrotu oraz archiwum', async () => {
    const input = snapshot(3);
    const { output } = await new DeterministicPortfolioConsultingModelGateway().analyze({
      rubricVersion: 'portfolio-consulting-v1',
      requestDigest: 'digest-1',
      snapshot: input,
    });
    const decisions = parsePortfolioAnalysisItems(output, input).filter(
      (item) => item.kind === 'DECISION'
    );
    expect(decisions.map((item) => item.proposedDisposition?.kind)).toEqual([
      'IN',
      'PARKING',
      'ARCHIVE',
    ]);
    const parking = decisions[1].proposedDisposition;
    expect(parking?.reason.length).toBeGreaterThan(0);
    expect(parking?.returnCondition?.length).toBeGreaterThan(0);
  });

  it('jest deterministyczna — ten sam snapshot daje bit w bit ten sam wynik', async () => {
    const gateway = new DeterministicPortfolioConsultingModelGateway();
    const input = { rubricVersion: 'r', requestDigest: 'd', snapshot: snapshot(2) };
    const first = await gateway.analyze(input);
    const second = await gateway.analyze(input);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('domyslnie wylaczona i niemozliwa do wlaczenia w produkcji', () => {
    delete process.env.PORTFOLIO_ANALYSIS_DETERMINISTIC_MODEL;
    process.env.NODE_ENV = 'development';
    expect(isDeterministicPortfolioAnalysisModelEnabled()).toBe(false);
    process.env.PORTFOLIO_ANALYSIS_DETERMINISTIC_MODEL = 'true';
    expect(isDeterministicPortfolioAnalysisModelEnabled()).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(isDeterministicPortfolioAnalysisModelEnabled()).toBe(false);
  });
});
