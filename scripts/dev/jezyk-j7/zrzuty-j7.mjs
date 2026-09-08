/**
 * DOWÓD WIZUALNY paczki J7/J7b — moduł 07 Realizacja, EN i PL.
 *
 * Wzór: scripts/dev/przejscie-cto-0809/weryfikacja-lista-j6b.mjs (paczka J6b).
 * Stanowisko: API 4189 / Vite 3209 / baza consultify_kopia_final.
 *
 * Uruchomienie:
 *   node scripts/dev/jezyk-j7/zrzuty-j7.mjs przed|po
 *
 * Dla każdego ekranu zapisuje <nazwa>-<lang>.png oraz <nazwa>-<lang>.png.json
 * z licznikiem słów obcego języka w `main`.innerText. Wiersze, których treść
 * pokrywa się z wartościami z bazy (tytuły inicjatyw/zadań/decyzji/RAID,
 * nazwiska), trafiają do osobnego wiadra DANE i NIE liczą się jako UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const FAZA = process.argv[2] === 'po' ? 'po' : 'przed';
const BASE = 'http://127.0.0.1:3209';
const OUT = path.resolve(process.cwd(), 'evidence/jezyk-j7', FAZA);
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

// --- wiadro DANE: wartości pochodzące z bazy, nie z interfejsu -------------
const DANE = new Set();
for (const q of [
  'select title from initiatives',
  'select name from initiatives',
  'select description from initiatives',
  'select title from tasks',
  'select description from tasks',
  'select title from decisions',
  'select title from raid_items',
  'select description from raid_items',
  // Rejestr realizacji jest zdarzeniowy: tytuły inicjatyw/zadań/decyzji
  // widoczne w module siedzą w payloadzie agregatu, nie w kolumnach.
  "select distinct trim(both '\"' from v) from (select jsonb_path_query(payload_json::jsonb, 'strict $.**.title')::text v from ie_aggregate_state union all select jsonb_path_query(payload_json::jsonb, 'strict $.**.name')::text from ie_aggregate_state) s",
  "select coalesce(display_name, first_name || ' ' || last_name) from users",
  'select first_name from users',
  'select last_name from users',
]) {
  for (const v of sql(q).split('\n')) {
    const s = v.trim();
    if (s) DANE.add(s.toLowerCase());
  }
}


const DANE_LISTA = [...DANE];
/**
 * Linia pochodzi z DANYCH (nie z interfejsu), gdy pokrywa się z wartością
 * z bazy. Komórki tabeli bywają ucięte wielokropkiem, więc porównujemy też
 * prefiks — inaczej „Naprawa krytycznego błędu produk…" liczyłaby się jako
 * polski napis interfejsu.
 */
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
  'sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','paz','lis','gru',
  'problem','założenie','zalozenie','zależność','zaleznosc','sygnały','sygnaly','sygnał','sygnal',
]);
const EN_SLOWA = new Set([
  'the','and','for','with','from','all','new','close','save','create','delete','edit','open','risk','risks',
  'decision','decisions','report','reports','level','period','author','status','task','tasks','people','demand',
  'supply','utilisation','utilization','backlog','week','weeks','overdue','blocked','signals','signal','none',
  'assumption','dependency','issue','of','as','no','yes','add','review','published','draft','done','pending',
  'jan','feb','mar','apr','jun','jul','aug','sep','oct','nov','dec',
]);

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
        if (DIAKRYTYKI.test(w) || PL_SLOWA.has(l)) trafienia.push(w);
      }
    } else {
      if (DIAKRYTYKI.test(czysty)) continue; // linia z polskimi znakami = polska
      for (const w of slowa) {
        const l = w.toLowerCase();
        if (EN_SLOWA.has(l)) trafienia.push(w);
      }
    }
    if (!trafienia.length) continue;
    const jestDanymi = czyDane(linia);
    (jestDanymi ? wynik.dane : wynik.ui).push({ linia, trafienia: [...new Set(trafienia)] });
  }
  return wynik;
}

async function ustawJezyk(p, lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`);
  await p.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
}

async function zrzut(p, nazwa, lang) {
  await p.waitForTimeout(2000);
  // Cały dokument: pasek modułu + tabela + PODGLĄD (aside) + modale.
  const text = await p.evaluate(() => document.body.innerText);
  const plik = path.join(OUT, `${nazwa}-${lang}.png`);
  await p.screenshot({ path: plik });
  const w = liniePodejrzane(text, lang);
  const meta = {
    ekran: nazwa,
    jezyk: lang,
    url: p.url(),
    obcychSlowUI: w.ui.reduce((a, x) => a + x.trafienia.length, 0),
    obcychLiniiUI: w.ui.length,
    ui: w.ui,
    dane: w.dane.slice(0, 40),
  };
  fs.writeFileSync(`${plik}.json`, JSON.stringify(meta, null, 1));
  console.log(
    `${nazwa}-${lang}: obce slowa UI=${meta.obcychSlowUI} (linii ${meta.obcychLiniiUI}), DANE=${w.dane.length}`
  );
  return meta;
}

const re = (pl, en) => new RegExp(`^\\s*(${pl}|${en})\\s*$`, 'i');

async function klik(p, locator, opis) {
  try {
    const el = locator.first();
    await el.waitFor({ state: 'visible', timeout: 6000 });
    await el.click({ force: true });
    await p.waitForTimeout(1200);
    return true;
  } catch {
    console.log(`  ! nie kliknięto: ${opis}`);
    return false;
  }
}

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();
await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.locator('input[type="email"]').first().fill('audyt@dbr77.local');
await p.locator('input[type="password"]').first().fill('AudytDBR77!2026');
await p.locator('input[type="password"]').first().press('Enter');
await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const K = 'consultify-storage';
  const r = localStorage.getItem(K);
  const o = r ? JSON.parse(r) : { state: {}, version: 0 };
  o.state = { ...(o.state || {}), theme: 'light' };
  localStorage.setItem(K, JSON.stringify(o));
});

const FF = 'ff_summaryOneLook=1&ff_execReportsIntel=1';
const idz = async (qs) => {
  await p.goto(`${BASE}/execution?${qs}&${FF}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
};
const pierwszyWiersz = () => p.locator('main table tbody tr').first().locator('td').first();

const raport = [];
for (const lang of ['en', 'pl']) {
  await ustawJezyk(p, lang);

  // 1. Kokpit
  await idz('tab=summary');
  raport.push(await zrzut(p, '01-kokpit', lang));

  // 2. Realizacje — lista
  await idz('tab=list');
  await p.waitForSelector('main table tbody tr', { timeout: 30000 }).catch(() => {});
  raport.push(await zrzut(p, '02-realizacje-lista', lang));

  // 3. Realizacje — podgląd + panel „Zarządzanie"
  await klik(p, pierwszyWiersz(), 'wiersz realizacji');
  await klik(
    p,
    p.locator('button, [role=button]').filter({ hasText: re('Zarządzanie', 'Management') }),
    'panel Zarządzanie'
  );
  raport.push(await zrzut(p, '03-realizacje-podglad', lang));

  // 4. Praca — tabela
  await idz('tab=work');
  await p.waitForSelector('main table tbody tr', { timeout: 30000 }).catch(() => {});
  raport.push(await zrzut(p, '04-praca-tabela', lang));

  // 5. Praca — podgląd
  await klik(p, pierwszyWiersz(), 'wiersz pracy');
  raport.push(await zrzut(p, '05-praca-podglad', lang));

  // 6. Praca — formularz „Nowe zadanie"
  await idz('tab=work');
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Nowe zadanie', 'New task') }),
    'Nowe zadanie'
  );
  raport.push(await zrzut(p, '06-praca-nowe-zadanie', lang));

  // 7. Zasoby — tabela
  await idz('tab=resources');
  await p.waitForSelector('main table tbody tr', { timeout: 30000 }).catch(() => {});
  raport.push(await zrzut(p, '07-zasoby-tabela', lang));

  // 8. Zasoby — podgląd osoby
  await klik(p, pierwszyWiersz(), 'wiersz zasobu');
  raport.push(await zrzut(p, '08-zasoby-podglad', lang));

  // 9. Decyzje — lista
  await idz('tab=control');
  await p.waitForSelector('main table tbody tr', { timeout: 30000 }).catch(() => {});
  raport.push(await zrzut(p, '09-decyzje-lista', lang));

  // 10. Decyzje — „Nowa decyzja"
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Nowa decyzja', 'New decision') }),
    'Nowa decyzja'
  );
  raport.push(await zrzut(p, '10-decyzje-nowa', lang));

  // 11. Ryzyka — lista (chip Menu 3)
  await idz('tab=control');
  await klik(p, p.locator('main button').filter({ hasText: /^\s*(Ryzyka|Risks)\s*\d*\s*$/i }), 'chip Ryzyka');
  raport.push(await zrzut(p, '11-ryzyka-lista', lang));

  // 12. Ryzyka — „Nowa pozycja RAID"
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Nowa pozycja RAID', 'New RAID item') }),
    'Nowa pozycja RAID'
  );
  raport.push(await zrzut(p, '12-ryzyka-nowa-raid', lang));

  // 13. Ryzyka — kebab wiersza
  await idz('tab=control');
  await klik(p, p.locator('main button').filter({ hasText: /^\s*(Ryzyka|Risks)\s*\d*\s*$/i }), 'chip Ryzyka');
  await klik(
    p,
    p.locator('main [aria-label*="akcje" i], main [aria-label*="actions" i]'),
    'kebab wiersza'
  );
  raport.push(await zrzut(p, '13-ryzyka-kebab', lang));

  // 14. Sygnały
  await idz('tab=control');
  await klik(p, p.locator('main button').filter({ hasText: /^\s*(Sygnały|Signals)\s*\d*\s*$/i }), 'chip Sygnały');
  raport.push(await zrzut(p, '14-sygnaly', lang));

  // 15. Raporty — lista
  await idz('tab=reports');
  raport.push(await zrzut(p, '15-raporty-lista', lang));

  // 16. Raporty — menu „Dodaj raport"
  await klik(
    p,
    p.locator('main button').filter({ hasText: re('Dodaj raport', 'Add report') }),
    'Dodaj raport'
  );
  raport.push(await zrzut(p, '16-raporty-dodaj-menu', lang));

  // 17. Kanban
  await idz('tab=list&view=kanban');
  raport.push(await zrzut(p, '17-kanban', lang));
}

sql(`UPDATE users SET language='pl' WHERE email='audyt@dbr77.local'`);
await b.close();

const sumy = { en: 0, pl: 0 };
for (const r of raport) sumy[r.jezyk] += r.obcychSlowUI;
fs.writeFileSync(path.join(OUT, '_podsumowanie.json'), JSON.stringify({ faza: FAZA, sumy, ekrany: raport.map((r) => ({ ekran: r.ekran, jezyk: r.jezyk, obcychSlowUI: r.obcychSlowUI })) }, null, 1));
console.log(`\nSUMA obcych słów UI: EN=${sumy.en}  PL=${sumy.pl}`);
