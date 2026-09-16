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
