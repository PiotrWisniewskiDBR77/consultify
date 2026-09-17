/**
 * @vitest-environment jsdom
 *
 * DEC-596 / Wpis 54 — kolumna Status listy Spotkań pokazuje STAN CYKLA ŻYCIA
 * (pięć stanów z `meetings.lifecycle_state`), a nie legacy `status` z
 * datowym „Past — needs update": lista, chipy Menu 3 i karta mówią jednym
 * słownikiem stanów. Etykieta w kolumnie jest zwarta (`meeting.lifecycle.short.*`),
 * bo columnFit fasady dociska kolumnę `dataType: 'status'` do 160 px.
 *
 * Mierzone tu reguły biznesowe:
 *  1. wiersz z `lifecycle_state='minutes_to_approve'` i legacy `status='scheduled'`
 *     w przeszłości renderuje „Minutes due", NIGDY legacy „Past — needs update",
 *  2. wiersz BEZ `lifecycle_state` i `status='completed'` renderuje „Closed"
 *     (parzystość z backfillem migracji 20262301),
 *  3. wiersz `needs_actions` renderuje zwartą etykietę stanu, nie opis daty.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { LABELS, searchParamsMock, setSearchParamsMock, navigateMock, getMeetingsMock } =
  vi.hoisted(() => ({
    LABELS: {
      'meeting.lifecycle.scheduled': 'Scheduled',
      'meeting.lifecycle.inProgress': 'In progress',
      'meeting.lifecycle.minutesToApprove': 'Minutes to approve',
      'meeting.lifecycle.needsActions': 'Needs actions',
      'meeting.lifecycle.closed': 'Closed',
      'meeting.lifecycle.short.scheduled': 'Scheduled',
      'meeting.lifecycle.short.inProgress': 'In progress',
      'meeting.lifecycle.short.minutesToApprove': 'Minutes due',
      'meeting.lifecycle.short.needsActions': 'Needs actions',
      'meeting.lifecycle.short.closed': 'Closed',
      'meeting.status.pastNeedsUpdate': 'Past — needs update',
      'meeting.status.completed': 'Completed',
      'meeting.status.scheduled': 'Scheduled',
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
  startAt: '2026-09-10T10:00:00.000Z',
  endAt: '2026-09-10T11:00:00.000Z',
};

const rows = [
  {
    ...baseRow,
    id: 'm-past',
    title: 'Weekly PMO review',
    status: 'scheduled',
    lifecycleState: 'minutes_to_approve',
  },
  { ...baseRow, id: 'm-done', title: 'Q2 business review', status: 'completed' },
  {
    ...baseRow,
    id: 'm-actions',
    title: 'Risk escalation sync',
    status: 'scheduled',
    lifecycleState: 'needs_actions',
  },
];

const rowOf = async (title: string) => {
  const link = await screen.findByText(title);
  let node: HTMLElement | null = link;
  while (node && node.tagName !== 'TR') node = node.parentElement;
  if (!node) throw new Error(`brak wiersza tabeli dla ${title}`);
  return within(node);
};

describe('MeetingHub — kolumna Status mówi stanem cyklu życia (DEC-596)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMeetingsMock.mockResolvedValue(rows);
  });

  it('past meeting in minutes_to_approve renders the lifecycle label, never legacy "Past — needs update"', async () => {
    render(<MeetingHub />);
    const row = await rowOf('Weekly PMO review');
    expect(row.getByText('Minutes due')).toBeTruthy();
    expect(row.queryByText('Past — needs update')).toBeNull();
    expect(row.queryByText('Minutes to approve')).toBeNull();
  });

  it('row without lifecycle_state and status completed renders Closed (backfill parity)', async () => {
    render(<MeetingHub />);
    const row = await rowOf('Q2 business review');
    expect(row.getByText('Closed')).toBeTruthy();
    expect(row.queryByText('Completed')).toBeNull();
  });

  it('needs_actions row renders the compact lifecycle label', async () => {
    render(<MeetingHub />);
    const row = await rowOf('Risk escalation sync');
    expect(row.getByText('Needs actions')).toBeTruthy();
  });
});
