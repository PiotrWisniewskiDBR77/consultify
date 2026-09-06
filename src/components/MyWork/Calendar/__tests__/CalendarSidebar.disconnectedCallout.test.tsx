/**
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397] ZLECENIE 1.1-K (06.09).
 *
 * Owner's word: in the left column, under the SOURCES list, two large
 * messages ("Google Calendar: Not connected — connect it, to see events
 * here. Connect" / "Outlook: Not connected…") duplicated the same source
 * rows just above them, which already carry a
 * "Connect in Integrations →" sub-label. This test proves mutationally that
 * the plain disconnected state no longer renders that second callout, while:
 *   - the source row's inline "Connect in Integrations →" sub-label stays
 *     (it is the only affordance now, and it must keep pointing at
 *     Integrations), and
 *   - a genuinely different state (e.g. 'reauth') — which the row cannot
 *     express — still gets its own callout, since that information is not
 *     duplicated anywhere else.
 *
 * Reverting the `if (isDisconnected) return null;` guard added to
 * CalendarSidebar.tsx must turn this RED.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// tests/setup.ts globally stubs `useNavigate` to a no-op vi.fn() (component
// tests that render router-aware components with no <Router> wrapper would
// otherwise throw). This file DOES wrap in a <MemoryRouter> and needs to
// assert on a real navigation, so it restores react-router-dom's real
// useNavigate for itself only.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return actual;
});

// The suite-global react-i18next mock (tests/setup.ts) returns a key-agnostic
// Proxy for `t(key, { returnObjects: true })`, which does not support
// `.map()`. CalendarSidebar's mini-calendar header calls exactly that for
// `weekdaysShort`, so this file needs a local override that answers with a
// real array for that call while keeping the same "string fallback wins"
// behavior the rest of the component (and this test) relies on.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | Record<string, unknown>) => {
      if (typeof options === 'string') return options;
      if (options && typeof options === 'object') {
        if ((options as { returnObjects?: boolean }).returnObjects) {
          return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
        }
        return (options as { defaultValue?: string }).defaultValue ?? key;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

import { CalendarSidebar } from '../CalendarSidebar';

const baseProps = {
  filter: { sources: ['task', 'initiative', 'decision', 'consultify', 'google', 'outlook'] },
  onFilterChange: vi.fn(),
  currentDate: new Date('2026-09-06T00:00:00.000Z'),
  onDateChange: vi.fn(),
};

// CalendarSidebar calls useNavigate() unconditionally (row clicks on an
// unavailable external source navigate to Integrations), so every render in
// this file — even the ones not exercising navigation — needs a real
// <Router> ancestor now that react-router-dom's mock above is a pass-through.
const renderSidebar = (props: Partial<React.ComponentProps<typeof CalendarSidebar>>) =>
  render(
    <MemoryRouter initialEntries={['/my-work/calendar']}>
      <CalendarSidebar {...baseProps} {...props} />
    </MemoryRouter>
  );

describe('CalendarSidebar — external source callouts vs. row sub-label', () => {
  it('does not render a duplicate "not connected" callout for the disconnected state', () => {
    renderSidebar({
      externalSourceStatus: {
        google: {
          available: false,
          statusKey: 'disconnected',
          statusLabel: 'Not connected',
          helper: 'Google Calendar is not connected yet — connect it to bring events here.',
          nextStep: 'Connect Google Calendar in Integrations.',
        },
        outlook: {
          available: false,
          statusKey: 'disconnected',
          statusLabel: 'Not connected',
          helper: 'Outlook is not connected yet — connect it to bring events here.',
          nextStep: 'Connect Outlook in Integrations.',
        },
      },
    });

    // The row-level sub-label survives — this is the single remaining
    // affordance for a disconnected source.
    expect(screen.getAllByText('Connect in Integrations →')).toHaveLength(2);

    // The second, larger "not connected" message block must be gone: its
    // helper copy (unique to the callout, never used by the row) must not
    // be in the document at all.
    expect(
      screen.queryByText('Google Calendar is not connected yet — connect it to bring events here.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Outlook is not connected yet — connect it to bring events here.')
    ).not.toBeInTheDocument();

    // No leftover "Connect" callout action button either (used to navigate
    // to Integrations a second, redundant way).
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
  });

  it('still renders a callout for a state the row cannot express (reauth)', () => {
    renderSidebar({
      externalSourceStatus: {
        google: {
          available: false,
          statusKey: 'reauth',
          statusLabel: 'Reauth required',
          helper: 'Google Calendar needs to be reauthorized.',
          nextStep: 'Start reauthorization in Integrations.',
        },
      },
    });

    expect(screen.getByText('Google Calendar needs to be reauthorized.')).toBeInTheDocument();
    expect(screen.getByText('Start reauthorization in Integrations.')).toBeInTheDocument();
  });

  it('clicking the row (its only remaining affordance) still navigates to Settings → Integrations', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/my-work/calendar']}>
        <Routes>
          <Route
            path="/my-work/calendar"
            element={
              <CalendarSidebar
                {...baseProps}
                externalSourceStatus={{
                  google: {
                    available: false,
                    statusKey: 'disconnected',
                    statusLabel: 'Not connected',
                    helper: 'Google Calendar is not connected yet.',
                    nextStep: 'Connect Google Calendar in Integrations.',
                  },
                }}
              />
            }
          />
          <Route path="/settings/integrations" element={<div>Integrations screen landed</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByText('Google Calendar').closest('button')!);

    expect(screen.getByText('Integrations screen landed')).toBeInTheDocument();
  });
});
