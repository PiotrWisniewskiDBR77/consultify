/**
 * Sonda: czy wskaznik % w dolnym pasku nadaza za realnym zoomem?
 * Czyta tekst pigulki i porownuje z transformem `.react-flow__viewport`.
 * node scripts/probe-zoom.mjs [ff]
 */
import { chromium } from 'playwright';

const FF = process.argv[2] || '';
const SCREENS = [
  ['mapa', 'mindmap-canvas'],
  ['tablica', 'whiteboard-canvas'],
  ['przeplyw', 'processflow-canvas'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1480, height: 840 } });

const czytaj = (page) =>
  page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport');
    const m = vp && /scale\(([\d.]+)\)/.exec(getComputedStyle(vp).transform.includes('matrix')
      ? ''
      : '');
    let realny = null;
    if (vp) {
      const tr = getComputedStyle(vp).transform;
      const mm = /matrix\(([-\d.]+)/.exec(tr);
      if (mm) realny = Math.round(parseFloat(mm[1]) * 100);
    }
    const pig = [...document.querySelectorAll('div')].filter(
      (d) => /^\d{1,3}%$/.test((d.textContent || '').trim()) && d.children.length === 0
    );
    return { realny, pokazany: pig.map((d) => d.textContent.trim()) };
  });

for (const [name, screen] of SCREENS) {
  const page = await ctx.newPage();
  let url = `http://localhost:3332/?screen=${screen}`;
  if (FF !== '') url += `&ff_ideaBottomBarUnified=${FF}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(4500);
  const przed = await czytaj(page);
  // zoom KÓŁKIEM w srodku plotna
  await page.mouse.move(700, 450);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -220);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(900);
  const poKolku = await czytaj(page);
  console.log(
    `${name.padEnd(10)} start real=${przed.realny}% pokazany=${JSON.stringify(przed.pokazany)}  →  po kolku real=${poKolku.realny}% pokazany=${JSON.stringify(poKolku.pokazany)}`
  );
  await page.close();
}
await browser.close();
