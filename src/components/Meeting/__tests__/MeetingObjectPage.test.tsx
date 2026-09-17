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
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Local override of the global `react-i18next` mock (tests/setup.ts): this
// suite needs `t()` to return the literal defaultValue (not a key-agnostic
// proxy) so assertions on rendered copy stay exact. Everything past `t`/
// `useTranslation` is re-exported straight from the global mock's shape —
// `StandardArtifactShell` pulls in `NModeShell`'s `SectionErrorBoundary`,
// which imports `src/i18n.ts`, which calls `initReactI18next` at module
// scope; omitting it here (as the pre-shell version of this mock did) throws
// "No initReactI18next export is defined" before a single test can run.
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
  routerState: { pathname: '/meetings/meeting-1', meetingId: 'meeting-1', noteId: undefined as string | undefined },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: routerState.pathname }),
  useParams: () => ({ meetingId: routerState.meetingId, noteId: routerState.noteId }),
}));

const { getMeetingMock, listNotesMock, listDecisionRecordsMock, listFollowUpRecordsMock } =
  vi.hoisted(() => ({
    getMeetingMock: vi.fn(),
    listNotesMock: vi.fn(),
    listDecisionRecordsMock: vi.fn(),
    listFollowUpRecordsMock: vi.fn(),
  }));

vi.mock('@/services/api', () => ({
  Api: {
    getMeeting: getMeetingMock,
    listMeetingNotes: listNotesMock,
    // [U-51] Karta wola nowa trase `GET /:id/participants` (uczestnicy po
    // nazwisku + rola + RSVP). Atrapa modulu jest BIALA LISTA — bez tego
    // wpisu `Api.listMeetingParticipants` jest `undefined` i karta pokazuje
    // stan bledu uczestnikow zamiast tresci.
    listMeetingParticipants: vi.fn().mockResolvedValue({ participants: [] }),
    // DEC-82: the right panel's Properties table now also reads the org
    // roster (organizer lookup) and the D.4/D.5 decision/follow-up-record
    // resources (counts). Stubbed to honest empty defaults by default (see
    // `beforeEach`) — one test overrides them to cover the D.4/D.5 real
    // records rendering path.
    getUsers: vi.fn().mockResolvedValue([]),
    listMeetingDecisionRecords: listDecisionRecordsMock,
    listMeetingFollowUpRecords: listFollowUpRecordsMock,
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
    listDecisionRecordsMock.mockReset();
    listDecisionRecordsMock.mockResolvedValue({ decisions: [] });
    listFollowUpRecordsMock.mockReset();
    listFollowUpRecordsMock.mockResolvedValue({ followUps: [] });
    // DEC-596: karta czyta oś agendy przez surowy `fetch`
    // (`meetingAgendaClient.ts`). Domyślna atrapa zwraca PUSTĄ listę
    // strukturalnych punktów, więc sekcja spada na legacy `agenda_json`
    // fixture'a — dokładnie zachowanie, które te testy mierzyły wcześniej.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ agendaItems: [] }) }))
    );
    routerState.pathname = '/meetings/meeting-1';
    routerState.meetingId = 'meeting-1';
    routerState.noteId = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
    // DEC-596: agenda to oś spotkania (`meeting_agenda_items`). Gdy tabela jest
    // pusta, sekcja UCZCIWIE spada na legacy `agenda_json` z dopiskiem — więc
    // zakres na `data-testid`, bo sama etykieta „Agenda" jest też wierszem
    // Właściwości.
    const agendaCard = screen.getByTestId('meeting-agenda-axis');
    expect(within(agendaCard).getByText('Status')).toBeTruthy();
    expect(within(agendaCard).getByTestId('meeting-agenda-legacy')).toBeTruthy();
    expect(
      within(agendaCard).getByText(
        'Free-text agenda only — no structured agenda items recorded for this meeting.'
      )
    ).toBeTruthy();
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

  it('leaves the loading state for an honest retryable error when the meeting request never settles', async () => {
    vi.useFakeTimers();
    getMeetingMock.mockImplementation(() => new Promise(() => undefined));
    render(<MeetingObjectPage />);

    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(await screen.findByText('Failed to load meetings')).toBeTruthy();
    expect(screen.queryByText('Loading')).toBeNull();
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

  it('renders Zrób zadanie for every action item and prevents a duplicate request', async () => {
    routerState.pathname = '/meetings/meeting-1/minutes';
    getMeetingMock.mockResolvedValue({ meeting });
    listNotesMock.mockResolvedValue({ notes: [{ id: 'note-1', source: 'heuristic', summary: 'Draft minutes', keyPoints: [], decisions: [], actionItems: [{ task: 'Write recap', owner: 'Bob' }], status: 'proposed', proposalId: 'proposal-1' }] });
    // DEC-596: karta woła przez `fetch` także oś agendy, więc atrapa musi
    // rozdzielać żądania po URL — inaczej licznik blokady duplikatu zliczałby
    // GET agendy razem z POST tworzenia zadania.
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('/agenda')
        ? { ok: true, json: async () => ({ agendaItems: [] }) }
        : { ok: true }
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<MeetingObjectPage />);

    await screen.findByText('Write recap');
    const button = screen.getByRole('button', { name: 'Create task' });
    button.click();
    button.click();
    const taskCalls = () => fetchMock.mock.calls.filter(([url]) => !String(url).includes('/agenda'));
    await waitFor(() => expect(taskCalls()).toHaveLength(1));
    expect(taskCalls()[0]).toEqual([
      '/api/meeting/meeting-1/notes/note-1/action-items/0/task',
      { method: 'POST', credentials: 'include' },
    ]);
    expect(await screen.findByRole('button', { name: 'Task created' })).toBeDisabled();
  });

  it('Decyzje i działania section shows meeting decisions and follow-ups', async () => {
    // D.4/D.5 (day 10 UI wiring, see MeetingObjectPage.tsx comment above
    // `decisionsContent`): this section reads the dedicated decision/
    // follow-up-record resources now, not the legacy `meeting.decisions` /
    // `meeting.followUps` display-only arrays (dead once a note is
    // approved) — the fixture's `meeting.decisions: ['Ship v2']` and
    // `meeting.followUps: [{ title: 'Recap' }]` are intentionally unused
    // here; this test mocks the real D.4/D.5 records instead.
    routerState.pathname = '/meetings/meeting-1/decisions';
    getMeetingMock.mockResolvedValue({ meeting });
    listDecisionRecordsMock.mockResolvedValue({
      decisions: [
        {
          id: 'decision-1',
          organizationId: 'org-1',
          meetingId: 'meeting-1',
          statement: 'Ship v2',
          rationale: '',
          decidedBy: null,
          decidedAt: null,
          status: 'recorded',
          sourceKind: 'manual',
          sourceNoteId: null,
          sourceIndex: null,
          createdBy: 'user-1',
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-01T10:00:00.000Z',
        },
      ],
    });
    listFollowUpRecordsMock.mockResolvedValue({
      followUps: [
        {
          id: 'fu-1',
          organizationId: 'org-1',
          meetingId: 'meeting-1',
          title: 'Recap',
          owner: 'Bob',
          ownerUserId: null,
          dueAt: null,
          status: 'open',
          sourceKind: 'manual',
          sourceNoteId: null,
          sourceIndex: null,
        },
      ],
    });
    render(<MeetingObjectPage />);

    await waitFor(() => expect(getMeetingMock).toHaveBeenCalled());
    expect(await screen.findByText('Ship v2')).toBeTruthy();
    expect(screen.getByText('Recap')).toBeTruthy();
  });

  it('clicking a section tab navigates instead of only flipping local state', async () => {
    getMeetingMock.mockResolvedValue({ meeting });
    render(<MeetingObjectPage />);

    await screen.findByText('Quarterly Review');
    screen.getByText('Decisions & actions').click();
    expect(navigateMock).toHaveBeenCalledWith('/meetings/meeting-1/decisions');

    screen.getByText('Minutes').click();
    expect(navigateMock).toHaveBeenCalledWith('/meetings/meeting-1/minutes');
  });

  it('renders the SPEC-A shell — Menu 1 (title + lifecycle status) and the right panel (Actions/Properties) — with real meeting data', async () => {
    // DEC-596: status karty to TRWAŁY stan cyklu życia z `meetings.
    // lifecycle_state` (migracja 20262301), nie derywacja z zegara. Ten sam
    // zbiór pięciu stanów i te same etykiety co Menu 3 listy (`MeetingHub`).
    getMeetingMock.mockResolvedValue({
      meeting: { ...meeting, lifecycleState: 'needs_actions' },
    });
    render(<MeetingObjectPage />);

    expect(await screen.findByText('Quarterly Review')).toBeTruthy();
    // Zakres na Menu 1 (`data-nmode-header`, NModeHeader.tsx): ten sam stan
    // renderuje się też jako wiersz „Status" we Właściwościach (panel otwarty
    // domyślnie), więc bez zakresu asercja miałaby dwa trafienia.
    const header = document.querySelector('[data-nmode-header]') as HTMLElement;
    expect(within(header).getByText('Needs actions')).toBeTruthy();
    // Stare „Past — needs update" (derywacja z `endAt`) NIE ma już źródła.
    expect(screen.queryByText('Past — needs update')).toBeNull();

    // Prawy panel (ArtifactRightPanel accordion): section headers always
    // render regardless of open/closed state. FIX-M-1c (DEC-58 sceptyk):
    // these used to be hardcoded Polish literals rendered even under this
    // test's simulated 'en' locale — now real t() calls, so the mocked `t`
    // (which returns the literal defaultValue, see the top of this file)
    // renders the EN default text.
    expect(screen.getByText('Actions')).toBeTruthy();
    expect(screen.getByText('Properties')).toBeTruthy();

    // "Actions" and "Properties" are open by default (DEC-82 —
    // `ArtifactRightPanel.tsx` SSOT: "Domyślnie ROZWINIĘTE: Akcje i
    // Właściwości", matching Decisions/Task/Initiative) and both carry real,
    // wired content — not placeholder copy.
    expect(screen.getByText('Reload')).toBeTruthy();
    expect(screen.getByText('Back to list')).toBeTruthy();

    // "Properties" — already open — carries the meeting's REAL location, not
    // invented/placeholder content.
    expect(await screen.findByText('Zoom')).toBeTruthy();
    expect(screen.getByText('Property')).toBeTruthy();
    expect(screen.getByText('Value')).toBeTruthy();
  });
});
