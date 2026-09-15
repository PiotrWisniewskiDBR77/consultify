/**
 * F10 / P-J02 pkt 3 — surowe `[answer_id: …]` w prozie wniosku.
 *
 * Wejście testów NIE jest wymyślone: to dosłowny fragment `themes_json`
 * wniosku „Justyna wnioski" (`ii_b5a80a46-91a2-4d3b-8d88-7bb885b78222`,
 * DBR77, staging, 2026-09-15 04:08 UTC) — tego samego, o którym testerka
 * napisała „treść ze znakami które nie są literami a powinny być".
 *
 * Testy mutacyjne: każdy `it` upada, gdy sanitizer zostanie wyjęty lub
 * zawężony (dlatego sprawdzamy NIEOBECNOŚĆ wzorca, a nie równość napisów).
 */
import { describe, expect, it } from 'vitest';

import {
  maSurowyIdentyfikator,
  oczyscListeZdan,
  oczyscProzeWniosku,
  oczyscZnaleziska,
} from '../interviewInsightProse.js';

const ZYWY_OPIS =
  'Brak jednego źródła danych wymusza ręczne przepisywanie informacji między systemami CRM. ' +
  '(Źródła: Justyna Laskowska, [answer_id: 0ca24fc4-a401-46fd-9032-5dce2863165f], ' +
  '[answer_id: 4b0f2007-97c6-470b-85c7-fbdbe3903a15])';

describe('oczyscProzeWniosku', () => {
  it('usuwa surowe [answer_id: …] z żywego opisu ze stagingu', () => {
    const po = oczyscProzeWniosku(ZYWY_OPIS);
    expect(po).not.toMatch(/answer_id/i);
    expect(po).not.toMatch(/0ca24fc4-a401-46fd-9032-5dce2863165f/);
    expect(po).not.toMatch(/4b0f2007-97c6-470b-85c7-fbdbe3903a15/);
  });

  it('zostawia czytelne źródło osobowe (usuwamy ID, nie atrybucję)', () => {
    expect(oczyscProzeWniosku(ZYWY_OPIS)).toContain('Justyna Laskowska');
  });

  it('nie zostawia osieroconej interpunkcji po wycięciu', () => {
    const po = oczyscProzeWniosku(ZYWY_OPIS);
    expect(po).not.toMatch(/,\s*\)/);
    expect(po).not.toMatch(/\(\s*,/);
    expect(po).not.toMatch(/ {2,}/);
  });

  it('kasuje cały nawias, gdy po wycięciu ID nie zostaje w nim treść', () => {
    const po = oczyscProzeWniosku('Zdanie. (Sources: [answer_id: abc], [answer_id: def])');
    expect(po).toBe('Zdanie.');
  });

  it('łapie warianty zapisu znacznika', () => {
    for (const w of ['[answer id: abc]', '[ANSWER_ID: abc]', '(answer_id: abc)', '[answer-id: abc]']) {
      expect(oczyscProzeWniosku(`X ${w} Y`)).not.toMatch(/answer.?id/i);
    }
  });

  it('nie rusza prozy bez znaczników (zero fałszywych trafień)', () => {
    const czyste = 'Automatyzacja zmniejsza czas obsługi o 30% (dane z wywiadu).';
    expect(oczyscProzeWniosku(czyste)).toBe(czyste);
  });

  it('nie podstawia treści za puste wejście', () => {
    expect(oczyscProzeWniosku('')).toBe('');
    expect(oczyscProzeWniosku(null)).toBe('');
    expect(oczyscProzeWniosku(undefined)).toBe('');
  });

  it('maSurowyIdentyfikator wykrywa przed i nie wykrywa po', () => {
    expect(maSurowyIdentyfikator(ZYWY_OPIS)).toBe(true);
    expect(maSurowyIdentyfikator(oczyscProzeWniosku(ZYWY_OPIS))).toBe(false);
  });
});

describe('oczyscZnaleziska', () => {
  const temat = {
    title: 'Brak integracji [answer_id: 0ca24fc4-a401-46fd-9032-5dce2863165f]',
    description: ZYWY_OPIS,
    divergence_note: 'Kierownictwo widzi to inaczej [answer_id: deadbeef].',
    evidence_refs: ['0ca24fc4-a401-46fd-9032-5dce2863165f', '4b0f2007-97c6-470b-85c7-fbdbe3903a15'],
    strength: 'strong',
  };

  it('czyści tytuł, opis i notatkę rozbieżności', () => {
    const [po] = oczyscZnaleziska([temat]);
    expect(po.title).not.toMatch(/answer_id/i);
    expect(po.description).not.toMatch(/answer_id/i);
    expect(po.divergence_note).not.toMatch(/answer_id/i);
  });

  it('NIE rusza evidence_refs — tam identyfikator jest daną, nie śmieciem', () => {
    const [po] = oczyscZnaleziska([temat]);
    expect(po.evidence_refs).toEqual(temat.evidence_refs);
    expect(po.strength).toBe('strong');
  });

  it('przeżywa wejście spoza kontraktu', () => {
    expect(oczyscZnaleziska(undefined)).toEqual([]);
    expect(oczyscZnaleziska(null)).toEqual([]);
    expect(oczyscZnaleziska([null as never])).toEqual([null]);
  });
});

describe('oczyscListeZdan', () => {
  it('czyści listę i wyrzuca puste po czyszczeniu', () => {
    const po = oczyscListeZdan([
      'Brak inwentaryzacji systemów. [answer_id: abc]',
      '[answer_id: def]',
      '',
    ]);
    expect(po).toEqual(['Brak inwentaryzacji systemów.']);
  });
});
