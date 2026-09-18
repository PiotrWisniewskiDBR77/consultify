// D-01 (DLUG-PO-MVP, P2/S) — dowód wzrokowy: CTA „Get started" w REALNYM modalu
// powitalnym <FirstRunOnboarding> (krok 1 „Meet Teresa") jest neutralny navy
// (variant primary), NIE crimson #85182F (variant brand).
//
// Uruchomienie:
//   npx vite --config dev-render/vite.config.ts --port 5413 --strictPort &
//   node evidence/qoder-d01-20260918/shot.mjs 5413 evidence/qoder-d01-20260918
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '5413';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/qoder-d01-20260918');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CRIMSON = 'rgb(133, 24, 47)'; // #85182F — brand crimson-600 (niedozwolone na CTA)
const NAVY_LIGHT = 'rgb(15, 23, 42)'; // #0F172A — navy-900 (primary, light)
const NAVY_DARK = 'rgb(244, 247, 251)'; // #F4F7FB — primary, dark

const oczekiwanyKolor = { light: NAVY_LIGHT, dark: NAVY_DARK };

async function run() {
  const browser = await chromium.launch();
  const raport = [];
  const bledy = [];
  const nieudane = [];

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (m) => {
      if (m.type() === 'error') bledy.push(`${theme}: ${m.text()}`);
    });
    page.on('pageerror', (e) => bledy.push(`${theme} pageerror: ${e.message}`));

    // Harness dev-render nie ma backendu (apiNoBackendPlugin oddaje 404 na
    // /api/*) — stub na 200, żeby licznik mierzył PRAWDZIWE błędy ekranu, nie
    // brak backendu. GET /preferences = stan first-run „brand-new user"
    // (onboarding_completed:false), na wypadek gdyby realna ścieżka Api
    // jednak wystartowała (screen i tak stubuje getFirstRunState w module).
    await page.route(
      (url) => new URL(url).pathname.startsWith('/api/'),
      (route) => {
        const req = route.request();
        if (req.method() !== 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        }
        const sciezka = new URL(req.url()).pathname;
        const cialo = sciezka.endsWith('/preferences')
          ? { onboarding_completed: false, onboarding_role: null }
          : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(cialo),
        });
      }
    );

    await page.addInitScript(() => {
      try {
        localStorage.removeItem('consultify_onboarding_done:user-d01-harness');
        localStorage.setItem('demo_story_rail_dismissed', 'true');
      } catch {
        /* best-effort */
      }
    });

    const url = `http://localhost:${PORT}/?screen=d01-onboarding-cta&lang=en&theme=${theme}&uwagi=0`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const cta = page.getByRole('button', { name: 'Get started' });
    await cta.first().waitFor({ state: 'visible', timeout: 30000 });

    const odczyt = await cta.first().evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        tekst: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        tlo: cs.backgroundColor,
        klasa: el.className,
      };
    });

    raport.push(`${theme} | CTA="${odczyt.tekst}" | tlo=${odczyt.tlo} | oczekiwane=${oczekiwanyKolor[theme]}`);

    if (odczyt.tlo === CRIMSON) {
      nieudane.push(`${theme}: CTA nadal crimson ${CRIMSON} (D-01 nie naprawione)`);
    }
    if (odczyt.tlo !== oczekiwanyKolor[theme]) {
      nieudane.push(
        `${theme}: tło CTA ${odczyt.tlo} != oczekiwany navy ${oczekiwanyKolor[theme]}`
      );
    }
    if (odczyt.klasa.includes('crimson')) {
      nieudane.push(`${theme}: klasa CTA zawiera crimson: ${odczyt.klasa}`);
    }
    if (!/Get started/i.test(odczyt.tekst)) {
      nieudane.push(`${theme}: CTA nie ma tekstu „Get started" (${odczyt.tekst})`);
    }

    await page.screenshot({
      path: path.join(OUT_DIR, `d01-${theme}.png`),
      fullPage: false,
    });
    await page.close();
  }

  await browser.close();
  const bledyKonsoli = bledy.length;
  raport.push(`bledyKonsoli=${bledyKonsoli}`);
  raport.push(`nieudane=${nieudane.length}`);
  if (bledy.length) raport.push(...bledy.map((b) => `  ERR ${b}`));
  if (nieudane.length) raport.push(...nieudane.map((b) => `  FAIL ${b}`));
  fs.writeFileSync(path.join(OUT_DIR, 'odczyt.txt'), `${raport.join('\n')}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'wyniki.json'),
    JSON.stringify({ bledyKonsoli, nieudane: nieudane.length, raport, bledy, nieudane }, null, 2)
  );
  console.log(raport.join('\n'));
  console.log('Zrzuty:', OUT_DIR);
  if (bledyKonsoli > 0 || nieudane.length > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
