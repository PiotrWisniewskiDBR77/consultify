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
// ★ KAŻDY zrzut w ŚWIEŻYM kontekście. Powód (2026-09-02, złapane przez
// kontrolę mechaniczną): `isResultsVNextFlagEnabled` PERSYSTUJE jawny wybór
// z query do localStorage (`writeLocalStorage`, RN-G6 fix 2026-08-12), więc
// zrzut „flaga OFF" robiony w tym samym kontekście CO POPRZEDNI z `=1`
// pokazywał zakładkę mimo OFF. Wspólny kontekst = przyrząd kłamie.
async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}
const { page } = await freshPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200)); });

for (const shot of shots) {
  console.log('→', shot.name, shot.url);
  const { ctx: shotCtx, page: shotPage } = await freshPage();
  shotPage.on('console', () => {});
  await shotPage.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  await shotPage.waitForTimeout(shot.wait ?? 2500);
  for (const sel of shot.clicks ?? []) {
    const loc = shotPage.locator(sel).first();
    if (await loc.count()) { await loc.click(); await shotPage.waitForTimeout(900); }
    else console.log('  ! brak elementu:', sel);
  }
  if (shot.expect) {
    const n = await shotPage.locator(shot.expect).count();
    const chce = shot.expectCount ?? 'wiecej niz 0';
    const ok = shot.expectCount === undefined ? n > 0 : n === shot.expectCount;
    console.log(`  kontrola mechaniczna „${shot.expect}": ${n} trafien, oczekiwano ${chce} → ${ok ? 'OK' : '← NIEZGODNE, zrzut nie dowodzi tezy'}`);
  }
  await shotPage.screenshot({ path: `${OUT}/${shot.name}`, fullPage: false });
  console.log('  zapisano', `${OUT}/${shot.name}`);
  await shotCtx.close();
}
await browser.close();
