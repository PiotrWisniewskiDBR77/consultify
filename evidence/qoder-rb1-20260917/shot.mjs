// RB-1 (Wpis 76 / przepis Wpis 44) — dowód wzrokowy: karta „Voice & Detail"
// w PRAWDZIWYM <SettingsPanel> (Report Builder → zakładka Content) z żywymi
// pokrętłami silnika, które przed naprawą nie miały żadnej kontrolki w produkcie
// (jedyną miał martwy IntentStep.tsx — zero importów).
//
// Uruchomienie:
//   npx vite --config dev-render/vite.config.ts --port 5430 --strictPort &
//   node evidence/qoder-rb1-20260917/shot.mjs 5430 evidence/qoder-rb1-20260917
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '5430';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/qoder-rb1-20260917');
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_BAZA = `http://localhost:${PORT}/?screen=report-builder-voice-detail&lang=en&uwagi=0`;

async function run() {
  const browser = await chromium.launch();
  const raport = [];
  const bledy = [];

  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (m) => {
      if (m.type() === 'error') bledy.push(`${theme}: ${m.text()}`);
    });
    page.on('pageerror', (e) => bledy.push(`${theme} pageerror: ${e.message}`));

    await page.goto(`${URL_BAZA}&theme=${theme}`, { waitUntil: 'networkidle' });

    // Harness klika nagłówek karty po ~120 ms; poczekaj aż kontrolki będą widoczne.
    await page.waitForSelector('text=Voice & Detail', { timeout: 15000 });
    await page
      .waitForFunction(
        () => {
          const labels = Array.from(document.querySelectorAll('label')).map((l) =>
            (l.textContent || '').trim()
          );
          return (
            labels.includes('Verbosity') &&
            labels.includes('Writing style') &&
            labels.includes('Examples') &&
            labels.includes('Custom tone (optional)')
          );
        },
        { timeout: 15000 }
      )
      .catch(() => bledy.push(`${theme}: controls not revealed`));

    // Odczyt na głos: jakie etykiety i wartości kontrolek widzi nadzorca.
    const odczyt = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('h3')).find((h) =>
        /Voice & Detail/i.test(h.textContent || '')
      )?.closest('div');
      const root = card?.parentElement || document;
      const picks = Array.from(root.querySelectorAll('select')).map((s) => ({
        label: s.closest('div')?.querySelector('label')?.textContent?.trim() || '?',
        value: s.value,
        options: Array.from(s.options).map((o) => o.textContent?.trim()),
      }));
      const tone = root.querySelector('input[type="text"]');
      return {
        selects: picks,
        customTone: tone ? { value: tone.value, placeholder: tone.placeholder } : null,
      };
    });

    raport.push(
      `${theme} | selects=${JSON.stringify(odczyt.selects)} | customTone=${JSON.stringify(odczyt.customTone)}`
    );

    await page.screenshot({ path: path.join(OUT_DIR, `voice-detail-${theme}.png`), fullPage: false });
    await page.close();
  }

  await browser.close();
  const bledyKonsoli = bledy.length;
  raport.push(`bledyKonsoli=${bledyKonsoli}`);
  if (bledy.length) raport.push(...bledy.map((b) => `  ERR ${b}`));
  fs.writeFileSync(path.join(OUT_DIR, 'odczyt.txt'), `${raport.join('\n')}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'shot-wynik.json'),
    JSON.stringify({ bledyKonsoli, raport }, null, 2)
  );
  console.log(raport.join('\n'));
  console.log('Zrzuty:', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
