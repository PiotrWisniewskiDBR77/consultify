// Dowód dla ZLECENIA mvp/liczniki-inicjatyw (ODMROZENIE 05_INITIATIVES).
// Renderuje REALNĄ trasę /initiatives (nie dev-render) na własnym vite,
// 1440x900, motyw jasny, sesja z /private/tmp/stanowisko-noc/auth.json
// (tylko odczyt), rozwija dropdown statusu w Menu 2 i zapisuje PNG + .png.json
// (url, bledyKonsoli) do evidence/liczniki-inicjatyw/.
// Dodatkowo wypisuje TRZY liczby z jednego kadru: pigułka Menu 3 „Wszystkie",
// licznik przy przycisku „Status" w Menu 2 i suma pozycji statusów w liście.
//
// Użycie:
//   node scripts/dev/liczniki-inicjatyw-zrzuty.mjs --etykieta przed|po [--port 3111]
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const ETYKIETA = arg('etykieta', 'po');
const PORT = arg('port', '3111');
// --zakres wszystkie → klik pstryczka zakresu w Menu 2 przed odczytem liczb
// (dowód, że etykieta "Aktywne/Wszystkie" uczciwie tłumaczy różnicę 60 vs 72).
const ZAKRES = arg('zakres', 'aktywne');
const BASE = `http://localhost:${PORT}`;
const OUT = 'evidence/liczniki-inicjatyw';

const auth = JSON.parse(fs.readFileSync('/private/tmp/stanowisko-noc/auth.json', 'utf8'));
const origin = auth.origins.find((o) => o.origin === 'http://localhost:3090');
const ls = Object.fromEntries(origin.localStorage.map((i) => [i.name, i.value]));
try {
  const storage = JSON.parse(ls['consultify-storage']);
  storage.state.theme = 'light';
  ls['consultify-storage'] = JSON.stringify(storage);
} catch (e) {
  console.error('Nie udało się wymusić motywu jasnego:', e);
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies(
  auth.cookies
    .filter((c) => c.domain === 'localhost')
    .map((c) => ({ ...c, domain: 'localhost', expires: c.expires ?? -1 }))
);
const page = await context.newPage();
await page.emulateMedia({ colorScheme: 'light' });

const bledyKonsoli = [];
page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text()));
page.on('pageerror', (e) => bledyKonsoli.push(String(e)));
page.on('response', (r) => {
  if (r.status() >= 400) bledyKonsoli.push(`HTTP ${r.status()} ${r.url()}`);
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
}, ls);
await page.goto(`${BASE}/initiatives`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('[data-testid="initiatives-hub"]', { timeout: 30000 });
await page.waitForTimeout(2500);

if (ZAKRES === 'wszystkie') {
  await page.evaluate(() => {
    const grupa = document.querySelector('[role="radiogroup"]');
    const btn = [...(grupa?.querySelectorAll('button') ?? [])].find(
      (b) => (b.textContent ?? '').trim() === 'Wszystkie'
    );
    btn?.click();
  });
  await page.waitForTimeout(2500);
}

// Rozwinięcie listy statusów w Menu 2 — wymóg zlecenia: w jednym kadrze
// pigułka „Wszystkie", licznik przy filtrze i lista statusów.
await page.click('[data-testid="initiatives-lifecycle-dropdown"] button');
await page.waitForTimeout(600);

const liczby = await page.evaluate(() => {
  const ostatnia = (el) => {
    const m = (el?.textContent ?? '').match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
  };
  const pigulka = document.querySelector('[data-testid="initiatives-menu3-chip-all"]');
  const drop = document.querySelector('[data-testid="initiatives-lifecycle-dropdown"]');
  const przycisk = drop?.querySelector('button');
  const opcje = [...(drop?.querySelectorAll('[role="option"]') ?? [])];
  return {
    menu3Wszystkie: ostatnia(pigulka),
    menu2PrzyFiltrze: ostatnia(przycisk),
    dropdownWszystkie: ostatnia(opcje[0]),
    statusy: opcje.slice(1).map((o) => ({ etykieta: o.textContent.trim(), liczba: ostatnia(o) })),
    sumaStatusow: opcje.slice(1).reduce((s, o) => s + (ostatnia(o) ?? 0), 0),
  };
});

const plik = `${OUT}/${ETYKIETA}-inicjatywy-liczniki`;
await page.screenshot({ path: `${plik}.png`, fullPage: false });
fs.writeFileSync(
  `${plik}.png.json`,
  JSON.stringify({ url: page.url(), etykieta: ETYKIETA, liczby, bledyKonsoli }, null, 2)
);
console.log(ETYKIETA, page.url(), JSON.stringify(liczby, null, 2), 'błędy:', bledyKonsoli.length);

await browser.close();
