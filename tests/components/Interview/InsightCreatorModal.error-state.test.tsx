/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const apiGetMock = vi.fn();
const listContextDocumentsMock = vi.fn();
const createInsightMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

vi.mock('@/components/ui/primitives/Modal', () => ({
  Modal: ({ open, children }: any) => (open ? <div>{children}</div> : null),
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    listContextDocuments: (...args: any[]) => listContextDocumentsMock(...args),
    createInsight: (...args: any[]) => createInsightMock(...args),
    uploadContextDocument: vi.fn(),
  },
}));

import { InsightCreatorModal } from '../../../src/components/Interview/InsightCreatorModal';

describe('InsightCreatorModal load honesty', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    listContextDocumentsMock.mockReset();
    createInsightMock.mockReset();
    listContextDocumentsMock.mockResolvedValue({ documents: [] });
  });

  it('shows a retryable load error instead of pretending there are no completed sessions', async () => {
    apiGetMock.mockRejectedValue(new Error('network failed'));

    render(<InsightCreatorModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Insight generator is temporarily unavailable.')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'This does not mean there are no completed sessions. Retry loading the data.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('No completed sessions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ Retry/i }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledTimes(2);
    });
  });

  it('sends topic focus, leading question, and consultant note as governed analysis scope', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/interview/sessions/completed') {
        return Promise.resolve([
          {
            id: 'session-1',
            name: 'Customer Discovery',
            status: 'completed',
            approvalStatus: 'approved',
            completedAt: '2026-05-03T10:00:00.000Z',
            respondentId: 'respondent-1',
            respondentName: 'Anna Nowak',
            respondentRole: 'Operations Lead',
            department: 'Operations',
            answeredQuestions: 4,
            totalQuestions: 5,
          },
          {
            id: 'session-2',
            name: 'Finance Discovery',
            status: 'completed',
            approvalStatus: 'approved',
            completedAt: '2026-05-03T11:00:00.000Z',
            respondentId: 'respondent-2',
            respondentName: 'Jan Kowalski',
            respondentRole: 'Finance Lead',
            department: 'Finance',
            answeredQuestions: 3,
            totalQuestions: 5,
          },
        ]);
      }
      return Promise.resolve([]);
    });
    createInsightMock.mockResolvedValue({ id: 'insight-1' });

    render(<InsightCreatorModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/interview/sessions/completed');
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. Digital Transformation Analysis Q1 2024'), {
      target: { value: 'Scoped report' },
    });
    fireEvent.click(screen.getByText('Between the Lines'));
    fireEvent.click(screen.getByText('Analysis'));
    fireEvent.click(screen.getByText('Contradiction scan'));
    fireEvent.click(screen.getByRole('button', { name: 'Process and operations' }));
    fireEvent.click(screen.getByText('Context'));
    fireEvent.change(
      screen.getByPlaceholderText('e.g. Where do ownership handoffs most often break?'),
      {
        target: { value: 'Where do handoffs fail?' },
      }
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        'e.g. Focus on differences between IT and business departments. Use formal language.'
      ),
      { target: { value: 'Look for cross-functional blockers.' } }
    );
    fireEvent.click(screen.getByText('Source'));
    fireEvent.change(screen.getByLabelText('Respondent role filter'), {
      target: { value: 'Operations Lead' },
    });
    fireEvent.change(screen.getByLabelText('Respondent department filter'), {
      target: { value: 'Operations' },
    });
    await waitFor(() => {
      expect(screen.getByText('Customer Discovery')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Customer Discovery/i }));
    fireEvent.click(screen.getByText('Context'));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(createInsightMock).toHaveBeenCalledWith(
        expect.objectContaining({
          topicFocus: ['process_and_operations'],
          consultantNote: 'Look for cross-functional blockers.',
          leadingQuestion: 'Where do handoffs fail?',
          filters: expect.objectContaining({
            roles: ['Operations Lead'],
            departments: ['Operations'],
            outputTypes: ['summary', 'between_the_lines'],
            analysisModes: ['general_consulting_synthesis', 'contradiction_scan'],
          }),
          analysisMode: 'contradiction_scan',
          analysisScope: expect.objectContaining({
            role_filters: ['Operations Lead'],
            department_filters: ['Operations'],
            topic_focus: ['process_and_operations'],
            analysis_mode: 'contradiction_scan',
            consultant_note: 'Look for cross-functional blockers.',
            leading_question: 'Where do handoffs fail?',
          }),
        })
      );
    });
  });
});
