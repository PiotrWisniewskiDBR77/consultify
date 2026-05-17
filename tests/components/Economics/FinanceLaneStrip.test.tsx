import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import type { FinanceLaneRun } from '../../../src/services/api/v8/finance';
import type { DegradedAlert } from '../../../src/components/Economics/hooks/useFinanceLane';
import { FinanceLanePanel } from '../../../src/components/Economics/FinanceLanePanel';
import { FinanceLaneStrip } from '../../../src/components/Economics/FinanceLaneStrip';

function makeRun(overrides: Partial<FinanceLaneRun> = {}): FinanceLaneRun {
  return {
    runId: 'run-1',
    organizationId: 'org-1',
    currentStep: 'import',
    importOutcome: null,
    analysisCompleted: false,
    mutationOutcome: null,
    readbackConfirmed: false,
    degraded: [],
    auditTrail: [{ at: new Date().toISOString(), step: 'import', actor: 'user1', outcome: 'started' }],
    versionType: 'current',
    kpiLinkageStatus: 'coherent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('FinanceLaneStrip — unit tests', () => {
  it('returns null when no active lane run', () => {
    const html = renderToString(
      React.createElement(FinanceLaneStrip, {
        activeLaneRun: null,
        degradedAlerts: [],
        onOpenPanel: vi.fn(),
      })
    );
    expect(html).toBe('');
  });

  it('renders 4 step indicators in canonical order', () => {
    const html = renderToString(
      React.createElement(FinanceLaneStrip, {
        activeLaneRun: makeRun({ currentStep: 'analysis' }),
        degradedAlerts: [],
        onOpenPanel: vi.fn(),
      })
    );
    const stepOrder = ['Import', 'Analysis', 'Mutation', 'Readback'];
    let lastIdx = -1;
    for (const label of stepOrder) {
      const idx = html.indexOf(label);
      expect(idx).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it('shows degraded badge when alerts exist', () => {
    const alerts: DegradedAlert[] = [
      { reason: 'import_failed', severity: 'destructive', title: 'Import failed', description: 'fail', nextAction: 'fix' },
      { reason: 'stale_model', severity: 'info', title: 'Stale model', description: 'old', nextAction: 'refresh' },
    ];
    const html = renderToString(
      React.createElement(FinanceLaneStrip, {
        activeLaneRun: makeRun(),
        degradedAlerts: alerts,
        onOpenPanel: vi.fn(),
      })
    );
    expect(html).toContain('issue');
  });

  it('shows KPI coherence chip', () => {
    const html = renderToString(
      React.createElement(FinanceLaneStrip, {
        activeLaneRun: makeRun({ kpiLinkageStatus: 'stale' }),
        degradedAlerts: [],
        onOpenPanel: vi.fn(),
      })
    );
    expect(html).toContain('KPI: stale');
  });

  it('shows version type badge', () => {
    const html = renderToString(
      React.createElement(FinanceLaneStrip, {
        activeLaneRun: makeRun({ versionType: 'actual' }),
        degradedAlerts: [],
        onOpenPanel: vi.fn(),
      })
    );
    expect(html).toContain('Actual');
  });
});

describe('FinanceLanePanel — unit tests', () => {
  it('renders nothing when closed', () => {
    const html = renderToString(
      React.createElement(FinanceLanePanel, {
        open: false,
        onClose: vi.fn(),
        activeLaneRun: makeRun(),
        degradedAlerts: [],
        mutationAudits: [],
        kpiCoherence: null,
        versionSnapshots: [],
      })
    );
    expect(html).toBe('');
  });

  it('shows lane progress section with 4 steps when open', () => {
    const html = renderToString(
      React.createElement(FinanceLanePanel, {
        open: true,
        onClose: vi.fn(),
        activeLaneRun: makeRun({ currentStep: 'mutation' }),
        degradedAlerts: [],
        mutationAudits: [],
        kpiCoherence: null,
        versionSnapshots: [],
      })
    );
    expect(html).toContain('Lane Progress');
    expect(html).toContain('Import');
    expect(html).toContain('Analysis');
    expect(html).toContain('Mutation');
    expect(html).toContain('Readback');
  });

  it('shows degraded alerts section with severity styling', () => {
    const alerts: DegradedAlert[] = [
      { reason: 'import_failed', severity: 'destructive', title: 'Import failed', description: 'test fail', nextAction: 'Fix import' },
    ];
    const html = renderToString(
      React.createElement(FinanceLanePanel, {
        open: true,
        onClose: vi.fn(),
        activeLaneRun: makeRun(),
        degradedAlerts: alerts,
        mutationAudits: [],
        kpiCoherence: null,
        versionSnapshots: [],
      })
    );
    expect(html).toContain('Issues');
    expect(html).toContain('Import failed');
    expect(html).toContain('Fix import');
  });

  it('shows KPI coherence section', () => {
    const html = renderToString(
      React.createElement(FinanceLanePanel, {
        open: true,
        onClose: vi.fn(),
        activeLaneRun: makeRun(),
        degradedAlerts: [],
        mutationAudits: [],
        kpiCoherence: { status: 'stale', detail: '3 stale reconciliations' },
        versionSnapshots: [],
      })
    );
    expect(html).toContain('KPI Coherence');
    expect(html).toContain('stale');
    expect(html).toContain('3 stale reconciliations');
  });
});
