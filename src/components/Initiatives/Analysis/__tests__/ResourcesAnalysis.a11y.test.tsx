/**
 * @vitest-environment jsdom
 *
 * CB-01 / RV-017 — the Resources table's Role-column filter control must
 * expose an accessible name that communicates its purpose and current
 * active state, and its open/close state must be programmatically exposed.
 * PL/EN because the name is built from a translation key.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const TRANSLATIONS: Record<string, { en: string; pl: string }> = {
  'initiatives.analysis.resources.filterRoleActive': {
    en: 'Filter by role (active: {{role}})',
    pl: 'Filtruj wg roli (aktywny: {{role}})',
  },
  'initiatives.analysis.resources.filterRoleInactive': {
    en: 'Filter by role, no filter applied',
    pl: 'Filtruj wg roli, brak aktywnego filtra',
  },
};

function mockI18n(lang: 'en' | 'pl') {
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t: (key: string, defaultOrOpts?: any, maybeOpts?: any) => {
        const opts =
          typeof maybeOpts === 'object'
            ? maybeOpts
            : typeof defaultOrOpts === 'object'
              ? defaultOrOpts
              : undefined;
        const entry = TRANSLATIONS[key];
        const base = entry ? entry[lang] : typeof defaultOrOpts === 'string' ? defaultOrOpts : key;
        if (!opts) return base;
        return Object.keys(opts).reduce((s, k) => s.replace(`{{${k}}}`, String(opts[k])), base);
      },
      i18n: { language: lang },
    }),
  }));
}

const ALLOCATIONS = [
  {
    resourceId: 'r1',
    resourceName: 'Ana Kowalska',
    role: 'Engineer',
    allocatedInitiatives: ['init-1'],
    allocatedInitiativeNames: ['Digital onboarding'],
    utilizationPercent: 80,
    status: 'ok' as const,
  },
];

describe('ResourcesAnalysis — Role-column filter accessible contract', () => {
  it('names the filter with no active state (EN)', async () => {
    vi.resetModules();
    mockI18n('en');
    const { ResourcesAnalysis } = await import('../ResourcesAnalysis');
    render(<ResourcesAnalysis allocations={ALLOCATIONS} issues={[]} onOpenInitiative={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Filter by role, no filter applied' })
    ).toBeInTheDocument();
  });

  it('names the filter with no active state (PL)', async () => {
    vi.resetModules();
    mockI18n('pl');
    const { ResourcesAnalysis } = await import('../ResourcesAnalysis');
    render(<ResourcesAnalysis allocations={ALLOCATIONS} issues={[]} onOpenInitiative={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Filtruj wg roli, brak aktywnego filtra' })
    ).toBeInTheDocument();
  });

  it('exposes aria-expanded and opens a role dropdown on activation', async () => {
    vi.resetModules();
    mockI18n('en');
    const { ResourcesAnalysis } = await import('../ResourcesAnalysis');
    render(<ResourcesAnalysis allocations={ALLOCATIONS} issues={[]} onOpenInitiative={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Filter by role, no filter applied' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Engineer' })).toBeInTheDocument();
  });

  it('communicates the active role once a role is selected', async () => {
    vi.resetModules();
    mockI18n('en');
    const { ResourcesAnalysis } = await import('../ResourcesAnalysis');
    render(<ResourcesAnalysis allocations={ALLOCATIONS} issues={[]} onOpenInitiative={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Filter by role, no filter applied' }));
    fireEvent.click(screen.getByRole('button', { name: 'Engineer' }));

    expect(
      screen.getByRole('button', { name: 'Filter by role (active: Engineer)' })
    ).toBeInTheDocument();
  });
});
