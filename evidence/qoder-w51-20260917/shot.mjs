// W51 (DEC-604 OB1-4 + DEC-612 skrzynka „For approval") — dowód wzrokowy:
// PRAWDZIWE komponenty (`InitiativesHub` z zakładką „Obciążenie" oraz
// `TransitionInboxSurface`) z POMIAREM z bazy consultify_kopia_d3 wplecionym
// w atrapy fetch harnessa dev-render (motyw przez store aplikacji — main.tsx
// :3028, NIE emulateMedia).
//
// Uruchomienie:
//   VITE_INITIATIVES_WORKLOAD=true VITE_INITIATIVES_FOUR_BUTTONS=true \
//   VITE_TRANSITION_INBOX=true \
//     npx vite --config dev-render/vite.config.ts --port 5431 --strictPort &
//   node evidence/qoder-w51-20260917/shot.mjs 5431 evidence/qoder-w51-20260917
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '5431';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/qoder-w51-20260917');
fs.mkdirSync(OUT_DIR, { recursive: true });

const EKRANY = [
  {
    nazwa: 'workload',
    url: `http://localhost:${PORT}/?screen=w51-dec604-obciazenie&tab=capacity&lang=en&uwagi=0`,
  },
  {
    nazwa: 'inbox',
    url: `http://localhost:${PORT}/?screen=w51-dec612-skrzynka&lang=en&uwagi=0`,
  },
];

async function run() {
  const browser = await chromium.launch();
  const raport = [];
  const bledy = [];
  const braki = [];
  const sieci404 = [];

  for (const ekran of EKRANY) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on('console', (m) => {
        if (m.type() === 'error') bledy.push(`${ekran.nazwa}/${theme}: ${m.text()}`);
      });
      page.on('pageerror', (e) => bledy.push(`${ekran.nazwa}/${theme} pageerror: ${e.message}`));
      page.on('response', (r) => {
        if (r.status() === 404) sieci404.push(`${ekran.nazwa}/${theme} ${r.request().method()} ${r.url()}`);
      });
      // Pasek „Start the tour" (StoryRail) przykrywa canvas; produkt pamięta
      // zamknięcie w localStorage (`storyRailStops.ts:71`).
      await page.addInitScript(() => {
        try {
          localStorage.setItem('demo_story_rail_dismissed', 'true');
        } catch {
          /* best-effort */
        }
      });
      // Harness nie ma backendu — niespełnione GET-y /api/* oddają 200, żeby
      // licznik mierzył PRAWDZIWE błędy ekranu (wzór z przyjętego dowodu M6
      // i RB-1 v2). Ekrany W51 i tak mają własne atrapy window.fetch —
      // route łapie tylko to, co faktycznie wychodzi do sieci.
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
          const cialo = sciezka.startsWith('/api/organizations')
            ? {
                organization: { id: 'org-northwind', name: 'Northwind Manufacturing Ltd.', plan: 'enterprise' },
                organizations: [{ id: 'org-northwind', name: 'Northwind Manufacturing Ltd.' }],
              }
            : sciezka.startsWith('/api/preferences')
              ? { preferences: { language: 'en', theme } }
              : sciezka.startsWith('/api/demo/status')
                ? { isActive: false }
                : [];
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(cialo),
          });
        }
      );

      await page.goto(`${ekran.url}&theme=${theme}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Onboarding pierwszego logowania przykrywa i rozmywa powłokę.
      const skip = page.getByRole('button', { name: /Skip for now/i });
      if (await skip.count()) await skip.first().click();

      let odczyt;
      if (ekran.nazwa === 'workload') {
        await page
          .waitForFunction(
            () => (document.body.textContent || '').includes('Laura Novak'),
            { timeout: 30000 }
          )
          .catch(() => braki.push(`${ekran.nazwa}/${theme}: brak osób z seeda ( heatmapa pusta?)`));
        odczyt = await page.evaluate(() => {
          const tekst = (document.body.textContent || '') + ' ' +
            Array.from(document.querySelectorAll('input, textarea, [title]'))
              .map((i) => (i.value || i.getAttribute('title') || ''))
              .join(' ');
          const osoby = ['Laura Novak', 'Daniel Osei', 'Emily Carter', 'Michael Grant', 'Robert Chen', 'Priya Sharma', 'Thomas Baker', 'James Whitfield', 'Sarah Mitchell'];
          return {
            osobyWidoczne: osoby.filter((o) => tekst.includes(o)).length,
            legenda: ['Below 85%', '85–100%', 'Above 100%'].filter((l) => tekst.includes(l)),
            pustyStan: tekst.includes('No scheduled workload matches this scope.'),
            procZSeeda: ['250%', '209%', '151%', '122%', '110%', '38%', '45%'].filter((p) => tekst.includes(p)),
            kolumna: tekst.includes('Team member'),
          };
        });
        if (odczyt.osobyWidoczne < 9) braki.push(`${ekran.nazwa}/${theme}: ${odczyt.osobyWidoczne}/9 osób`);
        if (odczyt.legenda.length < 3) braki.push(`${ekran.nazwa}/${theme}: legenda ${odczyt.legenda.length}/3`);
        if (odczyt.pustyStan) braki.push(`${ekran.nazwa}/${theme}: pusty stan heatmapy`);
        if (odczyt.procZSeeda.length < 3) braki.push(`${ekran.nazwa}/${theme}: procenty z seeda ${odczyt.procZSeeda.length}`);
      } else {
        await page
          .waitForFunction(
            () => (document.body.textContent || '').includes('MES Rollout Line 3'),
            { timeout: 30000 }
          )
          .catch(() => braki.push(`${ekran.nazwa}/${theme}: brak wiersza propozycji`));
        odczyt = await page.evaluate(() => {
          const tekst = (document.body.textContent || '').replace(/\s+/g, ' ');
          const wiersze = document.querySelectorAll('tbody tr').length;
          return {
            wiersze,
            inicjatywa: tekst.includes('MES Rollout Line 3'),
            autor: tekst.includes('Laura Novak'),
            przejście: /EXECUTING/i.test(tekst) && /DONE/i.test(tekst),
            domena: /CLOSURE|Closure/i.test(tekst),
          };
        });
        if (odczyt.wiersze !== 1) braki.push(`${ekran.nazwa}/${theme}: wierszy=${odczyt.wiersze} (oczekiwane 1)`);
        if (!odczyt.inicjatywa || !odczyt.autor || !odczyt['przejście']) braki.push(`${ekran.nazwa}/${theme}: wiersz niepełny ${JSON.stringify(odczyt)}`);
      }

      raport.push(`${ekran.nazwa}/${theme} | ${JSON.stringify(odczyt)}`);
      await page.screenshot({
        path: path.join(OUT_DIR, `${ekran.nazwa}-${theme}.png`),
        fullPage: false,
      });
      await page.close();
    }
  }

  await browser.close();
  const bledyKonsoli = bledy.length;
  raport.push(`bledyKonsoli=${bledyKonsoli}`);
  raport.push(`braki=${braki.length}`);
  raport.push(`zadania404=${sieci404.length}`);
  if (bledy.length) raport.push(...bledy.map((b) => `  ERR ${b}`));
  if (braki.length) raport.push(...braki.map((b) => `  BRAK ${b}`));
  if (sieci404.length) raport.push(...sieci404.map((u) => `  404 ${u}`));
  fs.writeFileSync(path.join(OUT_DIR, 'odczyt.txt'), `${raport.join('\n')}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'shot-wynik.json'),
    JSON.stringify({ bledyKonsoli, braki: braki.length, zadania404: sieci404.length, raport, braki, sieci404 }, null, 2)
  );
  console.log(raport.join('\n'));
  console.log('Zrzuty:', OUT_DIR);
  if (bledyKonsoli > 0 || braki.length > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
