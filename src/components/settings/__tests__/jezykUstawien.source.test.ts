/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU USTAWIENIA (paczka J15, DEC-453).
 *
 * DLACZEGO ISTNIEJE (pomiar 09.09, `evidence/jezyk-j15/`): moduł miał 7
 * polskich `defaultValue` w `t()`, 100 kluczy obecnych wyłącznie w `pl`
 * (16 z nich bez defaultu w kodzie — konto EN widziało SUROWY KLUCZ),
 * 30 polskich napisów wprost w JSX, 135 angielskich napisów wprost w JSX
 * (te bolą konto PL) i 81 dat/liczb formatowanych bez locale z konta.
 * `src/i18n.ts` ustawia `fallbackLng: { en: ['en'] }`, więc konto angielskie
 * NIGDY nie spada na plik PL — spada na `defaultValue` z KODU. Polski default
 * jest tu równoznaczny z polskim ekranem dla Anglika.
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — dlatego obejmuje też ekrany, których
 * żaden zrzut nie odwiedził (kreator MFA, kody zapasowe, webhooki, panel
 * kluczy API, historia ustawień). Skaner `scripts/i18n/pomiar-jezyka.mjs`
 * liczy TSX; ten test obejmuje również `.ts` (tam siedzą słowniki i helpery).
 *
 * ZASIĘG: pliki modułu 15_SETTINGS z rejestru zamrożeń
 * (`docs/program/MVP_FINAL_ZAMROZONE.json`). Onboarding, Welcome, Help,
 * CookieConsentBanner, InviteUserModal i `components/AISettings/**` są
 * świadomie POZA — skaner przypisuje je do modułu 15 po prefiksie klucza,
 * ale należą do wspólnych/innych paczek (STOP paczki J15).
 *
 * MUTACJA (dowód, że test nie jest dekoracją): zamiana dowolnego
 * `t('klucz', 'English')` w zasięgu na `t('klucz', 'Polski tekst')` daje RED
 * w drugim `it`; przywrócenie `toLocaleDateString()` bez argumentu daje RED
 * w czwartym; usunięcie `t()` z pliku kodów zapasowych — w piątym.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KORZEN = path.resolve(__dirname, '../../..'); // src/
const KATALOGI = ['components/settings', 'components/Profile', 'views/settings'];
const POJEDYNCZE = [
  'views/SettingsView.tsx',
  // J-DOG-A (09.09): EnterpriseOnboardingWizard byl jawnie POZA zasiegiem
  // paczki J15 (patrz komentarz przy ZASIEG wyzej — "Onboarding... swiadomie
  // POZA"), ale mandat J-DOG-A przypisal go do MOJEGO zakresu wprost ("teraz
  // sa w zakresie"). Dodaje TYLKO ten jeden plik (nie caly katalog
  // components/Onboarding) — reszta katalogu (SmartNudge w InAppNudges,
  // QuestionExplanation.tsx, SnapshotLabel.tsx, TourTrigger.tsx) to martwy kod
  // bez importera z App.tsx/AppRoutes.tsx, wciaz po polsku, zgloszony do
  // usuniecia w STOP tej paczki — dodanie calego katalogu zaswieciloby ten
  // test na czerwono z powodu niezwiazanego.
  'components/Onboarding/EnterpriseOnboardingWizard.tsx',
];

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Same diakrytyki NIE WYSTARCZAJĄ — „Dostepnosc", „Profil", „Limity zapytan"
 * to napisy w pełni polskie bez ani jednego ogonka. Słownik bierzemy z TEGO
 * SAMEGO pliku, na którym stoi przyrząd pomiarowy, żeby bezpiecznik i pomiar
 * nie rozjechały się definicją „polskiego".
 */
const WYJATKI = JSON.parse(
  fs.readFileSync(path.resolve(KORZEN, '../scripts/i18n/pomiar-jezyka.wyjatki.json'), 'utf8')
) as { polskieSilne: string[] };
const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne.map((s) => s.toLowerCase()),
  'ustawienia',
  'ustawien',
  'profil',
  'profilu',
  'haslo',
  'hasla',
  'bezpieczenstwo',
  'bezpieczenstwa',
  'powiadomienia',
  'powiadomien',
  'integracje',
  'integracji',
  'jezyk',
  'jezyka',
  'kody',
  'kodow',
  'zapasowe',
  'urzadzenie',
  'urzadzenia',
  'sesje',
  'sesji',
  'zapisz',
  'anuluj',
  'usun',
  'dodaj',
  'wlaczone',
  'wylaczone',
  'limity',
  'zapytan',
  'dostepnosc',
]);

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
  // Ekran POKAZUJE PODGLĄD formatu wybranego przez użytkownika — jawne locale
  // i jawny `Intl` są tam poprawne, bo to jest właśnie ta funkcja.
  'RegionalSettings.tsx': 'podgląd formatu daty/liczby wybranego przez użytkownika',
  // Formatuje datę po jawnym warunku języka konta (`language === 'pl'`), czyli
  // robi dokładnie to, czego wymaga reguła — tylko własnym zapisem.
  'ApprovalPatternManager.tsx': 'locale wybierane jawnie z języka konta',
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

const ZRODLA = [
  ...KATALOGI.flatMap((k) => [...pliki(path.join(KORZEN, k))]),
  ...POJEDYNCZE.map((p) => path.join(KORZEN, p)),
]
  .filter((p) => !(path.basename(p) in WYLACZONE))
  .map((p) => ({ nazwa: path.relative(KORZEN, p), tekst: fs.readFileSync(p, 'utf8') }));

describe('moduł Ustawienia — konto angielskie nie widzi polskiego', () => {
  it('ma co skanować (bezpiecznik przed pustym zbiorem)', () => {
    expect(ZRODLA.length).toBeGreaterThan(100);
  });

  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec =
      /\bt\(\s*(["'`])[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]-]+)+\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,300})\2/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const m of tekst.matchAll(wzorzec)) {
        if (czyPolski(m[3])) trafienia.push(`${nazwa}: „${m[3]}"`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i etykietach', () => {
    const tekstJsx = />\s*([^<>{}'"`;=\n][^<>{}'"`;=]*)</g;
    const atrybuty =
      /\b(title|placeholder|aria-label|ariaLabel|alt|label|subtitle|description|emptyText|helperText|tooltip)\s*=\s*"([^"]+)"/g;
    const etykietyObiektu = /\b(label|title|description|reason)\s*:\s*'([^']+)'/g;
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
    // formatListTime / formatListNumber / localeListy).
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

  it('plik z kodami zapasowymi MFA powstaje z t(), nie z napisu na sztywno', () => {
    // Jedyny artefakt, który użytkownik zapisuje u siebie i czyta wtedy, gdy
    // NIE MOŻE się zalogować — musi być w języku jego interfejsu.
    const generatory = ZRODLA.filter(({ tekst }) => tekst.includes('backup-codes.txt'));
    expect(generatory.length).toBeGreaterThanOrEqual(1);
    for (const { nazwa, tekst } of generatory) {
      expect(tekst, `${nazwa} — tytuł pliku kodów poza t()`).toContain(
        'settings.recovery.fileTitle'
      );
      expect(tekst, `${nazwa} — stopka pliku kodów poza t()`).toContain(
        'settings.recovery.fileFooter'
      );
    }
  });
});
