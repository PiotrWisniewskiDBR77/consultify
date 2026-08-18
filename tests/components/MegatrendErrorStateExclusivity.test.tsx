/**
 * @vitest-environment jsdom
 *
 * UI-MVP-001 — TrendRadarCard: error / loading / content are MUTUALLY
 * EXCLUSIVE, and the failed-load copy is really translated.
 *
 * The radar used to be drawn UNDERNEATH the error state, so a failed load still
 * painted a chart from stale or empty data — the app asserting a shape of the
 * world it did not have. Before that it was a bare `Error: {msg}` line with no
 * recovery at all.
 *
 * Unlike the Execution rollout panels (hardcoded Polish), this surface goes
 * through i18next, so EN and PL are both asserted here against the real
 * resource files.
 */
import fs from 'fs';
import path from 'path';

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { type RadarMegatrend, TrendRadarCard } from '@/components/Megatrend/TrendRadarCard';

const readLocale = (lng: string) =>
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), `public/locales/${lng}/translation.json`), 'utf-8')
  );

const EN = readLocale('en');
const PL = readLocale('pl');

// Drive the DEFAULT i18next instance rather than a provider-scoped one.
// `@testing-library` and the component resolve `react-i18next` through
// different module copies here (the worktree's node_modules is a symlink), so
// an `I18nextProvider` wrapper is invisible to the component and it falls back
// to the global default. Initialising that default is what actually changes
// what the component renders.
beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  }
  // The REAL shipped resources — a missing or shadowed key fails this test.
  i18next.addResourceBundle('en', 'translation', EN, true, true);
  i18next.addResourceBundle('pl', 'translation', PL, true, true);
  await i18next.changeLanguage('en');
});

const DATA: RadarMegatrend[] = [
  {
    id: 'm1',
    label: 'Electrification',
    type: 'Technology',
    ring: 'Now',
    impact: 5,
  } as RadarMegatrend,
];

const renderCard = (props: Partial<React.ComponentProps<typeof TrendRadarCard>> = {}) =>
  render(<TrendRadarCard data={DATA} {...props} />);

describe('TrendRadarCard — error/loading/content exclusivity', () => {
  it('on error renders the shared error state only — no radar chart', async () => {
    // `EmptyState` synthesizes the retry button only when onRetry is supplied.
    renderCard({ error: 'boom', onRetry: vi.fn() });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again|Spróbuj ponownie/i })).toBeInTheDocument();

    // The radar (and its legend) must not be painted beside a failure.
    expect(document.querySelector('svg.absolute')).toBeNull();
    expect(screen.queryByText(/Impact size/i)).not.toBeInTheDocument();
  });

  it('Retry invokes the caller-supplied refetch', async () => {
    const onRetry = vi.fn();
    renderCard({ error: 'boom', onRetry });

    fireEvent.click(screen.getByRole('button', { name: /Try again|Spróbuj ponownie/i }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
  });

  it('while loading renders neither the error state nor the radar', () => {
    renderCard({ loading: true });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('svg.absolute')).toBeNull();
    expect(screen.queryByText(/Impact size/i)).not.toBeInTheDocument();
  });

  it('success stays honest — radar renders, no error affordance', () => {
    renderCard();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Try again|Spróbuj ponownie/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Impact size/i)).toBeInTheDocument();
  });

  describe('failed-load copy comes from the shipped resources (EN + PL)', () => {
    // NOTE ON SCOPE: this jsdom harness cannot drive the component's own
    // i18next instance. `react-i18next`/`i18next` resolve to more than one
    // module copy here (the worktree's node_modules is a symlink), so neither
    // an `I18nextProvider` wrapper nor the default instance reaches the
    // component — verified directly: a scoped `t()` returned the Polish string
    // while the DOM still rendered the English default. What IS reproducible
    // here is the contract that actually broke in production: the key must
    // exist, unshadowed, in BOTH bundles and resolve at runtime. The rendered
    // PL surface itself is covered by the mounted browser matrix.
    const KEYS = ['tools.megatrends.radarLoadFailed', 'tools.megatrends.loadFailedDesc'];

    const dig = (bundle: unknown, keyPath: string) =>
      keyPath
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle);

    it.each(KEYS)('%s exists as a string in EN and PL (no key-path shadowing)', (key) => {
      expect(typeof dig(EN, key)).toBe('string');
      expect(typeof dig(PL, key)).toBe('string');
    });

    it.each(KEYS)('%s resolves at runtime in EN and PL', async (key) => {
      for (const [lng, bundle] of [
        ['en', EN],
        ['pl', PL],
      ] as const) {
        const inst = i18next.createInstance();
        await inst.init({
          lng,
          fallbackLng: 'en',
          resources: { [lng]: { translation: bundle } },
        });
        // A shadowed or absent key would return this sentinel instead.
        expect(inst.t(key, 'SENTINEL-NOT-FOUND')).toBe(dig(bundle, key));
        expect(inst.t(key, 'SENTINEL-NOT-FOUND')).not.toBe('SENTINEL-NOT-FOUND');
      }
    });

    it('renders a resolved string, never a raw i18n key', async () => {
      renderCard({ error: 'boom', onRetry: vi.fn() });
      const heading = (await screen.findByRole('alert')).querySelector('h3');
      const text = heading?.textContent ?? '';

      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/^tools\./);
      expect([EN.tools.megatrends.radarLoadFailed, PL.tools.megatrends.radarLoadFailed]).toContain(
        text
      );
    });
  });

  it('PL copy is actually different from EN (not an untranslated fallback)', () => {
    const en = EN.tools.megatrends.radarLoadFailed;
    const pl = PL.tools.megatrends.radarLoadFailed;
    expect(typeof en).toBe('string');
    expect(typeof pl).toBe('string');
    expect(pl).not.toBe(en);
  });
});
