// Zrzuty dowodowe toru funkcji — „droga dojścia", 2026-09-02.
// Wymaga uruchomionego harnessu dev-render: 
//   npx vite --config dev-render/vite.config.ts --port 58231 --strictPort
// `&uwagi=0` wycina pływające kontrolki harnessu z kadru (lekcja
// „przyrząd zasłania produkt" — kontrola musi być mechaniczna, nie na oko).
import { chromium } from 'playwright';

const BASE = process.env.WOLACZE_BASE || 'http://localhost:58231';
const OUT = '/private/tmp/wolacze-0902/evidence/wolacze-20260902';

const shots = JSON.parse(process.env.WOLACZE_SHOTS || '[]');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200)); });

for (const shot of shots) {
  console.log('→', shot.name, shot.url);
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(shot.wait ?? 2500);
  for (const sel of shot.clicks ?? []) {
    const loc = page.locator(sel).first();
    if (await loc.count()) { await loc.click(); await page.waitForTimeout(900); }
    else console.log('  ! brak elementu:', sel);
  }
  if (shot.expect) {
    const n = await page.locator(shot.expect).count();
    console.log(`  kontrola mechaniczna „${shot.expect}": ${n} trafien ${n > 0 ? 'OK' : '← BRAK, zrzut nie dowodzi niczego'}`);
  }
  await page.screenshot({ path: `${OUT}/${shot.name}`, fullPage: false });
  console.log('  zapisano', `${OUT}/${shot.name}`);
}
await browser.close();
