/**
 * Bramka: nagłówek kolumny w angielskim UI nie może być po polsku.
 *
 * Powód (przegląd 128 zrzutów, 2026-07-27): w tabelach modułu Documents stały
 * polskie nagłówki `TYP` i `TRYB` pośród angielskich `TITLE / STATUS / OWNER`.
 * Przyczyną nie był kod ekranu, tylko DWIE wartości w angielskim pliku
 * tłumaczeń — `rap.columns.mode = "Tryb"` i `rap.outputs.columns.kind = "Typ"`.
 * Ekran robił wszystko poprawnie, a i18n podawał mu polskie słowo.
 *
 * Test skanuje wszystkie klucze nagłówków kolumn w EN. Języki inne niż polski
 * sprawdzamy po diakrytykach — to jedyny sygnał odporny na fałszywe trafienia
 * (angielskie "Data", "Mode" itd. nie mają ą/ć/ę/ł/ń/ó/ś/ź/ż).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/** Klucze, które trafiają na nagłówek kolumny tabeli. */
const KLUCZ_NAGLOWKA = (sciezka: string) =>
  sciezka.includes('.columns.') || sciezka.includes('.col.') || sciezka.endsWith('.column');

function splaszcz(obiekt: unknown, prefiks = '', wynik: Array<[string, string]> = []) {
  if (obiekt && typeof obiekt === 'object' && !Array.isArray(obiekt)) {
    for (const [k, v] of Object.entries(obiekt as Record<string, unknown>)) {
      splaszcz(v, prefiks ? `${prefiks}.${k}` : k, wynik);
    }
  } else if (typeof obiekt === 'string') {
    wynik.push([prefiks, obiekt]);
  }
  return wynik;
}

const wczytaj = (lang: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `public/locales/${lang}/translation.json`), 'utf-8')
  );

describe('nagłówki kolumn — spójność językowa', () => {
  it.each(['en', 'de', 'es'])('%s: żaden nagłówek kolumny nie jest po polsku', (lang) => {
    const podejrzane = splaszcz(wczytaj(lang))
      .filter(([sciezka]) => KLUCZ_NAGLOWKA(sciezka))
      .filter(([, wartosc]) => DIAKRYTYKI.test(wartosc));

    expect(
      podejrzane,
      `Polskie nagłówki w pliku ${lang}: ${podejrzane.map(([k, v]) => `${k}="${v}"`).join(', ')}`
    ).toEqual([]);
  });

  it('en: dwa nagłówki, które psuły moduł Documents, są po angielsku', () => {
    const en = wczytaj('en');
    expect(en.rap.columns.mode).toBe('Mode');
    expect(en.rap.outputs.columns.kind).toBe('Type');
  });

  it('pl: te same klucze zostają po polsku', () => {
    const pl = wczytaj('pl');
    expect(pl.rap.columns.mode).toBe('Tryb');
    expect(pl.rap.outputs.columns.kind).toBe('Typ');
  });
});
