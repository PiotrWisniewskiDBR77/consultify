/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentWorkbenchPanel } from '../../../src/components/assessment/AssessmentWorkbenchPanel';

const getWorkbench = vi.fn();
const getWorkbenchDefinition = vi.fn();
const getWorkbenchPromotionPayload = vi.fn();

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/assessment', () => ({
  V8AssessmentApi: {
    getWorkbench: (...args: unknown[]) => getWorkbench(...args),
    getWorkbenchDefinition: (...args: unknown[]) => getWorkbenchDefinition(...args),
    getWorkbenchPromotionPayload: (...args: unknown[]) => getWorkbenchPromotionPayload(...args),
    applyWorkbenchPreset: vi.fn(),
    transitionWorkbench: vi.fn(),
    addWorkbenchEvidence: vi.fn(),
    setRequiredEvidenceKinds: vi.fn(),
    proposeWorkbenchScore: vi.fn(),
    reviewWorkbenchScore: vi.fn(),
    proposeWorkbenchInterpretation: vi.fn(),
    reviewWorkbenchInterpretation: vi.fn(),
    promoteWorkbench: vi.fn(),
  },
}));

describe('AssessmentWorkbenchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkbench.mockResolvedValue({
      workbench: {
        contractVersion: 'p28_workbench_v1',
        assessmentDefinitionRef: {
          definitionId: 'asdef_drd_1.0',
          methodologyId: 'DRD',
          version: '1.0',
          status: 'published',
          readOnly: true,
        },
        assessmentRunId: 'a-1',
        orgId: 'org-1',
        runState: 'awaiting_evidence',
        startedBy: 'user-1',
        startedAt: '2026-04-11T00:00:00.000Z',
        evidencePointers: [],
        scoreProposal: null,
        scoreReview: null,
        interpretationProposal: null,
        interpretationReview: null,
        promotionTraces: [],
        degraded: { code: 'missing_required_evidence', message: 'Add evidence' },
      },
      whatNext: ['Add evidence before scoring.'],
    });
    getWorkbenchDefinition.mockResolvedValue({
      definitionRef: {
        definitionId: 'asdef_drd_1.0',
        methodologyId: 'DRD',
        version: '1.0',
        status: 'published',
        readOnly: true,
      },
      definition: {
        id: 'asdef_drd_1.0',
        methodologyId: 'DRD',
        version: '1.0',
        title: 'DRD canonical definition',
        status: 'published',
        isReadOnly: true,
        definition: {},
        createdBy: 'user-1',
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
      },
    });
    getWorkbenchPromotionPayload.mockResolvedValue({
      valid: false,
      validationErrors: ['Missing interpretation proposal'],
      payload: {},
    });
  });

  it('renders loaded workbench state, definition, and next steps', async () => {
    render(<AssessmentWorkbenchPanel assessmentId="a-1" />);

    await waitFor(() => {
      expect(screen.getByText('Assessment Workbench')).toBeInTheDocument();
    });

    // The run-state label is localized; the persisted degradation code is the
    // stable contract and must remain visible without translation.
    expect(screen.getByText('missing_required_evidence')).toBeInTheDocument();
    expect(screen.getByText('DRD canonical definition')).toBeInTheDocument();
    expect(screen.getByText('Add evidence before scoring.')).toBeInTheDocument();
    expect(screen.getByText('Missing interpretation proposal')).toBeInTheDocument();
    expect(screen.getByText('Review Readiness')).toBeInTheDocument();
    expect(screen.getByText('Downstream Status')).toBeInTheDocument();
  });
});
