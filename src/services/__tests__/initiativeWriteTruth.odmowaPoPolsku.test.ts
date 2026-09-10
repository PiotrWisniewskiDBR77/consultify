/**
 * BLOKADA PILOTAZU — odmowa utworzenia inicjatywy MUSI dojsc do czlowieka.
 *
 * Zmierzone 10.09 na zywym stagingu: w swiezej organizacji
 * `POST /api/initiatives/runtime-v1/source-proposals` odpowiadalo
 * 422 `INITIATIVE_OWNER_INELIGIBLE`, a `RuntimeApiError` niosl w `message`
 * SAM KOD. Wszystkie trzy powierzchnie tworzenia inicjatywy pokazuja
 * `e?.message` wprost, wiec uzytkownik dostawal surowy kod albo nic
 * czytelnego — przycisk „Utworz" wygladal, jakby nie robil nic.
 *
 * Dowod mutacyjny: usuniecie wpisu z `KLUCZE_ODMOWY` w
 * `initiativeWriteTruth.ts` czerwieni pierwszy blok tego pliku.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import i18n from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import { RuntimeApiError } from '../initiatives-execution/runtimeApi';
import { opiszOdmoweTworzeniaInicjatywy } from '../initiativeWriteTruth';

/**
 * Zasoby bierzemy z REALNEGO `public/locales/pl/translation.json`, a nie z
 * atrapy — inaczej test przechodzilby przy nieistniejacym kluczu i mierzylby
 * wlasna fikstura zamiast tresci, ktora zobaczy uzytkownik.
 */
beforeAll(async () => {
  const pl = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/locales/pl/translation.json'), 'utf8')
  );
  if (!i18n.isInitialized) await i18n.init({ lng: 'pl', resources: {} });
  i18n.addResourceBundle('pl', 'translation', pl, true, true);
  await i18n.changeLanguage('pl');
});

describe('opiszOdmoweTworzeniaInicjatywy — powod odmowy po polsku', () => {
  it('kod INITIATIVE_OWNER_INELIGIBLE nie wycieka do uzytkownika', () => {
    const opis = opiszOdmoweTworzeniaInicjatywy(
      new RuntimeApiError(422, 'INITIATIVE_OWNER_INELIGIBLE')
    );
    expect(opis.message).not.toMatch(/INITIATIVE_OWNER_INELIGIBLE/);
    expect(opis.message).toMatch(/właścicielem inicjatywy/);
    expect(opis.message).toMatch(/zespołu projektu/);
  });

  it('kod CAPABILITY_REQUIRED tez ma czytelny powod', () => {
    const opis = opiszOdmoweTworzeniaInicjatywy(new RuntimeApiError(403, 'CAPABILITY_REQUIRED'));
    expect(opis.message).not.toMatch(/CAPABILITY_REQUIRED/);
    expect(opis.message).toMatch(/uprawnień/);
  });

  // E1c/F2 (10.09, po E2/E2b): trzy nowe kody odmowy z bramki uprawnien
  // (`effectiveCapability.middleware.ts`) — `RuntimeApiError.message` niesie
  // SUROWY KOD (klasa ustawia `message = code`), a `InitiativeDocumentView`
  // (amend) i kreatory pokazuja `e?.message` wprost. Dowod mutacyjny: usuniecie
  // ktoregokolwiek z trzech wpisow z `KLUCZE_ODMOWY` czerwieni ten blok.
  it.each([
    'CAPABILITY_OBJECT_OWNERSHIP_REQUIRED',
    'CAPABILITY_OWNERSHIP_PREDICATE_MISSING',
    'CAPABILITY_OWNERSHIP_CHECK_FAILED',
  ])('kod %s tlumaczy sie na polskie zdanie o wlascicielu, nie surowy kod', (kod) => {
    const opis = opiszOdmoweTworzeniaInicjatywy(new RuntimeApiError(403, kod));
    expect(opis.message).not.toMatch(/CAPABILITY_/);
    expect(opis.message).toBe(
      'Możesz edytować tylko inicjatywy, których jesteś właścicielem lub twórcą.'
    );
  });

  it('nieznany kod runtime zostaje bez zmian (nie udajemy, ze wiemy co sie stalo)', () => {
    const zrodlo = new RuntimeApiError(500, 'INITIATIVES_EXECUTION_RUNTIME_FAILED');
    expect(opiszOdmoweTworzeniaInicjatywy(zrodlo)).toBe(zrodlo);
  });

  it('blad spoza runtime przechodzi nietkniety', () => {
    const zrodlo = new Error('Network request failed');
    expect(opiszOdmoweTworzeniaInicjatywy(zrodlo)).toBe(zrodlo);
  });
});
