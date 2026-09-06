/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string | { defaultValue?: string }) => typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? _key, i18n: { language: 'pl' } }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) => children,
  Translation: ({ children }: any) => children({ t: (key: string) => key, i18n: {} }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/meetings/meeting-1/minutes' }), useParams: () => ({ meetingId: 'meeting-1', noteId: undefined }) }));
const api = vi.hoisted(() => ({ getMeeting: vi.fn(), listMeetingNotes: vi.fn() }));
vi.mock('@/services/api', () => ({ Api: { getMeeting: api.getMeeting, listMeetingNotes: api.listMeetingNotes, getUsers: vi.fn().mockResolvedValue([]), listMeetingDecisionRecords: vi.fn().mockResolvedValue({ decisions: [] }), listMeetingFollowUpRecords: vi.fn().mockResolvedValue({ followUps: [] }) } }));

import { MeetingObjectPage } from '../MeetingObjectPage';

afterEach(() => vi.unstubAllGlobals());

describe('P9 meeting action item → task', () => {
  it('renders a button for the action and blocks a rapid duplicate request', async () => {
    api.getMeeting.mockResolvedValue({ meeting: { id: 'meeting-1', title: 'Spotkanie', startAt: '2026-09-06T10:00:00Z', endAt: '2026-09-06T11:00:00Z', attendees: [], preRead: [], agenda: [], status: 'scheduled' } });
    api.listMeetingNotes.mockResolvedValue({ notes: [{ id: 'note-1', summary: 'Podsumowanie', actionItems: [{ task: 'Wyślij raport', owner: 'Anna' }], decisions: [], keyPoints: [], status: 'proposed' }] });
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', request);
    render(<MeetingObjectPage />);
    await screen.findByText('Wyślij raport');
    const button = screen.getByRole('button', { name: 'Zrób zadanie' });
    button.click();
    button.click();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Zadanie utworzone' })).toBeDisabled();
  });
});
