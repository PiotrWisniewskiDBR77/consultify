/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU 02 MOJA PRACA (paczka J2, DEC-453).
 *
 * DLACZEGO ISTNIEJE (pomiar 09.09, `evidence/jezyk-j2/przed/`): konto
 * angielskie widziało w tym module **182 polskie `defaultValue` w `t()`**
 * (z tego 23 BEZ klucza w `en/translation.json`, czyli polskie na stałe)
 * i **75 dat/liczb formatowanych bez locale albo z locale przybitym**.
 * `src/i18n.ts` ustawia `fallbackLng: { en: ['en'] }`, więc EN NIGDY nie
 * spada na plik PL — spada na `defaultValue` Z KODU. Polski default jest
 * w tym module równoznaczny z polskim ekranem dla Anglika.
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — dlatego łapie także miejsca, do
 * których żaden zrzut nie dotarł (inspektor pomysłu, pas notatki, panele
 * tabeli platformowej, kolejki bramek). Skaner `scripts/i18n/pomiar-jezyka.mjs`
 * liczy TSX; ten test obejmuje również `.ts` (tam siedziały `financialFormat.ts`
 * i `formulaEngineCore.ts` z locale na sztywno).
 *
 * ZASIĘG: `src/components/MyWork/**`. Poza nim leżą pliki, które skaner też
 * liczy do modułu 02 — `src/components/CaseWorkspace/**` (10 075 linii BEZ
 * ANI JEDNEGO `useTranslation`, trasa `/zlecenia` przy fladze OFF nie jest
 * nawet rejestrowana w `src/App.tsx`), `src/views/vault/**`, `src/views/
 * MyApprovalsView.tsx`. CaseWorkspace to osobna paczka (J2b); obejmowanie go
 * tym bezpiecznikiem dałoby test, który świeci na czerwono od pierwszego dnia
 * i przez to zostanie wyciszony — a wyciszony bezpiecznik jest gorszy niż
 * jego brak.
 *
 * MUTACJA (sprawdzona 09.09 na `TaskRow.tsx`, każda osobno):
 *   1. `t('mut.a', 'Zapisz zmiany w zadaniu')`            → RED,
 *   2. `<span>Warunki zamknięcia zadania</span>`          → RED,
 *   3. `d.toLocaleDateString()`                           → RED.
 *
 * ★ ZMIERZONE OGRANICZENIE, nie chwalenie się: mutacja
 * `<span>Warunki zamkniecia zadania</span>` — to samo zdanie BEZ ogonków —
 * PRZESZŁA NA ZIELONO. Detektor stoi na diakrytykach plus słowniku
 * `polskieSilne`, a te trzy słowa w słowniku nie występują. Test łapie więc
 * polski pisany normalnie (z ogonkami) i polski z częstymi słowami
 * funkcyjnymi; nie łapie polskiego pisanego bez ogonków ze słownictwem
 * fachowym. Kto to poszerza — poszerza `polskieSilne` w
 * `scripts/i18n/pomiar-jezyka.wyjatki.json`, żeby przyrząd i bezpiecznik
 * dalej mówiły o tym samym.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KATALOG = path.resolve(__dirname, '..');
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Same diakrytyki NIE WYSTARCZAJĄ — „Warunki zamkniecia" czy „Brak powiazan"
 * to zdania w pełni polskie bez ani jednego ogonka. Dlatego test dokłada
 * słownik polskich słów funkcyjnych — TEN SAM, na którym stoi
 * `scripts/i18n/pomiar-jezyka.mjs`, żeby bezpiecznik i przyrząd pomiarowy nie
 * rozjechały się definicją „polskiego" (lekcja z J7b).
 */
const WYJATKI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../scripts/i18n/pomiar-jezyka.wyjatki.json'),
    'utf8'
  )
) as { polskieSilne: string[] };
const POLSKIE_SLOWA = new Set(WYJATKI.polskieSilne);

function czyPolski(tekst: string): boolean {
  if (DIAKRYTYKI.test(tekst)) return true;
  return tekst
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .some((slowo) => POLSKIE_SLOWA.has(slowo.toLowerCase()));
}

/**
 * Pliki świadomie WYŁĄCZONE, każdy z powodem. To nie jest „lista, na którą
 * dopisuje się kolejny plik, gdy test zaświeci".
 */
const WYLACZONE: Record<string, string> = {
  // TREŚĆ SZABLONÓW (węzły, nazwy kolumn, przykładowe wiersze ~40 szablonów
  // konsultingowych). To DANE startowe, nie etykiety interfejsu — język danych
  // to osobna kategoria (K6) i osobna paczka, tak samo jak w J7b.
  'ideaConsultingTemplates.ts': 'treść szablonów startowych (dane), nie napisy interfejsu',
  // KONTRAKTY KART: pola `brakAiPrompt`/`reason` niosą UZASADNIENIE DLA
  // PROGRAMISTY („log zdarzeń to zapis faktów…"), wymuszone typem
  // `definiujKarteKanoniczna`. Nic z tego nie trafia na ekran.
  'taskCardContract.ts': 'uzasadnienia w typie kontraktu, nie renderowane',
  'decisionCardContract.ts': 'uzasadnienia w typie kontraktu, nie renderowane',
  'notificationCardContract.ts': 'uzasadnienia w typie kontraktu, nie renderowane',
  // Para napisów PL/EN wybierana przez `isPolish` (`label` / `labelEn`,
  // `promptPl` / `promptEn`) — poprawny wzorzec dwujęzyczny, nie polski default.
  'IdeaTeresaSection.tsx': 'para napisów PL/EN wybierana przez isPolish',
};

function pliki(dir: string): string[] {
  const out: string[] = [];
  for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === '__tests__') continue;
      out.push(...pliki(p));
      continue;
    }
    if (!/\.tsx?$/.test(wpis.name)) continue;
    if (/\.test\.tsx?$/.test(wpis.name)) continue;
    if (WYLACZONE[wpis.name]) continue;
    out.push(p);
  }
  return out;
}

/** Komentarze wygaszone spacjami — numery linii zostają nienaruszone. */
function bezKomentarzy(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

const ZRODLA = pliki(KATALOG).map((p) => ({
  nazwa: path.relative(KATALOG, p),
  tekst: bezKomentarzy(fs.readFileSync(p, 'utf8')),
}));

describe('J2 — moduł Moja Praca mówi po angielsku w kodzie', () => {
  it('ma z czego mierzyć (lista plików nie jest pusta)', () => {
    // Bez tego „0 trafień" znaczyłoby także „0 przeczytanych plików" —
    // brak pomiaru nie jest wynikiem.
    expect(ZRODLA.length).toBeGreaterThan(200);
  });

  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec =
      /\bt\(\s*(?:'[^']+'|"[^"]+"|`[^`]+`)\s*,\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const m of tekst.matchAll(wzorzec)) {
        if (czyPolski(m[2])) trafienia.push(`${nazwa}: „${m[2]}"`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i etykietach', () => {
    const tekstJsx = />\s*([^<>{}'"`;=\n][^<>{}'"`;=]*)</g;
    const atrybuty = /\b(title|placeholder|aria-label|label|subtitle|emptyText)\s*=\s*"([^"]+)"/g;
    // Świadomie BEZ `note|reason|description`: w tym module te pola niosą
    // uzasadnienia dla programisty wewnątrz kontraktów kart (`brakAiPrompt`),
    // a nie napisy na ekranie. `label`/`title` to etykiety realnie renderowane.
    const etykietyObiektu = /\b(label|title)\s*:\s*'([^']+)'/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of [tekstJsx, atrybuty, etykietyObiektu]) {
        for (const m of tekst.matchAll(wzorzec)) {
          const wartosc = m[m.length - 1];
          if (czyPolski(wartosc)) trafienia.push(`${nazwa}: „${wartosc.trim()}"`);
        }
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie formatuje dat ani liczb z locale przybitym na sztywno', () => {
    // SSOT: src/utils/listDateFormat.ts (formatListDate / formatListDateTime /
    // formatListNumber / localeListy).
    const wzorce = [
      /toLocale(?:Date|Time)?String\(\s*\)/g,
      /toLocale(?:Date|Time)?String\(\s*'(?:pl-PL|en-US|en-GB)'/g,
      /new Intl\.(?:DateTime|Number)Format\(\s*'(?:pl-PL|en-US|en-GB)'/g,
    ];
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of wzorce) {
        for (const m of tekst.matchAll(wzorzec)) trafienia.push(`${nazwa}: ${m[0]}`);
      }
    }
    expect(trafienia).toEqual([]);
  });
});
