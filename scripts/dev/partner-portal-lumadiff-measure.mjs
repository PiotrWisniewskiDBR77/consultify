// Jednorazowy pomiar par light/dark dla zrzutów modułu 16 „Partner"
// (evidence/grafika/16-partner). Liczy różnicę średniej jasności (luma,
// jak w scripts/dev/lib/meanLuma.mjs) ORAZ procent pikseli różnych między
// parą — dwie niezależne miary, tak jak zażądano w zleceniu (KLAUDE.md #7:
// para light/dark musi się REALNIE różnić, liczby wpisane do raportu, nie
// deklaracja "wygląda inaczej").
import fs from 'fs';
import path from 'path';

import sharp from 'sharp';

const DIR = path.resolve(process.cwd(), 'evidence/grafika/16-partner');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png'));

const pairs = new Map();
for (const f of files) {
  const m = f.match(/^(.+)__PRZED__(light|dark)\.png$/);
  if (!m) continue;
  const [, base, theme] = m;
  const entry = pairs.get(base) || {};
  entry[theme] = path.join(DIR, f);
  pairs.set(base, entry);
}

async function meanLuma(p) {
  const stats = await sharp(p).stats();
  const [r, g, b] = stats.channels;
  return 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean;
}

async function percentDifferentPixels(pLight, pDark) {
  const imgL = sharp(pLight).ensureAlpha();
  const imgD = sharp(pDark).ensureAlpha();
  const [metaL, metaD] = await Promise.all([imgL.metadata(), imgD.metadata()]);
  const w = Math.min(metaL.width, metaD.width);
  const h = Math.min(metaL.height, metaD.height);
  const [bufL, bufD] = await Promise.all([
    sharp(pLight).ensureAlpha().resize(w, h).raw().toBuffer(),
    sharp(pDark).ensureAlpha().resize(w, h).raw().toBuffer(),
  ]);
  let diffCount = 0;
  const totalPixels = w * h;
  const THRESH = 24; // suma różnic RGB > próg = piksel "różny" (odporność na kompresję)
  for (let i = 0; i < bufL.length; i += 4) {
    const dr = Math.abs(bufL[i] - bufD[i]);
    const dg = Math.abs(bufL[i + 1] - bufD[i + 1]);
    const db = Math.abs(bufL[i + 2] - bufD[i + 2]);
    if (dr + dg + db > THRESH) diffCount++;
  }
  return (diffCount / totalPixels) * 100;
}

const wyniki = [];
for (const [base, entry] of [...pairs.entries()].sort()) {
  if (!entry.light || !entry.dark) {
    wyniki.push({ base, status: `BRAK PARY (ma tylko ${entry.light ? 'light' : 'dark'})` });
    continue;
  }
  const [lumaL, lumaD] = await Promise.all([meanLuma(entry.light), meanLuma(entry.dark)]);
  const lumaDiff = Math.abs(lumaL - lumaD);
  const pctDiff = await percentDifferentPixels(entry.light, entry.dark);
  wyniki.push({
    base,
    lumaLight: lumaL.toFixed(1),
    lumaDark: lumaD.toFixed(1),
    lumaDiff: lumaDiff.toFixed(1),
    pctDiff: pctDiff.toFixed(1),
  });
}

console.log('ekran'.padEnd(34), 'luma light'.padEnd(11), 'luma dark'.padEnd(10), 'różnica luma'.padEnd(13), '% pikseli różnych');
console.log('─'.repeat(95));
for (const w of wyniki) {
  if (w.status) {
    console.log(w.base.padEnd(34), w.status);
    continue;
  }
  console.log(
    w.base.padEnd(34),
    w.lumaLight.padEnd(11),
    w.lumaDark.padEnd(10),
    w.lumaDiff.padEnd(13),
    `${w.pctDiff}%`
  );
}

fs.writeFileSync(
  path.join(DIR, '_luma-pixel-diff.json'),
  JSON.stringify(wyniki, null, 2)
);
console.log(`\nZapisano → ${path.join(DIR, '_luma-pixel-diff.json')}`);
