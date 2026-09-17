/**
 * @vitest-environment jsdom
 *
 * MTG-1 rework etap 1 / DEC-596 — karta spotkania: AGENDA JAKO OŚ.
 *
 * Mierzone reguły (makieta mtg-rework-20260917, ekran karty):
 *   1. punkt agendy ma godzinę startu = start spotkania + suma czasów
 *      wcześniejszych punktów (nie start spotkania przy każdym wierszu),
 *   2. punkt ma numer (`position`), tytuł, cel, prowadzącego po nazwisku,
 *      pre-read i powiązania z inicjatywą/decyzją — wyłącznie do odczytu,
 *   3. gdy tabela `meeting_agenda_items` jest pusta, sekcja UCZCIWIE spada na
 *      legacy `agenda_json` z dopiskiem; gdy ma punkty strukturalne, linie
 *      legacy NIE są renderowane obok,
 *   4. awaria odczytu agendy (500) to widoczny błąd z ponowieniem, a 403/404
 *      (brak prawa / brak spotkania) to spadek na brak punktów BEZ straszenia
 *      błędem — tak samo, jak karta traktuje listę uczestników,
 *   5. prawy panel: Powiązania pokazują linki zapisane na punktach agendy
 *      (inicjatywa po tytule, decyzja po treści) albo uczciwy pusty stan,
 *      a Właściwości niosą liczbę punktów, prowadzącego i protokolanta.
 *
 * MUTACJA (dowód, że testy mierzą): zabierz w `AgendaAxisField` sumowanie
 * czasów (podaj start spotkania dla każdego punktu) -> RED „start time";
 * usuń spadek na `legacyAgenda` -> RED „legacy fallback"; zamień w
 * `loadAgenda` warunek 403/404 na zawsze-pokazuj-błąd -> RED „no access".
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Lokalne nadpisanie globalnej atrapy `react-i18next` (tests/setup.ts):
// `t()` zwraca defaultValue Z interpolacją zmiennych — oś agendy używa formy
// `t(klucz, szablon, zmienne)` dla sum i czasów, więc bez interpolacji
// asercje porównywałyby z surowym `{{items}}`.
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

const meeting = {
  id: 'meeting-1',
  title: 'Quarterly Review',
  startAt: START,
  endAt: '2026-07-01T11:30:00.000Z',
  location: 'Zoom',
  attendees: ['Alice'],
  preRead: [],
  agenda: ['Legacy free-text line'],
  decisions: [],
  followUps: [],
  status: 'scheduled',
  lifecycleState: 'scheduled',
  chairUserId: 'user-chair',
  scribeUserId: 'user-scribe',
};

const agendaItem = (over: Record<string, unknown> = {}) => ({
  id: 'item-1',
  organizationId: 'org-1',
  meetingId: 'meeting-1',
  position: 1,
  title: 'Opening',
  durationMinutes: 15,
  purpose: 'information',
  leadUserId: null,
  preRead: [],
  initiativeId: null,
  decisionId: null,
  notes: '',
  createdAt: START,
  updatedAt: START,
  ...over,
});

/** Ta sama reguła co `formatAgendaTime` — liczona niezależnie od komponentu,
 *  żeby oczekiwany napis nie zależał od strefy czasowej maszyny testowej. */
const clock = (iso: string, plusMinutes = 0): string =>
  new Date(new Date(iso).getTime() + plusMinutes * 60_000).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

const agendaResponse = (agendaItems: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ agendaItems }),
});

const stubAgendaFetch = (impl: (url: string) => Promise<unknown> | unknown) => {
  const fetchMock = vi.fn(async (url: string) => impl(String(url)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const openPanelSection = (label: string) => {
  const header = screen.getByText(label).closest('button');
  expect(header).toBeTruthy();
  header!.click();
};

describe('MeetingObjectPage — agenda jako oś spotkania (DEC-596)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getMeetingMock.mockReset();
    getMeetingMock.mockResolvedValue({ meeting });
    listNotesMock.mockReset();
    listNotesMock.mockResolvedValue({ notes: [] });
    listDecisionRecordsMock.mockReset();
    listDecisionRecordsMock.mockResolvedValue({ decisions: [] });
    listFollowUpRecordsMock.mockReset();
    listFollowUpRecordsMock.mockResolvedValue({ followUps: [] });
    listParticipantsMock.mockReset();
    listParticipantsMock.mockResolvedValue({ participants: [] });
    getUsersMock.mockReset();
    getUsersMock.mockResolvedValue([
      { id: 'user-chair', firstName: 'Cara', lastName: 'Chair' },
      { id: 'user-scribe', firstName: 'Sam', lastName: 'Scribe' },
      { id: 'user-lead', firstName: 'Ola', lastName: 'Lead' },
    ]);
    getInitiativesMock.mockReset();
    getInitiativesMock.mockResolvedValue([]);
    routerState.pathname = '/meetings/meeting-1';
    routerState.meetingId = 'meeting-1';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders each item with a start time computed from the meeting start plus the earlier durations', async () => {
    stubAgendaFetch((url) =>
      url.endsWith('/agenda')
        ? agendaResponse([
            agendaItem({ id: 'item-1', position: 1, title: 'Opening', durationMinutes: 15 }),
            agendaItem({
              id: 'item-2',
              position: 2,
              title: 'Budget review',
              durationMinutes: 20,
              purpose: 'discussion',
            }),
            agendaItem({
              id: 'item-3',
              position: 3,
              title: 'Hire decision',
              durationMinutes: 10,
              purpose: 'decision',
            }),
          ])
        : { ok: true }
    );
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    const rows = await within(axis).findAllByTestId('agenda-item-title');
    expect(rows.map((row) => row.textContent)).toEqual([
      '1. Opening',
      '2. Budget review',
      '3. Hire decision',
    ]);

    // Godziny: 10:00 (start) · 10:15 (+15) · 10:35 (+15+20) — ten sam
    // format co w kodzie, ale liczony tu niezależnie.
    const times = within(axis)
      .getAllByText(/^(0?\d|1\d|2[0-3]):\d{2}$/)
      .map((node) => node.textContent);
    expect(times).toEqual([clock(START), clock(START, 15), clock(START, 35)]);

    // Sumy w nagłówku osi: 3 punkty, 45 minut.
    expect(within(axis).getByTestId('meeting-agenda-axis-totals').textContent).toBe(
      '3 items · 45 min'
    );
    // Cele punktów jako chipy (drabina: informacja/dyskusja/decyzja).
    expect(within(axis).getByText('Information')).toBeTruthy();
    expect(within(axis).getByText('Discussion')).toBeTruthy();
    expect(within(axis).getByText('Decision')).toBeTruthy();
  });

  it('resolves the item owner by name and shows pre-read files', async () => {
    stubAgendaFetch((url) =>
      url.endsWith('/agenda')
        ? agendaResponse([
            agendaItem({
              leadUserId: 'user-lead',
              preRead: ['Q2-numbers.pdf'],
            }),
          ])
        : { ok: true }
    );
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    expect(await within(axis).findByText('Owner: Ola Lead')).toBeTruthy();
    expect(within(axis).getByText('Q2-numbers.pdf')).toBeTruthy();
  });

  it('says "unassigned" for an item without an owner instead of inventing a name', async () => {
    stubAgendaFetch((url) =>
      url.endsWith('/agenda') ? agendaResponse([agendaItem({ leadUserId: null })]) : { ok: true }
    );
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    expect(await within(axis).findByText('Owner: unassigned')).toBeTruthy();
  });

  it('renders initiative/decision links as read-only chips with resolved labels', async () => {
    getInitiativesMock.mockResolvedValue([{ id: 'init-1', title: 'Cut churn' }]);
    listDecisionRecordsMock.mockResolvedValue({
      decisions: [{ id: 'dec-1', statement: 'Ship v2 in Q3', status: 'recorded' }],
    });
    stubAgendaFetch((url) =>
      url.endsWith('/agenda')
        ? agendaResponse([agendaItem({ initiativeId: 'init-1', decisionId: 'dec-1' })])
        : { ok: true }
    );
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    expect(await within(axis).findByTestId('agenda-item-initiative')).toBeTruthy();
    expect(within(axis).getByTestId('agenda-item-initiative').textContent).toContain('Cut churn');
    expect(within(axis).getByTestId('agenda-item-decision').textContent).toContain(
      'Ship v2 in Q3'
    );
    // Tylko odczyt: brak trasy obiektowej inicjatywy, więc żaden z chipów nie
    // jest linkiem (atrapa prowadząca donikąd byłaby gorsza niż etykieta).
    expect(within(axis).queryByRole('link')).toBeNull();
  });

  it('falls back to the legacy free-text agenda with an honest hint when the table is empty', async () => {
    stubAgendaFetch((url) => (url.endsWith('/agenda') ? agendaResponse([]) : { ok: true }));
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    expect(await within(axis).findByTestId('meeting-agenda-legacy')).toBeTruthy();
    expect(within(axis).getByText('Legacy free-text line')).toBeTruthy();
    expect(
      within(axis).getByText(
        'Free-text agenda only — no structured agenda items recorded for this meeting.'
      )
    ).toBeTruthy();
  });

  it('does NOT render the legacy lines next to structured items', async () => {
    stubAgendaFetch((url) =>
      url.endsWith('/agenda') ? agendaResponse([agendaItem({ title: 'Opening' })]) : { ok: true }
    );
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    await within(axis).findByTestId('agenda-item-title');
    expect(within(axis).queryByTestId('meeting-agenda-legacy')).toBeNull();
    expect(within(axis).queryByText('Legacy free-text line')).toBeNull();
  });

  it('shows an honest empty state when there are neither structured items nor legacy lines', async () => {
    getMeetingMock.mockResolvedValue({ meeting: { ...meeting, agenda: [] } });
    stubAgendaFetch((url) => (url.endsWith('/agenda') ? agendaResponse([]) : { ok: true }));
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    expect(await within(axis).findByText('No agenda items yet.')).toBeTruthy();
    expect(within(axis).queryByTestId('meeting-agenda-legacy')).toBeNull();
  });

  it('shows a retryable error on a real failure and reloads the agenda on retry', async () => {
    let calls = 0;
    stubAgendaFetch((url) => {
      if (!url.endsWith('/agenda')) return { ok: true };
      calls += 1;
      return calls === 1
        ? { ok: false, status: 500, json: async () => ({}) }
        : agendaResponse([agendaItem({ title: 'Opening' })]);
    });
    render(<MeetingObjectPage />);

    const axis = await screen.findByTestId('meeting-agenda-axis');
    expect(await within(axis).findByText('Could not load the agenda.')).toBeTruthy();
    expect(within(axis).queryByTestId('agenda-item-title')).toBeNull();

    within(axis).getByRole('button', { name: /try again/i }).click();
    expect(await within(axis).findByTestId('agenda-item-title')).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('treats 403/404 as "no structured items" (legacy fallback) instead of a scary error', async () => {
    for (const status of [403, 404]) {
      getMeetingMock.mockResolvedValue({ meeting });
      stubAgendaFetch((url) =>
        url.endsWith('/agenda') ? { ok: false, status, json: async () => ({}) } : { ok: true }
      );
      const { unmount } = render(<MeetingObjectPage key={`run-${status}`} />);

      const axis = await screen.findByTestId('meeting-agenda-axis');
      expect(await within(axis).findByTestId('meeting-agenda-legacy')).toBeTruthy();
      expect(within(axis).queryByText('Could not load the agenda.')).toBeNull();
      unmount();
    }
  });

  it('fills the Relations panel from the agenda links and says so honestly when there are none', async () => {
    getInitiativesMock.mockResolvedValue([{ id: 'init-1', title: 'Cut churn' }]);
    stubAgendaFetch((url) =>
      url.endsWith('/agenda') ? agendaResponse([agendaItem({ initiativeId: 'init-1' })]) : { ok: true }
    );
    const first = render(<MeetingObjectPage />);

    await screen.findByTestId('meeting-agenda-axis');
    openPanelSection('Relations');
    const relations = await screen.findByTestId('meeting-relations');
    expect(within(relations).getByText('Initiatives')).toBeTruthy();
    expect(within(relations).getByText('Cut churn')).toBeTruthy();
    // Decyzji nie ma — uczciwie brak nagłówka, nie pusta lista.
    expect(within(relations).queryByText('Decisions')).toBeNull();
    first.unmount();

    // Pusty przypadek: brak linków -> jawny tekst, nie pusty akordeon.
    getMeetingMock.mockResolvedValue({ meeting });
    stubAgendaFetch((url) => (url.endsWith('/agenda') ? agendaResponse([]) : { ok: true }));
    const second = render(<MeetingObjectPage key="empty-relations" />);
    await screen.findByTestId('meeting-agenda-axis');
    openPanelSection('Relations');
    expect(
      await screen.findByText(
        'No agenda item is linked to an initiative or a decision yet.'
      )
    ).toBeTruthy();
    second.unmount();
  });

  it('carries the agenda count and the chair/scribe roles in Properties', async () => {
    stubAgendaFetch((url) =>
      url.endsWith('/agenda')
        ? agendaResponse([
            agendaItem({ id: 'item-1', position: 1 }),
            agendaItem({ id: 'item-2', position: 2 }),
          ])
        : { ok: true }
    );
    const first = render(<MeetingObjectPage />);

    await screen.findByTestId('meeting-agenda-axis');
    const properties = screen.getByText('Properties').closest('section') || document.body;
    await waitFor(() => expect(within(properties).getByText('2 items')).toBeTruthy());
    expect(within(properties).getByText('Cara Chair')).toBeTruthy();
    expect(within(properties).getByText('Sam Scribe')).toBeTruthy();
    first.unmount();

    // Bez ról w zapisie -> uczciwe „—", nigdy wymyślone nazwisko.
    getMeetingMock.mockResolvedValue({
      meeting: { ...meeting, chairUserId: null, scribeUserId: null },
    });
    stubAgendaFetch((url) => (url.endsWith('/agenda') ? agendaResponse([]) : { ok: true }));
    const second = render(<MeetingObjectPage key="no-roles" />);
    await screen.findByTestId('meeting-agenda-axis');
    const properties2 = screen.getByText('Properties').closest('section') || document.body;
    const chairRow = within(properties2)
      .getByText('Chair')
      .closest('tr, div, li') as HTMLElement;
    expect(chairRow.textContent).toContain('—');
  });
});
