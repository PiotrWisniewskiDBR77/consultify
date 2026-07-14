/**
 * DOWÓD DECK PPTX 2026-07-14 — analiza geometrii wyeksportowanego .pptx.
 * Otwiera plik jako ZIP, parsuje XML slajdów i raportuje per slajd:
 *   - liczbę kształtów, bounding boxy (cale),
 *   - elementy wystające poza slajd,
 *   - pary elementów nachodzących na siebie (z tolerancją; ignoruje tła full-bleed).
 * Uruchomienie: node server/scripts/proof-deck-pptx-analyze.mjs <plik.pptx>
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const EMU = 914400;
const file = process.argv[2];
if (!file) throw new Error('usage: node proof-deck-pptx-analyze.mjs <file.pptx>');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-proof-'));
execSync(`unzip -qq -o ${JSON.stringify(file)} -d ${JSON.stringify(tmp)}`);

const pres = fs.readFileSync(path.join(tmp, 'ppt/presentation.xml'), 'utf8');
const sz = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
const SLIDE_W = Number(sz[1]) / EMU;
const SLIDE_H = Number(sz[2]) / EMU;
console.log(`Slide size: ${SLIDE_W.toFixed(2)} x ${SLIDE_H.toFixed(2)} in`);

const slideFiles = fs
  .readdirSync(path.join(tmp, 'ppt/slides'))
  .filter((f) => /^slide\d+\.xml$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

function textOf(shapeXml) {
  const runs = [...shapeXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
  return runs.join(' ').replace(/\s+/g, ' ').trim();
}

for (const sf of slideFiles) {
  const xml = fs.readFileSync(path.join(tmp, 'ppt/slides', sf), 'utf8');
  // split into top-level shape-ish chunks: sp, pic, graphicFrame
  const chunks = [...xml.matchAll(/<p:(sp|pic|graphicFrame)>[\s\S]*?<\/p:\1>/g)];
  const boxes = [];
  for (const c of chunks) {
    const body = c[0];
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext = body.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!off || !ext) continue;
    const b = {
      kind: c[1],
      x: Number(off[1]) / EMU,
      y: Number(off[2]) / EMU,
      w: Number(ext[1]) / EMU,
      h: Number(ext[2]) / EMU,
      text: textOf(body).slice(0, 60),
      isChart: /<c:chart|graphicFrame/.test(c[1]) || /chart/.test(body.slice(0, 400)),
    };
    boxes.push(b);
  }
  const n = sf.match(/\d+/)[0];
  console.log(`\n=== Slide ${n} — ${boxes.length} shapes ===`);
  const out = [];
  const overlaps = [];
  for (const b of boxes) {
    const oob =
      b.x < -0.01 || b.y < -0.01 || b.x + b.w > SLIDE_W + 0.01 || b.y + b.h > SLIDE_H + 0.01;
    if (oob) out.push(b);
  }
  // overlap detection: skip full-bleed backgrounds (>85% of slide area) and zero-area
  const solid = boxes.filter(
    (b) => b.w * b.h > 0.01 && b.w * b.h < 0.85 * SLIDE_W * SLIDE_H
  );
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i];
      const b = solid[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 0.05 && iy > 0.05) {
        const inter = ix * iy;
        const smaller = Math.min(a.w * a.h, b.w * b.h);
        // report only meaningful overlaps (>25% of the smaller element),
        // and skip text sitting on a card/shape ~containing it (panel pattern)
        const contains =
          (a.x <= b.x + 0.06 && a.y <= b.y + 0.06 && a.x + a.w >= b.x + b.w - 0.06 && a.y + a.h >= b.y + b.h - 0.06) ||
          (b.x <= a.x + 0.06 && b.y <= a.y + 0.06 && b.x + b.w >= a.x + a.w - 0.06 && b.y + b.h >= a.y + a.h - 0.06);
        if (inter / smaller > 0.25 && !contains) overlaps.push([a, b, inter / smaller]);
      }
    }
  }
  for (const b of boxes) {
    console.log(
      `  [${b.kind}] x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} w=${b.w.toFixed(2)} h=${b.h.toFixed(2)}${b.text ? ` "${b.text}"` : ''}`
    );
  }
  if (out.length) {
    console.log(`  !! OUT-OF-BOUNDS (${out.length}):`);
    for (const b of out)
      console.log(
        `     x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} w=${b.w.toFixed(2)} h=${b.h.toFixed(2)} "${b.text}"`
      );
  }
  if (overlaps.length) {
    console.log(`  !! OVERLAPS (${overlaps.length}):`);
    for (const [a, b, r] of overlaps)
      console.log(
        `     ${Math.round(r * 100)}%: "${a.text || a.kind}" (${a.x.toFixed(2)},${a.y.toFixed(2)},${a.w.toFixed(2)}x${a.h.toFixed(2)}) <-> "${b.text || b.kind}" (${b.x.toFixed(2)},${b.y.toFixed(2)},${b.w.toFixed(2)}x${b.h.toFixed(2)})`
      );
  }
  if (!out.length && !overlaps.length) console.log('  OK: no out-of-bounds, no significant overlaps');
}
console.log(`\n(extracted to ${tmp})`);
