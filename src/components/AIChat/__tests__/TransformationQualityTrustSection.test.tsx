import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TransformationCaseDto } from '@/services/api/v8/transformation-cases';

import { TransformationQualityTrustSection } from '../TransformationCasesPanel';

function makeCase(): TransformationCaseDto {
  return {
    transformationCaseId: 'case-quality',
    organizationId: 'org-1',
    projectId: null,
    conversationId: null,
    contextSnapshotId: 'snapshot-1',
    executionRunId: 'run-1',
    initiatedByUserId: 'user-1',
    mandate: 'Plan transformacji',
    desiredOutcomes: [],
    status: 'active',
    lifecycleStage: 'execution',
    autonomyLevel: 'A1_prepare',
    collaborationMode: 'teresa_draft_human_edit',
    currentEditor: 'human',
    autonomyPolicyVersion: 1,
    assumptions: ['Wolumen pozostanie stabilny'],
    missingInputs: ['Koszt energii'],
    activePlanId: 'plan-1',
    lineageId: 'lineage-1',
    version: 4,
    createdAt: '2026-08-07T12:00:00.000Z',
    updatedAt: '2026-08-07T12:00:00.000Z',
  };
}

describe('TransformationQualityTrustSection', () => {
  it('fails closed in Polish when the case payload has no quality evidence', () => {
    render(<TransformationQualityTrustSection transformationCase={makeCase()} isPolish />);

    const region = screen.getByRole('region', { name: 'Jakość i wiarygodność' });
    expect(within(region).getByRole('status')).toHaveTextContent('Dowód niedostępny');
    expect(within(region).getAllByText('Dowód niedostępny')).toHaveLength(3);
    expect(region).toHaveTextContent('Brakujące dane: Koszt energii');
    expect(region).toHaveTextContent('Założenie: Wolumen pozostanie stabilny');
    expect(region).not.toHaveTextContent(/\d+%/);
  });

  it('renders only supplied English evaluation evidence and announces critical failures', () => {
    const transformationCase = {
      ...makeCase(),
      qualityEvaluation: {
        status: 'failed',
        score: 0.72,
        cases: [
          { dimension: 'correctness', passed: false },
          { dimension: 'evidence', passed: false },
          { dimension: 'usefulness', passed: true },
        ],
        criticalFailures: ['source_honesty:case-4'],
      },
    } as TransformationCaseDto;

    render(
      <TransformationQualityTrustSection transformationCase={transformationCase} isPolish={false} />
    );

    const region = screen.getByRole('region', { name: 'Quality and trust' });
    expect(within(region).getByRole('status')).toHaveTextContent('Not verified');
    expect(region).toHaveTextContent('72%');
    expect(region).toHaveTextContent('correctness, evidence');
    expect(within(region).getByRole('alert')).toHaveTextContent(
      'Critical failures: source_honesty:case-4'
    );
  });
});
