/**
 * DOWÓD WIZUALNY paczki J-małe — 6 modułów (13 Organizacja, 08 Wyniki,
 * 12 Spotkania, 03 Wywiad, 11 Audyty, 06 Inicjatywy/07 Realizacja), EN i PL.
 *
 * Wzór: scripts/dev/jezyk-j7/zrzuty-j7.mjs (paczka J7b) — ten sam przyrząd,
 * te same wiadra UI/DANE, ten sam słownik neutralnych.
 *
 * Stanowisko: API 4200 / Vite 3218 / baza consultify_kopia_final.
 * Uruchomienie: node scripts/dev/jezyk-jmale/zrzuty-jmale.mjs przed|po [modul]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

import { ZAPYTANIA_DANE } from './dane-zapytania.mjs';

const FAZA = process.argv[2] === 'po' ? 'po' : 'przed';
const TYLKO = process.argv[3] || null;
const BASE = 'http://127.0.0.1:3218';
const KORZEN = path.resolve(process.cwd(), 'evidence/jezyk-jmale');

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

// --- wiadro DANE: wartości z bazy, nie z interfejsu -----------------------
const DANE = new Set();
for (const q of ZAPYTANIA_DANE) {
  try {
    for (const v of sql(q).split('\n')) {
      const s = v.trim();
      if (s) DANE.add(s.toLowerCase());
    }
  } catch { /* tabela może nie istnieć w tej bazie — pomijamy */ }
}
// Nazwy własne obiektów modułów — bez nich tytuły z bazy (nazwa karty wyników,
// zestawu OKR, analizy ROI) liczyłyby się jako polski INTERFEJS na ekranie EN.
const DANE_LISTA = [...DANE];
function czyDane(linia) {
  const l = linia.toLowerCase().trim();
  if (!l) return false;
  if (DANE.has(l)) return true;
  const ucieta = l.replace(/(\.\.\.|…)$/, '').trim();
  if (ucieta.length >= 8 && DANE_LISTA.some((d) => d.startsWith(ucieta))) return true;
  return DANE_LISTA.some((d) => d.length >= 12 && l.includes(d));
}

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const PL_SLOWA = new Set([
  'nie','tak','jest','są','brak','oraz','albo','lub','dla','przez','wszystkie','wszystkich','nowy','nowa','nowe',
  'zapisz','utwórz','utworz','zamknij','wybierz','sprawdź','sprawdz','pokaż','pokaz','dodaj','usuń','usun',
  'raport','raporty','poziom','okres','autor','stan','danych','ryzyka','ryzyko','decyzje','decyzja','zadanie','zadania',
  'osób','osob','popyt','podaż','podaz','obłożenie','oblozenie','zaległość','zaleglosc','tygodni','tygodnie',
  'wykonane','odrzucone','zrobione','trwa','ponownie','spróbuj','sprobuj','ładowanie','ladowanie','od',
  // 'mar' WYPADA z listy polskiej: to jednocześnie angielski skrót marca („Mar 18,
  // 2026"), więc na ekranie EN dawał 9 fałszywych trafień na samej liście spotkań.
  // Ta sama klasa błędu, którą J7b usunął po stronie EN_SLOWA ('jan'/'mar').
  'sty','lut','kwi','maj','cze','lip','sie','wrz','paź','paz','lis','gru',
  'założenie','zalozenie','zależność','zaleznosc','sygnały','sygnaly','sygnał','sygnal',
  'cele','cel','wyzwania','profil','profilu','organizacji','organizacja','tożsamość','tozsamosc','branża','branza',
  'wielkość','wielkosc','przychód','przychod','pracowników','pracownikow','kierunek','ograniczenia','mierniki',
  'zakres','współpracy','wspolpracy','dowody','przyczyny','blokery','szanse','scenariusze','gotowość','gotowosc',
  'wiedzy','graf','wyniki','wynik','spotkania','spotkanie','wywiad','wywiady','audyt','audyty','inicjatywy',
]);
const EN_SLOWA = new Set([
  'the','and','for','with','from','all','new','close','save','create','delete','edit','open','risk','risks',
  'decision','decisions','report','reports','level','period','author','task','tasks','people','demand',
  'supply','utilisation','utilization','backlog','week','weeks','overdue','blocked','signals','signal','none',
  'assumption','dependency','issue','of','as','no','yes','add','review','published','draft','done','pending',
  'feb','apr','jun','jul','aug','sep','oct','nov','dec',
  'identity','operating','model','organization','organisation','goals','metrics','challenges','evidence',
  'readiness','scope','collaboration','sources','claims','meetings','meeting','interview','audits','audit',
  'results','initiatives','execution','settings','search','filter','columns','preview','actions',
]);
const NEUTRALNE = new Set(['problem','model','mar','status','kpi','raid','sla','ok','pmo','roi','ai','okr','crm','erp','id','sso','mfa','api','pdf','csv','drd','b2b','b2c','pkd','vat','nip','ceo','cto','it','hr','esg']);

function liniePodejrzane(text, lang) {
  const wynik = { ui: [], dane: [] };
  for (const raw of text.split('\n')) {
    const linia = raw.trim();
    if (!linia) continue;
    const czysty = linia.replace(/https?:\/\/\S+/g, ' ');
    const slowa = czysty.split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/).filter(Boolean);
    let trafienia = [];
    if (lang === 'en') {
      for (const w of slowa) {
        const l = w.toLowerCase();
        if (NEUTRALNE.has(l)) continue;
        if (DIAKRYTYKI.test(w) || PL_SLOWA.has(l)) trafienia.push(w);
      }
    } else {
      if (DIAKRYTYKI.test(czysty)) continue;
      for (const w of slowa) {
        const l = w.toLowerCase();
        if (NEUTRALNE.has(l)) continue;
        if (EN_SLOWA.has(l)) trafienia.push(w);
      }
    }
    if (!trafienia.length) continue;
    const jestDanymi = czyDane(linia);
    (jestDanymi ? wynik.dane : wynik.ui).push({ linia, trafienia: [...new Set(trafienia)] });
  }
  return wynik;
}

// --- ekrany per moduł -----------------------------------------------------
const MODULY = {
  organizacja: [
    ['01-org-tozsamosc', '/organization'],
    ['02-org-cele', '/organization/goals'],
    ['03-org-wyzwania', '/organization/challenges'],
    ['04-org-strategia', '/organization/strategy'],
  ],
  wyniki: [
    ['01-wyniki-kpi', '/results/kpi'],
    ['02-wyniki-roi', '/results/roi'],
    ['03-wyniki-okr', '/results/okr'],
  ],
  spotkania: [
    ['01-spotkania-lista', '/meetings'],
  ],
  wywiad: [
    ['01-wywiad', '/interview'],
  ],
  audyty: [
    ['01-audyty', '/audit-programs'],
  ],
  resztki: [
    ['01-inicjatywy', '/initiatives'],
    ['02-realizacja', '/execution'],
  ],
};

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();
await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.locator('input[type="email"]').first().fill('audyt@dbr77.local');
await p.locator('input[type="password"]').first().fill('AudytDBR77!2026');
await p.locator('input[type="password"]').first().press('Enter');
await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const K = 'consultify-storage';
  const r = localStorage.getItem(K);
  const o = r ? JSON.parse(r) : { state: {}, version: 0 };
  o.state = { ...(o.state || {}), theme: 'light' };
  localStorage.setItem(K, JSON.stringify(o));
});

const podsumowanie = {};
for (const [modul, ekrany] of Object.entries(MODULY)) {
  if (TYLKO && TYLKO !== modul) continue;
  const OUT = path.join(KORZEN, modul, FAZA);
  fs.mkdirSync(OUT, { recursive: true });
  podsumowanie[modul] = { en: 0, pl: 0, ekrany: {} };
  for (const lang of ['en', 'pl']) {
    sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`);
    await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
    for (const [nazwa, trasa] of ekrany) {
      await p.goto(`${BASE}${trasa}`, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(2600);
      const text = await p.evaluate(() => document.body.innerText);
      const plik = path.join(OUT, `${nazwa}-${lang}.png`);
      await p.screenshot({ path: plik });
      const w = liniePodejrzane(text, lang);
      const meta = {
        ekran: nazwa, jezyk: lang, url: p.url(),
        obcychSlowUI: w.ui.reduce((a, x) => a + x.trafienia.length, 0),
        obcychLiniiUI: w.ui.length,
        ui: w.ui,
        dane: w.dane.slice(0, 40),
      };
      fs.writeFileSync(`${plik}.json`, JSON.stringify(meta, null, 1));
      podsumowanie[modul][lang] += meta.obcychSlowUI;
      podsumowanie[modul].ekrany[`${nazwa}-${lang}`] = meta.obcychSlowUI;
      console.log(`${modul}/${nazwa}-${lang}: obce slowa UI=${meta.obcychSlowUI} (linii ${meta.obcychLiniiUI}), DANE=${w.dane.length}`);
    }
  }
  fs.writeFileSync(path.join(OUT, '_podsumowanie.json'), JSON.stringify(podsumowanie[modul], null, 1));
}
sql(`UPDATE users SET language='pl' WHERE email='audyt@dbr77.local'`);
console.log(JSON.stringify(podsumowanie, null, 1));
await b.close();
