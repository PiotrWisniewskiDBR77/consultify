#!/usr/bin/env node
/**
 * SPRAWDZ-ZRODLA — bramka przeciw dokumentom-widmom.
 *
 * Problem, ktory rozwiazuje (2026-07-21):
 * skill `consultify-artefakty` kazal kazdemu agentowi czytac przed praca TRZY dokumenty
 * opisane jako SSOT wzorca N. Zaden z nich nigdy nie powstal — brak commita dodania
 * w calej historii repo. Ta sama pulapka: raport MVP, raporty czastkowe z PRV-008.
 *
 * Skutek: agent czyta instrukcje, nie znajduje zrodla, zgaduje — i buduje na zgadywaniu.
 *
 * Ten skrypt czyta wszystkie pliki instruktazowe (CLAUDE.md, skille, kanony) i sprawdza,
 * czy KAZDY cytowany plik faktycznie istnieje na dysku. Jesli nie — konczy sie bledem.
 *
 *   node scripts/sprawdz-zrodla.mjs          # raport
 *   node scripts/sprawdz-zrodla.mjs --cicho  # tylko bledy (do hooka/CI)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CICHO = process.argv.includes('--cicho');

/** Pliki, ktore instruuja agentow — ich cytaty musza byc prawdziwe. */
function zbierzInstrukcje() {
  const out = [];
  const dodaj = (p) => existsSync(join(KORZEN, p)) && out.push(p);

  dodaj('CLAUDE.md');

  const skille = join(KORZEN, '.claude/skills');
  if (existsSync(skille)) {
    for (const d of readdirSync(skille)) {
      const p = `.claude/skills/${d}/SKILL.md`;
      if (existsSync(join(KORZEN, p))) out.push(p);
    }
  }

  // kanony UI — one tez odsylaja do siebie nawzajem
  const kanony = 'docs/ui-standards';
  if (existsSync(join(KORZEN, kanony))) {
    const chodz = (rel) => {
      for (const e of readdirSync(join(KORZEN, rel))) {
        const r = `${rel}/${e}`;
        const s = statSync(join(KORZEN, r));
        if (s.isDirectory()) chodz(r);
        else if (e.endsWith('.md')) out.push(r);
      }
    };
    chodz(kanony);
  }
  return out;
}

/**
 * Wyciaga sciezki-kandydatow z tekstu. Bierzemy tylko rzeczy, ktore WYGLADAJA
 * jak sciezka do pliku w repo — zeby nie zglaszac falszywych alarmow na prozie.
 */
function wyciagnijSciezki(tekst) {
  const kand = new Set();
  const dodaj = (s) => {
    if (!s) return;
    s = s.trim().replace(/[)\]},.;:]+$/, '').replace(/^[('"`]+/, '');
    if (!s || s.includes(' ') || s.includes('\n')) return;
    if (/^https?:\/\//.test(s)) return;
    // wzorce, nie sciezki: `*DetailView.tsx`, `{Section}Canvas.tsx`, `src/**/x.ts`
    if (/[*{}<>?]/.test(s)) return;
    // urwane fragmenty prozy: `.md`, `2.md`, `.ts/.tsx` — nazwa musi miec rdzen >=3 znaki
    const rdzen = s.split('/').pop().replace(/\.[a-z]+$/i, '');
    if (rdzen.length < 3) return;
    if (!/\.(md|ts|tsx|js|mjs|sh|json|css|sql)$/.test(s)) return;
    if (s.startsWith('@/') || s.startsWith('./') === false && s.startsWith('/')) return;
    kand.add(s.replace(/^\.\//, ''));
  };

  // `sciezka/plik.md`
  for (const m of tekst.matchAll(/`([^`\n]+?)`/g)) dodaj(m[1]);
  // [tekst](sciezka)
  for (const m of tekst.matchAll(/\]\(([^)\n]+?)\)/g)) dodaj(m[1]);
  return [...kand];
}

/** Plik moze byc cytowany bez pelnej sciezki — szukamy po nazwie w repo. */
// UWAGA: worktree innych galezi MUSZA byc pominiete — inaczej plik zyjacy tylko na obcej
// galezi liczy sie jako 'istnieje', a agent pracujacy na origin/demo go nie zobaczy.
const POMIN_KATALOGI = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.worktrees', 'worktrees',
]);
let indeksNazw = null;
function zbudujIndeks() {
  const map = new Map();
  const chodz = (rel) => {
    let wpisy;
    try { wpisy = readdirSync(join(KORZEN, rel || '.'), { withFileTypes: true }); }
    catch { return; }
    for (const e of wpisy) {
      if (e.name.startsWith('.') && e.name !== '.claude') continue;
      if (POMIN_KATALOGI.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) chodz(r);
      else {
        if (!map.has(e.name)) map.set(e.name, []);
        map.get(e.name).push(r);
      }
    }
  };
  chodz('');
  return map;
}

function istnieje(sciezka) {
  if (existsSync(join(KORZEN, sciezka))) return true;
  indeksNazw ??= zbudujIndeks();
  const nazwa = sciezka.split('/').pop();
  const trafienia = indeksNazw.get(nazwa);
  if (!trafienia?.length) return false;
  // cytat bez pelnej sciezki jest OK, jesli plik o tej nazwie istnieje gdziekolwiek
  return true;
}

// ── bieg ──────────────────────────────────────────────────────────────────────
const instrukcje = zbierzInstrukcje();
const widma = [];
let zbadanych = 0;

for (const plik of instrukcje) {
  const tekst = readFileSync(join(KORZEN, plik), 'utf8');
  for (const s of wyciagnijSciezki(tekst)) {
    zbadanych++;
    if (!istnieje(s)) widma.push({ plik, cytat: s });
  }
}

if (!CICHO) {
  console.log(`Plikow instruktazowych: ${instrukcje.length}`);
  console.log(`Sprawdzonych odwolan:  ${zbadanych}`);
}

if (widma.length) {
  const wg = {};
  for (const w of widma) (wg[w.plik] ??= []).push(w.cytat);
  console.error(`\n❌ DOKUMENTY-WIDMA — cytowane, ale nie istnieja (${widma.length}):\n`);
  for (const [plik, cytaty] of Object.entries(wg)) {
    console.error(`  ${plik}`);
    for (const c of [...new Set(cytaty)]) console.error(`      → ${c}`);
  }
  console.error(
    '\nNapraw jedna z dwoch drog: (a) napisz brakujacy dokument, ' +
    '(b) usun odwolanie z instrukcji.\nInstrukcja odsylajaca w prozne jest gorsza niz jej brak — ' +
    'agent zgaduje zamiast czytac.\n'
  );
  process.exit(1);
}

if (!CICHO) console.log('\n✅ Wszystkie cytowane zrodla istnieja.');
