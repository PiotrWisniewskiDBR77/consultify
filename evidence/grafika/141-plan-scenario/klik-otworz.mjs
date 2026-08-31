/**
 * Zrzut INTERAKCYJNY dla plan-scenario-d1: zaznacz wiersz → prawy panel → klik „Otwórz",
 * potem osobno → klik „Otwórz narzędzia planu" (warsztat).
 * `scripts/dev/grafika-zrzuty.mjs` nie ma trybu interakcji, a oba defekty ujawniają się
 * dopiero PO kliknięciu — bez tego zrzutu ocena byłaby czysto kodowa.
 */
import path from 'path';

import { chromium } from 'playwright';

const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.split('=').slice(1).join('=') : d;
};
const FAZA = arg('faza', 'PRZED');
const OUT = arg('out', '/private/tmp/m03/evidence/grafika/141-plan-scenario');
const MOTYWY = arg('motywy', 'light,dark').split(',');

const browser = await chromium.launch();
for (const motyw of MOTYWY) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const bledy = [];
  page.on('console', (m) => {
    if (m.type() === 'error') bledy.push(m.text().slice(0, 200));
  });
  await page.goto(
    `http://127.0.0.1:3020/?screen=plan-scenario-d1&lang=pl&theme=${motyw}&uwagi=0`,
    { waitUntil: 'networkidle', timeout: 60000 }
  );
  await page.waitForTimeout(2500);
  await page.addStyleTag({
    content: '[data-dev-render-chrome], .dev-render-chrome { display: none !important; }',
  });

  // 1) klik w pierwszy wiersz → prawy panel
  await page.getByText('Cyfrowe wdrożenie klienta').first().click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(OUT, `plan-scenario-d1-panel__${FAZA}__${motyw}.png`),
    fullPage: true,
  });

  // 2) klik „Otwórz" w nagłówku panelu
  const otworz = page.getByRole('button', { name: /^Otwórz$/ });
  const ile = await otworz.count();
  const wylaczony = ile ? await otworz.first().isDisabled() : null;
  const tytul = ile ? await otworz.first().getAttribute('title') : null;
  if (ile && !wylaczony) {
    await otworz.first().click();
    await page.waitForTimeout(900);
  }
  await page.screenshot({
    path: path.join(OUT, `plan-scenario-d1-po-otworz__${FAZA}__${motyw}.png`),
    fullPage: true,
  });
  const wysPo = await page.evaluate(() => document.documentElement.scrollHeight);

  // 3) warsztat planu — uczciwie nazwany przycisk
  const warsztat = page.getByRole('button', { name: /Otwórz narzędzia planu/ }).first();
  if (await warsztat.count()) {
    await warsztat.click();
    await page.waitForTimeout(900);
    await page.screenshot({
      path: path.join(OUT, `plan-scenario-d1-warsztat__${FAZA}__${motyw}.png`),
      fullPage: true,
    });
  }

  console.log(
    `${motyw}: „Otworz"=${ile} wylaczony=${wylaczony} wys.po-kliku=${wysPo} bledy=${bledy.length}`
  );
  if (tytul) console.log(`   tooltip: ${tytul}`);
  if (bledy.length) console.log('  ', bledy.slice(0, 3).join(' | '));
  await context.close();
}
await browser.close();
