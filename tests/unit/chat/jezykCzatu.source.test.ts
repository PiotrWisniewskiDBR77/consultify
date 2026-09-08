/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU 01 CZAT (paczka J1, 2026-09-08).
 *
 * Po co: paczka J1 przeniosła moduł Czat na zasadę „default w `t()` jest ZAWSZE
 * po angielsku, polski żyje w `public/locales/pl`" (§2.3 PLANU językowego) oraz
 * „język odpowiedzi AI = język interfejsu, zakaz zaszywania »po polsku« w
 * prompcie" (§2.8). Bez testu źródłowego jedna wklejka cofa obie rzeczy i nikt
 * tego nie zobaczy do następnego pełnego pomiaru.
 *
 * Detektor NIE stoi na samych diakrytykach — lekcja z J7b: „Kamienie milowe" to
 * zdanie w pełni polskie bez ani jednego ogonka i przechodziło. Używamy TEGO
 * SAMEGO słownika wyjątków, co `scripts/i18n/pomiar-jezyka.mjs`, żeby test i
 * pomiar nigdy się nie rozjechały.
 *
 * MUTACJA (dowód, że test działa): wstaw w dowolny plik modułu
 *   t('chat.x', 'Zatwierdź zmianę')            -> test 1 RED
 *   <div>Nie udało się zapisać</div>           -> test 2 RED
 *   'Odpowiedz po polsku' w prompcie serwera   -> test 3 RED
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const WYJATKI = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/i18n/pomiar-jezyka.wyjatki.json'), 'utf8')
);

const DIAKRYTYKI = /[ĄąĆćĘęŁłŃńÓóŚśŹźŻż]/;
const nazwyWlasne = new Set<string>(WYJATKI.nazwyWlasne.map((s: string) => s.toLowerCase()));
const plSilne = new Set<string>(WYJATKI.polskieSilne);
const plSlabe = new Set<string>(WYJATKI.polskieSlabe);
const pomijaneWartosci: RegExp[] = WYJATKI.pomijaneWartosci.map((r: string) => new RegExp(r));

const oczysc = (t: string): string =>
  String(t)
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[\w.-]+@[\w.-]+\b/g, ' ');

const slowa = (t: string): string[] =>
  oczysc(t)
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
    .filter((l) => !nazwyWlasne.has(l));

function wartoOceniac(tekst: string): boolean {
  const s = String(tekst).trim();
  if (s.length < 3) return false;
  for (const r of pomijaneWartosci) if (r.test(s)) return false;
  const c = oczysc(s).trim();
  if (c.length < 3) return false;
  return /[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]{2,}/.test(c);
}

/** Ten sam algorytm co `wykryjPolski` w pomiar-jezyka.mjs. */
function polski(tekst: string): boolean {
  if (!wartoOceniac(tekst)) return false;
  if (DIAKRYTYKI.test(oczysc(tekst))) return true;
  const ws = slowa(tekst);
  if (ws.some((w) => plSilne.has(w))) return true;
  return [...new Set(ws.filter((w) => plSlabe.has(w)))].length >= 2;
}

function pliki(dir: string, out: string[] = []): string[] {
  let wpisy: fs.Dirent[];
  try {
    wpisy = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const w of wpisy) {
    const p = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (w.name === 'node_modules' || w.name === '__tests__') continue;
      pliki(p, out);
    } else if (/\.(ts|tsx)$/.test(w.name) && !/\.test\./.test(w.name)) {
      out.push(p);
    }
  }
  return out;
}

const PLIKI_MODULU = [
  ...pliki(path.join(ROOT, 'src/components/AIChat')),
  path.join(ROOT, 'src/views/SharedConversationView.tsx'),
].filter((p) => fs.existsSync(p));

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

describe('J1 — moduł Czat nie mówi po polsku do konta angielskiego', () => {
  it('żaden defaultValue w t() nie jest polski (§2.3 — polski żyje w pl/translation.json)', () => {
    const WZ =
      /\bt\(\s*(["'`])([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+)\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,200})\3/g;
    const trafienia: string[] = [];
    for (const p of PLIKI_MODULU) {
      const tresc = fs.readFileSync(p, 'utf8');
      if (!tresc.includes('t(')) continue;
      WZ.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WZ.exec(tresc))) {
        if (!polski(m[4])) continue;
        const linia = tresc.slice(0, m.index).split('\n').length;
        trafienia.push(`${rel(p)}:${linia} — t('${m[2]}', '${m[4]}')`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('żaden widoczny napis w JSX nie jest polskim tekstem poza t() (§2.4)', () => {
    const ATRYBUTY =
      /\b(placeholder|title|label|aria-label|ariaLabel|alt|tooltip|emptyText|helperText|subtitle|heading|confirmText|cancelText|okText|description)\s*=\s*(["'])([^"'{}]{3,160})\2/g;
    const TEKST_JSX = />\s*([^<>{}\n][^<>{}]{2,160})\s*</g;
    const trafienia: string[] = [];
    for (const p of PLIKI_MODULU) {
      const tresc = fs.readFileSync(p, 'utf8');
      const linie = tresc.split('\n');
      const sprawdz = (offset: number, tekst: string) => {
        const nrLinii = tresc.slice(0, offset).split('\n').length;
        const linia = linie[nrLinii - 1] || '';
        if (/\bt\s*\(/.test(linia) && linia.indexOf(tekst.trim()) > linia.indexOf('t(')) return;
        if (/^\s*(\/\/|\*|\/\*|import |export \* )/.test(linia)) return;
        if (!polski(tekst)) return;
        trafienia.push(`${rel(p)}:${nrLinii} — „${tekst.trim().slice(0, 90)}"`);
      };
      let m: RegExpExecArray | null;
      ATRYBUTY.lastIndex = 0;
      while ((m = ATRYBUTY.exec(tresc))) sprawdz(m.index, m[3]);
      TEKST_JSX.lastIndex = 0;
      while ((m = TEKST_JSX.exec(tresc))) {
        const kandydat = m[1].trim();
        if (!/[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]{3,}/.test(kandydat)) continue;
        if (/^[A-Za-z]+\s*=/.test(kandydat)) continue;
        if (
          /;|=>|\bconst\b|\blet\b|\breturn\b|\bfunction\b|useState|useRef|useMemo|&&|\|\||\?\?|===|!==/.test(
            kandydat
          )
        )
          continue;
        sprawdz(m.index, kandydat);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('prompt czatu nie zaszywa języka odpowiedzi (§2.8 — decyduje [LANGUAGE INSTRUCTION])', () => {
    // Te pliki budują prompt dla Teresy na ścieżce czatu. Zaszyte „po polsku"
    // wygrywa z users.language i konto EN dostaje polską odpowiedź — dokładnie
    // to naprawiła paczka J1 (ai.routes.ts /chat + moduleContextGrounding).
    const SCIEZKI = [
      'server/src/routes/ai.routes.ts',
      'server/src/services/ai/moduleContextGrounding.ts',
      'server/src/services/ai/AIPipeline.ts',
      'src/components/AIChat/canvasDocumentProposal.ts',
    ];
    const ZAKAZANE = [/Odpowiedz\s+po\s+polsku/i, /odpowiadaj\s+po\s+polsku/i, /respond\s+in\s+Polish/i];
    const trafienia: string[] = [];
    for (const s of SCIEZKI) {
      const p = path.join(ROOT, s);
      if (!fs.existsSync(p)) continue;
      const linie = fs.readFileSync(p, 'utf8').split('\n');
      linie.forEach((linia, i) => {
        // Komentarz opisujący defekt to nie prompt — liczy się kod.
        if (/^\s*(\/\/|\*|\/\*)/.test(linia)) return;
        if (ZAKAZANE.some((re) => re.test(linia))) {
          trafienia.push(`${s}:${i + 1} — ${linia.trim().slice(0, 100)}`);
        }
      });
    }
    expect(trafienia).toEqual([]);
  });

  it('propozycja dokumentu nie ma polskiej domyślki języka (§2.8)', () => {
    const p = path.join(ROOT, 'src/components/AIChat/canvasDocumentProposal.ts');
    const tresc = fs.readFileSync(p, 'utf8');
    // Domyślka MUSI iść za interfejsem, nie za stałą 'pl'.
    expect(tresc).not.toMatch(/params\.language\s*\|\|\s*'pl'/);
    expect(tresc).toMatch(/params\.language\s*\|\|\s*i18n\.language/);
  });
});
