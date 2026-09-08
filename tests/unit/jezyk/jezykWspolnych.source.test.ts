/**
 * BEZPIECZNIK JĘZYKOWY KOMPONENTÓW WSPÓLNYCH (paczka ZZ, 2026-09-09).
 *
 * Po co: paczka ZZ przeniosła powłokę, nawigację, ekrany awarii, stany puste i
 * komponenty `standard/` na zasadę „default w `t()` jest ZAWSZE po angielsku"
 * (PLAN §2.3) oraz „zero tekstu widocznego poza `t()`" (§2.4). Te pliki widzi
 * KAŻDY moduł, więc jedna wklejka z polskim napisem wraca na wszystkich
 * ekranach naraz — i nikt tego nie zauważy do następnego pełnego pomiaru.
 *
 * Detektor NIE stoi na samych diakrytykach (lekcja z J7b: „Kamienie milowe" to
 * zdanie w pełni polskie bez ani jednego ogonka). Używa TEGO SAMEGO słownika
 * wyjątków co `scripts/i18n/pomiar-jezyka.mjs`, żeby test i pomiar nie mogły
 * się rozjechać.
 *
 * MUTACJA (dowód, że test działa — wykonana i cofnięta 09.09):
 *   t('common.x', 'Zapisz zmiany')                  -> test 1 RED
 *   <div>Nie udało się zapisać</div>                -> test 2 RED
 *   breadcrumbs={breadcrumbs || ['Narzędzia']}      -> test 3 RED
 *   detectMessageLanguage(content) || chatLanguage  -> test 4 RED
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

/**
 * Zakres: TYLKO to, co paczka ZZ faktycznie doprowadziła do zera.
 *
 * `src/components/shared` w całości jest za szeroki — mieszkają tam ekrany
 * modułowe innych paczek (BillingCore, UserManagementCore), które mają własne
 * terminy. Bezpiecznik, który obejmuje cudzy dług, świeci na czerwono od
 * pierwszego dnia i po tygodniu wszyscy go wyłączają.
 */
const KATALOGI = [
  'src/components/standard',
  'src/components/EmptyStates',
  'src/components/Feedback',
  'src/components/ai',
  'src/components/access',
];
const POJEDYNCZE = [
  'src/routes/DeferredRouteLoadingFallback.tsx',
  'src/components/RouteErrorBoundary.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/NotFoundPage.tsx',
  'src/components/ModelSelector.tsx',
  'src/components/layout/MfaEnrollmentBanner.tsx',
  'src/components/shared/AIFieldEnhancer.tsx',
  'src/components/shared/ArtifactStudio/ArtifactMenu3.tsx',
  'src/components/shared/CanonicalWorkHardeningPanel.tsx',
  'src/components/shared/TaskMilestoneBlastRadius.tsx',
];

const PLIKI = [
  ...KATALOGI.flatMap((k) => pliki(path.join(ROOT, k))),
  ...POJEDYNCZE.map((p) => path.join(ROOT, p)),
].filter((p) => fs.existsSync(p));

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

describe('ZZ — komponenty wspólne nie mówią po polsku do konta angielskiego', () => {
  it('ma co mierzyć (brak plików = fałszywe PASS)', () => {
    expect(PLIKI.length).toBeGreaterThan(30);
  });

  it('żaden defaultValue w t() nie jest polski (§2.3 — polski żyje w pl/translation.json)', () => {
    const WZ =
      /\bt\(\s*(["'`])([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+)\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,200})\3/g;
    const trafienia: string[] = [];
    for (const p of PLIKI) {
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
    for (const p of PLIKI) {
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

  it('breadcrumby w AppRoutes idą przez t(), nie przez literał (poza „Ocena" paczki J5)', () => {
    const tresc = fs.readFileSync(path.join(ROOT, 'src/routes/AppRoutes.tsx'), 'utf8');
    const WZ = /breadcrumbs=\{breadcrumbs \|\| \[([^\]]*)\]/g;
    const trafienia: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = WZ.exec(tresc))) {
      // wycinamy wywołania t(...) — zostają wyłącznie gołe literały
      const zawartosc = m[1].replace(/\bt\(\s*(["'])(?:[^"']*)\1(?:\s*,\s*(["'])(?:[^"']*)\2)?\s*\)/g, '');
      if (!/["']/.test(zawartosc)) continue;
      if (zawartosc.includes("'Ocena'")) continue; // własność paczki J5, świadomie pominięte
      const nrLinii = tresc.slice(0, m.index).split('\n').length;
      trafienia.push(`src/routes/AppRoutes.tsx:${nrLinii} — [${zawartosc.trim()}]`);
    }
    expect(trafienia).toEqual([]);
  });

  it('język odpowiedzi AI nie idzie za językiem TREŚCI wiadomości (PLAN §2.8/§5.3)', () => {
    // Decyzja CTO: język AI = język interfejsu. Wykryty język treści nie może
    // ani nadpisywać `chatLanguage`, ani utrwalać się na wątku — inaczej jeden
    // wklejony polski akapit przestawia konto EN na polski, na stałe.
    const tresc = fs.readFileSync(
      path.join(ROOT, 'src/components/AIChat/UnifiedChatPanel.tsx'),
      'utf8'
    );
    const kod = tresc
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n');
    expect(kod).not.toMatch(/detectMessageLanguage\s*\(/);
    expect(kod).not.toMatch(/setConversationChatLanguage\([^)]*detected/);
  });

  it('bootstrap i18n ma bramę języka — powłoka nie maluje się przed rozstrzygnięciem', () => {
    // Ta brama jest jedyną rzeczą, która trzyma polskie wartości domyślne
    // z kodu poza ekranem konta EN, dopóki `en/translation.json` (1,9 MB) jest
    // w drodze. Usunięcie jej cofa całą paczkę i nie widać tego w żadnym teście
    // komponentu — stąd asercja na samo wpięcie.
    const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    expect(app).toMatch(/useLanguageBootReady\(\)/);
    expect(app).toMatch(/isAuthInitializing \|\| !languageBootReady/);
  });
});
