/**
 * @vitest-environment jsdom
 *
 * Wpis 70 P2 (DEC-596) — podgląd listy Spotkań pokazuje ETYKIETĘ EN dla rodzaju
 * relacji, którą realnie linkuje (projekt), zamiast polskiego fallbacku
 * generycznego w EN UI.
 *
 * Zmierzony łańcuch defektu: relacja miała `label` = `Project: <8 znaków id>…`,
 * a `TECHNICAL_PREFIX_PATTERN` w `businessDisplayLabel.ts` łapie słowo `project`
 * z dwukropkiem, więc `containsTechnicalIdentifier` zwracał true, chip szedł
 * przez `resolveBusinessDisplayLabel` BEZ `type` i lądował na
 * `relationFallbackLabel(undefined)` = „Powiązany rekord" (zrzuty 03/04 etapu 2).
 *
 * Mierzone tu reguły:
 *  1. relacja projektu jest podana z `type` (i `id`), więc chip renderuje
 *     angielską etykietę rodzaju relacji, NIGDY „Powiązany rekord",
 *  2. spotkanie BEZ projektu nie dokłada pustego chipa (blok relacji ukryty —
 *     kanon „blok bez danych = ukryty"),
 *  3. surowy identyfikator nie znika z UI — zostaje w etykiecie/tooltipie,
 *     więc chip nie kłamie, że projekt ma nazwę.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { LABELS, searchParamsMock, setSearchParamsMock, navigateMock, getMeetingsMock } =
  vi.hoisted(() => ({
    LABELS: {
      'meeting.project': 'Project',
      'meeting.meetingLabel': 'Meeting',
      'common.relations': 'Relations',
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

const PROJECT_ID = 'd585884f-6cd0-4be2-ae04-abaf0c223659';

const baseRow = {
  location: 'Leeds — Meeting Room 2',
  attendees: ['Alice'],
  preRead: [],
  agenda: [],
  decisions: [],
  followUps: [],
  startAt: '2026-09-10T10:00:00.000Z',
  endAt: '2026-09-10T11:00:00.000Z',
  status: 'scheduled',
};

const clickRow = async (title: string) => {
  const link = await screen.findByText(title);
  let node: HTMLElement | null = link;
  while (node && node.tagName !== 'TR') node = node.parentElement;
  if (!node) throw new Error(`brak wiersza tabeli dla ${title}`);
  node.click();
};

describe('MeetingHub — etykieta relacji w podglądzie jest EN, nie polskim fallbackiem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMeetingsMock.mockResolvedValue([
      { ...baseRow, id: 'm-projekt', title: 'Weekly PMO review', projectId: PROJECT_ID },
      { ...baseRow, id: 'm-bez-projektu', title: 'Q2 business review', projectId: null },
    ]);
  });

  it('renders the English relation-kind label for the linked project', async () => {
    render(<MeetingHub />);
    await clickRow('Weekly PMO review');

    expect(await screen.findByText('Linked project')).toBeTruthy();
    expect(screen.queryByText('Powiązany rekord')).toBeNull();
    expect(screen.queryByText('Powiązany projekt')).toBeNull();
  });

  it('keeps the raw identifier in the chip copy instead of inventing a project name', async () => {
    render(<MeetingHub />);
    await clickRow('Weekly PMO review');
    await screen.findByText('Linked project');

    const chip = screen
      .getAllByTitle(/Linked project/)
      .find((element) => element.getAttribute('title')?.includes(PROJECT_ID.slice(0, 8)));
    expect(chip, 'tooltip chipa ma nieść surowy identyfikator projektu').toBeTruthy();
  });

  it('adds no relation chip for a meeting without a project', async () => {
    render(<MeetingHub />);
    await clickRow('Q2 business review');

    // Tytuł jest i w wierszu, i w nagłówku podglądu — czekamy na oba, co
    // dowodzi, że podgląd się otworzył (blok relacji bez danych jest ukryty).
    const dopasowania = await screen.findAllByText('Q2 business review');
    expect(dopasowania.length).toBeGreaterThan(1);
    expect(screen.queryByText('Linked project')).toBeNull();
    expect(screen.queryByText('Powiązany rekord')).toBeNull();
  });
});
