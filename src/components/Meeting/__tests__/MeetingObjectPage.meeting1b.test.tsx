/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 08_MEETINGS DEC-573] MEETING-1b (KANAL Wpis 132):
 *  - P1: the "Decisions & actions" follow-ups list was asymmetric with the
 *    decisions list next to it — decisions rendered both the recorded rows
 *    AND the approved-note items still only "in the minutes" (with a "From
 *    the minutes" tag), while follow-ups rendered only `followUpRecords`.
 *    The right-panel counter already counted both sources
 *    (`licznikZRejestruIProtokolu`), so the list and the counter told two
 *    different stories about the same data. Fixed symmetrically to decisions
 *    at MeetingObjectPage.tsx (~:1391).
 *  - Menu 2 (Sections + Edit|Preview) must render (U-51 regression guard,
 *    scoped here to this package's real component, not a stub).
 *  - Participants render by display name, falling back to email when the
 *    name is blank (ParticipantsField, MeetingObjectPage.tsx:285).
 *  - Preview (read mode) hides the write forms (decision/follow-up "add"
 *    controls) while keeping the recorded content — same discipline as the
 *    existing `[U-51] Podglad (Menu 2)` comments in the component.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: string | { defaultValue?: string; n?: number }) => {
      if (typeof opts === 'string') return opts;
      const dv = opts?.defaultValue ?? k;
      return typeof opts?.n === 'number' ? dv.replace('{{n}}', String(opts.n)) : dv;
    },
    i18n: { language: 'en' },
  }),
  Trans: ({ children, i18nKey }: any) => children || i18nKey,
  I18nextProvider: ({ children }: any) => children,
  Translation: ({ children }: any) => children({ t: (k: string) => k, i18n: {} }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

const { navigateMock, routerState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  routerState: {
    pathname: '/meetings/meeting-1b/decisions',
    meetingId: 'meeting-1b',
    noteId: undefined as string | undefined,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: routerState.pathname }),
  useParams: () => ({ meetingId: routerState.meetingId, noteId: routerState.noteId }),
}));

const {
  getMeetingMock,
  listNotesMock,
  listParticipantsMock,
  listDecisionRecordsMock,
  listFollowUpRecordsMock,
} = vi.hoisted(() => ({
  getMeetingMock: vi.fn(),
  listNotesMock: vi.fn(),
  listParticipantsMock: vi.fn(),
  listDecisionRecordsMock: vi.fn(),
  listFollowUpRecordsMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMeeting: getMeetingMock,
    listMeetingNotes: listNotesMock,
    listMeetingParticipants: listParticipantsMock,
    listMeetingDecisionRecords: listDecisionRecordsMock,
    listMeetingFollowUpRecords: listFollowUpRecordsMock,
    getUsers: vi.fn().mockResolvedValue([]),
  },
}));

import { MeetingObjectPage } from '../MeetingObjectPage';

const meeting = {
  id: 'meeting-1b',
  title: 'MEETING-1b package review',
  startAt: '2026-09-16T09:00:00.000Z',
  endAt: '2026-09-16T10:00:00.000Z',
  location: 'Zoom',
  attendees: [],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  status: 'scheduled',
};

const approvedNoteWithTwoActionItems = {
  id: 'note-1b',
  source: 'heuristic',
  summary: 'Approved minutes',
  keyPoints: [],
  decisions: [],
  actionItems: [
    { task: 'Draft the receipt', owner: 'Kasia' },
    { task: 'Ping Irina about staging', owner: 'Tomek' },
  ],
  status: 'approved',
  proposalId: null,
};

describe('MeetingObjectPage — MEETING-1b (P1 follow-ups symmetry + regressions)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getMeetingMock.mockReset();
    getMeetingMock.mockResolvedValue({ meeting });
    listNotesMock.mockReset();
    listNotesMock.mockResolvedValue({ notes: [] });
    listParticipantsMock.mockReset();
    listParticipantsMock.mockResolvedValue({ participants: [] });
    listDecisionRecordsMock.mockReset();
    listDecisionRecordsMock.mockResolvedValue({ decisions: [] });
    listFollowUpRecordsMock.mockReset();
    listFollowUpRecordsMock.mockResolvedValue({ followUps: [] });
    routerState.pathname = '/meetings/meeting-1b/decisions';
    routerState.meetingId = 'meeting-1b';
    routerState.noteId = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders Menu 2 (Sections + Edit/Preview mode toggle)', async () => {
    render(<MeetingObjectPage />);
    await screen.findByText('MEETING-1b package review');

    expect(screen.getByRole('radio', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Edit' }).getAttribute('aria-checked')).toBe('true');
  });

  it('renders participants by display name, falling back to email when the name is blank', async () => {
    listParticipantsMock.mockResolvedValue({
      participants: [
        {
          id: 'p-1',
          organizationId: 'org-1',
          meetingId: 'meeting-1b',
          participantKind: 'user',
          userId: 'user-1',
          email: 'kasia@dbr77.com',
          displayName: 'Kasia Nowak',
          role: 'attendee',
          invitationStatus: 'accepted',
          deliveryStatus: 'sent',
          respondedAt: null,
        },
        {
          id: 'p-2',
          organizationId: 'org-1',
          meetingId: 'meeting-1b',
          participantKind: 'guest',
          userId: null,
          email: 'guest@example.com',
          displayName: '',
          role: 'optional',
          invitationStatus: 'invited',
          deliveryStatus: 'sent',
          respondedAt: null,
        },
      ],
    });
    routerState.pathname = '/meetings/meeting-1b';
    render(<MeetingObjectPage />);
    await screen.findByText('MEETING-1b package review');

    const participantsCard = await screen.findByTestId('meeting-participants');
    expect(within(participantsCard).getByText('Kasia Nowak')).toBeTruthy();
    // Blank `displayName` falls back to the email, never a raw blank row.
    expect(within(participantsCard).getByText('guest@example.com')).toBeTruthy();
  });

  it('P1: follow-ups list is symmetric with decisions — approved-note items render "From the minutes" and the counter matches the visible list', async () => {
    listNotesMock.mockResolvedValue({ notes: [approvedNoteWithTwoActionItems] });
    render(<MeetingObjectPage />);
    await screen.findByText('MEETING-1b package review');

    // The two approved-note action items render in the Follow-ups list
    // (previously only `followUpRecords` rendered here — this list was
    // empty even though the counter already said "2 in minutes").
    const fromMinutesRows = await screen.findAllByTestId('meeting-followup-from-minutes');
    expect(fromMinutesRows).toHaveLength(2);
    expect(screen.getByText('Draft the receipt')).toBeTruthy();
    expect(screen.getByText('Ping Irina about staging')).toBeTruthy();
    expect(screen.getAllByText('From the minutes — not yet recorded').length).toBe(2);

    // Right-panel Properties "Follow-ups" counter (`licznikZRejestruIProtokolu`)
    // must name the SAME 2 items the list just rendered, not a silent 0.
    expect(screen.getByText('2 in minutes, not yet recorded')).toBeTruthy();
  });

  it('Preview (read mode) hides the decision/follow-up write forms but keeps recorded content', async () => {
    listDecisionRecordsMock.mockResolvedValue({
      decisions: [
        {
          id: 'decision-1',
          organizationId: 'org-1',
          meetingId: 'meeting-1b',
          statement: 'Ship the MEETING-1b receipt',
          rationale: '',
          decidedBy: null,
          decidedAt: null,
          status: 'recorded',
          sourceKind: 'manual',
          sourceNoteId: null,
          sourceIndex: null,
          createdBy: 'user-1',
          createdAt: '2026-09-16T09:00:00.000Z',
          updatedAt: '2026-09-16T09:00:00.000Z',
        },
      ],
    });
    render(<MeetingObjectPage />);
    await screen.findByText('MEETING-1b package review');

    // Edit mode (default): both write forms are present.
    expect(screen.getByPlaceholderText('New decision…')).toBeTruthy();
    expect(screen.getByPlaceholderText('Follow-up…')).toBeTruthy();
    expect(await screen.findByText('Ship the MEETING-1b receipt')).toBeTruthy();

    screen.getByRole('radio', { name: 'Preview' }).click();

    await waitFor(() => expect(screen.queryByPlaceholderText('New decision…')).toBeNull());
    expect(screen.queryByPlaceholderText('Follow-up…')).toBeNull();
    // Recorded content stays visible — Preview hides controls, not data.
    expect(screen.getByText('Ship the MEETING-1b receipt')).toBeTruthy();
  });
});
