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
 *
 * ★ K-20b (KANAL Wpis 133, DEC-575, FEEDBACK-1-CTO): ratchet powyżej miał TRZY
 * ślepe plamy, zmierzone na `849c6dad12` — test „zero torów OFF w kolorze
 * powierzchni" był ZIELONY mimo 9 żywych naruszeń w drzewie:
 *   1) Grupa regexu sprawdzała TYLKO drugą stronę ternara (`: '...'`), zakładając
 *      układ `warunek ? ON : OFF`. `KeyboardShortcutsSettings.tsx:565` ma
 *      odwrócony warunek — `isDisabled ? OFF : ON` — więc kolor powierzchni
 *      siedział w PIERWSZEJ grupie i przechodził bez zgłoszenia.
 *   2) Regex wymagał obu gałęzi ternara W JEDNEJ LINII. Cztery pliki
 *      (`WorkPreferencesSettings.tsx`, `AdvancedSecuritySettings.tsx`,
 *      `NotificationChannelsSettings.tsx`, i częściowo Keyboard) rozbijają
 *      ternar na kolejne linie wewnątrz template-literala — regex nigdy się
 *      nie odpalał.
 *   3) Pięć torów (`IntegrationHealthSettings.tsx` ×2, `CalendarSyncSettings.tsx`
 *      ×2, `NotificationScheduleSettings.tsx`) to w ogóle NIE ternar — to
 *      checkbox+`peer`: `<input type="checkbox" className="sr-only peer">` +
 *      `<div className="bg-c-surface-raised ... peer peer-checked:bg-[ON-color] …">`.
 *      Ratchet szukający `? '...' : '...'` nie ma szans tego złapać.
 * Naprawa: (a) sprawdzaj OBIE strony ternara, nie zakładaj kolejności;
 * (b) normalizuj plik do jednej linii przed dopasowaniem — łapie ternar
 * rozbity na dowolną liczbę linii; (c) osobny detektor wzorca `peer-checked`
 * — dowolna klasa bazowa toru (przed `peer-checked:`) w kolorze powierzchni
 * ALBO `bg-c-border` (1,25:1 vs `--c-surface` — też za słabe, decyzja
 * tokenowa DEC-575) to FAIL. Naprawiony tor = `bg-c-control-track`
 * (nowy token, ≥3:1 w obu motywach — patrz `src/index.css`).
 *
 * Czerwony test PRZED naprawą (na `849c6dad12`, bez zmian K-20b) — zielony PO.
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

/**
 * K-20b: `bg-c-border` też jest za słaby na tor (1,25:1 vs `--c-surface` —
 * DEC-575). Osobna lista od `KOLORY_POWIERZCHNI` bo to inna usterka (nie
 * „znika w tle", tylko „poniżej progu kontrolki" — WCAG 1.4.11 ≥3:1) — ale
 * dla toru pstryczka OBIE są FAIL, więc łączymy je przy sprawdzaniu.
 */
const KOLORY_ZA_SLABE_NA_TOR = [...KOLORY_POWIERZCHNI, 'bg-c-border'];

describe('K-20 — tor pstryczka OFF nigdy w kolorze powierzchni (całe settings/**)', () => {
  const wszystkie = pliki(KORZEN);

  it('drzewo ustawień w ogóle się mierzy (bezpiecznik „brak pomiaru nie jest wynikiem")', () => {
    expect(wszystkie.length).toBeGreaterThan(20);
  });

  it('zero torów OFF w kolorze powierzchni (ternar jednoliniowy, OBIE gałęzie)', () => {
    const naruszenia: string[] = [];

    for (const plik of wszystkie) {
      const linie = fs.readFileSync(plik, 'utf8').split('\n');
      linie.forEach((linia, i) => {
        const dopasowanie = linia.match(/\? '(bg-[\w\-/[\].]+)' : '(bg-[\w\-/[\].]+)'/);
        if (!dopasowanie) return;
        const kontekst = linie.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (!kontekst.includes('rounded-full')) return;
        // K-20b: sprawdź OBIE gałęzie — ternar bywa `warunek ? OFF : ON`
        // (Keyboard) tak samo często jak `warunek ? ON : OFF`. Kolor
        // powierzchni w KTÓREJKOLWIEK gałęzi toru = naruszenie.
        [dopasowanie[1], dopasowanie[2]].forEach((kolor) => {
          if (KOLORY_POWIERZCHNI.includes(kolor)) {
            naruszenia.push(`${path.relative(KORZEN, plik)}:${i + 1} → ${kolor}`);
          }
        });
      });
    }

    expect(naruszenia).toEqual([]);
  });

  it('zero torów OFF w kolorze powierzchni (ternar wieloliniowy — K-20b)', () => {
    const naruszenia: string[] = [];

    for (const plik of wszystkie) {
      const tekst = fs.readFileSync(plik, 'utf8');
      // Znormalizuj do jednej "linii": ternar rozbity na warunek/`?`/`:` w
      // kolejnych liniach template-literala (WorkPreferencesSettings,
      // AdvancedSecuritySettings, NotificationChannelsSettings) znika po
      // scaleniu białych znaków — ten sam regex co wyżej wtedy się odpala.
      const scalony = tekst.replace(/\s+/g, ' ');
      const wzorzec = /rounded-full[^?]{0,200}\? '(bg-[\w\-/[\].]+)' : '(bg-[\w\-/[\].]+)'/g;
      let dopasowanie: RegExpExecArray | null;
      while ((dopasowanie = wzorzec.exec(scalony)) !== null) {
        [dopasowanie[1], dopasowanie[2]].forEach((kolor) => {
          if (KOLORY_POWIERZCHNI.includes(kolor)) {
            naruszenia.push(`${path.relative(KORZEN, plik)} (wieloliniowy) → ${kolor}`);
          }
        });
      }
    }

    expect(naruszenia).toEqual([]);
  });

  it('zero torów checkbox+peer w kolorze powierzchni/bg-c-border (K-20b)', () => {
    const naruszenia: string[] = [];

    for (const plik of wszystkie) {
      const tekst = fs.readFileSync(plik, 'utf8');
      // Łap className="..." ORAZ className={`...`} — obie formy występują
      // w drzewie (checkbox+peer używa zwykłego stringa, nie template-literala).
      const klasyRegex = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
      let dopasowanie: RegExpExecArray | null;
      while ((dopasowanie = klasyRegex.exec(tekst)) !== null) {
        const klasy = dopasowanie[1] ?? dopasowanie[2] ?? '';
        if (!klasy.includes('peer-checked:')) continue;
        // Kolor bazowy toru = klasy PRZED `peer-checked:` (stan OFF/nieaktywny
        // — peer-checked nadpisuje go tylko gdy checkbox jest zaznaczony).
        const bazowe = klasy.split('peer-checked:')[0];
        const zaSlaby = KOLORY_ZA_SLABE_NA_TOR.find((kolor) =>
          new RegExp(`(^|\\s)${kolor}(\\s|$)`).test(bazowe)
        );
        if (!zaSlaby) continue;
        const przedDopasowaniem = tekst.slice(0, dopasowanie.index);
        const numerLinii = przedDopasowaniem.split('\n').length;
        naruszenia.push(`${path.relative(KORZEN, plik)}:${numerLinii} → ${zaSlaby}`);
      }
    }

    expect(naruszenia).toEqual([]);
  });

  it('zgłoszony plik używa WSPÓLNEGO SettingsToggleControl, nie własnego pstryczka', () => {
    const zrodlo = fs.readFileSync(path.join(KORZEN, 'WorkingHoursSettings.tsx'), 'utf8');
    expect(zrodlo).toContain('SettingsToggleControl');
    expect(zrodlo).not.toMatch(/w-12 h-6 rounded-full/);
  });

  it('SettingsToggleControl (wspólna kontrolka) nie wraca do `bg-c-border` (K-20b)', () => {
    const zrodlo = fs.readFileSync(path.join(KORZEN, 'shared/SettingsSection.tsx'), 'utf8');
    expect(zrodlo).toContain('bg-c-control-track');
  });
});

/**
 * ★ K-20c (KANAL Wpis 142, DEC-575): CZWARTY detektor ratchetu.
 *
 * PREMISA ZMIERZONA PIKSELOWO na `9ec5a9f32b` (nie `getComputedStyle` — ten
 * zwraca token, a nie to, co widzi oko): tor pstryczka nosił poprawny token
 * `--c-control-track` (4,76:1 w jasnym motywie), ale WIERSZ, w którym siedział,
 * miał `opacity-40` (`KeyboardShortcutsSettings.tsx:510`) / `opacity-60`
 * (`WorkingHoursSettings.tsx:386`). Przezroczystość kontenera MNOŻY kolor
 * potomka przy składaniu na tle — zmierzone na PNG: **1,68:1** i **2,24:1**.
 * Trzy poprzednie detektory patrzą wyłącznie na klasę koloru toru i dlatego
 * były zielone.
 *
 * REGUŁA: `opacity-*` na KONTENERZE, którego wnętrze zawiera tor pstryczka
 * (`peer-checked:`, `SettingsToggleControl`, `role="switch"`) = FAIL.
 * Wyciszenie stanu wyłączonego robi się punktowo na TEKŚCIE
 * (`text-c-text-muted`), nigdy fade'em całego wiersza.
 *
 * WYJĄTEK: `opacity-*` na SAMEJ kontrolce (np. `disabled` + `opacity-50` na
 * elemencie z `role="switch"`) jest dozwolone — WCAG 1.4.11 wyłącza kontrolki
 * nieaktywne spod progu kontrastu. Dlatego markery szukane są WYŁĄCZNIE poniżej
 * znacznika otwierającego element, który niesie `opacity-*`.
 *
 * Czerwony PRZED naprawą K-20c (2 naruszenia), zielony PO.
 */
const MARKERY_TORU = [
  'peer-checked:',
  'SettingsToggleControl',
  'role="switch"',
  // Kanoniczny token toru (DEC-575) — łapie pstryczki klejone ręcznie przez
  // `cn(...)` na `<button>`, bez `peer` i bez `role="switch"`
  // (`KeyboardShortcutsSettings.tsx`).
  'bg-c-control-track',
];

/** Wcięcie linii (liczba wiodących spacji) — granica bloku JSX liczona z niego. */
const wciecie = (linia: string): number => linia.length - linia.trimStart().length;

/**
 * Wygaś treść komentarzy, ZACHOWUJĄC numery linii (znaki → spacje). Bez tego
 * detektor łapie sam siebie: nota „`opacity-60` na CAŁYM wierszu" opisująca
 * naprawę jest tekstem `opacity-6` w linii nad `className`. `//` wycinamy
 * tylko gdy zaczyna linię (żeby nie zjeść `https://` w literale).
 */
const bezKomentarzy = (tekst: string): string =>
  tekst
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

describe('K-20c — `opacity-*` na kontenerze z pstryczkiem (czwarty detektor)', () => {
  const wszystkie = pliki(KORZEN);

  it('drzewo ustawień w ogóle się mierzy (bezpiecznik „brak pomiaru nie jest wynikiem")', () => {
    expect(wszystkie.length).toBeGreaterThan(20);
  });

  it('zero fade’ów całego wiersza nad torem pstryczka', () => {
    const naruszenia: string[] = [];

    for (const plik of wszystkie) {
      const linie = bezKomentarzy(fs.readFileSync(plik, 'utf8')).split('\n');

      linie.forEach((linia, i) => {
        if (!/\bopacity-\d/.test(linia)) return;

        // 1) Znacznik otwierający elementu, który niesie `opacity-*`:
        //    pierwsza linia W GÓRĘ zaczynająca się od `<Tag`.
        let start = i;
        while (start >= 0 && !/^\s*<[A-Za-z]/.test(linie[start])) start -= 1;
        if (start < 0) return;

        // 2) Koniec znacznika otwierającego (`>` lub `/>` na końcu linii).
        let koniecTagu = start;
        while (koniecTagu < linie.length && !/(^|[^=])\/?>\s*$/.test(linie[koniecTagu])) {
          koniecTagu += 1;
        }
        if (koniecTagu >= linie.length) return;
        // Element samozamykający nie ma wnętrza — nie jest kontenerem.
        if (/\/>\s*$/.test(linie[koniecTagu])) return;

        // 3) Wnętrze elementu: do linii o tym samym wcięciu zamykającej `</`.
        const poziom = wciecie(linie[start]);
        let koniec = koniecTagu + 1;
        while (
          koniec < linie.length &&
          !(wciecie(linie[koniec]) <= poziom && /^\s*<\//.test(linie[koniec]))
        ) {
          koniec += 1;
        }

        const wnetrze = linie.slice(koniecTagu + 1, koniec).join('\n');
        const marker = MARKERY_TORU.find((m) => wnetrze.includes(m));
        if (!marker) return;

        naruszenia.push(
          `${path.relative(KORZEN, plik)}:${i + 1} → opacity-* nad torem (${marker})`
        );
      });
    }

    expect(naruszenia).toEqual([]);
  });
});

/**
 * K-20c: rodzeństwo POZA `settings/**` — te dwa pliki wypadły z zasięgu
 * ratchetu K-20b (KORZEN = `settings/`) i dlatego zostały z `bg-c-border`
 * (1,25:1) na torze OFF. Jawna lista, żeby nie odrosło.
 */
describe('K-20c — tory pstryczków poza drzewem settings/', () => {
  const POZA_SETTINGS = [
    '../AISettings/SettingsToggle.tsx',
  ];

  it.each(POZA_SETTINGS)('%s nie używa `bg-c-border` jako toru', (wzgledna) => {
    const zrodlo = fs.readFileSync(path.join(KORZEN, wzgledna), 'utf8');
    expect(zrodlo).not.toMatch(/'bg-c-border'/);
    expect(zrodlo).toContain('bg-c-control-track');
  });
});

/**
 * K-20c: crimson (`bg-brand` = #85182F) na stanie ZAZNACZONYM checkboxa
 * powiadomień — czerwień jest w Consultify zarezerwowana dla semantyki
 * krytycznej (CLAUDE.md, reguła UI 3). Stan aktywny = `--c-focus-solid`.
 */
describe('K-20c — zero crimson na stanie aktywnym kontrolek ustawień', () => {
  it('EmailNotificationsSettings nie maluje zaznaczonego checkboxa na `bg-brand`', () => {
    const zrodlo = fs.readFileSync(path.join(KORZEN, 'EmailNotificationsSettings.tsx'), 'utf8');
    expect(zrodlo).not.toMatch(/bg-brand\b/);
    expect(zrodlo).toContain('bg-c-focus-solid');
  });
});

/**
 * K-20c: `text-white` przybity na sztywno w `KeyboardShortcutsSettings` —
 * w motywie JASNYM nazwy skrótów i etykiety presetów były białym tekstem na
 * białej karcie (1,00:1). Token `--c-text` odwraca się z motywem.
 */
describe('K-20c — zero przybitego `text-white` w KeyboardShortcutsSettings', () => {
  it('nazwy skrótów i etykiety presetów używają tokenu, nie `text-white`', () => {
    const zrodlo = fs.readFileSync(path.join(KORZEN, 'KeyboardShortcutsSettings.tsx'), 'utf8');
    expect(zrodlo).not.toMatch(/(^|[\s'"`:])(hover:)?text-white(\s|'|"|`|$)/m);
  });
});
