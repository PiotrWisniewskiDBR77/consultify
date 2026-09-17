/**
 * @vitest-environment jsdom
 *
 * DEC-596 / Wpis 41a — Menu 3 listy Spotkań: pięć stanów cyklu życia
 * (`Scheduled → In progress → Minutes to approve → Needs actions → Closed`)
 * z licznikami czytanymi z trwałego `meetings.lifecycle_state` (migracja
 * 20262301) oraz filtr tabeli po kliknięciu chipa.
 *
 * Mierzone tu reguły biznesowe:
 *  1. licznik chipa i filtr wierszy używają TEGO SAMEGO predykatu (M12-F02 —
 *     chip nie może reklamować N, gdy tabela pokazuje M),
 *  2. wiersz BEZ `lifecycle_state` (środowisko sprzed migracji) wpada do stanu
 *     dokładnie tak, jak robi to backfill migracji: `status='completed'` →
 *     `closed`, każdy inny → `scheduled`,
 *  3. stan spoza zbioru pięciu nie tworzy szóstego chipa ani nie znika z listy.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { LABELS, searchParamsMock, setSearchParamsMock, navigateMock, getMeetingsMock } =
  vi.hoisted(() => ({
    LABELS: {
      'meeting.counters.all': 'All',
      'meeting.lifecycle.scheduled': 'Scheduled',
      'meeting.lifecycle.inProgress': 'In progress',
      'meeting.lifecycle.minutesToApprove': 'Minutes to approve',
      'meeting.lifecycle.needsActions': 'Needs actions',
      'meeting.lifecycle.closed': 'Closed',
    } as Record<string, string>,
    searchParamsMock: new URLSearchParams(),
    setSearchParamsMock: vi.fn(),
    navigateMock: vi.fn(),
    getMeetingsMock: vi.fn(),
  }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | { defaultValue?: string }) =>
      LABELS[key] ?? ((typeof opts === 'string' ? opts : opts?.defaultValue) ?? key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsMock, setSearchParamsMock],
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMeetings: getMeetingsMock,
    getAIOperatorMeetingBrief: vi.fn().mockResolvedValue(null),
    listMeetingNotes: vi.fn().mockResolvedValue({ notes: [] }),
    listMeetingParticipants: vi.fn().mockResolvedValue({ participants: [] }),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => unknown) =>
    selector({ currentUser: { id: 'admin-1', role: 'ADMIN', isAuthenticated: true } }),
}));

import { MeetingHub } from '../MeetingHub';

const baseRow = {
  location: 'Leeds — Meeting Room 2',
  attendees: ['Alice'],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  startAt: '2026-09-20T10:00:00.000Z',
  endAt: '2026-09-20T11:00:00.000Z',
};

const rows = [
  { ...baseRow, id: 'm-1', title: 'Weekly PMO review', status: 'scheduled', lifecycleState: 'scheduled' },
  { ...baseRow, id: 'm-2', title: 'Portfolio standup', status: 'scheduled', lifecycleState: 'scheduled' },
  { ...baseRow, id: 'm-3', title: 'Board offsite', status: 'scheduled', lifecycleState: 'in_progress' },
  { ...baseRow, id: 'm-4', title: 'Client steering', status: 'scheduled', lifecycleState: 'minutes_to_approve' },
  { ...baseRow, id: 'm-5', title: 'Benefit review', status: 'scheduled', lifecycleState: 'needs_actions' },
  // Bez `lifecycle_state` — reguła backfillu migracji: completed → closed.
  { ...baseRow, id: 'm-6', title: 'Legacy completed sync', status: 'completed' },
  // Stan spoza zbioru (np. ręcznie nadpisany wiersz) — nie wolno go zgubić.
  { ...baseRow, id: 'm-7', title: 'Unknown state sync', status: 'scheduled', lifecycleState: 'bogus' },
];

const chipText = (id: string) => screen.getByTestId(`standard-chip-${id}`).textContent || '';

describe('MeetingHub — Menu 3: stany cyklu życia (DEC-596)', () => {
  beforeEach(() => {
    getMeetingsMock.mockReset();
    getMeetingsMock.mockResolvedValue({ meetings: rows });
    searchParamsMock.delete('meetingId');
    setSearchParamsMock.mockReset();
    navigateMock.mockReset();
  });

  it('renderuje pięć stanów + All z licznikami z trwałego lifecycle_state', async () => {
    render(<MeetingHub />);
    await screen.findByText('Weekly PMO review');

    for (const id of ['all', 'scheduled', 'in_progress', 'minutes_to_approve', 'needs_actions', 'closed']) {
      expect(screen.getByTestId(`standard-chip-${id}`)).toBeTruthy();
    }
    expect(chipText('all')).toContain('All');
    expect(chipText('all')).toContain('7');
    expect(chipText('scheduled')).toContain('Scheduled');
    // m-1 + m-2 (jawny stan) + m-7 (stan spoza zbioru → reguła backfillu).
    expect(chipText('scheduled')).toContain('3');
    expect(chipText('in_progress')).toContain('In progress');
    expect(chipText('in_progress')).toContain('1');
    expect(chipText('minutes_to_approve')).toContain('Minutes to approve');
    expect(chipText('minutes_to_approve')).toContain('1');
    expect(chipText('needs_actions')).toContain('Needs actions');
    expect(chipText('needs_actions')).toContain('1');
    expect(chipText('closed')).toContain('Closed');
    // m-6 nie ma `lifecycle_state`, ale `status='completed'` → closed.
    expect(chipText('closed')).toContain('1');
  });

  it('klik chipa filtruje tabelę tym samym predykatem, który liczy licznik', async () => {
    render(<MeetingHub />);
    await screen.findByText('Weekly PMO review');

    fireEvent.click(screen.getByTestId('standard-chip-in_progress'));
    await waitFor(() => expect(screen.queryByText('Weekly PMO review')).toBeNull());
    expect(screen.getByText('Board offsite')).toBeTruthy();
    expect(screen.queryByText('Legacy completed sync')).toBeNull();

    fireEvent.click(screen.getByTestId('standard-chip-closed'));
    await waitFor(() => expect(screen.queryByText('Board offsite')).toBeNull());
    expect(screen.getByText('Legacy completed sync')).toBeTruthy();

    fireEvent.click(screen.getByTestId('standard-chip-all'));
    await waitFor(() => expect(screen.getByText('Weekly PMO review')).toBeTruthy());
    expect(screen.getByText('Board offsite')).toBeTruthy();
    expect(screen.getByText('Legacy completed sync')).toBeTruthy();
  });

  it('licznik chipa i liczba wierszy po filtrze są identyczne (M12-F02)', async () => {
    render(<MeetingHub />);
    await screen.findByText('Weekly PMO review');

    fireEvent.click(screen.getByTestId('standard-chip-scheduled'));
    await waitFor(() => expect(screen.getByText('Portfolio standup')).toBeTruthy());

    const advertised = Number((chipText('scheduled').match(/\d+/) || ['0'])[0]);
    const rendered = ['Weekly PMO review', 'Portfolio standup', 'Unknown state sync'].filter(
      (title) => screen.queryByText(title) !== null
    ).length;
    expect(advertised).toBe(3);
    expect(rendered).toBe(advertised);
    expect(within(screen.getByTestId('standard-chip-scheduled')).getByText('Scheduled')).toBeTruthy();
  });
});
