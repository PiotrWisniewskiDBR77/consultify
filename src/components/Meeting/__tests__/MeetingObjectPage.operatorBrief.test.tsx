/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, value?: string | { defaultValue?: string }) =>
      (typeof value === 'string' ? value : value?.defaultValue) || _key,
    i18n: { language: 'en' },
  }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) => children,
  Translation: ({ children }: any) => children({ t: (key: string) => key, i18n: {} }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/meetings/meeting-brief' }),
  useParams: () => ({ meetingId: 'meeting-brief', noteId: undefined }),
}));

const { getMeeting, listNotes, getBrief } = vi.hoisted(() => ({
  getMeeting: vi.fn(),
  listNotes: vi.fn(),
  getBrief: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMeeting,
    listMeetingNotes: listNotes,
    getAIOperatorMeetingBrief: getBrief,
  },
}));

import { MeetingObjectPage } from '../MeetingObjectPage';

const meeting = {
  id: 'meeting-brief',
  title: 'Review',
  startAt: '2026-08-25T10:00:00.000Z',
  endAt: '2026-08-25T11:00:00.000Z',
  location: '',
  attendees: [],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  status: 'scheduled',
  createdBy: 'user-a',
};

describe('MeetingObjectPage operator brief', () => {
  beforeEach(() => {
    getMeeting.mockReset().mockResolvedValue({ meeting });
    listNotes.mockReset().mockResolvedValue({ notes: [] });
    getBrief.mockReset();
  });

  it('renders an existing brief on the canonical meeting card', async () => {
    getBrief.mockResolvedValue({ prepSummary: 'Prepare the capacity decision.' });
    render(<MeetingObjectPage />);
    expect(await screen.findByText('Prepare the capacity decision.')).toBeTruthy();
    expect(getBrief).toHaveBeenCalledWith('meeting-brief');
  });

  it('renders an honest empty state when no brief exists', async () => {
    const error: any = new Error('missing');
    error.status = 404;
    getBrief.mockRejectedValue(error);
    render(<MeetingObjectPage />);
    expect(await screen.findByText('No operator brief is available.')).toBeTruthy();
  });

  it('distinguishes an API failure from an empty brief and retries', async () => {
    getBrief
      .mockRejectedValueOnce(Object.assign(new Error('failed'), { status: 500 }))
      .mockResolvedValueOnce({ prepSummary: 'Recovered brief.' });
    render(<MeetingObjectPage />);
    expect(await screen.findByText('Could not load the operator brief.')).toBeTruthy();
    const retry = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retry);
    expect(await screen.findByText('Recovered brief.')).toBeTruthy();
  });

  it('does not render stale brief data after a tenant-safe 404', async () => {
    const error: any = new Error('not found');
    error.status = 404;
    getBrief.mockRejectedValue(error);
    render(<MeetingObjectPage />);
    await waitFor(() => expect(getBrief).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('meeting-operator-brief')).toBeNull();
    expect(screen.getByText('No operator brief is available.')).toBeTruthy();
  });
});
