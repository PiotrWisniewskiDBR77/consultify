/**
 * @vitest-environment jsdom
 *
 * // CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru
 *
 * Day 105 contract: an approved governed note returned by the canonical notes
 * endpoint must not disappear from the "Decisions & actions" section merely
 * because the independent meeting_decisions resource is empty.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) =>
      (typeof options === 'string' ? options : options?.defaultValue) ?? key,
    i18n: { language: 'en' },
  }),
  Trans: ({ children, i18nKey }: any) => children || i18nKey,
  I18nextProvider: ({ children }: any) => children,
  Translation: ({ children }: any) => children({ t: (key: string) => key, i18n: {} }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/meetings/w3-mtg-approved-meeting-v1/decisions' }),
  useParams: () => ({ meetingId: 'w3-mtg-approved-meeting-v1', noteId: undefined }),
}));

const { getMeetingMock, listNotesMock, listDecisionRecordsMock } = vi.hoisted(() => ({
  getMeetingMock: vi.fn().mockResolvedValue({
    meeting: {
      id: 'w3-mtg-approved-meeting-v1',
      title: 'Customer pilot readiness — approved minutes',
      startAt: '2026-09-12T09:00:00.000Z',
      endAt: '2026-09-12T10:00:00.000Z',
      attendees: [],
      preRead: [],
      agenda: [],
      decisions: [],
      followUps: [],
      status: 'completed',
    },
  }),
  listNotesMock: vi.fn().mockResolvedValue({
    notes: [
      {
        id: 'approved-note',
        status: 'approved',
        summary: 'Approved pilot minutes',
        decisions: [{ decision: 'Pilot after readiness evidence' }],
        actionItems: [],
      },
    ],
  }),
  listDecisionRecordsMock: vi.fn().mockResolvedValue({ decisions: [] }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMeeting: getMeetingMock,
    listMeetingNotes: listNotesMock,
    listMeetingDecisionRecords: listDecisionRecordsMock,
    listMeetingFollowUpRecords: vi.fn().mockResolvedValue({ followUps: [] }),
    getUsers: vi.fn().mockResolvedValue([]),
  },
}));

import { MeetingObjectPage } from '../MeetingObjectPage';

describe('MeetingObjectPage approved governed decision contract', () => {
  it('shows an approved note decision in Decisions & actions when decision-records is empty', async () => {
    render(<MeetingObjectPage />);

    expect(await screen.findByText('Pilot after readiness evidence')).toBeTruthy();
    expect(listNotesMock).toHaveBeenCalledWith('w3-mtg-approved-meeting-v1');
    expect(listDecisionRecordsMock).toHaveBeenCalledWith('w3-mtg-approved-meeting-v1');
  });
});
