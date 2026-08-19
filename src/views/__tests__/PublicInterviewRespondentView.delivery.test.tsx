import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicInterviewRespondentView } from '../PublicInterviewRespondentView';

const api = vi.hoisted(() => ({
  answer: vi.fn(),
  complete: vi.fn(),
  load: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: 'en' } }),
}));
vi.mock('@/services/api/publicInterview', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/api/publicInterview')>();
  return { ...original, publicInterviewApi: api };
});

const snapshot = {
  anonymityMode: 'identified' as const,
  distributionId: 'distribution-1',
  expiresAt: '2026-09-01T00:00:00.000Z',
  questions: [
    {
      answerText: null,
      contextNote: null,
      id: 'question-1',
      isRequired: true,
      questionText: 'Exact v1 question',
      updatedAt: '2026-08-19T10:00:00.000Z',
    },
  ],
  sessionId: 'session-1',
  status: 'opened',
  templateId: 'template-1',
  templateVersion: 1,
};

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/public/interview/token-1']}>
      <Routes>
        <Route path="/public/interview/:token" element={<PublicInterviewRespondentView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicInterviewRespondentView exact delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.load.mockResolvedValue(snapshot);
    api.complete.mockResolvedValue({ alreadyComplete: false, completed: true });
  });

  it('shows the exact published version returned by cold readback', async () => {
    renderView();
    expect(await screen.findByLabelText(/Exact v1 question/)).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(api.load).toHaveBeenCalledWith('token-1');
  });

  it('keeps one idempotency identity across a failed retry and reports busy state', async () => {
    api.answer
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ replayed: true, updatedAt: '2026-08-19T10:01:00.000Z' });
    renderView();
    const textarea = await screen.findByLabelText(/Exact v1 question/);
    fireEvent.change(textarea, { target: { value: 'Durable answer' } });
    const save = screen.getByRole('button', { name: 'Save answer' });
    fireEvent.click(save);
    expect(save).toBeDisabled();
    await screen.findByRole('alert');
    fireEvent.click(save);
    await waitFor(() => expect(api.answer).toHaveBeenCalledTimes(2));
    const first = api.answer.mock.calls[0][2];
    const second = api.answer.mock.calls[1][2];
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.expectedUpdatedAt).toBe(snapshot.questions[0].updatedAt);
    expect(await screen.findByText('Answer saved')).toBeInTheDocument();
  });
});
