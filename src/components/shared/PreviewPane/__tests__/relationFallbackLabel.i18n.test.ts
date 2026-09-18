/**
 * Wpis 70 P2 (DEC-596) + D-28 — etykieta rodzaju relacji w podglądzie ma PARĘ EN/PL.
 *
 * Mierzony defekt (Wpis 70 P2): podgląd listy Spotkań karmi `PreviewRelations`
 * relację projektu, której `label` zaczyna się od `Project:` —
 * `containsTechnicalIdentifier` widzi w tym identyfikator techniczny, więc chip
 * spadał na `relationFallbackLabel(undefined)` = polskie „Powiązany rekord" w EN UI.
 * Po naprawie kind `project` ma wpis w `sharedComponents.relationKind.project`
 * (EN/PL parami w `public/locales/{en,pl}/translation.json`).
 *
 * D-28 domyka resztę: GENERYCZNY fallback (kind bez wpisu) nie jest już twardym
 * literałem PL `?? 'Powiązany rekord'` — teraz czyta parę
 * `sharedComponents.relationKind.record` (EN „Linked record" / PL „Powiązany
 * rekord"), więc EN UI pokazuje angielski, a PL zostaje bez regresji. Zastana
 * mapa PL dla kindów NAZWANYCH (`RELATION_KIND_LABELS`, np. `execution`) jest
 * jawnie poza zakresem — ten test ją zamraża jako dług, nie jako wzorzec.
 *
 * Klucze są czytane z PRAWDZIWYCH plików locale, więc test łapie zarówno brak
 * pary, jak i rozjazd EN/PL — nie atrapy w kodzie testu.
 */
import i18n from 'i18next';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { relationFallbackLabel } from '../businessDisplayLabel';

const KLUCZ_PROJECT = 'sharedComponents.relationKind.project';
const KLUCZ_RECORD = 'sharedComponents.relationKind.record';
const KATALOG_TEGO_TESTU = dirname(fileURLToPath(import.meta.url));

const wartoscKlucza = (klucz: string, jezyk: 'en' | 'pl'): string => {
  const sciezka = resolve(
    KATALOG_TEGO_TESTU,
    `../../../../../public/locales/${jezyk}/translation.json`
  );
  const cale = JSON.parse(readFileSync(sciezka, 'utf8')) as Record<string, unknown>;
  const wartosc = klucz.split('.').reduce<unknown>(
    (akumulator, segment) =>
      akumulator && typeof akumulator === 'object'
        ? (akumulator as Record<string, unknown>)[segment]
        : undefined,
    cale
  );
  expect(typeof wartosc, `${jezyk}: brak klucza ${klucz}`).toBe('string');
  return wartosc as string;
};

describe('relationFallbackLabel — para EN/PL dla rodzaju relacji (Wpis 70 P2 + D-28)', () => {
  const enProject = wartoscKlucza(KLUCZ_PROJECT, 'en');
  const plProject = wartoscKlucza(KLUCZ_PROJECT, 'pl');
  const enRecord = wartoscKlucza(KLUCZ_RECORD, 'en');
  const plRecord = wartoscKlucza(KLUCZ_RECORD, 'pl');

  beforeAll(async () => {
    await i18n.init({
      lng: 'en',
      fallbackLng: false,
      resources: {
        en: {
          translation: {
            sharedComponents: { relationKind: { project: enProject, record: enRecord } },
          },
        },
        pl: {
          translation: {
            sharedComponents: { relationKind: { project: plProject, record: plRecord } },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('locale carry a real EN/PL pair for both the named kind and the generic fallback', () => {
    expect(enProject.length).toBeGreaterThan(0);
    expect(plProject.length).toBeGreaterThan(0);
    expect(enProject).not.toBe(plProject);
    expect(enProject).toBe('Linked project');
    expect(plProject).toBe('Powiązany projekt');

    expect(enRecord.length).toBeGreaterThan(0);
    expect(plRecord.length).toBeGreaterThan(0);
    expect(enRecord).not.toBe(plRecord);
    expect(enRecord).toBe('Linked record');
    expect(plRecord).toBe('Powiązany rekord');
  });

  it('EN UI reads the English relation label for the kind the meeting preview links', async () => {
    await i18n.changeLanguage('en');
    expect(relationFallbackLabel('project')).toBe('Linked project');
    // Wielkość liter nie ma znaczenia — kind przychodzi z danych.
    expect(relationFallbackLabel('PROJECT')).toBe('Linked project');
    expect(relationFallbackLabel('project')).not.toBe('Powiązany rekord');
  });

  it('PL UI keeps the Polish label (no regression for the existing language)', async () => {
    await i18n.changeLanguage('pl');
    expect(relationFallbackLabel('project')).toBe('Powiązany projekt');
  });

  it('D-28: the generic fallback is i18n-resolved — English in EN UI, Polish in PL UI', async () => {
    await i18n.changeLanguage('en');
    // Kind bez wpisu i brak kindu — oba schodzą na parę `record`, nie na literał PL.
    expect(relationFallbackLabel('nieznany-rodzaj')).toBe('Linked record');
    expect(relationFallbackLabel(undefined)).toBe('Linked record');
    expect(relationFallbackLabel('nieznany-rodzaj')).not.toBe('Powiązany rekord');

    await i18n.changeLanguage('pl');
    // PL bez regresji: generyk nadal czyta się po polsku (e2e harness PL na tym polega).
    expect(relationFallbackLabel('nieznany-rodzaj')).toBe('Powiązany rekord');
    expect(relationFallbackLabel(undefined)).toBe('Powiązany rekord');
  });

  it('leaves the legacy PL map for NAMED kinds untouched (out-of-scope debt)', async () => {
    await i18n.changeLanguage('en');
    // Zastany dług: nazwany kind bez pary i18n nadal oddaje literał PL z mapy.
    // D-28 NIE rusza `RELATION_KIND_LABELS` — tylko generyczny fallback.
    expect(relationFallbackLabel('execution')).toBe('Powiązana realizacja');
  });
});
