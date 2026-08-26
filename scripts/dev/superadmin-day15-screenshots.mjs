// Day 15 P.6 evidence capture manifest. Run against the local dev-render on :4340.
// The committed PNGs are captured in a browser-controlled session from these exact URLs.
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.DAY15_BASE_URL || 'http://127.0.0.1:4340';
const OUT =
  process.env.DAY15_EVIDENCE_DIR ||
  'docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/evidence-superadmin-day15';

const shots = [
  ['platform-operations-light-pl.png', 'lang=pl&theme=light&scene=ready'],
  ['platform-operations-dark-pl.png', 'lang=pl&theme=dark&scene=ready'],
  ['platform-operations-light-en.png', 'lang=en&theme=light&scene=ready'],
  ['platform-operations-dark-en.png', 'lang=en&theme=dark&scene=ready'],
  ['platform-operations-empty-light-pl.png', 'lang=pl&theme=light&scene=empty'],
  ['platform-operations-catalog-error-dark-en.png', 'lang=en&theme=dark&scene=error'],
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [name, query] of shots) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/?screen=superadmin-platform-operations-day15&${query}`, {
    waitUntil: 'networkidle',
  });
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
  await context.close();
}
await browser.close();
