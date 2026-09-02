/**
 * TOR GRAFIKA — które ekrany rejestru dotknęła dzisiejsza zmiana kodu (2026-09-02).
 *
 * POWÓD POWSTANIA. Właściciel 02.09: „ustaw status »poprawione« tam, gdzie były
 * wprowadzane zmiany, jakiekolwiek". Ręczne mapowanie kosztowało tego dnia trzy
 * pomyłki, bo wołacze bywają schowane za `lazy(() => import(...))` i za aliasami
 * — grep po „<Nazwa" ich nie widzi (ta sama ślepota, którą miała bramka parytetu).
 *
 * CO ROBI. Dla każdego ekranu z docs/program/grafika/status.json:
 *   1. znajduje jego wejście w dev-render (rejestr SCREENS w main.tsx albo własny .html),
 *   2. przechodzi PRZECHODNIO graf importów aż do plików `src/`,
 *   3. sprawdza przecięcie z listą plików zmienionych dziś,
 *   4. osobno mapuje ZMIENIONE KLUCZE i18n — słownik dotyka ekranu tylko wtedy,
 *      gdy któryś plik z jego grafu naprawdę używa zmienionego klucza.
 *
 * Użycie:
 *   node scripts/dev/grafika-dotkniete.mjs --pliki=<lista.txt> --klucze=<lista.txt> [--json=<out>]
 */
import fs from 'fs';
import path from 'path';

const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};
const ROOT = process.cwd();
const czytaj = (p) => fs.readFileSync(p, 'utf8');

const zmienione = new Set(
  czytaj(arg('pliki')).split('\n').map((s) => s.trim()).filter((s) => s && s.startsWith('src/'))
);
const klucze = arg('klucze')
  ? czytaj(arg('klucze')).split('\n').map((s) => s.trim()).filter(Boolean)
  : [];

/* ---------- 1. rejestr ekranów dev-render ---------- */
const main = czytaj('dev-render/main.tsx');
// alias -> ścieżka modułu (lazy albo zwykły import)
const alias2mod = new Map();
for (const m of main.matchAll(
  /const\s+(\w+)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g
)) alias2mod.set(m[1], m[2]);
for (const m of main.matchAll(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm)) alias2mod.set(m[1], m[2]);

// screenId -> alias  (blok `'id': { ... render: () => <Alias ... /> }`)
const id2alias = new Map();
for (const m of main.matchAll(/'([a-z0-9][a-z0-9-]*)':\s*\{([\s\S]{0,900}?)\n\s*\},/g)) {
  const [, id, ciało] = m;
  const r = ciało.match(/render:\s*\(\)\s*=>\s*(?:\([\s\S]{0,200}?)?<(\w+)/);
  if (r) id2alias.set(id, r[1]);
}

/* ---------- 2. rozwiązywanie importów ---------- */
const ROZSZ = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js'];
const istnieje = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
const rozwiaz = (spec, zPliku) => {
  if (!spec.startsWith('.') && !spec.startsWith('@/') && !spec.startsWith('src/')) return null;
  let baza;
  if (spec.startsWith('@/')) baza = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('src/')) baza = path.join(ROOT, spec);
  else baza = path.resolve(path.dirname(zPliku), spec);
  if (istnieje(baza) && /\.[jt]sx?$/.test(baza)) return baza;
  for (const r of ROZSZ) if (istnieje(baza + r)) return baza + r;
  return null;
};

const cacheTresc = new Map();
const tresc = (p) => {
  if (!cacheTresc.has(p)) cacheTresc.set(p, istnieje(p) ? czytaj(p) : '');
  return cacheTresc.get(p);
};
const cacheGraf = new Map();
/** Wszystkie pliki osiągalne z `wejscie` przez importy (statyczne + dynamiczne). */
const graf = (wejscie) => {
  if (cacheGraf.has(wejscie)) return cacheGraf.get(wejscie);
  const widziane = new Set();
  const kolejka = [wejscie];
  while (kolejka.length) {
    const p = kolejka.pop();
    if (!p || widziane.has(p)) continue;
    widziane.add(p);
    const s = tresc(p);
    if (!s) continue;
    const spece = new Set();
    for (const m of s.matchAll(/from\s*['"]([^'"]+)['"]/g)) spece.add(m[1]);
    for (const m of s.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) spece.add(m[1]);
    for (const m of s.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) spece.add(m[1]);
    for (const sp of spece) {
      const r = rozwiaz(sp, p);
      if (r && !widziane.has(r)) kolejka.push(r);
    }
  }
  cacheGraf.set(wejscie, widziane);
  return widziane;
};

/* ---------- 3. pliki .html z własnym punktem wejścia ---------- */
const htmlWejscia = new Map();
for (const f of fs.readdirSync('dev-render').filter((f) => f.endsWith('.html'))) {
  const s = czytaj(path.join('dev-render', f));
  const m = s.match(/<script[^>]+src=["']\.?\/?([^"']+\.tsx?)["']/);
  if (m) htmlWejscia.set(f.replace(/\.html$/, ''), path.join(ROOT, 'dev-render', m[1]));
}

/* ---------- 4. które pliki src używają zmienionego klucza ---------- */
const plikiSrc = [];
(function chodz(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') chodz(p); }
    else if (/\.[jt]sx?$/.test(e.name)) plikiSrc.push(p);
  }
})(path.join(ROOT, 'src'));

// klucz -> pliki, które go wołają. Szukamy dosłownego ciągu klucza ORAZ ogona
// po ostatniej kropce w sąsiedztwie prefiksu (t('a.b', ...) i useTranslation('a')).
const plikDoKluczy = new Map();
for (const p of plikiSrc) {
  const s = tresc(p);
  const trafione = klucze.filter((k) => s.includes(k) || s.includes(k.replace(/_(one|few|many|other)$/, '')));
  if (trafione.length) plikDoKluczy.set(p, trafione);
}

/* ---------- 5. przejście po rejestrze ---------- */
const status = JSON.parse(czytaj('docs/program/grafika/status.json'));
const wynik = [];
let bezWejscia = 0;
for (const m of status.moduly) {
  for (const e of m.ekrany) {
    let wejscie = null;
    const alias = id2alias.get(e.id);
    if (alias && alias2mod.has(alias)) wejscie = rozwiaz(alias2mod.get(alias), path.join(ROOT, 'dev-render/main.tsx'));
    if (!wejscie && htmlWejscia.has(e.id)) wejscie = htmlWejscia.get(e.id);
    if (!wejscie) { bezWejscia++; wynik.push({ ...e, modul: m.nazwa, katalog: m.katalog, wejscie: null, pliki: [], kluczePlikow: [] }); continue; }
    const g = graf(wejscie);
    const wzgl = [...g].map((p) => path.relative(ROOT, p));
    const dotkniete = wzgl.filter((p) => zmienione.has(p));
    const kluczoweTrafienia = [];
    for (const p of g) if (plikDoKluczy.has(p)) kluczoweTrafienia.push({ plik: path.relative(ROOT, p), klucze: plikDoKluczy.get(p) });
    wynik.push({
      id: e.id, nazwa: e.nazwa, ocena: e.ocena, modul: m.nazwa, katalog: m.katalog,
      wejscie: path.relative(ROOT, wejscie), pliki: dotkniete, kluczePlikow: kluczoweTrafienia,
    });
  }
}

const dotkniete = wynik.filter((w) => w.pliki.length || w.kluczePlikow.length);
console.log(`ekranów w rejestrze:            ${wynik.length}`);
console.log(`bez wejścia w dev-render:       ${bezWejscia}`);
console.log(`DOTKNIĘTYCH dzisiejszą zmianą:  ${dotkniete.length}`);
console.log(`  — przez zmieniony plik kodu:  ${wynik.filter((w) => w.pliki.length).length}`);
console.log(`  — tylko przez klucz słownika: ${wynik.filter((w) => !w.pliki.length && w.kluczePlikow.length).length}`);
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(wynik, null, 1));
