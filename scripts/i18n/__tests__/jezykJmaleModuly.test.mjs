/**
 * TEST ŹRÓDŁOWY paczki J-małe — sześć modułów ma ZERO polskiego w wersji EN.
 *
 * Mierzy PRODUKT, nie dokumentację: uruchamia ten sam skaner, którym stoi
 * bramka (`scripts/i18n/pomiar-jezyka.mjs --json`), i sprawdza cztery
 * kategorie, które ta paczka doprowadziła do zera:
 *
 *   K1def  polski `defaultValue` w `t()`  — użytkownik EN widzi go przy
 *          pierwszym malowaniu ekranu (`react.useSuspense: false`) i zawsze,
 *          gdy klucza brak w paczce tłumaczeń,
 *   K4pl   polski tekst na sztywno w JSX poza `t()`,
 *   K4en   angielski tekst na sztywno w JSX poza `t()` (boli użytkownika PL),
 *   K7     data/liczba bez locale albo z locale przybitym na sztywno.
 *
 * K5pl/K5en (zdania z serwera) NIE są tu sprawdzane — to kontrakt API i osobna
 * paczka J17, patrz docs/program/JEZYK_EN_PL_20260908/PLAN.md.
 *
 * MUTACJA (dowód, że test nie jest atrapą): wstaw polski literał do dowolnego
 * pliku któregoś z tych modułów, np. w `src/components/Meeting/MeetingHub.tsx`
 *     <span>Nie udało się wczytać</span>
 * i uruchom ten plik — asercja dla „12 Meeting" musi zrobić się CZERWONA na
 * kategorii K4pl. Wykonane 2026-09-08, wynik: czerwony (K4pl 0 → 1).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Moduły paczki J-małe — nazwy dokładnie takie, jakich używa skaner. */
const MODULY_JMALE = [
  '13 Organization',
  '08 Results',
  '12 Meeting',
  '03 Interview',
  '11 Audits',
  '06 Initiatives',
  '07 Execution',
];

const KATEGORIE = ['K1def', 'K4pl', 'K4en', 'K7'];

function zmierz() {
  const surowy = execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/i18n/pomiar-jezyka.mjs'), '--json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  // `--json` dopisuje JSON na końcu wyjścia; bierzemy od pierwszego `{`.
  return JSON.parse(surowy.slice(surowy.indexOf('{')));
}

describe('J-małe — sześć modułów bez obcego języka w interfejsie', () => {
  const wynik = zmierz();

  it.each(MODULY_JMALE)('%s: K1def · K4pl · K4en · K7 są na zerze', (modul) => {
    const m = wynik.moduly[modul];
    expect(m, `skaner nie zna modułu ${modul}`).toBeDefined();
    const niezerowe = KATEGORIE.filter((k) => (m[k] ?? 0) > 0).map((k) => `${k}=${m[k]}`);
    expect(niezerowe, `${modul}: ${niezerowe.join(', ')}`).toEqual([]);
  });

  it('baseline bramki zna te moduły i też trzyma je na zerze', async () => {
    const fs = await import('node:fs');
    const baseline = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'docs/program/JEZYK_EN_PL_20260908/baseline.json'),
        'utf8'
      )
    );
    for (const modul of MODULY_JMALE) {
      const m = baseline.moduly?.[modul];
      expect(m, `baseline nie zna modułu ${modul}`).toBeDefined();
      for (const k of KATEGORIE) {
        expect(m[k] ?? 0, `${modul}.${k} w baseline`).toBe(0);
      }
    }
  });
});
