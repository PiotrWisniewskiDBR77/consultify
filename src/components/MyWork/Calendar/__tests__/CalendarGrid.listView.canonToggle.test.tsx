/**
 * Odbiór na żywo 05.09 (`evidence/odbior-zywo-20260905/16-kanon/wyniki.json`,
 * id `mw-007-calendar-narrow-viewport`, ROZNI_SIE): zatwierdzony obraz kalendarza
 * (My Work → Kalendarz) ma CZTERY pozycje przełącznika widoku (Miesiąc/Tydzień/
 * Dzień/Lista). Realny ekran (Calendar V2, default-on od be0d6e6b2c) miał tylko
 * TRZY — `CalendarGrid` chowała „Lista" wyłącznie w trybie `v2` bez
 * uzasadnienia w commit message, mimo że FullCalendar renderuje `listWeek`
 * (patrz `VIEW_MAP`) identycznie w obu trybach.
 *
 * Ten test dowodzi mutacyjnie, że wszystkie cztery przyciski są obecne
 * niezależnie od `v2` (true — realny domyślny tryb produkcyjny, i false —
 * legacy).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@fullcalendar/react', () => ({
  default: React.forwardRef((_props: unknown, _ref: unknown) => (
    <div data-testid="fullcalendar-stub" />
  )),
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }));
vi.mock('@fullcalendar/interaction', () => ({ default: {} }));
vi.mock('@fullcalendar/list', () => ({ default: {} }));

import { CalendarGrid } from '../CalendarGrid';

const baseProps = {
  events: [],
  currentDate: new Date('2026-09-05T00:00:00.000Z'),
  onDateChange: vi.fn(),
  onViewModeChange: vi.fn(),
};

describe('CalendarGrid view-mode toggle keeps all 4 canon positions', () => {
  it.each([true, false])('shows Month/Week/Day/List when v2=%s', (v2) => {
    render(<CalendarGrid {...baseProps} viewMode="month" v2={v2} />);

    // The test harness's global react-i18next mock returns the raw key when
    // no fallback string is passed (this component calls `t(key)` with no
    // second arg) — assert on the keys, which is what actually renders.
    expect(screen.getByRole('button', { name: 'myWork.calendarGrid.viewMonth' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'myWork.calendarGrid.viewWeek' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'myWork.calendarGrid.viewDay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'myWork.calendarGrid.viewList' })).toBeInTheDocument();
  });
});
