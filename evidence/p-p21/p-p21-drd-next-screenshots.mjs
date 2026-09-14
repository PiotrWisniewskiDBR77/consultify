// P-P21 (fala F2) — dowód wzrokowy dla zgłoszenia Pawła: „Next" na ostatnim
// kroku w pełni odpowiedzianej jednostki DRD wracał na „Question 1 of 7 /
// Step 1/3" tej samej jednostki zamiast przejść do następnej (1A → 1B).
//
// Harness: dev-render/screens/drd-http-workspace.tsx, stage=pelna-jednostka
// (atrapa serwera zaszczepia w 1A poziomy 1-6 jako potwierdzone, więc ekran
// staje na poziomie 7 — dokładnie w miejscu Pawła).
//
// Uruchomienie (port dowolny, ten sam w URL):
//   npx vite --config dev-render/vite.config.ts --port 4571 --strictPort &
//   node evidence/p-p21/p-p21-drd-next-screenshots.mjs 4571 evidence/p-p21/po
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const PORT = process.argv[2] || '4571';
const OUT_DIR = path.resolve(process.argv[3] || 'evidence/p-p21');
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_BAZA = `http://localhost:${PORT}/?screen=drd-http-workspace&stage=pelna-jednostka&view=interview`;

async function run() {
  const browser = await chromium.launch();
  const raport = [];
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${URL_BAZA}&theme=${theme}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="interview-focus-panel"]');
    await page.waitForFunction(
      () => /(of|z)\s*7/.test(document.querySelector('[data-testid="question-progress"]')?.textContent || '')
    );

    const opis = async (etykieta) => {
      const postep = (await page.getByTestId('question-progress').textContent())?.trim();
      const idPytania = await page.evaluate(
        () =>
          document
            .querySelector('[data-testid="interview-focus-panel"] [data-testid^="question-card-"]')
            ?.getAttribute('data-testid')
            ?.replace('question-card-', '') ?? '(brak)'
      );
      const okruchy = await page.evaluate(
        () =>
          document.querySelector('[data-testid="interview-focus-panel"] nav')?.textContent?.trim() ??
          '(brak)'
      );
      raport.push(`${theme} | ${etykieta} | ${postep} | ${idPytania} | ${okruchy}`);
    };

    // 1. OSTATNI krok jednostki 1A (poziom 7 z 7)
    await opis('01-ostatni-krok');
    await page.screenshot({ path: path.join(OUT_DIR, `01-ostatni-krok-${theme}.png`) });

    // 2. człowiek potwierdza ostatni poziom — jednostka pełna, ekran zostaje
    await page.getByRole('radio', { name: /Confirmed|Potwierdzone/ }).first().click();
    await page.waitForTimeout(600);
    await opis('02-po-potwierdzeniu');
    await page.screenshot({ path: path.join(OUT_DIR, `02-po-potwierdzeniu-${theme}.png`) });

    // 3. „Next" — TU był defekt (powrót na Question 1 of 7 tej samej jednostki)
    await page.getByRole('button', { name: /^Next$|^Dalej$/ }).click();
    await page.waitForTimeout(600);
    await opis('03-po-next');
    await page.screenshot({ path: path.join(OUT_DIR, `03-po-next-${theme}.png`) });

    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'odczyt.txt'), `${raport.join('\n')}\n`, 'utf8');
  console.log(raport.join('\n'));
  console.log('Zrzuty:', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
