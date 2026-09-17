/**
 * Wpis 70 P2 (DEC-596) — etykieta rodzaju relacji w podglądzie ma PARĘ EN/PL.
 *
 * Mierzony defekt: podgląd listy Spotkań karmi `PreviewRelations` relację
 * projektu, której `label` zaczyna się od `Project:` — `containsTechnicalIdentifier`
 * widzi w tym identyfikator techniczny, więc chip spadał na
 * `relationFallbackLabel(undefined)` = polskie „Powiązany rekord" w EN UI.
 * Po naprawie kind `project` ma wpis w `sharedComponents.relationKind.project`
 * (EN/PL parami w `public/locales/{en,pl}/translation.json`), a generyczny
 * fallback `?? 'Powiązany rekord'` zostaje nietknięty (zastany dług, osobny wiersz).
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

const KLUCZ = 'sharedComponents.relationKind.project';
const KATALOG_TEGO_TESTU = dirname(fileURLToPath(import.meta.url));

const wartoscKlucza = (jezyk: 'en' | 'pl'): string => {
  const sciezka = resolve(
    KATALOG_TEGO_TESTU,
    `../../../../../public/locales/${jezyk}/translation.json`
  );
  const cale = JSON.parse(readFileSync(sciezka, 'utf8')) as Record<string, unknown>;
  const wartosc = KLUCZ.split('.').reduce<unknown>(
    (akumulator, klucz) =>
      akumulator && typeof akumulator === 'object'
        ? (akumulator as Record<string, unknown>)[klucz]
        : undefined,
    cale
  );
  expect(typeof wartosc, `${jezyk}: brak klucza ${KLUCZ}`).toBe('string');
  return wartosc as string;
};

describe('relationFallbackLabel — para EN/PL dla rodzaju relacji (Wpis 70 P2)', () => {
  const en = wartoscKlucza('en');
  const pl = wartoscKlucza('pl');

  beforeAll(async () => {
    await i18n.init({
      lng: 'en',
      fallbackLng: false,
      resources: {
        en: { translation: { sharedComponents: { relationKind: { project: en } } } },
        pl: { translation: { sharedComponents: { relationKind: { project: pl } } } },
      },
    });
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('locale carry a real EN/PL pair, not one language twice', () => {
    expect(en.length).toBeGreaterThan(0);
    expect(pl.length).toBeGreaterThan(0);
    expect(en).not.toBe(pl);
    expect(en).toBe('Linked project');
    expect(pl).toBe('Powiązany projekt');
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

  it('leaves the legacy PL map and the generic fallback untouched', async () => {
    await i18n.changeLanguage('en');
    // Zastany dług: kind bez pary i18n nadal oddaje literał PL z mapy.
    expect(relationFallbackLabel('execution')).toBe('Powiązana realizacja');
    // Fallback generyczny — JAWNIE poza zakresem tej naprawy.
    expect(relationFallbackLabel('nieznany-rodzaj')).toBe('Powiązany rekord');
    expect(relationFallbackLabel(undefined)).toBe('Powiązany rekord');
  });
});
