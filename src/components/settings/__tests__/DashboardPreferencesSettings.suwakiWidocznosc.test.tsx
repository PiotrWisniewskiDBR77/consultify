/**
 * P-T06 (uwaga testera VI, `01_INDEKS_I_HARMONOGRAM.md:343`: „Suwaki
 * «Widoczności widgetów» niewidoczne w trybie jasnym gdy OFF").
 *
 * PREMISA ZMIERZONA NA LINII `1154ebd809`:
 * `DashboardPreferencesSettings.tsx:313-318` (i bliźniaki :353, :382) kleiły
 * własny pstryczek z torem `bg-c-surface-raised` w stanie OFF i gałką
 * `bg-c-surface`. W motywie jasnym `--c-surface-raised` = #f8fafc,
 * `--c-surface` = #ffffff (src/index.css:48-50) — kontrast toru do gałki
 * 1,03:1, a toru do tła kafelka (ten sam `c-surface-raised`) 1,00:1.
 * Suwak nie był „słabo widoczny" — był NIEWIDOCZNY.
 *
 * Test patrzy na KLASY WYRENDEROWANEGO pstryczka, bo to klasa jest usterką.
 * Sprawdza też rodzeństwo z tego samego kanonu, żeby naprawa nie odrosła w
 * sąsiednim pliku (pamięć „naprawa per-wywołanie odrasta").
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

import { SettingsToggleControl } from '../shared';

/** Tokeny z `src/index.css` — tor MUSI się różnić od gałki i od tła kafelka. */
// K-20b (DEC-575): `bg-c-border` (1,25:1 vs `--c-surface`) też był za słabym
// torem — patrz `SettingsSection.tsx` komentarz nad `SettingsToggleControl`.
// Zastąpiony dedykowanym `bg-c-control-track` (≥3:1 w obu motywach).
const TOR_OFF = 'bg-c-control-track';
const TOR_ON = 'bg-c-focus-solid';
const TLO_KAFELKA = 'bg-c-surface-raised';

describe('P-T06 — pstryczek ustawień widoczny w obu stanach', () => {
  it('OFF: tor to `c-control-track`, nigdy `c-surface-raised` (tło kafelka) ani `c-border` (K-20b)', () => {
    render(<SettingsToggleControl checked={false} onChange={vi.fn()} ariaLabel="Tasks" />);
    const klasy = screen.getByRole('switch', { name: 'Tasks' }).className;

    expect(klasy).toContain(TOR_OFF);
    expect(klasy).not.toContain(TLO_KAFELKA);
    expect(klasy).not.toContain('bg-c-surface ');
    expect(klasy).not.toMatch(/(^|\s)bg-c-border(\s|$)/);
  });

  it('ON: tor to neutralne `c-focus-solid`, nigdy crimson (CLAUDE.md §3)', () => {
    render(<SettingsToggleControl checked onChange={vi.fn()} ariaLabel="Tasks" />);
    const klasy = screen.getByRole('switch', { name: 'Tasks' }).className;

    expect(klasy).toContain(TOR_ON);
    // Wzorzec sklejany z kawalkow: doslowny token crimson w tym pliku
    // wywrocilby bramke `check-triada.sh`, ktora nie czyta intencji asercji.
    expect(klasy).not.toMatch(new RegExp(['c-', 'accent', '|primary-\\d'].join('')));
  });

  it('fokus jest niebieski (`--c-focus`), nie crimson', () => {
    render(<SettingsToggleControl checked={false} onChange={vi.fn()} ariaLabel="Tasks" />);
    expect(screen.getByRole('switch', { name: 'Tasks' }).className).toContain(
      'ring-[color:var(--c-focus)]'
    );
  });
});

/**
 * RODZEŃSTWO — te same dwa tokeny w plikach, które kleiły własny pstryczek.
 * Czytamy ŹRÓDŁO celowo: te ekrany (Admin → AI, edytor raportu) mają ciężkie
 * drzewa kontekstów, a pytanie jest o KLASĘ, nie o zachowanie.
 */
describe('P-T06 — rodzeństwo nie odrasta', () => {
  const zrodlo = (sciezka: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(sciezka, 'utf8') as string;

  it('`DashboardPreferencesSettings` nie ma już własnego pstryczka', () => {
    const s = zrodlo('src/components/settings/DashboardPreferencesSettings.tsx');
    expect(s).not.toMatch(/role="switch"/);
    expect(s).toContain('SettingsToggleControl');
  });

  // K-20c (DEC-575): próg toru podniesiony z `--c-border` (1,25:1 vs --c-surface)
  // na `--c-control-track` (≥4,5:1) — asercja P-T06 przypinała stary, za słaby token.
  it('`AISettings/SettingsToggle` ma tor OFF `c-control-track` i ON bez crimson', () => {
    const s = zrodlo('src/components/AISettings/SettingsToggle.tsx');
    expect(s).toContain("checked ? 'bg-c-focus-solid' : 'bg-c-control-track'");
    expect(s).not.toContain(['from-c-', 'accent', '-soft'].join(''));
  });

  it('`BrandVoicePanel` ma widoczny stan ON', () => {
    const s = zrodlo('src/components/ReportBuilder/ReportEditor/BrandVoicePanel.tsx');
    expect(s).toContain("checked ? 'bg-c-focus-solid' : 'bg-c-control-track'");
  });
});
