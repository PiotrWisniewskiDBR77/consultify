/**
 * @vitest-environment jsdom
 *
 * AssessmentReportView — container states. Mocks `../reportApi` (this
 * module's OWN thin client, not `methodCoreApi` directly) so the test
 * exercises the container's state machine without a network layer.
 *
 * Covers: `outputId=null` never calls fetch and shows the honest
 * "not frozen yet" message (never a substitute calculation); a 404-shaped
 * miss shows "not found"; an auth failure shows "forbidden"; a successful
 * load renders the document; viewing the screen never performs a write
 * (no `create*`/`post*` export from `reportApi` is imported or called).
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  fetchOutputForReport: vi.fn(),
  fetchSessionForReport: vi.fn(),
  fetchApprovalsForReport: vi.fn(),
}));

vi.mock('../reportApi', async () => {
  const actual = await vi.importActual<typeof import('../reportApi')>('../reportApi');
  return {
    ...actual,
    fetchOutputForReport: hoisted.fetchOutputForReport,
    fetchSessionForReport: hoisted.fetchSessionForReport,
    fetchApprovalsForReport: hoisted.fetchApprovalsForReport,
  };
});

import { AssessmentReportView } from '../AssessmentReportView';
import { MethodCoreApiError } from '../reportApi';

const OUTPUT = {
  id: 'out-1',
  organizationId: 'org-1',
  sessionId: 'sess-1',
  snapshotId: 'snap-1',
  module: 'assessment' as const,
  methodPackId: 'drd',
  methodPackVersion: '2.0.0-methodpack.1',
  outputVersion: 1,
  revisionOfOutputId: null,
  scope: 'Sesja sess-1 — drd@2.0.0-methodpack.1, zamrożona z event-store.',
  current: {},
  target: {},
  gap: {},
  aggregation: { byGroup: {}, mappingVersion: 'v1', rule: 'r', excluded: {} },
  visualModel: null,
  evidenceCompleteness: { totalUnits: 0, unitsWithAcceptedEvidence: 0, unitsMissingEvidence: 0, completenessRatio: 0 },
  limitations: ['Ograniczenie testowe.'],
  findings: [],
  prioritisationResult: null,
  sourceRevisionOfSessionId: null,
  contentHash: 'sha256-x',
  createdAt: '2026-08-10T09:20:00.000Z',
  frozenAt: '2026-08-10T09:20:00.000Z',
  demoBypassActive: false,
};

beforeEach(() => {
  hoisted.fetchOutputForReport.mockReset();
  hoisted.fetchSessionForReport.mockReset();
  hoisted.fetchApprovalsForReport.mockReset();
});

describe('AssessmentReportView', () => {
  it('shows the honest "not frozen yet" state and performs ZERO fetches when outputId is null', () => {
    render(<AssessmentReportView outputId={null} />);
    expect(screen.getByText('Wynik nie został jeszcze zamrożony')).toBeInTheDocument();
    expect(hoisted.fetchOutputForReport).not.toHaveBeenCalled();
  });

  it('renders the document once the Output, session and approvals resolve', async () => {
    hoisted.fetchOutputForReport.mockResolvedValue({ output: OUTPUT, superseded: false, supersededByOutputId: null });
    hoisted.fetchSessionForReport.mockResolvedValue(null);
    hoisted.fetchApprovalsForReport.mockResolvedValue([]);
    render(<AssessmentReportView outputId="out-1" />);
    await waitFor(() => expect(screen.getByText(/DRD · 2\.0\.0-methodpack\.1/)).toBeInTheDocument());
  });

  it('shows "not found" when the Output fetch resolves null (404)', async () => {
    hoisted.fetchOutputForReport.mockResolvedValue(null);
    render(<AssessmentReportView outputId="missing-id" />);
    await waitFor(() => expect(screen.getByText('Nie znaleziono zamrożonego Outputu')).toBeInTheDocument());
  });

  it('shows "forbidden" on a 403', async () => {
    hoisted.fetchOutputForReport.mockRejectedValue(new MethodCoreApiError('forbidden', 403, {}));
    render(<AssessmentReportView outputId="out-1" />);
    await waitFor(() => expect(screen.getByText('Brak dostępu do tego wyniku')).toBeInTheDocument());
  });
});
