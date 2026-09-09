/**
 * BEZPIECZNIK JĘZYKOWY PANELU ADMINISTRATORA (paczka J14, DEC-453).
 *
 * DLACZEGO ISTNIEJE. Przyrząd `scripts/i18n/pomiar-jezyka.mjs` widział w tym
 * module 31 defektów w ekranach panelu organizacji. Audyt źródeł zobaczył ~415.
 * Różnica to nie przypadek, tylko DWA wzorce, których heurystyka diakrytyczna
 * nie łapie z założenia:
 *
 *   (a) `adminNavigation.ts` trzymał DWA równoległe słowniki napisów — polski
 *       `ADMIN_DOMAINS` i angielskie `ADMIN_DOMAIN_EN`/`ADMIN_SCREEN_EN` —
 *       przełączane funkcją `getAdminDomains(language)`. 136 napisów CAŁEGO
 *       menu panelu, w pliku `.ts`, poza `t()`, poza skanem.
 *   (b) `isPolish ? 'PL' : 'EN'` w czterech plikach powłoki: oba języki
 *       zaszyte w kodzie, i18n omijane w całości.
 *
 * Do tego napisy w pełni polskie BEZ ani jednego ogonka („Role i uprawnienia",
 * „Plan i limity", „Panel administratora", „Zapisano i potwierdzono odczytem"),
 * których detektor diakrytyczny nie zobaczy nigdy.
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — obejmuje więc także te z 62 slotów
 * nawigacji, których żaden zrzut nie odwiedził, oraz pliki `.ts` (słowniki
 * enumów, konfiguracja nawigacji), których przyrząd nie skanuje.
 *
 * DWIE STRONY, nie jedna. Wymaganie właściciela ma dwie połowy: „w angielskiej
 * nie ma być ani jednego innego języka" ORAZ „w polskiej ani jednego
 * angielskiego". Dlatego test sprawdza polski w kodzie (psuje EN) i angielskie
 * napisy poza `t()` (psują PL).
 *
 * MUTACJA (dowód, że to nie dekoracja) — sprawdzone 09.09:
 *   - zamiana dowolnego `t('klucz', 'English')` w zasięgu na polski tekst
 *     → RED w „nie ma polskiego defaultValue w t()";
 *   - przywrócenie `label: 'Users'` w `adminNavigation.ts`
 *     → RED w „nie ma napisów poza t() w etykietach i treści JSX";
 *   - przywrócenie `toLocaleDateString()` bez argumentu
 *     → RED w „nie formatuje dat ani liczb z locale przybitym na sztywno".
 *
 * ZASIĘG: ekrany panelu administratora ORGANIZACJI. `src/views/superadmin/**`
 * i `src/components/SuperAdmin/**` są świadomie POZA — to osobna powierzchnia
 * platformy za `requiredRole="SUPERADMIN"` (ProtectedRoute.tsx:84-90 nie wpuszcza
 * tam nawet ADMIN/OWNER organizacji), z własnym layoutem i rozłącznymi trasami.
 * Jej dług językowy jest wypisany w `evidence/jezyk-j14/README.md`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KORZEN = path.resolve(__dirname, '../../..'); // src/
const KATALOGI = ['views/admin', 'components/Admin'];

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const WYJATKI = JSON.parse(
  fs.readFileSync(path.resolve(KORZEN, '../scripts/i18n/pomiar-jezyka.wyjatki.json'), 'utf8')
) as { polskieSilne: string[] };

/**
 * Słownik polskich słów — TEN SAM rdzeń, na którym stoi przyrząd pomiarowy,
 * plus słowa widziane na zrzutach TEGO panelu bez ani jednego ogonka. Bez tej
 * listy bezpiecznik przepuściłby całe menu („Role i uprawnienia", „Faktury",
 * „Sesje", „Domeny", „Retencja", „Diagnostyka").
 */
/**
 * ŚWIADOMIE NIE MA TU słów, które po angielsku znaczą to samo albo brzmią
 * identycznie: `role`, `plan`, `panel`, `benchmark`, `audyt`/`audit`, `limity`.
 * Wpisanie ich dawało fałszywe trafienia na poprawnych angielskich defaultach
 * („Default Role", „Artifacts Panel", „Failed to assign plan") — bezpiecznik,
 * który krzyczy na poprawny kod, zostaje wyciszony i przestaje bronić.
 */
const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne.map((s) => s.toLowerCase()),
  'administratora',
  'uprawnienia',
  'uprawnien',
  'faktury',
  'faktura',
  'sesje',
  'sesji',
  'domeny',
  'retencja',
  'retencji',
  'diagnostyka',
  'zdarzenia',
  'przeglad',
  'zapisano',
  'potwierdzono',
  'odczytem',
  'wykorzystanie',
  'koszty',
  'persony',
  'modele',
  'dostawcy',
  'incydenty',
  'audytu',
  'konsultingowy',
  'zespoly',
  'uzytkownicy',
  'zaproszenia',
  'wlasnosc',
  'niezweryfikowane',
  'zaleznosci',
  'kolejka',
  'kolejki',
  'zadania',
]);

function czyPolski(tekst: string): boolean {
  if (DIAKRYTYKI.test(tekst)) return true;
  return tekst
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .some((slowo) => POLSKIE_SLOWA.has(slowo.toLowerCase()));
}

/**
 * Pliki świadomie WYŁĄCZONE, każdy z powodem i adresem. To nie jest lista,
 * na którą dopisuje się kolejny plik, gdy test zaświeci.
 */
const WYLACZONE: Record<string, string> = {
  // Ukryta nakładka deweloperska otwierana wyłącznie przez `?v9flags=1`
  // (ChatV9FlagsOverlay.tsx:41) — NIE jest żadnym z 62 slotów nawigacji
  // panelu i właściciel organizacji nie ma do niej wejścia z menu.
  // Dług wypisany w evidence/jezyk-j14/README.md.
  'ChatV9FlagsPanel.tsx': 'ukryta nakładka deweloperska ?v9flags=1, poza menu panelu',
  'ChatV9FlagsOverlay.tsx': 'ukryta nakładka deweloperska ?v9flags=1, poza menu panelu',
  'ChatV9FlagsIndicator.tsx': 'ukryta nakładka deweloperska ?v9flags=1, poza menu panelu',
  'ChatV9FlagsResetHandler.tsx': 'ukryta nakładka deweloperska ?v9flags=1, poza menu panelu',
};

function* pliki(dir: string): Generator<string> {
  for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === '__tests__' || wpis.name === 'node_modules') continue;
      yield* pliki(p);
    } else if (/\.tsx?$/.test(wpis.name) && !/\.d\.ts$/.test(wpis.name)) {
      yield p;
    }
  }
}

const ZRODLA = KATALOGI.flatMap((k) => [...pliki(path.join(KORZEN, k))])
  .filter((p) => !(path.basename(p) in WYLACZONE))
  .map((p) => ({ nazwa: path.relative(KORZEN, p), tekst: fs.readFileSync(p, 'utf8') }));

describe('panel administratora — konto angielskie nie widzi polskiego', () => {
  it('ma co skanować (bezpiecznik przed pustym zbiorem)', () => {
    expect(ZRODLA.length).toBeGreaterThan(50);
  });

  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec =
      /\bt\(\s*(["'`])[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]-]+)+\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,400})\2/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const m of tekst.matchAll(wzorzec)) {
        if (czyPolski(m[3])) trafienia.push(`${nazwa}: „${m[3]}"`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  /**
   * DRUGIE ŹRÓDŁO polskiego widocznego dla Anglika — i to, które wpuściło
   * 68 napisów całego menu: napis w TABLICY/OBIEKCIE STAŁYM, renderowany
   * później przez `t(klucz, napis)`. To nie jest `defaultValue` w wywołaniu
   * `t()`, więc próba wyżej go NIE WIDZI (sprawdzone mutacją: wstawienie
   * `c('members', 'admin.nav.screen.members', 'Użytkownicy')` przechodziło
   * przez tamtą próbę bez słowa). Ta próba czyta same literały etykiet.
   */
  it('nie ma polskich napisów w etykietach tablic i obiektów stałych', () => {
    const etykiety =
      /\b(label|title|name|description|denial|message|reason|emptyMessage|subtitle)\s*:\s*'([^']{3,300})'/g;
    // `\s` (nie ` `) i flaga `s` — prettier łamie długie wywołania `c(...)`
    // na cztery linie, a regex wymagający jednej linii przepuścił mutację
    // „Role i uprawnienia" (sprawdzone 09.09). Wąskie dopasowanie po jednej
    // linii to bezpiecznik, który udaje, że działa.
    const pomocnikNawigacji = /\bc\(\s*'[a-z0-9-]+'\s*,\s*'[^']+'\s*,\s*'([^']{3,300})'/gs;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of [etykiety, pomocnikNawigacji]) {
        for (const m of tekst.matchAll(wzorzec)) {
          const wartosc = String(m[m.length - 1]).trim();
          if (czyPolski(wartosc)) trafienia.push(`${nazwa}: „${wartosc}"`);
        }
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie rozgałęzia napisów po języku zamiast używać i18n', () => {
    // `isPolish ? 'PL' : 'EN'` trzyma oba języki w kodzie i omija i18n —
    // to był wzorzec z AdminHealthPanel/AdminCapabilityState/AdminSettingsSidebar.
    const wzorce = [
      /\bisPolish\b/g,
      /\blanguage\s*(?:\?\.)?\.?toLowerCase\(\)\s*\.startsWith\(\s*['"]pl['"]\s*\)/g,
      /\bi18n\.language\s*===\s*['"]pl['"]/g,
    ];
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of wzorce) {
        for (const m of tekst.matchAll(wzorzec)) trafienia.push(`${nazwa}: ${m[0]}`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie formatuje dat ani liczb z locale przybitym na sztywno', () => {
    // SSOT: src/utils/listDateFormat.ts
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

  /**
   * DRUGA POŁOWA WYMAGANIA: „w wersji polskiej ani jednego angielskiego".
   *
   * Sprawdzamy WYŁĄCznie miejsca, w których napis nie może być defaultem `t()`:
   * gołą treść węzła JSX (`>Create API Key<`) i atrybuty HTML w cudzysłowie
   * (`title="Revoke key"`). Angielskie defaulty w `t('klucz', 'English')` są tu
   * POPRAWNE i celowo nie są liczone — to reguła §2.3 planu, nie defekt.
   */
  it('nie ma angielskich napisów poza t() w treści JSX i atrybutach', () => {
    const SLOWA_EN =
      /\b(the|and|for|with|this|that|your|from|not|are|is|was|were|has|have|can|will|please|failed|enter|select|create|update|delete|remove|add|save|cancel|close|open|search|loading|error|success|settings|users|invite|access|status|report|manage|enabled|disabled|unknown|none|active|required|key|keys|copy|revoke|expires|expired)\b/i;
    const tekstJsx = />\s*([A-Za-z][^<>{}'"`;=\n]{4,})</g;
    const atrybuty =
      /\b(title|placeholder|aria-label|ariaLabel|alt)\s*=\s*"([^"]{4,})"/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of [tekstJsx, atrybuty]) {
        for (const m of tekst.matchAll(wzorzec)) {
          const wartosc = String(m[m.length - 1]).trim();
          if (wartosc.split(/\s+/).length < 2) continue;
          if (SLOWA_EN.test(wartosc)) trafienia.push(`${nazwa}: „${wartosc}"`);
        }
      }
    }
    expect(trafienia).toEqual([]);
  });
});
