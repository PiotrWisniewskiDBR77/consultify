/**
 * @vitest-environment jsdom
 *
 * CB-01 / RB-007 & RV-017 — the per-initiative date-edit action must name
 * itself with the initiative it acts on (not a bare icon), and its inline
 * editor's Save/Cancel/date fields must be named too. PL/EN because the
 * name is built from a translation key.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const TRANSLATIONS: Record<string, { en: string; pl: string }> = {
  'initiatives.analysis.timeline.editDatesFor': {
    en: 'Edit dates for {{name}}',
    pl: 'Edytuj daty dla {{name}}',
  },
  'initiatives.analysis.timeline.saveDatesFor': {
    en: 'Save dates for {{name}}',
    pl: 'Zapisz daty dla {{name}}',
  },
  'initiatives.analysis.timeline.cancelEditingDatesFor': {
    en: 'Cancel editing dates for {{name}}',
    pl: 'Anuluj edycję dat dla {{name}}',
  },
  'initiatives.analysis.timeline.startDateFor': {
    en: 'Start date for {{name}}',
    pl: 'Data rozpoczęcia dla {{name}}',
  },
  'initiatives.analysis.timeline.endDateFor': {
    en: 'End date for {{name}}',
    pl: 'Data zakończenia dla {{name}}',
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
    }),
  }));
}

const BAR = {
  initiativeId: 'init-1',
  initiativeName: 'Digital onboarding',
  startDate: '2026-01-01',
  endDate: '2026-03-01',
  status: 'on-schedule' as const,
};

describe('TimelineAnalysis — per-row date-edit accessible contract', () => {
  it('names the edit action with the initiative (EN)', async () => {
    vi.resetModules();
    mockI18n('en');
    const { TimelineAnalysis } = await import('../TimelineAnalysis');
    render(
      <TimelineAnalysis
        bars={[BAR]}
        issues={[]}
        onOpenInitiative={vi.fn()}
        onQuickUpdate={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Edit dates for Digital onboarding' })
    ).toBeInTheDocument();
  });

  it('names the edit action with the initiative (PL)', async () => {
    vi.resetModules();
    mockI18n('pl');
    const { TimelineAnalysis } = await import('../TimelineAnalysis');
    render(
      <TimelineAnalysis
        bars={[BAR]}
        issues={[]}
        onOpenInitiative={vi.fn()}
        onQuickUpdate={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Edytuj daty dla Digital onboarding' })
    ).toBeInTheDocument();
  });

  it('opening the inline editor exposes named Save/Cancel/date fields, and Cancel closes it', async () => {
    vi.resetModules();
    mockI18n('en');
    const { TimelineAnalysis } = await import('../TimelineAnalysis');
    render(
      <TimelineAnalysis
        bars={[BAR]}
        issues={[]}
        onOpenInitiative={vi.fn()}
        onQuickUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit dates for Digital onboarding' }));

    expect(screen.getByLabelText('Start date for Digital onboarding')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save dates for Digital onboarding' })
    ).toBeInTheDocument();
    const cancelButton = screen.getByRole('button', {
      name: 'Cancel editing dates for Digital onboarding',
    });

    fireEvent.click(cancelButton);

    expect(
      screen.queryByRole('button', { name: 'Save dates for Digital onboarding' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit dates for Digital onboarding' })
    ).toBeInTheDocument();
  });
});
