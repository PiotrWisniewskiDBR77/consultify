/**
 * @vitest-environment jsdom
 *
 * AssessmentPresentationView — the honest-states contract: no Output id, a
 * fetch failure, and an unrecognized payload shape must all render a clear
 * message rather than ever falling back to sample/zero data. `fetchOutput`
 * is injected so these tests never touch real HTTP.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { MethodCoreApiError } from '@/method-core/api/methodCoreApi';

import { AssessmentPresentationView } from '../AssessmentPresentationView';
import type { RawAssessmentOutputRecord } from '../rawOutputTypes';

function makeRaw(overrides: Partial<RawAssessmentOutputRecord> = {}): RawAssessmentOutputRecord {
  return {
    id: 'output-1',
    organizationId: 'org-1',
    sessionId: 'session-1',
    snapshotId: 'snapshot-1',
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '1.0.0',
    outputVersion: 1,
    revisionOfOutputId: null,
    scope: 'Full DRD assessment.',
    current: { 'u-1': 2 },
    target: { 'u-1': 4 },
    gap: { 'u-1': 2 },
    aggregation: { byGroup: { d1: 2 }, mappingVersion: '1.0.0', rule: 'weighted-mean', excluded: {} },
    evidenceCompleteness: { totalUnits: 1, unitsWithAcceptedEvidence: 1, unitsMissingEvidence: 0, completenessRatio: 1 },
    limitations: ['Only self-reported evidence.'],
    findings: [],
    contentHash: 'sha256-x',
    createdAt: '2026-08-01T10:00:00.000Z',
    frozenAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('AssessmentPresentationView', () => {
  it('renders the honest "no Output" state when outputId is null — never sample data', () => {
    render(<AssessmentPresentationView outputId={null} fetchOutput={async () => ({ output: makeRaw() })} />);
    expect(screen.getByText(/Brak zamrożonego Outputu/i)).toBeInTheDocument();
    expect(screen.queryByTestId('presentation-deck')).not.toBeInTheDocument();
  });

  it('renders the deck once a well-shaped Output resolves', async () => {
    render(
      <AssessmentPresentationView outputId="output-1" fetchOutput={async () => ({ output: makeRaw() })} />
    );
    await waitFor(() => expect(screen.getByTestId('presentation-deck')).toBeInTheDocument());
  });

  it('renders a not-found message on a 404, not an empty deck', async () => {
    render(
      <AssessmentPresentationView
        outputId="missing-output"
        fetchOutput={async () => {
          throw new MethodCoreApiError('Output not found', 404, { error: 'Output not found' });
        }}
      />
    );
    await waitFor(() => expect(screen.getByText(/Nie znaleziono Outputu/i)).toBeInTheDocument());
  });

  it('renders a forbidden message on a 403', async () => {
    render(
      <AssessmentPresentationView
        outputId="output-1"
        fetchOutput={async () => {
          throw new MethodCoreApiError('Forbidden', 403, { error: 'forbidden' });
        }}
      />
    );
    await waitFor(() => expect(screen.getByText(/Brak dostępu/i)).toBeInTheDocument());
  });

  it('renders an unrecognized-shape message instead of guessing when the payload does not look like an Output', async () => {
    render(
      <AssessmentPresentationView
        outputId="output-1"
        fetchOutput={async () => ({ output: { unexpected: true } as unknown as RawAssessmentOutputRecord })}
      />
    );
    await waitFor(() => expect(screen.getByText(/nie ma oczekiwanego kształtu/i)).toBeInTheDocument());
  });
});
