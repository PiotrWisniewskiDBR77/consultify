/**
 * @vitest-environment jsdom
 *
 * MeetingObjectPage (stage 2): the object card at `/meetings/:meetingId`
 * (and its `/minutes` `/decisions` `/notes/:noteId` siblings, all mounted on
 * this same component). Covers:
 *   - it fetches through the dedicated `Api.getMeeting` (not the list-and-
 *     find approach stage 1 used as a stopgap);
 *   - the honest not-found empty state vs. a real retryable error (driven by
 *     `error.status`, mirroring the server's 404-collapses-missing-and-
 *     no-access posture — see `meeting.routes.test.ts`);
 *   - the three sections (Szczegóły / Protokół / Decyzje i działania) render
 *     the right slice of data, including a governed note's `decisions` /
 *     `actionItems` shown honestly (both the string and `{decision}`/
 *     `{task,owner}` object shapes the DTO allows);
 *   - which section is active is driven by the URL, and clicking a tab
 *     navigates rather than just flipping local state.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: string | { defaultValue?: string }) =>
      (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k,
    i18n: { language: 'en' },
  }),
}));

const { navigateMock, routerState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  routerState: { pathname: '/meetings/meeting-1', meetingId: 'meeting-1', noteId: undefined as string | undefined },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: routerState.pathname }),
  useParams: () => ({ meetingId: routerState.meetingId, noteId: routerState.noteId }),
}));

const { getMeetingMock, listNotesMock } = vi.hoisted(() => ({
  getMeetingMock: vi.fn(),
  listNotesMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMeeting: getMeetingMock,
    listMeetingNotes: listNotesMock,
  },
}));

import { MeetingObjectPage } from '../MeetingObjectPage';

const meeting = {
  id: 'meeting-1',
  title: 'Quarterly Review',
  startAt: '2026-07-01T10:00:00.000Z',
  endAt: '2026-07-01T11:00:00.000Z',
  location: 'Zoom',
  attendees: ['Alice', 'Bob'],
  preRead: [],
  agenda: ['Status'],
  decisions: ['Ship v2'],
  followUps: [{ id: 'fu-1', title: 'Recap', owner: 'Bob', status: 'open' }],
  status: 'scheduled',
};

describe('MeetingObjectPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getMeetingMock.mockReset();
    listNotesMock.mockReset();
    listNotesMock.mockResolvedValue({ notes: [] });
    routerState.pathname = '/meetings/meeting-1';
    routerState.meetingId = 'meeting-1';
    routerState.noteId = undefined;
  });

  it('fetches through the dedicated single-meeting endpoint, not the list', async () => {
    getMeetingMock.mockResolvedValue({ meeting });
    render(<MeetingObjectPage />);

    expect(await screen.findByText('Quarterly Review')).toBeTruthy();
    expect(getMeetingMock).toHaveBeenCalledWith('meeting-1');
  });

  it('renders the Szczegóły section by default with honest empty fields', async () => {
    getMeetingMock.mockResolvedValue({ meeting: { ...meeting, preRead: [] } });
    render(<MeetingObjectPage />);

    await screen.findByText('Quarterly Review');
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    // Pre-read is empty — honest "—", never invented copy.
    const preReadCard = screen.getByText('Pre-read').closest('div')?.parentElement;
    expect(preReadCard?.textContent).toContain('—');
  });

  it('shows the honest not-found empty state on a 404, not a generic error', async () => {
    const err: any = new Error('Meeting not found');
    err.status = 404;
    getMeetingMock.mockRejectedValue(err);
    render(<MeetingObjectPage />);

    expect(await screen.findByText('Meeting not found')).toBeTruthy();
    expect(
      screen.getByText('This meeting does not exist, or you do not have access to it.')
    ).toBeTruthy();
  });

  it('shows a retryable error (not the not-found state) on a real failure', async () => {
    const err: any = new Error('boom');
    err.status = 500;
    getMeetingMock.mockRejectedValueOnce(err);
    render(<MeetingObjectPage />);

    expect(await screen.findByText('Failed to load meetings')).toBeTruthy();
    expect(screen.queryByText('Meeting not found')).toBeNull();

    getMeetingMock.mockResolvedValueOnce({ meeting });
    screen.getByText(/try again/i).click();
    expect(await screen.findByText('Quarterly Review')).toBeTruthy();
  });

  it('Protokół section shows a governed note\'s decisions/actionItems honestly (string and object shapes)', async () => {
    routerState.pathname = '/meetings/meeting-1/minutes';
    getMeetingMock.mockResolvedValue({ meeting });
    listNotesMock.mockResolvedValue({
      notes: [
        {
          id: 'note-1',
          source: 'heuristic',
          summary: 'Draft minutes',
          keyPoints: [],
          decisions: ['Ship v2', { decision: 'Freeze scope' }],
          actionItems: [{ task: 'Write recap', owner: 'Bob' }, 'Follow up with legal'],
          status: 'proposed',
          proposalId: 'proposal-1',
        },
      ],
    });
    render(<MeetingObjectPage />);

    expect(await screen.findByText('Draft minutes')).toBeTruthy();
    expect(screen.getByText('Ship v2')).toBeTruthy();
    expect(screen.getByText('Freeze scope')).toBeTruthy();
    expect(screen.getByText('Write recap')).toBeTruthy();
    expect(screen.getByText('Follow up with legal')).toBeTruthy();
    expect(listNotesMock).toHaveBeenCalledWith('meeting-1');
  });

  it('Protokół section is honest ("—") when a note has no decisions/actionItems', async () => {
    routerState.pathname = '/meetings/meeting-1/minutes';
    getMeetingMock.mockResolvedValue({ meeting });
    listNotesMock.mockResolvedValue({
      notes: [
        {
          id: 'note-1',
          source: 'heuristic',
          summary: 'Draft minutes',
          keyPoints: [],
          decisions: [],
          actionItems: [],
          status: 'proposed',
          proposalId: 'proposal-1',
        },
      ],
    });
    render(<MeetingObjectPage />);

    expect(await screen.findByText('Draft minutes')).toBeTruthy();
    const dashes = await screen.findAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('Decyzje i działania section shows meeting decisions and follow-ups', async () => {
    routerState.pathname = '/meetings/meeting-1/decisions';
    getMeetingMock.mockResolvedValue({ meeting });
    render(<MeetingObjectPage />);

    await waitFor(() => expect(getMeetingMock).toHaveBeenCalled());
    expect(await screen.findByText('Ship v2')).toBeTruthy();
    expect(screen.getByText('Recap')).toBeTruthy();
  });

  it('clicking a section tab navigates instead of only flipping local state', async () => {
    getMeetingMock.mockResolvedValue({ meeting });
    render(<MeetingObjectPage />);

    await screen.findByText('Quarterly Review');
    screen.getByText('Decyzje i działania').click();
    expect(navigateMock).toHaveBeenCalledWith('/meetings/meeting-1/decisions');

    screen.getByText('Protokół').click();
    expect(navigateMock).toHaveBeenCalledWith('/meetings/meeting-1/minutes');
  });
});
