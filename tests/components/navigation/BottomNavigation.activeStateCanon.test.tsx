/**
 * @vitest-environment jsdom
 *
 * G1 canon guard (2026-08-12) — BottomNavigation active-state colour.
 *
 * Defect this guards against: the ACTIVE mobile-nav item (and, on inactive
 * items, the CSS `:active` touch-press state) was painted with
 * `text-primary-600`/`dark:text-primary-400`/`bg-primary-600`/
 * `dark:bg-primary-400` — i.e. crimson (`#85182F`), the token this repo
 * reserves EXCLUSIVELY for critical/destructive/brand semantics
 * (CLAUDE.md "Pułapka nr 1"; docs/ui-standards/TRIADA_KANON.md część A10 /
 * C1: "Aktywne stany UI = neutralne… `primary` w tailwind = crimson #85182F
 * — zakazany jako kolor UI").
 *
 * This test renders the REAL component (not a fixture) and asserts, on the
 * live DOM `className` output:
 *   1. No `primary-<number>` utility appears anywhere in the nav (covers the
 *      active label, the active indicator bar, AND the inactive items'
 *      `active:`/`dark:active:` press-state classes — Tailwind bakes variant
 *      classes into the static class list, so this catches them without
 *      needing to simulate a real `:active` pseudo-state).
 *   2. The active item instead carries the canonical neutral token
 *      (`text-c-text`) and the indicator bar carries an existing semantic
 *      token (`bg-c-info`) — not a new/invented colour.
 *   3. `aria-current="page"` is present on the active item (non-colour
 *      affordance — WCAG 1.4.1 use-of-colour; the active item must stay
 *      identifiable without relying on hue alone).
 *
 * Proof this guard actually fires on the original defect (not just a check
 * that always passes): temporarily revert src/components/navigation/
 * BottomNavigation.tsx to its pre-fix content (`git stash` the one file) and
 * re-run this file — see docs/product/case-workspace/evidence/
 * g1-nav-active-canon-2026-08-12/README.md "Guard — proof it fires" for the
 * captured transcript of that run (RED before the fix, GREEN after).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BottomNavigation } from '../../../src/components/navigation/BottomNavigation';
import { AppView } from '../../../src/types';

const deviceState = {
  isMobile: true,
};

const appState = {
  currentView: AppView.MY_WORK,
  setCurrentView: vi.fn(),
  returnToFullChat: vi.fn(),
  setIsSidebarOpen: vi.fn(),
  toggleChatCollapse: vi.fn(),
  isChatCollapsed: true,
};

const conversationState = {
  setDisplayMode: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => deviceState,
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => appState,
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: typeof conversationState) => unknown) =>
    selector(conversationState),
}));

// Matches ANY primary-<number> utility, in any prefix position
// (text-/dark:text-/bg-/dark:bg-/active:text-/dark:active:text-…) — same
// canon regex family as scripts/check-triada.sh's VIOL_RE, narrowed to the
// numbers Tailwind actually generates for this palette.
const CRIMSON_UTILITY_RE = /primary-(50|100|200|300|400|500|600|700|800|900)(?![0-9])/;

describe('BottomNavigation — active-state canon guard (G1, no crimson outside critical semantics)', () => {
  beforeEach(() => {
    deviceState.isMobile = true;
    appState.currentView = AppView.MY_WORK;
    appState.isChatCollapsed = true;
    appState.setCurrentView.mockReset();
    appState.returnToFullChat.mockReset();
    appState.setIsSidebarOpen.mockReset();
    appState.toggleChatCollapse.mockReset();
    conversationState.setDisplayMode.mockReset();
  });

  it('paints no primary-*/crimson utility anywhere in the nav (active label, indicator bar, or inactive :active press state)', () => {
    render(<BottomNavigation />);

    const nav = screen.getByRole('navigation', { name: 'Primary mobile navigation' });
    const offenders: string[] = [];

    // Every element in the nav subtree, not just the top-level buttons — the
    // indicator bar is a nested <div>, the label a nested <span>.
    nav.querySelectorAll('*').forEach((el) => {
      const cls = el.getAttribute('class') || '';
      if (CRIMSON_UTILITY_RE.test(cls)) {
        offenders.push(`<${el.tagName.toLowerCase()} class="${cls}">`);
      }
    });

    expect(offenders).toEqual([]);
  });

  it('uses the canonical neutral token (text-c-text) for the active item, not an invented colour', () => {
    render(<BottomNavigation />);

    const activeButton = screen.getByTestId('bottom-nav-mywork');
    expect(activeButton).toHaveAttribute('aria-current', 'page');
    expect(activeButton.className).toMatch(/\btext-c-text\b/);
    expect(activeButton.className).not.toMatch(CRIMSON_UTILITY_RE);
  });

  it('uses an existing semantic token (bg-c-info) for the active indicator bar, not crimson', () => {
    render(<BottomNavigation />);

    const activeButton = screen.getByTestId('bottom-nav-mywork');
    const indicatorBar = activeButton.querySelector('div.absolute.top-0');
    expect(indicatorBar).not.toBeNull();
    expect(indicatorBar!.className).toMatch(/\bbg-c-info\b/);
    expect(indicatorBar!.className).not.toMatch(CRIMSON_UTILITY_RE);
  });

  it('keeps the active item identifiable WITHOUT colour: aria-current + bold label + indicator bar all present together', () => {
    render(<BottomNavigation />);

    const activeButton = screen.getByTestId('bottom-nav-mywork');
    const inactiveButton = screen.getByTestId('bottom-nav-assessment');

    // Non-colour affordance #1: aria-current.
    expect(activeButton).toHaveAttribute('aria-current', 'page');
    expect(inactiveButton).not.toHaveAttribute('aria-current');

    // Non-colour affordance #2: font-weight on the label (font-semibold added
    // only when active — see BottomNavigation.tsx `${active ? 'font-semibold' : ''}`).
    const activeLabel = activeButton.querySelector('span');
    const inactiveLabel = inactiveButton.querySelector('span');
    expect(activeLabel!.className).toMatch(/\bfont-semibold\b/);
    expect(inactiveLabel!.className).not.toMatch(/\bfont-semibold\b/);

    // Non-colour affordance #3: the indicator bar element itself only exists
    // (in the DOM at all) for the active item — presence/absence of a shape,
    // not a colour comparison.
    expect(activeButton.querySelector('div.absolute.top-0')).not.toBeNull();
    expect(inactiveButton.querySelector('div.absolute.top-0')).toBeNull();
  });
});
