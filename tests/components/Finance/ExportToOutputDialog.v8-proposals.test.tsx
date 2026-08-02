/**
 * @vitest-environment jsdom
 *
 * FIN-06 — "Create Initiatives" export action rewired to the real
 * finance-candidate-handoff/investment-case endpoints (preview/confirm),
 * replacing the old fabricated-stub `V8FinanceApi.createInitiativesFromAnalysis`
 * flow this file used to cover (hence the historical filename — kept so no
 * dangling coverage gap opens up under a renamed/orphaned file).
 *
 * Coverage bar (per FIN-06's "no fake receipt" mandate):
 *   - an ineligible preview shows the REAL reason, never a success state;
 *   - a successful confirm shows a REAL candidateId-driven result, never a
 *     fabricated stub;
 *   - a 4xx/409 from confirm shows a REAL error, never success;
 *   - a source type that cannot resolve a `financial_models.id` (this
 *     dialog's `analysisType` prop is 'financial_analysis' or 'valuation' for
 *     two of its three real callers) never even attempts the call — it shows
 *     an honest "unsupported" explanation instead.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown, options?: Record<string, unknown>) => {
      const base = typeof fallback === 'string' ? fallback : ((fallback as any)?.defaultValue ?? _key);
      if (!options) return base;
      return Object.keys(options).reduce(
        (acc, k) => acc.split(`{{${k}}}`).join(String((options as any)[k])),
        base
      );
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const previewInvestmentCaseCandidateHandoff = vi.fn();
const confirmInvestmentCaseCandidateHandoff = vi.fn();

vi.mock('@/services/api/v8/financeCandidateHandoff', () => ({
  previewInvestmentCaseCandidateHandoff: (...args: unknown[]) =>
    previewInvestmentCaseCandidateHandoff(...args),
  confirmInvestmentCaseCandidateHandoff: (...args: unknown[]) =>
    confirmInvestmentCaseCandidateHandoff(...args),
}));

vi.mock('@/services/financeExportService', () => ({
  exportFinancialAnalysis: vi.fn(),
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { ExportToOutputDialog } from '../../../src/components/Finance/ExportToOutputDialog';

describe('ExportToOutputDialog — FIN-06 Investment Case candidate handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks eligibility and shows the real ineligible reason, never a success state', async () => {
    previewInvestmentCaseCandidateHandoff.mockResolvedValue({
      eligible: false,
      reason: 'NOT_APPROVED',
    });
    const onExportComplete = vi.fn();

    render(
      <ExportToOutputDialog
        open
        onClose={vi.fn()}
        analysisId="model-1"
        analysisTitle="Q3 expansion model"
        analysisType="financial_model"
        onExportComplete={onExportComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    expect(previewInvestmentCaseCandidateHandoff).toHaveBeenCalledWith('model-1');

    await waitFor(() => {
      expect(
        screen.getByText(
          'This model is not approved yet — approve it first, then send it as a Candidate.'
        )
      ).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Send as Candidate' });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(confirmButton);
    expect(confirmInvestmentCaseCandidateHandoff).not.toHaveBeenCalled();
    expect(onExportComplete).not.toHaveBeenCalled();
  });

  it('shows a real candidateId-driven success state on confirm, not a fabricated stub', async () => {
    previewInvestmentCaseCandidateHandoff.mockResolvedValue({
      eligible: true,
      preview: {
        title: 'Expand distribution network',
        rationale: 'Approved model shows 18% IRR uplift.',
        sourceType: 'finance_investment_case',
        sourceId: 'model-1',
      },
    });
    confirmInvestmentCaseCandidateHandoff.mockResolvedValue({
      created: true,
      candidateId: 'candidate-77',
    });
    const onClose = vi.fn();
    const onExportComplete = vi.fn();

    render(
      <ExportToOutputDialog
        open
        onClose={onClose}
        analysisId="model-1"
        analysisTitle="Q3 expansion model"
        analysisType="financial_model"
        onExportComplete={onExportComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    await waitFor(() => {
      expect(screen.getByText('Expand distribution network')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Send as Candidate' });
    expect(confirmButton).not.toBeDisabled();
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(confirmInvestmentCaseCandidateHandoff).toHaveBeenCalledWith('model-1');
    });

    await waitFor(() => {
      expect(onExportComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          outputId: 'candidate-77',
          title: 'Sent as Initiative candidate: Expand distribution network',
        })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a real error on a 409 from confirm, never success', async () => {
    previewInvestmentCaseCandidateHandoff.mockResolvedValue({
      eligible: true,
      preview: {
        title: 'Expand distribution network',
        rationale: 'Approved model shows 18% IRR uplift.',
        sourceType: 'finance_investment_case',
        sourceId: 'model-1',
      },
    });
    const confirmError: any = new Error('Finance source is not eligible for candidate handoff');
    confirmError.status = 409;
    confirmError.data = { error: 'Finance source is not eligible for candidate handoff', code: 'SOURCE_NOT_ELIGIBLE' };
    confirmInvestmentCaseCandidateHandoff.mockRejectedValue(confirmError);
    const onClose = vi.fn();
    const onExportComplete = vi.fn();

    render(
      <ExportToOutputDialog
        open
        onClose={onClose}
        analysisId="model-1"
        analysisTitle="Q3 expansion model"
        analysisType="financial_model"
        onExportComplete={onExportComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    await waitFor(() => {
      expect(screen.getByText('Expand distribution network')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send as Candidate' }));

    await waitFor(() => {
      expect(screen.getByText('Finance source is not eligible for candidate handoff')).toBeInTheDocument();
    });

    expect(onExportComplete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never attempts the handoff for a source type that cannot resolve a financial_models.id', async () => {
    render(
      <ExportToOutputDialog
        open
        onClose={vi.fn()}
        analysisId="analysis-1"
        analysisTitle="Working capital analysis"
        analysisType="financial_analysis"
        onExportComplete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Initiatives/i }));

    await waitFor(() => {
      expect(screen.getByText('Available from an approved Investment Case')).toBeInTheDocument();
    });

    expect(previewInvestmentCaseCandidateHandoff).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send as Candidate' })).toBeDisabled();
  });
});
