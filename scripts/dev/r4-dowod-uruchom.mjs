// R4 — dowod: powtorz wariant (b) z nowa flaga --cofnij-jesli-skraca=1 TYLKO
// dla ekranow ze slepa plama znalezionych w R1.
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
const SLEPE_PLAMY = arg('slepe-plamy', '');
if (!WYJSCIE || !SLEPE_PLAMY) { console.error('Podaj --wyjscie i --slepe-plamy'); process.exit(2); }

const EKRANY_META = JSON.parse(fs.readFileSync(path.join(__dirname, 'g06-macierz-ekrany.json'), 'utf8'));
const PARAMETRY = EKRANY_META._parametry || {};
const wpisy = JSON.parse(fs.readFileSync(SLEPE_PLAMY, 'utf8'));

const poModule = new Map();
for (const w of wpisy) {
  if (!poModule.has(w.mod)) poModule.set(w.mod, []);
  poModule.get(w.mod).push(w.ekran);
}

fs.mkdirSync(WYJSCIE, { recursive: true });
const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(WYJSCIE, 'przebieg-r4.log'), l + '\n'); };

for (const [mod, ekrany] of poModule) {
  const grupy = new Map();
  for (const ekran of ekrany) {
    const p = PARAMETRY[ekran] || '';
    if (!grupy.has(p)) grupy.set(p, []);
    grupy.get(p).push(ekran);
  }
  let idx = 0;
  for (const [params, listaEkranow] of grupy) {
    idx += 1;
    const sufiks = params ? `-g${idx}` : '';
    const katalog = path.join(WYJSCIE, mod);
    fs.mkdirSync(katalog, { recursive: true });
    const wynik = path.join(katalog, `wynik-c-naprawione${sufiks}.json`);
    const args = [
      path.join(REPO, 'scripts/dev/grafika-zrzuty.mjs'),
      `--base=${BASE}`,
      `--ekrany=${listaEkranow.join(',')}`,
      `--katalog=${mod.toLowerCase()}-c-naprawione${sufiks}`,
      '--faza=PO', '--jezyk=pl', '--szerokosc=1440', '--motywy=light', '--a11y=1',
      '--rozwin-sekcje=1', '--klik-po-rozwinieciu=1', '--osiad-po-rozwinieciu=1500',
      '--cofnij-jesli-skraca=1',
      `--wyjscie=${katalog}`, `--wynik-json=${wynik}`,
    ];
    if (params) args.push(`--parametry=${params}`);
    log(`${mod}${sufiks}: start, ${listaEkranow.length} ekranow (${listaEkranow.join(',')})`);
    const t0 = Date.now();
    const r = spawnSync('node', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 10 * 60 * 1000 });
    fs.writeFileSync(path.join(katalog, `log-c${sufiks}.txt`), (r.stdout || '') + '\n--STDERR--\n' + (r.stderr || ''));
    log(`${mod}${sufiks}: koniec po ${Math.round((Date.now()-t0)/1000)}s exit=${r.status} wynik ${fs.existsSync(wynik)?'JEST':'BRAK'}`);
  }
}
log('R4 GOTOWE');
