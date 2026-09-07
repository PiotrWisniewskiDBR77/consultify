// Dowód dla ZLECENIA mvp/pusta-lista-inicjatyw.
// Renderuje REALNĄ trasę /initiatives na własnym vite (port z --port), 1440x900,
// motyw jasny, sesja z /private/tmp/stanowisko-noc/auth.json (tylko odczyt).
// Mierzy JEDNYM kadrem: ile wierszy zwróciło API (obie trasy) i ile wierszy
// realnie wyrenderował ekran + czy widać stan pusty StandardTable.
// Zapisuje PNG + .png.json (url, liczby, bledyKonsoli) do evidence/pusta-lista/.
//
// Użycie: node scripts/dev/pusta-lista-inicjatyw-zrzuty.mjs --etykieta przed --port 3141
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const ETYKIETA = arg('etykieta', 'po');
const PORT = arg('port', '3141');
const ZAKRES = arg('zakres', 'aktywne');
const OUT = arg('out', 'evidence/pusta-lista');
const BASE = `http://localhost:${PORT}`;

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
const api = { legacy: null, runtimeV1: null };
page.on('console', (m) => m.type() === 'error' && bledyKonsoli.push(m.text()));
page.on('pageerror', (e) => bledyKonsoli.push(String(e)));
page.on('response', async (r) => {
  const u = r.url();
  if (r.status() >= 400) bledyKonsoli.push(`HTTP ${r.status()} ${u}`);
  try {
    if (/\/api\/initiatives\/runtime-v1\/initiatives(\?|$)/.test(u) && r.status() === 200) {
      const j = await r.json();
      api.runtimeV1 = (j.initiatives || []).length;
    } else if (/\/api\/initiatives(\?|$)/.test(u) && r.status() === 200) {
      const j = await r.json();
      const rows = Array.isArray(j) ? j : j.data || j.initiatives || [];
      api.legacy = Array.isArray(rows) ? rows.length : null;
    }
  } catch {
    /* nie-JSON — pomijamy */
  }
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
}, ls);
await page.goto(`${BASE}/initiatives`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('[data-testid="initiatives-hub"]', { timeout: 30000 });
await page.waitForTimeout(3000);

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

const liczby = await page.evaluate(() => {
  const ostatnia = (el) => {
    const m = (el?.textContent ?? '').match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
  };
  const hub = document.querySelector('[data-testid="initiatives-hub"]');
  const tbody = hub?.querySelector('table tbody');
  const wiersze = tbody ? tbody.querySelectorAll('tr').length : 0;
  return {
    wierszeTabeli: wiersze,
    stanPusty: !!document.querySelector('[data-testid="standard-table-empty"]'),
    menu3Wszystkie: ostatnia(document.querySelector('[data-testid="initiatives-menu3-chip-all"]')),
    menu2PrzyFiltrze: ostatnia(
      document.querySelector('[data-testid="initiatives-lifecycle-dropdown"] button')
    ),
  };
});

const plik = `${OUT}/${ETYKIETA}-inicjatywy-lista`;
await page.screenshot({ path: `${plik}.png`, fullPage: false });
fs.writeFileSync(
  `${plik}.png.json`,
  JSON.stringify(
    { url: page.url(), etykieta: ETYKIETA, zakres: ZAKRES, api, liczby, bledyKonsoli },
    null,
    2
  )
);
console.log(ETYKIETA, page.url(), JSON.stringify({ api, liczby }), 'błędy:', bledyKonsoli.length);

await browser.close();
