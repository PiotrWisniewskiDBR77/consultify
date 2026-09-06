/**
 * @vitest-environment jsdom
 *
 * DEC-405b (ZLECENIE 1.1-J2, przejście właściciela 06.09) — the sidebar's
 * old 6-chip "Today" row (Wszystkie/Przypięte/Ostatnie/Do przeglądu/Świeże/
 * Osierocone) was "kawałek kramu" (owner) and is replaced by this one
 * dropdown with counters, next to a persistent "Szukaj w notatkach…" field.
 * Uses REAL pl/en strings from `public/locales/*\/translation.json`
 * (`createRealT`) so a missing/blank translation key fails the test, not
 * just a hand-typed fallback map.
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

import type { NotebookViewFilterCounts } from '../NotebookViewFilterSelect';

function mockI18n(lang: 'en' | 'pl') {
  const t = createRealT(lang);
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({ t, i18n: { language: lang } }),
  }));
}

let NotebookViewFilterSelectImport: typeof import('../NotebookViewFilterSelect');

const COUNTS: NotebookViewFilterCounts = {
  all: 40,
  pinned: 2,
  recent: 2,
  toReview: 2,
  fresh: 33,
  orphaned: 40,
};

const mount = async (
  lang: 'en' | 'pl',
  overrides: Partial<{
    searchQuery: string;
    onSearchQueryChange: (v: string) => void;
    value: import('../NotebookViewFilterSelect').NotebookViewLens;
    onChange: (v: import('../NotebookViewFilterSelect').NotebookViewLens) => void;
    counts: NotebookViewFilterCounts;
  }> = {}
) => {
  vi.resetModules();
  mockI18n(lang);
  NotebookViewFilterSelectImport = await import('../NotebookViewFilterSelect');
  const { NotebookViewFilterSelect } = NotebookViewFilterSelectImport;
  return render(
    <NotebookViewFilterSelect
      searchQuery={overrides.searchQuery ?? ''}
      onSearchQueryChange={overrides.onSearchQueryChange ?? vi.fn()}
      value={overrides.value ?? 'all'}
      onChange={overrides.onChange ?? vi.fn()}
      counts={overrides.counts ?? COUNTS}
    />
  );
};

beforeEach(() => {
  vi.resetModules();
});

describe('NotebookViewFilterSelect — real PL strings', () => {
  it('shows the persistent "Szukaj w notatkach…" field, not a toggle button', async () => {
    await mount('pl');

    const input = screen.getByPlaceholderText('Szukaj w notatkach…');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
    // No separate lupa-button gating this field — it must be always visible.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onSearchQueryChange as the owner types', async () => {
    const onSearchQueryChange = vi.fn();
    await mount('pl', { onSearchQueryChange });

    fireEvent.change(screen.getByPlaceholderText('Szukaj w notatkach…'), {
      target: { value: 'ELKOMTECH' },
    });

    expect(onSearchQueryChange).toHaveBeenCalledWith('ELKOMTECH');
  });

  it('renders exactly one dropdown with all 6 lenses labelled + counted, no chip row', async () => {
    await mount('pl');

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // The owner's own literal example: "Wszystkie (40) · Przypięte (2) ·
    // Ostatnie (2) · Do przeglądu (2) · Świeże (33) · Osierocone (40)".
    const expected = [
      'Wszystkie (40)',
      'Przypięte (2)',
      'Ostatnie (2)',
      'Do przeglądu (2)',
      'Świeże (33)',
      'Osierocone (40)',
    ];
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(options.map((o) => o.textContent)).toEqual(expected);

    // No leftover chip buttons anywhere.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('defaults to "Wszystkie"', async () => {
    await mount('pl');
    expect(screen.getByRole('combobox')).toHaveValue('all');
  });

  it('calls onChange with the selected lens key when the owner picks "Przypięte"', async () => {
    const onChange = vi.fn();
    await mount('pl', { onChange });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pinned' } });

    expect(onChange).toHaveBeenCalledWith('pinned');
  });
});

describe('NotebookViewFilterSelect — real EN strings', () => {
  it('shows the EN placeholder and option labels', async () => {
    await mount('en');

    expect(screen.getByPlaceholderText('Search notes…')).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'All (40)',
      'Pinned (2)',
      'Recent (2)',
      'To review (2)',
      'Fresh (33)',
      'Orphaned (40)',
    ]);
  });
});
