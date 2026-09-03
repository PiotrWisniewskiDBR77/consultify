// G06 — pełna macierz 8 kadrów (PL/EN × jasny/ciemny × 1440/1024) per moduł,
// po scaleniu napraw dostępności (agent/fix-a11y-01-04, agent/fix-a11y-09-12).
//
// Orkiestruje KANONICZNE narzędzie scripts/dev/grafika-zrzuty.mjs (nie pisze
// własnego zrzutu): dla każdego modułu i każdej pary (język, szerokość) jeden
// przebieg z --motywy=light,dark --rozwin-sekcje=1 --a11y=1 (domyślny klik w
// pierwszy wiersz zostaje włączony — bez niego skan przepuszcza naruszenia
// widoczne dopiero po otwarciu podglądu, patrz commit 39dd82d301).
//
// Użycie:
//   node scripts/dev/g06-macierz-uruchom.mjs --moduly=01_ORGANIZATION,02_INTERVIEW \
//        --wyjscie=/private/tmp/g06-macierz-20260903-artefakty [--base=http://127.0.0.1:3020]
//
// Wynik: <wyjscie>/<MOD>/<jezyk>-<szerokosc>/wynik[-<grupa>].json + PNG.
// Agregacja: scripts/dev/g06-macierz-agreguj.mjs
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
const MODULY = arg('moduly', '').split(',').map((s) => s.trim()).filter(Boolean);
const WYJSCIE = arg('wyjscie', '');
const BASE = arg('base', 'http://127.0.0.1:3020');
if (!MODULY.length || !WYJSCIE) {
  console.error('Podaj --moduly=... i --wyjscie=...');
  process.exit(2);
}

const EKRANY = JSON.parse(fs.readFileSync(path.join(__dirname, 'g06-macierz-ekrany.json'), 'utf8'));
// Ekrany, które bez dodatkowych parametrów adresu renderują INNĄ powierzchnię
// niż odbierana (harness mówi to wprost w etykiecie ekranu w dev-render/main.tsx).
const PARAMETRY = EKRANY._parametry || {};

const KOMBINACJE = [
  ['pl', 1440],
  ['pl', 1024],
  ['en', 1440],
  ['en', 1024],
];

const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`;
  console.log(line);
  fs.appendFileSync(path.join(WYJSCIE, 'przebieg.log'), line + '\n');
};
fs.mkdirSync(WYJSCIE, { recursive: true });

for (const mod of MODULY) {
  const lista = EKRANY[mod];
  if (!lista) {
    log(`★ BRAK listy ekranów dla ${mod} — pomijam`);
    continue;
  }
  // Grupuj po parametrach: domyślna grupa + po jednej na każdy zestaw parametrów.
  const grupy = new Map();
  for (const ekran of lista) {
    const p = PARAMETRY[ekran] || '';
    if (!grupy.has(p)) grupy.set(p, []);
    grupy.get(p).push(ekran);
  }
  for (const [jezyk, szerokosc] of KOMBINACJE) {
    const katalog = path.join(WYJSCIE, mod, `${jezyk}-${szerokosc}`);
    fs.mkdirSync(katalog, { recursive: true });
    let idx = 0;
    for (const [params, ekrany] of grupy) {
      idx += 1;
      const sufiks = params ? `-g${idx}` : '';
      const wynik = path.join(katalog, `wynik${sufiks}.json`);
      if (fs.existsSync(wynik)) {
        log(`${mod} ${jezyk}-${szerokosc}${sufiks}: wynik już jest — pomijam (usuń plik, by przemierzyć)`);
        continue;
      }
      const args = [
        path.join(REPO, 'scripts/dev/grafika-zrzuty.mjs'),
        `--base=${BASE}`,
        `--ekrany=${ekrany.join(',')}`,
        `--katalog=${mod.toLowerCase()}-${jezyk}-${szerokosc}${sufiks}`,
        '--faza=PO',
        `--jezyk=${jezyk}`,
        `--szerokosc=${szerokosc}`,
        '--motywy=light,dark',
        '--rozwin-sekcje=1',
        '--a11y=1',
        // 03.09: osiadanie po rozwinięciu sekcji — bez tego fade-in framer-motion (AnimatedBlock)
        // daje fałszywy color-contrast (zmierzone: deck-artifact 4 węzły → 0 przy 1500 ms).
        '--osiad-po-rozwinieciu=1500',
        // 03.09: po rozwinięciu sekcji klik w wiersz ponownie — bez tego skan leci bez podglądu
        // (zmierzone: execution-tab-list tekst 1018 → 648, naruszenie w podglądzie znikało).
        '--klik-po-rozwinieciu=1',
        `--wyjscie=${katalog}`,
        `--wynik-json=${wynik}`,
      ];
      if (params) args.push(`--parametry=${params}`);
      log(`${mod} ${jezyk}-${szerokosc}${sufiks}: start, ${ekrany.length} ekranów${params ? ` (parametry: ${params})` : ''}`);
      const t0 = Date.now();
      const r = spawnSync('node', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      fs.writeFileSync(path.join(katalog, `log${sufiks}.txt`), (r.stdout || '') + '\n--- STDERR ---\n' + (r.stderr || ''));
      const ok = fs.existsSync(wynik);
      log(`${mod} ${jezyk}-${szerokosc}${sufiks}: koniec po ${Math.round((Date.now() - t0) / 1000)}s, exit=${r.status}, wynik.json ${ok ? 'JEST' : '★ BRAK'}`);
    }
  }
}
log(`GOTOWE: ${MODULY.join(', ')}`);
