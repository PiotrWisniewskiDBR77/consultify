/**
 * @vitest-environment jsdom
 *
 * MTG-2a (DEC-607) — WIRING test for the meeting card's Protocol entry.
 *
 * The card (`MeetingObjectPage`, details section) exposes the protocol document
 * ONLY while `VITE_MEETING_PROTOCOL` is ON, and clicking it must navigate to the
 * canonical object sub-route `/meetings/:meetingId/protocol` (never append a
 * `?meetingId=` query — DEC-2026-08-24-07 grammar). This asserts the REAL
 * component's navigation ARGUMENT, with the flag mocked ON so the gated entry
 * renders.
 *
 * Mutations that MUST turn this RED (proven in the report):
 *   · navigate to the list root / a `?meetingId=` query instead of the object
 *     sub-route → argument assert fails;
 *   · drop the flag gate (entry always rendered) is covered by the flag-OFF case
 *     below; remove the entry button → findByTestId fails.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const translate = (k: string, opts?: string | { defaultValue?: string }) =>
    (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k;
  return {
    useTranslation: () => ({
      t: translate,
      i18n: { language: 'en', getFixedT: () => translate, changeLanguage: async () => undefined },
    }),
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
    Translation: ({ children }: any) => children({ t: translate, i18n: {} }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
  };
});

const { navigateMock, routerState, flagState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  routerState: { pathname: '/meetings/meeting-1', meetingId: 'meeting-1', noteId: undefined as string | undefined },
  flagState: { enabled: true },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: routerState.pathname }),
  useParams: () => ({ meetingId: routerState.meetingId, noteId: routerState.noteId }),
}));

vi.mock('../meetingProtocolFlag', () => ({
  isMeetingProtocolEnabled: () => flagState.enabled,
  MEETING_PROTOCOL_FLAG_KEYS: { env: 'VITE_MEETING_PROTOCOL' },
}));

const { getMeetingMock } = vi.hoisted(() => ({ getMeetingMock: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: {
    getMeeting: getMeetingMock,
    listMeetingNotes: vi.fn().mockResolvedValue({ notes: [] }),
    listMeetingParticipants: vi.fn().mockResolvedValue({ participants: [] }),
    getUsers: vi.fn().mockResolvedValue([]),
    listMeetingDecisionRecords: vi.fn().mockResolvedValue({ decisions: [] }),
    listMeetingFollowUpRecords: vi.fn().mockResolvedValue({ followUps: [] }),
  },
}));

import { MeetingObjectPage } from '../MeetingObjectPage';

const meeting = {
  id: 'meeting-1',
  title: 'Quarterly Review',
  startAt: '2026-07-01T10:00:00.000Z',
  endAt: '2026-07-01T11:00:00.000Z',
  location: 'Zoom',
  attendees: ['Alice'],
  preRead: [],
  agenda: ['Status'],
  decisions: [],
  followUps: [],
  status: 'scheduled',
};

describe('MeetingObjectPage — Protocol entry wiring (MTG-2a)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getMeetingMock.mockReset();
    getMeetingMock.mockResolvedValue({ meeting });
    flagState.enabled = true;
    routerState.pathname = '/meetings/meeting-1';
    routerState.meetingId = 'meeting-1';
    // DEC-596: the agenda axis reads through a raw fetch; empty list keeps the
    // card on the legacy agenda fixture and off the structured path.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ agendaItems: [] }) })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flag ON: clicking the entry navigates to the canonical /meetings/:id/protocol sub-route', async () => {
    render(<MeetingObjectPage />);
    const entry = await screen.findByTestId('meeting-open-protocol');
    fireEvent.click(entry);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/meetings/meeting-1/protocol');
  });

  it('flag OFF: the entry is not rendered at all (fail-closed)', async () => {
    flagState.enabled = false;
    render(<MeetingObjectPage />);
    await screen.findByText('Quarterly Review');
    expect(screen.queryByTestId('meeting-open-protocol')).toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
