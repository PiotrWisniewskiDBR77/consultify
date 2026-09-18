// D-07 (DLUG-PO-MVP, 18.09) — dowód wzrokowy: filtr projektami (L3, Menu 2)
// w REALNYM <InitiativesHub> przy VITE_INITIATIVES_FOUR_BUTTONS=true, deep-link
// `?project=proj-digital`. Mierzymy: (1) selekt pokazuje wybrany projekt,
// (2) pasek „Address" niesie `project=proj-digital` (realny location.search),
// (3) rejestr zawężony do 3 wierszy projektu Digital, 2 wiersze Operations NIE
// widoczne. EN, light+dark, 1440×900.
//
// Uruchomienie:
//   VITE_INITIATIVES_FOUR_BUTTONS=true npx vite --config dev-render/vite.config.ts --port 5417 --strictPort &
//   node evidence/qoder-d07-20260918/shot.mjs 5417 evidence/qoder-d07-20260918
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '5417';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/qoder-d07-20260918');
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_BAZA = `http://localhost:${PORT}/?screen=d07-inicjatywy-filtr-projektu-url&project=proj-digital&lang=en&uwagi=0`;

const DIGITAL_ROWS = [
  'Self-service customer portal',
  'Invoice intake automation (RPA)',
  'Data warehouse migration',
];
const OPS_ROWS = ['Management reporting consolidation', 'Energy savings programme 2026'];

async function run() {
  const browser = await chromium.launch();
  const raport = [];
  const bledy = [];
  const braki = [];
  const sieci404 = [];

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (m) => {
      if (m.type() === 'error') bledy.push(`${theme}: ${m.text()}`);
    });
    page.on('pageerror', (e) => bledy.push(`${theme} pageerror: ${e.message}`));
    page.on('response', (r) => {
      if (r.status() === 404) sieci404.push(`${theme} ${r.request().method()} ${r.url()}`);
    });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('demo_story_rail_dismissed', 'true');
      } catch {
        /* best-effort */
      }
    });

    await page.goto(`${URL_BAZA}&theme=${theme}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const skip = page.getByRole('button', { name: /Skip for now/i });
    if (await skip.count()) await skip.first().click();

    // Rejestr montuje się asynchronicznie (mock window.fetch). Czekaj na pierwszy
    // wiersz projektu Digital — to dowód, że deep-link zawęził rejestr.
    await page
      .waitForFunction(
        (firstRow) => (document.body.textContent || '').includes(firstRow),
        DIGITAL_ROWS[0],
        { timeout: 30000 }
      )
      .catch(() => braki.push(`${theme}: rejestr nie wyrenderował wiersza "${DIGITAL_ROWS[0]}"`));

    const odczyt = await page.evaluate(() => {
      const select = document.querySelector('[data-testid="initiatives-project-filter"]');
      const address = document.querySelector('[data-testid="d07-address"]');
      const body = document.body.textContent || '';
      const selectedLabel =
        select && select.selectedIndex >= 0
          ? (select.options[select.selectedIndex]?.textContent || '').trim()
          : null;
      const optionLabels = select
        ? Array.from(select.options).map((o) => (o.textContent || '').trim())
        : [];
      return {
        selectExists: Boolean(select),
        selectValue: select ? select.value : null,
        selectedLabel,
        optionLabels,
        addressText: address ? (address.textContent || '').replace(/\s+/g, ' ').trim() : null,
        digitalVisible: [
          'Self-service customer portal',
          'Invoice intake automation (RPA)',
          'Data warehouse migration',
        ].filter((t) => body.includes(t)),
        opsVisible: [
          'Management reporting consolidation',
          'Energy savings programme 2026',
        ].filter((t) => body.includes(t)),
      };
    });

    if (!odczyt.selectExists) braki.push(`${theme}: brak selektora filtra projektami (flaga OFF?)`);
    if (odczyt.selectValue !== 'proj-digital')
      braki.push(`${theme}: select.value=${JSON.stringify(odczyt.selectValue)}, oczekiwano "proj-digital"`);
    if (odczyt.selectedLabel !== 'Digital & Automation Roadmap')
      braki.push(`${theme}: etykieta=${JSON.stringify(odczyt.selectedLabel)}, oczekiwano "Digital & Automation Roadmap"`);
    if (!odczyt.addressText || !odczyt.addressText.includes('project=proj-digital'))
      braki.push(`${theme}: pasek Address nie niesie project=proj-digital (${JSON.stringify(odczyt.addressText)})`);
    if (odczyt.digitalVisible.length !== 3)
      braki.push(`${theme}: widoczne wiersze Digital = ${odczyt.digitalVisible.length}/3`);
    if (odczyt.opsVisible.length !== 0)
      braki.push(`${theme}: REGRESJA — wiersze Operations widoczne mimo filtra (${odczyt.opsVisible.join(', ')})`);

    raport.push(
      `${theme} | select.value=${JSON.stringify(odczyt.selectValue)} | selectedLabel=${JSON.stringify(odczyt.selectedLabel)} | opcje=${odczyt.optionLabels.length} | address="${odczyt.addressText}" | digital=${odczyt.digitalVisible.length}/3 | ops=${odczyt.opsVisible.length}/2`
    );

    await page.screenshot({
      path: path.join(OUT_DIR, `d07-filtr-projektu-url-${theme}.png`),
      fullPage: false,
    });
    await page.close();
  }

  await browser.close();
  const bledyKonsoli = bledy.length;
  raport.push(`bledyKonsoli=${bledyKonsoli}`);
  raport.push(`braki=${braki.length}`);
  raport.push(`zadania404=${sieci404.length}`);
  if (bledy.length) raport.push(...bledy.map((b) => `  ERR ${b}`));
  if (braki.length) raport.push(...braki.map((b) => `  BRAK ${b}`));
  if (sieci404.length) raport.push(...sieci404.slice(0, 20).map((u) => `  404 ${u}`));
  fs.writeFileSync(path.join(OUT_DIR, 'odczyt.txt'), `${raport.join('\n')}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'wyniki.json'),
    JSON.stringify(
      { bledyKonsoli, braki: braki.length, zadania404: sieci404.length, raport, braki, sieci404 },
      null,
      2
    )
  );
  console.log(raport.join('\n'));
  console.log('Zrzuty:', OUT_DIR);
  if (bledyKonsoli > 0 || braki.length > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
