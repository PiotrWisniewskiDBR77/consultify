/**
 * K-20 (zgłoszenie testera #60, Tomek, `/settings/working-hours`, pl/light):
 * „Na tej stronie suwak wyłączony jest praktycznie niewidoczny".
 *
 * PREMISA ZMIERZONA NA `258043df9f`: `WorkingHoursSettings.tsx:384-394` kleił
 * własny pstryczek, którego tor w stanie OFF miał `bg-c-surface-raised` —
 * DOKŁADNIE kolor kafelka, w którym siedział. W motywie jasnym
 * `--c-surface-raised` = #f8fafc dla obu, więc kontrast tor/tło = 1,00:1.
 * Suwak nie był „słabo widoczny" — był niewidoczny.
 *
 * RODZEŃSTWO (pamięć „naprawa per-wywołanie odrasta"): pomiar pokazał, że to
 * NIE jest jeden plik — ten sam kształt siedział w 27 plikach `settings/**`
 * (54 wystąpienia pary ON/OFF + 1 wariant `bg-c-surface` w AISettings).
 * Ten test jest RATCHETEM po całym drzewie ustawień, nie po jednym pliku:
 * żaden tor pstryczka nie może w stanie OFF nosić koloru powierzchni.
 *
 * Czyta ŹRÓDŁO celowo — pytanie jest o KLASĘ, a te ekrany mają ciężkie drzewa
 * kontekstów i transportów.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KORZEN = path.resolve(__dirname, '..');

const pliki = (katalog: string): string[] =>
  fs
    .readdirSync(katalog, { withFileTypes: true })
    .flatMap((wpis) => {
      const p = path.join(katalog, wpis.name);
      if (wpis.isDirectory()) return wpis.name === '__tests__' ? [] : pliki(p);
      return wpis.name.endsWith('.tsx') ? [p] : [];
    });

/** Kolory powierzchni: tor pstryczka w tym kolorze znika w tle kafelka. */
const KOLORY_POWIERZCHNI = ['bg-c-surface-raised', 'bg-c-surface', 'bg-white', 'bg-c-bg'];

describe('K-20 — tor pstryczka OFF nigdy w kolorze powierzchni (całe settings/**)', () => {
  const wszystkie = pliki(KORZEN);

  it('drzewo ustawień w ogóle się mierzy (bezpiecznik „brak pomiaru nie jest wynikiem")', () => {
    expect(wszystkie.length).toBeGreaterThan(20);
  });

  it('zero torów OFF w kolorze powierzchni', () => {
    const naruszenia: string[] = [];

    for (const plik of wszystkie) {
      const linie = fs.readFileSync(plik, 'utf8').split('\n');
      linie.forEach((linia, i) => {
        const dopasowanie = linia.match(/\? '(bg-[\w\-/[\].]+)' : '(bg-[\w\-/[\].]+)'/);
        if (!dopasowanie) return;
        const kontekst = linie.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (!kontekst.includes('rounded-full')) return;
        if (!KOLORY_POWIERZCHNI.includes(dopasowanie[2])) return;
        naruszenia.push(`${path.relative(KORZEN, plik)}:${i + 1} → ${dopasowanie[2]}`);
      });
    }

    expect(naruszenia).toEqual([]);
  });

  it('zgłoszony plik używa WSPÓLNEGO SettingsToggleControl, nie własnego pstryczka', () => {
    const zrodlo = fs.readFileSync(path.join(KORZEN, 'WorkingHoursSettings.tsx'), 'utf8');
    expect(zrodlo).toContain('SettingsToggleControl');
    expect(zrodlo).not.toMatch(/w-12 h-6 rounded-full/);
  });
});
