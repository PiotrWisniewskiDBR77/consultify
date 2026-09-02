/**
 * @vitest-environment jsdom
 *
 * Regression test — Bramka 1 (Ustawienia): SettingsSidebar.tsx filters the
 * rendered navigation to `allowedSections` (currently lines ~491-492:
 * `group.items.filter((item) => allowedSectionSet.has(item.id))`).
 *
 * SettingsView.tsx wires this for the pilot role by passing
 * `allowedSections={isPilotParticipant ? pilotAllowedSections : undefined}`,
 * where `pilotAllowedSections` mirrors `PILOT_ALLOWED_SETTINGS_SECTIONS` from
 * `src/utils/pilotAccess.ts` (`profile`, `auth-access`, `language`, `theme`).
 * The owner/admin path passes no `allowedSections` at all, so the filter is
 * skipped entirely (`allowedSectionSet` is `null`).
 *
 * Measured against this branch's SettingsSidebar.tsx: the full nav has 37
 * leaf items across 10 groups; only 4 of those leaves are in the pilot
 * allowlist, so 33 must disappear under the pilot prop.
 *
 * Evidence pair (both required — a filter that hides everything for
 * everyone would also pass the first half alone):
 *  - "obcy nie widzi": pilot allowedSections -> only the 4 allowed leaves render.
 *  - "wlasciciel widzi": no allowedSections -> all 37 leaves render normally.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def?: string) => def ?? _key,
  }),
}));

import { SettingsSidebar } from '../SettingsSidebar';
import type { SettingsSection } from '../SettingsSidebar';

// Mirrors SettingsView.tsx's `pilotAllowedSections` / pilotAccess.ts's
// PILOT_ALLOWED_SETTINGS_SECTIONS. Kept as a literal on purpose: this test
// targets the SettingsSidebar filter itself, not SettingsView's wiring.
const PILOT_ALLOWED_SECTIONS: SettingsSection[] = [
  'profile',
  'auth-access',
  'language',
  'theme',
];

/** Leaf item buttons don't carry aria-expanded (group headers do), and the
 * footer "Back to Dashboard" button is the only other button outside a group.
 * Query with { hidden: true } because collapsed groups are only hidden via
 * the HTML `hidden` attribute, never removed from the DOM.
 */
function getLeafItemButtons(): HTMLElement[] {
  return screen
    .getAllByRole('button', { hidden: true })
    .filter(
      (btn) =>
        btn.getAttribute('aria-expanded') === null && btn.textContent !== 'Back to Dashboard'
    );
}

describe('SettingsSidebar pilot section filter (regression, bramka 1)', () => {
  it('obcy nie widzi: pilot allowedSections renders only the 4 allowed leaves', () => {
    render(
      <SettingsSidebar
        activeSection="profile"
        onSectionChange={vi.fn()}
        allowedSections={PILOT_ALLOWED_SECTIONS}
      />
    );

    expect(getLeafItemButtons()).toHaveLength(4);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.queryByText('Webhooks')).not.toBeInTheDocument();
    expect(screen.queryByText('Subscription & Billing')).not.toBeInTheDocument();
    expect(screen.queryByText('Beta Features')).not.toBeInTheDocument();
    expect(screen.queryByText('API Keys')).not.toBeInTheDocument();
    expect(screen.queryByText('Channels & Categories')).not.toBeInTheDocument();
  });

  it('wlasciciel widzi: no allowedSections renders all 37 leaves across 10 groups', () => {
    render(<SettingsSidebar activeSection="profile" onSectionChange={vi.fn()} />);

    expect(getLeafItemButtons()).toHaveLength(37);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByText('Subscription & Billing')).toBeInTheDocument();
    expect(screen.getByText('Beta Features')).toBeInTheDocument();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
  });
});
