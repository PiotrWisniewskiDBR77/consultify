/**
 * Galeria PRZED/PO dla porządku Menu 1/2/3 w Inicjatywach i Realizacji.
 *
 * Renderuje REALNE trasy /initiatives i /execution na własnym vite (3192),
 * loguje się kontem ADMIN audyt@dbr77.local przez prawdziwy formularz,
 * i zapisuje PNG + .png.json (opis, url, błędy konsoli) do evidence/menu-123-porzadek/.
 *
 * Dodatkowo MIERZY pasek Menu 2: liczbę linii (wykryte zawinięcie),
 * liczbę przycisków w prawym klastrze i obecność liczników.
 *
 * Użycie:
 *   node scripts/dev/menu-123-porzadek-zrzuty.mjs --etykieta przed
 *   node scripts/dev/menu-123-porzadek-zrzuty.mjs --etykieta po
 *   node scripts/dev/menu-123-porzadek-zrzuty.mjs --etykieta po --szer 1920
 *   node scripts/dev/menu-123-porzadek-zrzuty.mjs --etykieta po --motyw ciemny
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const ETYKIETA = arg('etykieta', 'po');
const PORT = arg('port', '3192');
const SZER = Number(arg('szer', '1440'));
const WYS = SZER >= 1920 ? 1080 : 900;
const MOTYW = arg('motyw', 'jasny'); // jasny | ciemny
const TYLKO = arg('tylko', ''); // filtr po id zakładki
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'evidence/menu-123-porzadek';
const STAN = '/private/tmp/wt-menu/.menu123-auth.json';

const ZAKLADKI = [
  { nr: '01', modul: 'inicjatywy', id: 'list', url: '/initiatives', testid: 'initiatives-hub' },
  { nr: '02', modul: 'inicjatywy', id: 'plan', url: '/initiatives?tab=plan', testid: 'initiatives-hub' },
  { nr: '03', modul: 'inicjatywy', id: 'obciazenie', url: '/initiatives?tab=capacity', testid: 'initiatives-hub' },
  { nr: '04', modul: 'realizacja', id: 'kokpit', url: '/execution?tab=summary', testid: null },
  { nr: '05', modul: 'realizacja', id: 'realizacje', url: '/execution?tab=list', testid: null },
  { nr: '06', modul: 'realizacja', id: 'praca', url: '/execution?tab=work', testid: null },
  { nr: '07', modul: 'realizacja', id: 'zasoby', url: '/execution?tab=resources', testid: null },
  { nr: '08', modul: 'realizacja', id: 'decyzje-ryzyka', url: '/execution?tab=control', testid: null },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// ── Logowanie raz, zapis stanu ────────────────────────────────────────────
if (!fs.existsSync(STAN)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.fill('input[type="email"], input[name="email"]', 'audyt@dbr77.local');
  await p.fill('input[type="password"], input[name="password"]', 'AudytDBR77!2026');
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 60000 });
  await p.waitForTimeout(4000);
  await ctx.storageState({ path: STAN });
  await ctx.close();
  console.log('Zalogowano, stan zapisany do', STAN);
}

// Motyw przez localStorage `consultify-storage` → state.theme
const stan = JSON.parse(fs.readFileSync(STAN, 'utf8'));
for (const o of stan.origins ?? []) {
  const wpis = o.localStorage.find((i) => i.name === 'consultify-storage');
  if (!wpis) continue;
  try {
    const s = JSON.parse(wpis.value);
    s.state = s.state ?? {};
    s.state.theme = MOTYW === 'ciemny' ? 'dark' : 'light';
    wpis.value = JSON.stringify(s);
  } catch (e) {
    console.error('Nie udało się wymusić motywu:', e);
  }
  if (!o.localStorage.find((i) => i.name === 'i18nextLng')) {
    o.localStorage.push({ name: 'i18nextLng', value: 'pl' });
  } else {
    o.localStorage.find((i) => i.name === 'i18nextLng').value = 'pl';
  }
}
const STAN_MOTYW = `/private/tmp/wt-menu/.menu123-auth-${MOTYW}.json`;
fs.writeFileSync(STAN_MOTYW, JSON.stringify(stan));

const context = await browser.newContext({
  viewport: { width: SZER, height: WYS },
  storageState: STAN_MOTYW,
  colorScheme: MOTYW === 'ciemny' ? 'dark' : 'light',
  locale: 'pl-PL',
});

const raport = [];

for (const z of ZAKLADKI) {
  if (TYLKO && z.id !== TYLKO) continue;
  const page = await context.newPage();
  const bledyKonsoli = [];
  page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => bledyKonsoli.push(String(e).slice(0, 300)));
  page.on('response', (r) => {
    if (r.status() >= 400) bledyKonsoli.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });

  try {
    await page.goto(`${BASE}${z.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1000);
    if (MOTYW === 'ciemny') {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
    }
    await page.waitForTimeout(7000);
  } catch (e) {
    bledyKonsoli.push(`NAWIGACJA: ${String(e).slice(0, 200)}`);
  }

  // ── POMIAR paska Menu 2 ────────────────────────────────────────────────
  const pomiar = await page.evaluate(() => {
    // Menu 2 = "Main Navigation Row" ModuleNavBar: div.flex.items-center.px-4.py-3
    // wewnątrz kontenera z border-b. Szukamy po lupie (aria-label Search/Szukaj).
    const lupa = document.querySelector(
      'button[aria-label="Search"], button[aria-label="Szukaj"], button[aria-label="Wyszukaj"]'
    );
    if (!lupa) return { znaleziono: false };
    const menu2 = lupa.closest('div.flex.items-center');
    const wiersz = menu2?.parentElement; // Main Navigation Row
    if (!wiersz) return { znaleziono: false };
    const r = wiersz.getBoundingClientRect();
    const dzieci = [...wiersz.children];
    const prawyKlaster = dzieci[dzieci.length - 1];
    const przyciski = prawyKlaster ? [...prawyKlaster.querySelectorAll('button')] : [];
    // Wysokość jednej linii paska = 36 (h-9) + py-3*2 (24) = 60 px.
    const linie = Math.max(1, Math.round((r.height - 24) / 44));
    // Liczniki w Menu 2: elementy tabular-nums / czysto liczbowe badge
    const liczniki = prawyKlaster
      ? [...prawyKlaster.querySelectorAll('span')].filter((s) =>
          /^\d+$/.test((s.textContent ?? '').trim()) && s.children.length === 0
        ).length
      : 0;
    // Baner statusu w Menu 2 (role=status / alert)
    const banery = prawyKlaster
      ? [...prawyKlaster.querySelectorAll('[role="status"], [role="alert"]')].length
      : 0;
    return {
      znaleziono: true,
      wysokoscPx: Math.round(r.height),
      linie,
      przyciskiWPrawymKlastrze: przyciski.length,
      etykietyPrawegoKlastra: przyciski
        .map((b) => (b.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40))
        .filter(Boolean),
      licznikiWMenu2: liczniki,
      baneryWMenu2: banery,
      selectyWMenu2: prawyKlaster ? prawyKlaster.querySelectorAll('select').length : 0,
    };
  });

  const nazwa = `${z.nr}-${z.modul}-${z.id}-${ETYKIETA}-${SZER}-${MOTYW}.png`;
  const plik = path.join(OUT, nazwa);
  await page.screenshot({ path: plik });
  fs.writeFileSync(
    `${plik}.json`,
    JSON.stringify(
      {
        opis: `${z.modul} › ${z.id} — ${ETYKIETA}, ${SZER}px, motyw ${MOTYW}`,
        url: `${BASE}${z.url}`,
        etykieta: ETYKIETA,
        szerokosc: SZER,
        motyw: MOTYW,
        pomiarMenu2: pomiar,
        bledyKonsoli: [...new Set(bledyKonsoli)].slice(0, 20),
      },
      null,
      2
    )
  );
  raport.push({ zakladka: `${z.modul}/${z.id}`, ...pomiar });
  console.log(nazwa, JSON.stringify(pomiar));
  await page.close();
}

console.table(raport);
await context.close();
await browser.close();
