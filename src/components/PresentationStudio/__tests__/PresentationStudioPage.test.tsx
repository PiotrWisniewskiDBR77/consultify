/**
 * @vitest-environment jsdom
 *
 * Component tests for `PresentationStudioPage` (Sprint S5).
 *
 * Verifies:
 *   - Page renders the Studio command row with the AI action ("Run preview")
 *     anchored on the right side of the local Menu 3 slot (per
 *     `.cursor/rules/ai-actions-menu3.mdc`).
 *   - Initial render shows the empty state, no preview cards populated.
 *   - Clicking "Run preview" fires all four
 *     POST `/api/presentation-studio/<surface>/preview` endpoints in
 *     parallel via `PresentationStudioApi`.
 *   - Successful previews populate all four section cards with status badges
 *     and human-readable summaries.
 *   - Generate envelope's `wouldGenerate.canProceed=false` surfaces an honest
 *     blocking-reasons list (degraded UI honesty per UI/UX source of truth).
 *   - API errors render an honest error banner (no fake success).
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PresentationStudioApi } from '@/services/api/presentationStudio.api';

import { PresentationStudioPage } from '../PresentationStudioPage';

vi.mock('@/services/api/presentationStudio.api', () => ({
  PresentationStudioApi: {
    previewSourcePack: vi.fn(),
    previewNarrativePlan: vi.fn(),
    previewTemplatePlan: vi.fn(),
    previewGenerate: vi.fn(),
  },
}));

const mockedApi = PresentationStudioApi as unknown as {
  previewSourcePack: ReturnType<typeof vi.fn>;
  previewNarrativePlan: ReturnType<typeof vi.fn>;
  previewTemplatePlan: ReturnType<typeof vi.fn>;
  previewGenerate: ReturnType<typeof vi.fn>;
};

function makeHappySourcePack() {
  return {
    ok: true,
    sourcePack: {
      status: 'ready',
      builtAt: '2026-05-08T20:00:00.000Z',
      sources: [{ sourceType: 'assessment' }],
      warnings: [],
      missingInputs: [],
    },
    missingInputs: [],
    warnings: [],
    previewId: 'pssp_org-A_1',
  };
}

function makeHappyNarrativePlan() {
  return {
    narrativePlan: {
      status: 'ready',
      goal: 'decide',
      thesis: 'Approve transformation budget for Q3.',
      slidePlan: [
        { intent: 'cover', title: 'Cover' },
        { intent: 'executive_summary', title: 'Executive thesis' },
      ],
      warnings: [],
      createdAt: '2026-05-08T20:00:00.000Z',
    },
    sourcePack: makeHappySourcePack().sourcePack,
    missingInputs: [],
    warnings: [],
    previewId: 'pssp_org-A_2',
  };
}

function makeHappyTemplatePlan() {
  return {
    templatePlan: {
      planId: 'ptap_1',
      status: 'draft',
      templateName: 'Steering Committee Preview Template',
      templateFamily: 'Steering Committee Deck',
      purpose: 'Reusable steering deck',
      recommendedFrequency: 'weekly or bi-weekly',
      audience: ['executive'],
      requiredInputs: ['assessment'],
      optionalInputs: [],
      sections: [
        {
          name: 'Executive Thesis',
          purpose: 'State the recommendation.',
          slides: [],
        },
      ],
      governance: {
        initialStatus: 'draft' as const,
        approvalRequired: true as const,
        ownerRole: 'template_owner',
        auditEvent: 'template_architect_plan_created' as const,
      },
      warnings: [],
      createdAt: '2026-05-08T20:00:00.000Z',
    },
    sourcePack: makeHappySourcePack().sourcePack,
    narrativePlan: makeHappyNarrativePlan().narrativePlan,
    missingInputs: [],
    warnings: [],
    approvalRequired: true as const,
    previewId: 'pssp_org-A_3',
  };
}

function makeGeneratePreview(canProceed: boolean) {
  return {
    outlinePreview: [
      { intent: 'cover', title: 'Cover', enabled: true },
      { intent: 'executive_summary', title: 'Executive thesis', enabled: true },
    ],
    estimatedSlideCount: 2,
    usedTemplate: {
      family: 'Steering Committee Deck',
      runtime: { templateFamily: 'Steering Committee Deck' },
      source: 'setup' as const,
    },
    sourcePack: makeHappySourcePack().sourcePack,
    narrativePlan: makeHappyNarrativePlan().narrativePlan,
    missingInputs: [],
    warnings: [],
    wouldGenerate: {
      canProceed,
      blockingReasons: canProceed ? [] : ['Strict mode requires source coverage.'],
      strict: !canProceed,
    },
    previewId: 'pssp_org-A_4',
  };
}

describe('PresentationStudioPage', () => {
  beforeEach(() => {
    mockedApi.previewSourcePack.mockReset();
    mockedApi.previewNarrativePlan.mockReset();
    mockedApi.previewTemplatePlan.mockReset();
    mockedApi.previewGenerate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Menu 3 command row with the AI action on the right', () => {
    render(<PresentationStudioPage />);

    const commandRow = screen.getByTestId('presentation-studio-command-row');
    const rightSlot = screen.getByTestId('presentation-studio-command-row-right');
    const runButton = screen.getByTestId('presentation-studio-run-preview');

    expect(commandRow).toBeTruthy();
    expect(rightSlot).toBeTruthy();
    // Right slot must contain the AI action; canvas must NOT.
    expect(rightSlot.contains(runButton)).toBe(true);
  });

  it('shows the empty state before any preview is run', () => {
    render(<PresentationStudioPage />);
    expect(screen.getByTestId('presentation-studio-empty')).toBeTruthy();
    expect(screen.queryByTestId('presentation-studio-error')).toBeNull();
  });

  it('fires all four preview endpoints in parallel and renders summaries', async () => {
    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(true));

    render(<PresentationStudioPage />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });

    await waitFor(() => {
      expect(mockedApi.previewSourcePack).toHaveBeenCalledTimes(1);
      expect(mockedApi.previewNarrativePlan).toHaveBeenCalledTimes(1);
      expect(mockedApi.previewTemplatePlan).toHaveBeenCalledTimes(1);
      expect(mockedApi.previewGenerate).toHaveBeenCalledTimes(1);
    });

    // All four section cards must be present after a successful run.
    expect(screen.getByTestId('section-source-pack')).toBeTruthy();
    expect(screen.getByTestId('section-narrative-plan')).toBeTruthy();
    expect(screen.getByTestId('section-template-plan')).toBeTruthy();
    expect(screen.getByTestId('section-generate')).toBeTruthy();

    // Template approval banner is mandatory (S3 governance invariant).
    expect(screen.getByTestId('template-approval-banner')).toBeTruthy();

    // canProceed=true should render no blocking-reasons list.
    expect(screen.queryByTestId('generate-blocking-reasons')).toBeNull();
  });

  it('renders blocking reasons honestly when generate canProceed=false', async () => {
    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(false));

    render(<PresentationStudioPage />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('generate-blocking-reasons')).toBeTruthy();
    });
    expect(screen.getByTestId('generate-blocking-reasons').textContent || '').toContain(
      'Strict mode requires source coverage.'
    );
  });

  it('renders an honest error banner when an endpoint fails', async () => {
    mockedApi.previewSourcePack.mockRejectedValue(new Error('Tenant context required'));
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(true));

    render(<PresentationStudioPage />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('presentation-studio-error')).toBeTruthy();
    });
    expect(screen.getByTestId('presentation-studio-error').textContent || '').toContain(
      'Tenant context required'
    );
  });
});
