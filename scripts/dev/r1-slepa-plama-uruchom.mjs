// R1 — pomiar rodziny „ślepa plama rozwijania" (dyżur agent/slepa-plama-20260903).
// Dla KAŻDEGO modułu z g06-macierz-ekrany.json dwa przebiegi kanonicznego
// scripts/dev/grafika-zrzuty.mjs, oba pl/light/1440/a11y=1:
//   (a) BEZ --rozwin-sekcje
//   (b) Z --rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500
// Batchuje WSZYSTKIE ekrany modułu w jednym wywołaniu narzędzia (respektując
// grupy _parametry), tak jak g06-macierz-uruchom.mjs — nie odpala nowego
// procesu/przeglądarki per ekran.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const WYJSCIE = arg('wyjscie', '');
const BASE = arg('base', 'http://127.0.0.1:5410');
const MODULY_ARG = arg('moduly', '');
if (!WYJSCIE) { console.error('Podaj --wyjscie=...'); process.exit(2); }

const EKRANY = JSON.parse(fs.readFileSync(path.join(__dirname, 'g06-macierz-ekrany.json'), 'utf8'));
const PARAMETRY = EKRANY._parametry || {};
const MODULY = MODULY_ARG ? MODULY_ARG.split(',').map((s) => s.trim()) : Object.keys(EKRANY).filter((k) => !k.startsWith('_'));

const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  fs.appendFileSync(path.join(WYJSCIE, 'przebieg-r1.log'), line + '\n');
};
fs.mkdirSync(WYJSCIE, { recursive: true });

for (const mod of MODULY) {
  const lista = EKRANY[mod];
  if (!lista) { log(`★ BRAK listy ekranów dla ${mod} — pomijam`); continue; }
  const grupy = new Map();
  for (const ekran of lista) {
    const p = PARAMETRY[ekran] || '';
    if (!grupy.has(p)) grupy.set(p, []);
    grupy.get(p).push(ekran);
  }
  const katalog = path.join(WYJSCIE, mod);
  fs.mkdirSync(katalog, { recursive: true });

  let idx = 0;
  for (const [params, ekrany] of grupy) {
    idx += 1;
    const sufiks = params ? `-g${idx}` : '';

    for (const [wariant, dodatkoweArgs] of [
      ['a-bez-rozwin', []],
      ['b-z-rozwin', ['--rozwin-sekcje=1', '--klik-po-rozwinieciu=1', '--osiad-po-rozwinieciu=1500']],
    ]) {
      const wynik = path.join(katalog, `wynik-${wariant}${sufiks}.json`);
      if (fs.existsSync(wynik)) {
        log(`${mod}${sufiks} ${wariant}: wynik już jest — pomijam`);
        continue;
      }
      const args = [
        path.join(REPO, 'scripts/dev/grafika-zrzuty.mjs'),
        `--base=${BASE}`,
        `--ekrany=${ekrany.join(',')}`,
        `--katalog=${mod.toLowerCase()}-${wariant}${sufiks}`,
        '--faza=PO',
        '--jezyk=pl',
        '--szerokosc=1440',
        '--motywy=light',
        '--a11y=1',
        ...dodatkoweArgs,
        `--wyjscie=${katalog}`,
        `--wynik-json=${wynik}`,
      ];
      if (params) args.push(`--parametry=${params}`);
      log(`${mod}${sufiks} ${wariant}: start, ${ekrany.length} ekranów${params ? ` (parametry: ${params})` : ''}`);
      const t0 = Date.now();
      const r = spawnSync('node', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 20 * 60 * 1000 });
      fs.writeFileSync(path.join(katalog, `log-${wariant}${sufiks}.txt`), (r.stdout || '') + '\n--- STDERR ---\n' + (r.stderr || ''));
      const ok = fs.existsSync(wynik);
      log(`${mod}${sufiks} ${wariant}: koniec po ${Math.round((Date.now() - t0) / 1000)}s, exit=${r.status}, wynik.json ${ok ? 'JEST' : '★ BRAK'}`);
    }
  }
}
log(`GOTOWE: ${MODULY.join(', ')}`);
