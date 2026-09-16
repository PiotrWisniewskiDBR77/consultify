/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }));

vi.mock('@/services/api', () => ({ Api: { post: apiPost } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }, values?: Record<string, string>) => {
      const text = typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key;
      return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => values?.[key] ?? `{{${key}}}`);
    },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { NewAssessmentReportModal } from '../NewAssessmentReportModal';

const template = {
  id: 'template-1',
  name: 'Assessment report',
  reportType: 'ASSESSMENT_DRD',
};

describe('NewAssessmentReportModal — canonical session to legacy report source', () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  it('keeps the Method Core session id for selection but sends its legacy twin as sourceId', async () => {
    apiPost
      .mockResolvedValueOnce({ report: { id: 'report-1' } })
      .mockResolvedValueOnce({ ok: true });
    const onCreated = vi.fn();

    render(
      <NewAssessmentReportModal
        isOpen
        onClose={vi.fn()}
        onCreated={onCreated}
        initialTemplate={template}
        lockTemplate
        assessments={[
          {
            id: 'method-session-1',
            reportSourceId: 'legacy-assessment-1',
            name: 'Northwind DRD',
            type: 'DRD',
            status: 'APPROVED',
          },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText('Assessment'), {
      target: { value: 'method-session-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('report-1'));
    expect(apiPost).toHaveBeenNthCalledWith(
      1,
      '/report-builder',
      expect.objectContaining({ sourceType: 'ASSESSMENT', sourceId: 'legacy-assessment-1' })
    );
    expect(apiPost).not.toHaveBeenCalledWith(
      '/report-builder',
      expect.objectContaining({ sourceId: 'method-session-1' })
    );
  });

  it('fails closed with the freeze-first message when a canonical session has no legacy twin', () => {
    render(
      <NewAssessmentReportModal
        isOpen
        onClose={vi.fn()}
        onCreated={vi.fn()}
        initialTemplate={template}
        lockTemplate
        assessments={[
          {
            id: 'method-session-without-twin',
            reportSourceId: null,
            name: 'Unfrozen DRD',
            type: 'DRD',
            status: 'APPROVED',
          },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText('Assessment'), {
      target: { value: 'method-session-without-twin' },
    });

    expect(
      screen.getByText('This session has no report source yet — freeze it first.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
    expect(apiPost).not.toHaveBeenCalled();
  });
});
