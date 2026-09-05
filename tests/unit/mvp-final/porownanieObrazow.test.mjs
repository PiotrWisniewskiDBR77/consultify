/**
 * MVP FINAL — silnik porównania zrzutów.
 * Bez tego testu „ZGODNY" jest tylko napisem. Sprawdzamy na wygenerowanych PNG-ach:
 * identyczne, jeden inny piksel, inne wymiary, oraz to, że diff.png naprawdę powstaje.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

import { porownajObrazy, SILNIK, wymiaryPng } from '../../../scripts/mvp-final/porownaj-obrazy.mjs';

const require_ = createRequire(import.meta.url);
let PNG = null;
try { PNG = require_('pngjs').PNG; } catch { /* brak pngjs — część testów pominięta świadomie */ }

const kat = fs.mkdtempSync(path.join(os.tmpdir(), 'mvp-final-png-'));
function zrobPng(nazwa, szer, wys, malarz) {
  const png = new PNG({ width: szer, height: wys });
  for (let y = 0; y < wys; y++) for (let x = 0; x < szer; x++) {
    const o = (y * szer + x) * 4;
    const [r, g, b] = malarz(x, y);
    png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255;
  }
  const p = path.join(kat, nazwa);
  fs.writeFileSync(p, PNG.sync.write(png));
  return p;
}

test('silnik jest realny, nie awaryjny SHA (w repo jest pngjs)', () => {
  assert.notEqual(SILNIK, 'sha', 'jeśli tu wypada sha, porównanie nie poda % pikseli — to regres narzędzia');
});

test('wymiaryPng czyta rozmiar bez biblioteki', { skip: !PNG }, () => {
  const p = zrobPng('rozmiar.png', 7, 3, () => [10, 20, 30]);
  assert.deepEqual(wymiaryPng(p), { w: 7, h: 3 });
});

test('identyczne obrazy = ZGODNY, 0%', { skip: !PNG }, async () => {
  const a = zrobPng('a1.png', 40, 20, (x, y) => [x * 2, y * 2, 100]);
  const b = zrobPng('b1.png', 40, 20, (x, y) => [x * 2, y * 2, 100]);
  const w = await porownajObrazy(a, b, path.join(kat, 'd1.png'), { root: kat });
  assert.equal(w.werdykt, 'ZGODNY');
  assert.equal(w.procent, 0);
  assert.equal(fs.existsSync(path.join(kat, 'd1.png')), false, 'przy zerze różnic nie ma po co pisać diffa');
});

test('jeden zmieniony piksel na 800 przekracza próg 0.1% i daje diff.png', { skip: !PNG }, async () => {
  const a = zrobPng('a2.png', 40, 20, () => [255, 255, 255]);
  const b = zrobPng('b2.png', 40, 20, (x, y) => (x === 5 && y === 5 ? [0, 0, 0] : [255, 255, 255]));
  const w = await porownajObrazy(a, b, path.join(kat, 'd2.png'), { root: kat });
  assert.equal(w.werdykt, 'ROZNI_SIE');
  assert.ok(w.procent > 0.1 && w.procent < 1, `spodziewane ~0.125%, jest ${w.procent}`);
  assert.ok(fs.existsSync(path.join(kat, 'd2.png')), 'diff.png musi powstać');
  assert.equal(w.diff, 'd2.png');
});

test('różnica poniżej progu tolerancji koloru (delta 12) nie jest zgłaszana', { skip: !PNG }, async () => {
  const a = zrobPng('a3.png', 40, 20, () => [200, 200, 200]);
  const b = zrobPng('b3.png', 40, 20, () => [205, 205, 205]);
  const w = await porownajObrazy(a, b, path.join(kat, 'd3.png'), { root: kat });
  assert.equal(w.werdykt, 'ZGODNY', 'szum kompresji/antyaliasu nie ma podnosić alarmu');
});

test('inne wymiary = ROZNI_SIE bez liczenia pikseli', { skip: !PNG }, async () => {
  const a = zrobPng('a4.png', 40, 20, () => [255, 255, 255]);
  const b = zrobPng('b4.png', 40, 21, () => [255, 255, 255]);
  const w = await porownajObrazy(a, b, path.join(kat, 'd4.png'), { root: kat });
  assert.equal(w.werdykt, 'ROZNI_SIE');
  assert.match(w.opis, /inne wymiary 40x20 vs 40x21/);
});

test('próg da się podnieść świadomie', { skip: !PNG }, async () => {
  const a = zrobPng('a5.png', 40, 20, () => [255, 255, 255]);
  const b = zrobPng('b5.png', 40, 20, (x, y) => (x === 5 && y === 5 ? [0, 0, 0] : [255, 255, 255]));
  const w = await porownajObrazy(a, b, path.join(kat, 'd5.png'), { root: kat, prog: 1 });
  assert.equal(w.werdykt, 'ZGODNY');
});
