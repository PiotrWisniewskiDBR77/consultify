/**
 * @vitest-environment jsdom
 *
 * MTG-1 rework / DEC-596 — karta spotkania: PRZEJŚCIE CYKLU ŻYCIA (Wpis 54c).
 *
 * Mierzone reguły (serwer = SSOT, `MEETING_LIFECYCLE_TRANSITIONS`):
 *   1. karta rysuje w panelu Akcje wiersz „Move to" z JEDYNNIE dozwolonymi
 *      przejściami z bieżącego stanu (scheduled → in_progress),
 *   2. stan o dwóch drogach (minutes_to_approve → needs_actions | closed)
 *      pokazuje oba cele,
 *   3. `closed` jest terminalny — brak przycisków przejścia,
 *   4. klik wysyła `PATCH /api/meeting/:id/lifecycle` z `{ nextState }` i po
 *      sukcesie ODŚWIEŻA kartę (stan z serwera, nie z pamięci frontu),
 *   5. odpowiedź 409 (niedozwolone przejście) NIE odświeża karty i nie
 *      zmienia stanu — front nigdy nie zgaduje przejścia za serwer.
 *
 * MUTACJE (dowód, że testy mierzą):
 *   M1 `meetingLifecycle.ts`: `closed: ['scheduled']` -> RED reguła 3
 *      (terminalny stan nagle rysuje przycisk),
 *   M2 `meetingLifecycle.ts`: `minutes_to_approve: ['closed']` -> RED reguła 2
 *      (znika cel „Needs actions"),
 *   M3 `MeetingObjectPage.advanceLifecycle`: usuń `await loadMeeting()` po
 *      sukcesie -> RED reguła 4 (brak odświeżenia),
 *   M4 `MeetingObjectPage.advanceLifecycle`: w `catch` wywołaj `loadMeeting()`
 *      -> RED reguła 5 (409 jednak odświeża).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      k: string,
      opts?: string | { defaultValue?: string; [key: string]: unknown },
      vars?: Record<string, unknown>
    ) => {
      const szablon = (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k;
      const params = { ...(typeof opts === 'object' && opts ? opts : {}), ...(vars || {}) };
      return szablon.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) =>
        String(params[name] ?? '')
      );
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
  routerState: { pathname: '/meetings/meeting-1', meetingId: 'meeting-1' },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: routerState.pathname }),
  useParams: () => ({ meetingId: routerState.meetingId, noteId: undefined }),
}));

const {
  getMeetingMock,
  listNotesMock,
  listDecisionRecordsMock,
  listFollowUpRecordsMock,
  listParticipantsMock,
  getUsersMock,
  getInitiativesMock,
} = vi.hoisted(() => ({
  getMeetingMock: vi.fn(),
  listNotesMock: vi.fn(),
  listDecisionRecordsMock: vi.fn(),
  listFollowUpRecordsMock: vi.fn(),
  listParticipantsMock: vi.fn(),
  getUsersMock: vi.fn(),
  getInitiativesMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMeeting: getMeetingMock,
    listMeetingNotes: listNotesMock,
    listMeetingParticipants: listParticipantsMock,
    listMeetingDecisionRecords: listDecisionRecordsMock,
    listMeetingFollowUpRecords: listFollowUpRecordsMock,
    getUsers: getUsersMock,
    getInitiatives: getInitiativesMock,
  },
}));

import { MeetingObjectPage } from '../MeetingObjectPage';

const START = '2026-07-01T10:00:00.000Z';

const baseMeeting = (lifecycleState: string) => ({
  id: 'meeting-1',
  title: 'Quarterly Review',
  startAt: START,
  endAt: '2026-07-01T11:30:00.000Z',
  location: 'Zoom',
  attendees: ['Alice'],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  status: 'scheduled',
  lifecycleState,
  chairUserId: null,
  scribeUserId: null,
});

/** Trasa `?` — `agenda` zawsze pusta (oś nie jest przedmiotem tego testu),
 *  `/lifecycle` konfigurowalne (200 albo 409), reszta `{ ok: true }`. */
const stubFetch = (lifecycle: (init: { method: string; body: string }) => unknown) => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/agenda')) {
      return { ok: true, status: 200, json: async () => ({ agendaItems: [] }) };
    }
    if (u.endsWith('/lifecycle')) {
      return lifecycle({ method: String(init?.method || ''), body: String(init?.body || '') });
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const okLifecycle = (nextState: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ lifecycleState: nextState }),
});

const actionsPanel = (): HTMLElement =>
  screen.getByText('Actions').closest('section') || document.body;

describe('MeetingObjectPage — przejście cyklu życia z karty (DEC-596 / Wpis 54c)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getMeetingMock.mockReset();
    listNotesMock.mockReset();
    listNotesMock.mockResolvedValue({ notes: [] });
    listDecisionRecordsMock.mockReset();
    listDecisionRecordsMock.mockResolvedValue({ decisions: [] });
    listFollowUpRecordsMock.mockReset();
    listFollowUpRecordsMock.mockResolvedValue({ followUps: [] });
    listParticipantsMock.mockReset();
    listParticipantsMock.mockResolvedValue({ participants: [] });
    getUsersMock.mockReset();
    getUsersMock.mockResolvedValue([]);
    getInitiativesMock.mockReset();
    getInitiativesMock.mockResolvedValue([]);
    routerState.pathname = '/meetings/meeting-1';
    routerState.meetingId = 'meeting-1';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders only the allowed transition for a scheduled meeting and PATCHes it, then reloads', async () => {
    getMeetingMock.mockResolvedValue({ meeting: baseMeeting('scheduled') });
    const fetchMock = stubFetch(() => okLifecycle('in_progress'));
    render(<MeetingObjectPage />);

    const panel = await waitFor(() => actionsPanel());
    // Reguła 1: jedyny dozwolony cel ze `scheduled` to `in_progress`.
    const advance = await within(panel).findByRole('button', { name: 'In progress' });
    expect(within(panel).queryByRole('button', { name: 'Closed' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Needs actions' })).toBeNull();

    advance.click();

    // Reguła 4: PATCH z `{ nextState }` + odświeżenie karty (getMeeting 2×).
    await waitFor(() => expect(getMeetingMock).toHaveBeenCalledTimes(2));
    const lifecycleCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/lifecycle'));
    expect(lifecycleCall).toBeTruthy();
    expect(String(lifecycleCall![0])).toBe('/api/meeting/meeting-1/lifecycle');
    expect((lifecycleCall![1] as RequestInit).method).toBe('PATCH');
    expect(JSON.parse(String((lifecycleCall![1] as RequestInit).body))).toEqual({
      nextState: 'in_progress',
    });
  });

  it('shows both targets for a state with two allowed transitions', async () => {
    getMeetingMock.mockResolvedValue({ meeting: baseMeeting('minutes_to_approve') });
    stubFetch(() => okLifecycle('closed'));
    render(<MeetingObjectPage />);

    const panel = await waitFor(() => actionsPanel());
    // Reguła 2: minutes_to_approve → needs_actions | closed (oba widoczne).
    expect(await within(panel).findByRole('button', { name: 'Needs actions' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Closed' })).toBeTruthy();
  });

  it('renders no transition buttons for the terminal closed state', async () => {
    getMeetingMock.mockResolvedValue({ meeting: baseMeeting('closed') });
    stubFetch(() => okLifecycle('closed'));
    render(<MeetingObjectPage />);

    const panel = await waitFor(() => actionsPanel());
    // Reguła 3: `closed` terminalny — brak wiersza „Move to".
    await within(panel).findByRole('button', { name: 'Reload' });
    expect(within(panel).queryByText('Move to')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'In progress' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Scheduled' })).toBeNull();
  });

  it('does NOT reload or change state when the server rejects the transition with 409', async () => {
    getMeetingMock.mockResolvedValue({ meeting: baseMeeting('scheduled') });
    stubFetch(() => ({
      ok: false,
      status: 409,
      json: async () => ({ code: 'MEETING_LIFECYCLE_TRANSITION_NOT_ALLOWED' }),
    }));
    render(<MeetingObjectPage />);

    const panel = await waitFor(() => actionsPanel());
    const advance = await within(panel).findByRole('button', { name: 'In progress' });
    expect(getMeetingMock).toHaveBeenCalledTimes(1);

    advance.click();

    // Reguła 5: 409 -> PATCH wysłany, ale BRAK odświeżenia (getMeeting nadal 1×)
    // i przycisk przejścia wciąż obecny (stan nie zmienił się za plecami serwera).
    await waitFor(() =>
      expect(
        screen.getByText('Actions').closest('section')?.querySelector('button')
      ).toBeTruthy()
    );
    expect(getMeetingMock).toHaveBeenCalledTimes(1);
    expect(await within(panel).findByRole('button', { name: 'In progress' })).toBeTruthy();
  });
});
