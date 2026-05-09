/**
 * @vitest-environment jsdom
 *
 * Component tests for `PresentationStudioPage` (Sprints S5 + S7).
 *
 * Verifies (S5):
 *   - Page renders the Studio command row with the AI action ("Run preview")
 *     anchored on the right side of the local Menu 3 slot (per
 *     `.cursor/rules/ai-actions-menu3.mdc`).
 *   - Initial render shows the empty state, no preview cards populated.
 *   - Clicking "Run preview" fires all four
 *     POST /api/presentation-studio/(surface)/preview endpoints in parallel.
 *   - Successful previews populate all four section cards.
 *   - Generate envelope's `wouldGenerate.canProceed=false` surfaces an honest
 *     blocking-reasons list (degraded UI honesty per UI/UX source of truth).
 *   - API errors render an honest error banner (no fake success).
 *
 * Verifies (S7):
 *   - "Request approval" CTA is hidden when `canProceed=false`.
 *   - "Request approval" CTA is visible only after a healthy preview where
 *     `canProceed=true` and renders in the Menu 3 right slot, never inside
 *     the canvas.
 *   - Clicking "Request approval" calls `requestApproval` once; on 200 the
 *     "Confirm generate" CTA appears (also in the right slot) with a TTL
 *     countdown label.
 *   - 412 PRECONDITION_NOT_MET surfaces an honest approval-error banner and
 *     does NOT show "Confirm generate".
 *   - Clicking "Confirm generate" with a fresh ticket calls `executeGenerate`
 *     and on 200 surfaces the deck id + slide count + audit event marker.
 *   - 403 INVALID_APPROVAL_TICKET (e.g. payload_mismatch) clears the ticket
 *     and surfaces an honest ticket-error banner with the typed reason
 *     translated to a human-readable label.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PresentationStudioApi,
  PresentationStudioApiError,
} from '@/services/api/presentationStudio.api';

import { PresentationStudioPage } from '../PresentationStudioPage';

vi.mock('@/services/api/presentationStudio.api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api/presentationStudio.api')>(
    '@/services/api/presentationStudio.api'
  );
  return {
    ...actual,
    PresentationStudioApi: {
      previewSourcePack: vi.fn(),
      previewNarrativePlan: vi.fn(),
      previewTemplatePlan: vi.fn(),
      previewGenerate: vi.fn(),
      requestApproval: vi.fn(),
      executeGenerate: vi.fn(),
      listSourceArtifacts: vi.fn(),
    },
  };
});

const mockedApi = PresentationStudioApi as unknown as {
  previewSourcePack: ReturnType<typeof vi.fn>;
  previewNarrativePlan: ReturnType<typeof vi.fn>;
  previewTemplatePlan: ReturnType<typeof vi.fn>;
  previewGenerate: ReturnType<typeof vi.fn>;
  requestApproval: ReturnType<typeof vi.fn>;
  executeGenerate: ReturnType<typeof vi.fn>;
  listSourceArtifacts: ReturnType<typeof vi.fn>;
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

/**
 * Fill the S8 setup form with valid required fields. Used by every test that
 * needs a preview to actually run; without this Run preview only triggers
 * inline validation messages.
 */
function fillRequiredFields() {
  fireEvent.change(screen.getByTestId('psstudio-field-title'), {
    target: { value: 'Steering Committee Preview' },
  });
  fireEvent.change(screen.getByTestId('psstudio-field-deck-type'), {
    target: { value: 'steering_committee' },
  });
}

function makeCleanLayoutAudit() {
  return {
    warnings: [],
    slideAudits: [
      { index: 0, intent: 'cover', flags: [] },
      { index: 1, intent: 'executive_summary', flags: [] },
    ],
    flagCounts: {
      layout_overflow_title: 0,
      layout_overflow_key_message: 0,
      layout_overflow_blocks: 0,
      missing_source_for_evidence_intent: 0,
      unsupported_intent_for_pptx_export: 0,
      unsupported_intent_for_pdf_export: 0,
    },
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
    layoutAudit: makeCleanLayoutAudit(),
    previewId: 'pssp_org-A_4',
  };
}

describe('PresentationStudioPage', () => {
  beforeEach(() => {
    mockedApi.previewSourcePack.mockReset();
    mockedApi.previewNarrativePlan.mockReset();
    mockedApi.previewTemplatePlan.mockReset();
    mockedApi.previewGenerate.mockReset();
    mockedApi.requestApproval.mockReset();
    mockedApi.executeGenerate.mockReset();
    mockedApi.listSourceArtifacts.mockReset();
    // Default for all tests: an empty source artifact list. Tests that need
    // populated artifacts override the mock locally.
    mockedApi.listSourceArtifacts.mockResolvedValue({
      artifacts: [],
      total: 0,
      byType: {},
      generatedAt: '2026-05-08T20:00:00.000Z',
      warnings: [],
    });
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
    fillRequiredFields();

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
    fillRequiredFields();

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
    fillRequiredFields();

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

  // ---------------------------------------------------------------------
  // S7 — approval/execute CTA flow
  // ---------------------------------------------------------------------

  function makeApprovalTicket(overrides: Partial<{ ticketId: string; expiresAt: string }> = {}) {
    return {
      ticketId: overrides.ticketId ?? 'pssa_ticket-1',
      organizationId: 'org-A',
      userId: 'user-1',
      payloadFingerprint: 'fp-abc',
      createdAt: '2026-05-08T20:00:00.000Z',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 9 * 60 * 1000).toISOString(),
      consumedAt: null,
    };
  }

  async function runHealthyPreview() {
    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(true));
    fillRequiredFields();
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });
    await waitFor(() => {
      expect(mockedApi.previewGenerate).toHaveBeenCalledTimes(1);
    });
  }

  it('hides the Request-approval CTA when canProceed=false', async () => {
    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(false));

    render(<PresentationStudioPage />);
    fillRequiredFields();
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('generate-blocking-reasons')).toBeTruthy();
    });
    expect(screen.queryByTestId('presentation-studio-request-approval')).toBeNull();
  });

  it('renders Request-approval CTA in the Menu 3 right slot after a healthy preview', async () => {
    render(<PresentationStudioPage />);
    await runHealthyPreview();

    const cta = await screen.findByTestId('presentation-studio-request-approval');
    const rightSlot = screen.getByTestId('presentation-studio-command-row-right');
    expect(rightSlot.contains(cta)).toBe(true);
    // Confirm-generate must NOT exist yet (no ticket has been minted).
    expect(screen.queryByTestId('presentation-studio-confirm-generate')).toBeNull();
  });

  it('mints a ticket and surfaces the Confirm-generate CTA with a TTL countdown', async () => {
    render(<PresentationStudioPage />);
    await runHealthyPreview();

    const ticket = makeApprovalTicket();
    mockedApi.requestApproval.mockResolvedValue({
      ticket,
      generatePreview: makeGeneratePreview(true),
      payloadFingerprint: ticket.payloadFingerprint,
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-request-approval'));
    });
    await waitFor(() => {
      expect(mockedApi.requestApproval).toHaveBeenCalledTimes(1);
    });

    const confirm = await screen.findByTestId('presentation-studio-confirm-generate');
    const rightSlot = screen.getByTestId('presentation-studio-command-row-right');
    expect(rightSlot.contains(confirm)).toBe(true);
    // Countdown label must be present and look like "Confirm generate · M:SS".
    const label =
      screen.getByTestId('presentation-studio-confirm-generate-label').textContent || '';
    expect(label).toMatch(/Confirm generate · \d+:\d{2}/);
    // The Request-approval CTA disappears once a ticket is held.
    expect(screen.queryByTestId('presentation-studio-request-approval')).toBeNull();
  });

  it('shows an honest approval-error banner when /request-approval returns 412', async () => {
    render(<PresentationStudioPage />);
    await runHealthyPreview();

    const blockedPreview = makeGeneratePreview(false);
    mockedApi.requestApproval.mockRejectedValue(
      new PresentationStudioApiError({
        status: 412,
        code: 'PRECONDITION_NOT_MET',
        message: 'Generation preview blocks approval.',
        preview: blockedPreview,
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-request-approval'));
    });
    const banner = await screen.findByTestId('presentation-studio-approval-error');
    expect(banner.textContent || '').toContain('Strict mode requires source coverage.');
    expect(screen.queryByTestId('presentation-studio-confirm-generate')).toBeNull();
  });

  it('redeems a ticket via /generate and shows the deck-id success banner', async () => {
    render(<PresentationStudioPage />);
    await runHealthyPreview();

    const ticket = makeApprovalTicket();
    mockedApi.requestApproval.mockResolvedValue({
      ticket,
      generatePreview: makeGeneratePreview(true),
      payloadFingerprint: ticket.payloadFingerprint,
    });
    mockedApi.executeGenerate.mockResolvedValue({
      deckId: 'deck-deadbeef',
      slideCount: 2,
      outline: [
        { intent: 'cover', title: 'Cover', enabled: true },
        { intent: 'executive_summary', title: 'Executive thesis', enabled: true },
      ],
      validationWarnings: [],
      ticketId: ticket.ticketId,
      auditEvent: 'presentation_generated_via_studio' as const,
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-request-approval'));
    });
    await screen.findByTestId('presentation-studio-confirm-generate');

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-confirm-generate'));
    });
    await waitFor(() => {
      expect(mockedApi.executeGenerate).toHaveBeenCalledTimes(1);
    });

    const successBanner = await screen.findByTestId('presentation-studio-generated');
    expect(successBanner.textContent || '').toContain('Deck generated and audited');
    expect(screen.getByTestId('presentation-studio-generated-deck-id').textContent).toBe(
      'deck-deadbeef'
    );
    // Once the deck is generated, the ticket is single-use → both action CTAs
    // are gone; only "Run preview" remains in the right slot.
    expect(screen.queryByTestId('presentation-studio-confirm-generate')).toBeNull();
    expect(screen.queryByTestId('presentation-studio-request-approval')).toBeNull();
  });

  it('clears the ticket and shows a typed banner on 403 INVALID_APPROVAL_TICKET', async () => {
    render(<PresentationStudioPage />);
    await runHealthyPreview();

    const ticket = makeApprovalTicket();
    mockedApi.requestApproval.mockResolvedValue({
      ticket,
      generatePreview: makeGeneratePreview(true),
      payloadFingerprint: ticket.payloadFingerprint,
    });
    mockedApi.executeGenerate.mockRejectedValue(
      new PresentationStudioApiError({
        status: 403,
        code: 'INVALID_APPROVAL_TICKET',
        message: 'Approval ticket rejected',
        reason: 'payload_mismatch',
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-request-approval'));
    });
    await screen.findByTestId('presentation-studio-confirm-generate');

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-confirm-generate'));
    });
    const banner = await screen.findByTestId('presentation-studio-ticket-error');
    expect(banner.textContent || '').toContain('Setup changed since the ticket was issued');
    // Ticket must be invalidated; Confirm-generate disappears and a fresh
    // Request-approval CTA returns to the right slot.
    expect(screen.queryByTestId('presentation-studio-confirm-generate')).toBeNull();
    expect(screen.getByTestId('presentation-studio-request-approval')).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // S8 — setup form & deck type selector
  // ---------------------------------------------------------------------

  it('renders the setup form with empty required fields by default', () => {
    render(<PresentationStudioPage />);
    expect(screen.getByTestId('presentation-studio-setup-form')).toBeTruthy();
    const titleInput = screen.getByTestId('psstudio-field-title') as HTMLInputElement;
    const deckTypeSelect = screen.getByTestId('psstudio-field-deck-type') as HTMLSelectElement;
    expect(titleInput.value).toBe('');
    expect(deckTypeSelect.value).toBe('');
    // Validation messages are NOT shown until the user has actually clicked
    // Run preview at least once (honest UX rule).
    expect(screen.queryByTestId('psstudio-error-title')).toBeNull();
    expect(screen.queryByTestId('psstudio-error-deck-type')).toBeNull();
    expect(screen.queryByTestId('presentation-studio-form-error')).toBeNull();
  });

  it('blocks Run preview when required fields are missing and surfaces inline errors', async () => {
    render(<PresentationStudioPage />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });

    expect(mockedApi.previewSourcePack).not.toHaveBeenCalled();
    expect(mockedApi.previewGenerate).not.toHaveBeenCalled();
    expect(screen.getByTestId('psstudio-error-title')).toBeTruthy();
    expect(screen.getByTestId('psstudio-error-deck-type')).toBeTruthy();
    expect(screen.getByTestId('presentation-studio-form-error')).toBeTruthy();
  });

  it('enables Run preview after both required fields are filled and clears form-error banner', async () => {
    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(true));

    render(<PresentationStudioPage />);

    // First click without filling -> validation error shown.
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });
    expect(screen.getByTestId('presentation-studio-form-error')).toBeTruthy();

    // Fill and re-click -> previews fire, form error banner disappears.
    fillRequiredFields();
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });
    await waitFor(() => {
      expect(mockedApi.previewGenerate).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('presentation-studio-form-error')).toBeNull();
    // The setup that hit the API must reflect what the user typed.
    const setupArg = mockedApi.previewSourcePack.mock.calls[0][0];
    expect(setupArg.title).toBe('Steering Committee Preview');
    expect(setupArg.deckType).toBe('steering_committee');
  });

  it('exposes all four governance-aware deck type options', () => {
    render(<PresentationStudioPage />);
    const deckTypeSelect = screen.getByTestId('psstudio-field-deck-type') as HTMLSelectElement;
    const optionValues = Array.from(deckTypeSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(
      expect.arrayContaining([
        '',
        'steering_committee',
        'project_pulse',
        'board_update',
        'sales_pitch',
      ])
    );
  });

  it('clears the in-flight approval ticket when the setup form changes', async () => {
    render(<PresentationStudioPage />);
    await runHealthyPreview();

    const ticket = makeApprovalTicket();
    mockedApi.requestApproval.mockResolvedValue({
      ticket,
      generatePreview: makeGeneratePreview(true),
      payloadFingerprint: ticket.payloadFingerprint,
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-request-approval'));
    });
    await screen.findByTestId('presentation-studio-confirm-generate');

    // User edits the title — the existing ticket would be stale
    // (payload_mismatch server-side). The UI must invalidate it eagerly.
    await act(async () => {
      fireEvent.change(screen.getByTestId('psstudio-field-title'), {
        target: { value: 'Different title' },
      });
    });
    // Single-use semantics on the client mirror the backend: the previously
    // minted ticket is dead, so Confirm-generate disappears.
    expect(screen.queryByTestId('presentation-studio-confirm-generate')).toBeNull();
    // The preview state still reports canProceed=true from the original
    // preview run, so the user can request a fresh ticket bound to the new
    // setup. The CTA reappears in the Menu 3 right slot.
    expect(screen.getByTestId('presentation-studio-request-approval')).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // S9 — source artifact picker
  // ---------------------------------------------------------------------

  function makeArtifactList(
    overrides: Partial<{
      artifacts: Array<{
        type: string;
        id: string;
        label: string;
        readiness: string;
        confidence: number | null;
        updatedAt: string | null;
        hint: string | null;
      }>;
      warnings: string[];
    }> = {}
  ) {
    const artifacts = overrides.artifacts ?? [
      {
        type: 'assessment',
        id: 'a-1',
        label: 'Q3 readiness review',
        readiness: 'ready',
        confidence: 0.91,
        updatedAt: '2026-05-01T10:00:00Z',
        hint: 'framework=SIRI',
      },
      {
        type: 'assessment',
        id: 'a-2',
        label: 'ADMA assessment',
        readiness: 'partial_ready',
        confidence: null,
        updatedAt: '2026-04-20T09:00:00Z',
        hint: null,
      },
    ];
    const byType: Record<string, number> = {};
    for (const a of artifacts) byType[a.type] = (byType[a.type] ?? 0) + 1;
    return {
      artifacts,
      total: artifacts.length,
      byType,
      generatedAt: '2026-05-08T20:00:00.000Z',
      warnings: overrides.warnings ?? [],
    };
  }

  it('fetches and renders the source artifact list on mount', async () => {
    mockedApi.listSourceArtifacts.mockResolvedValue(makeArtifactList());
    render(<PresentationStudioPage />);
    await waitFor(() => {
      expect(mockedApi.listSourceArtifacts).toHaveBeenCalledTimes(1);
    });
    const picker = await screen.findByTestId('presentation-studio-source-picker');
    expect(picker).toBeTruthy();
    expect(screen.getByTestId('psstudio-artifact-row-a-1')).toBeTruthy();
    expect(screen.getByTestId('psstudio-artifact-row-a-2')).toBeTruthy();
    expect(screen.queryByTestId('psstudio-source-picker-empty')).toBeNull();
    expect(screen.queryByTestId('psstudio-source-picker-error')).toBeNull();
  });

  it('renders the empty state when no source artifacts exist for the tenant', async () => {
    mockedApi.listSourceArtifacts.mockResolvedValue(makeArtifactList({ artifacts: [] }));
    render(<PresentationStudioPage />);
    expect(await screen.findByTestId('psstudio-source-picker-empty')).toBeTruthy();
    expect(screen.queryByTestId('psstudio-artifact-row-a-1')).toBeNull();
  });

  it('renders the honest degraded warning banner when the backend reports warnings', async () => {
    mockedApi.listSourceArtifacts.mockResolvedValue(
      makeArtifactList({
        artifacts: [],
        warnings: ['assessments_query_failed: connection lost'],
      })
    );
    render(<PresentationStudioPage />);
    const banner = await screen.findByTestId('psstudio-source-picker-warnings');
    expect(banner.textContent || '').toContain('assessments_query_failed');
    expect(screen.queryByTestId('psstudio-source-picker-empty')).toBeNull();
  });

  it('renders an honest error banner when the API call rejects', async () => {
    mockedApi.listSourceArtifacts.mockRejectedValue(new Error('Tenant context required'));
    render(<PresentationStudioPage />);
    const error = await screen.findByTestId('psstudio-source-picker-error');
    expect(error.textContent || '').toContain('Tenant context required');
  });

  it('forwards the user-selected artifacts into the preview API call', async () => {
    mockedApi.listSourceArtifacts.mockResolvedValue(makeArtifactList());
    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(true));

    render(<PresentationStudioPage />);
    await screen.findByTestId('psstudio-artifact-row-a-1');

    fillRequiredFields();
    // Select the first artifact via its checkbox.
    await act(async () => {
      fireEvent.click(screen.getByTestId('psstudio-artifact-checkbox-a-1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });
    await waitFor(() => {
      expect(mockedApi.previewSourcePack).toHaveBeenCalledTimes(1);
    });
    const setupArg = mockedApi.previewSourcePack.mock.calls[0][0];
    expect(setupArg.sourceArtifacts).toHaveLength(1);
    expect(setupArg.sourceArtifacts[0]).toMatchObject({
      type: 'assessment',
      id: 'a-1',
      readiness: 'ready',
      confidence: 0.91,
    });
  });

  it('clears the in-flight approval ticket when the source selection changes', async () => {
    mockedApi.listSourceArtifacts.mockResolvedValue(makeArtifactList());
    render(<PresentationStudioPage />);
    await screen.findByTestId('psstudio-artifact-row-a-1');

    await runHealthyPreview();
    const ticket = makeApprovalTicket();
    mockedApi.requestApproval.mockResolvedValue({
      ticket,
      generatePreview: makeGeneratePreview(true),
      payloadFingerprint: ticket.payloadFingerprint,
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-request-approval'));
    });
    await screen.findByTestId('presentation-studio-confirm-generate');

    // User toggles a source artifact — ticket invalidates eagerly.
    await act(async () => {
      fireEvent.click(screen.getByTestId('psstudio-artifact-checkbox-a-1'));
    });
    expect(screen.queryByTestId('presentation-studio-confirm-generate')).toBeNull();
  });

  it('reload button refetches the artifact list', async () => {
    mockedApi.listSourceArtifacts.mockResolvedValue(makeArtifactList());
    render(<PresentationStudioPage />);
    await screen.findByTestId('psstudio-artifact-row-a-1');
    expect(mockedApi.listSourceArtifacts).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId('psstudio-source-picker-reload'));
    });
    await waitFor(() => {
      expect(mockedApi.listSourceArtifacts).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------
  // Sprint S11 — pre-flight layout audit banner integration on the page.
  // ---------------------------------------------------------------------

  it('renders the layout audit clean banner after a preview with no findings (S11)', async () => {
    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(makeGeneratePreview(true));

    render(<PresentationStudioPage />);
    fillRequiredFields();
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });

    const banner = await screen.findByTestId('presentation-studio-layout-audit');
    expect(banner.getAttribute('data-state')).toBe('clean');
    expect(banner.textContent).toContain('Layout audit: no findings');
  });

  it('renders the layout audit warning banner with breakdown after a preview with findings (S11)', async () => {
    const generateWithFindings = {
      ...makeGeneratePreview(true),
      layoutAudit: {
        warnings: [
          '[layout_overflow_title] Slide 2 (executive_summary): title is 220 chars; …',
          '[missing_source_for_evidence_intent] Slide 3 (recommendation_single): …',
          '[unsupported_intent_for_pdf_export] Slide 4: …',
        ],
        slideAudits: [
          { index: 0, intent: 'cover', flags: [] },
          { index: 1, intent: 'executive_summary', flags: ['layout_overflow_title' as const] },
          {
            index: 2,
            intent: 'recommendation_single',
            flags: ['missing_source_for_evidence_intent' as const],
          },
          {
            index: 3,
            intent: 'mystery_intent',
            flags: ['unsupported_intent_for_pdf_export' as const],
          },
        ],
        flagCounts: {
          layout_overflow_title: 1,
          layout_overflow_key_message: 0,
          layout_overflow_blocks: 0,
          missing_source_for_evidence_intent: 1,
          unsupported_intent_for_pptx_export: 0,
          unsupported_intent_for_pdf_export: 1,
        },
      },
    };

    mockedApi.previewSourcePack.mockResolvedValue(makeHappySourcePack());
    mockedApi.previewNarrativePlan.mockResolvedValue(makeHappyNarrativePlan());
    mockedApi.previewTemplatePlan.mockResolvedValue(makeHappyTemplatePlan());
    mockedApi.previewGenerate.mockResolvedValue(generateWithFindings);

    render(<PresentationStudioPage />);
    fillRequiredFields();
    await act(async () => {
      fireEvent.click(screen.getByTestId('presentation-studio-run-preview'));
    });

    const banner = await screen.findByTestId('presentation-studio-layout-audit');
    expect(banner.getAttribute('data-state')).toBe('warnings');
    expect(banner.textContent).toContain('Layout audit: 3 findings');

    // Toggle expands the breakdown and the per-flag tiles render.
    const toggle = screen.getByTestId('presentation-studio-layout-audit-toggle');
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(
      screen.getByTestId('presentation-studio-layout-audit-flag-layout_overflow_title')
    ).toBeTruthy();
    expect(
      screen.getByTestId('presentation-studio-layout-audit-flag-missing_source_for_evidence_intent')
    ).toBeTruthy();
    expect(
      screen.getByTestId('presentation-studio-layout-audit-flag-unsupported_intent_for_pdf_export')
    ).toBeTruthy();
  });

  it('does NOT render the layout audit banner before a preview has run (S11)', () => {
    render(<PresentationStudioPage />);
    expect(screen.queryByTestId('presentation-studio-layout-audit')).toBeNull();
  });
});
