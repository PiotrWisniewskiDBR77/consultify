import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const createOutputFromSessionMock = vi.fn();
const appendNotebookConvertedOutputMock = vi.fn();
const trackFunnelEventMock = vi.fn();
const convertConfirmationShowMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/services/conversionService', () => ({
  createOutputFromSession: (...args: unknown[]) => createOutputFromSessionMock(...args),
}));

vi.mock('@/services/api', () => ({
  Api: {
    appendNotebookConvertedOutput: (...args: unknown[]) => appendNotebookConvertedOutputMock(...args),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

vi.mock('../../../src/components/MyWork/ConvertToConfirmation', () => ({
  ConvertToConfirmation: {
    show: (...args: unknown[]) => convertConfirmationShowMock(...args),
  },
}));

vi.mock('../../../src/components/MyWork/ConvertToDialog', () => ({
  ConvertToDialog: ({
    open,
    targetType,
    onConvert,
  }: {
    open: boolean;
    targetType?: string;
    onConvert: (session: { id: string }, targetType: string) => Promise<void>;
  }) =>
    open ? (
      <button onClick={() => void onConvert({ id: 'session-7' }, targetType || 'report')}>
        Confirm convert
      </button>
    ) : null,
}));

import { ConvertToOutputMenu } from '@/components/MyWork/ConvertToOutputMenu';

describe('ConvertToOutputMenu notebook readback continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOutputFromSessionMock.mockResolvedValue({
      success: true,
      sessionId: 'session-7',
      outputId: 'report-7',
      outputType: 'report',
    });
    appendNotebookConvertedOutputMock.mockResolvedValue({
      id: 'note-1',
      status: 'converted',
    });
  });

  it('persists converted notebook outputs before completing the convert flow', async () => {
    const onConvertComplete = vi.fn();

    render(
      <ConvertToOutputMenu
        sourceType="notebook"
        sourceId="note-1"
        sourceTitle="Notebook source"
        onConvertComplete={onConvertComplete}
      />
    );

    fireEvent.click(screen.getByTitle('Convert to output'));
    fireEvent.click(screen.getAllByRole('menuitem')[1]);
    fireEvent.click(screen.getByText('Confirm convert'));

    await waitFor(() => {
      expect(createOutputFromSessionMock).toHaveBeenCalledWith('session-7', 'report', 'Notebook source');
    });
    expect(appendNotebookConvertedOutputMock).toHaveBeenCalledWith('note-1', {
      type: 'report',
      id: 'report-7',
    });
    expect(onConvertComplete).toHaveBeenCalledWith('report', 'report-7');
    expect(convertConfirmationShowMock).toHaveBeenCalled();
  });
});
