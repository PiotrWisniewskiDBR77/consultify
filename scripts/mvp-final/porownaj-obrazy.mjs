/**
 * MVP FINAL — silnik porównania dwóch PNG (wydzielony, żeby dał się przetestować
 * bez uruchamiania przeglądarki i całego CLI).
 *
 * Kolejność silników: pixelmatch (jeśli jest) → własny diff na pngjs → sharp → SHA.
 * SHA jest ostatnią deską ratunku i MÓWI WPROST, że nie zna liczby pikseli — bo
 * „nie wiem, ile" nie może się przebrać za „zgodny".
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
function zaladuj(nazwa) { try { return require_(nazwa); } catch { return null; } }

const pixelmatchMod = zaladuj('pixelmatch');
export const pixelmatch = pixelmatchMod?.default || pixelmatchMod;
export const pngjs = zaladuj('pngjs');
export const sharp = zaladuj('sharp');

export const SILNIK = pngjs && pixelmatch ? 'pixelmatch' : pngjs ? 'pngjs' : sharp ? 'sharp' : 'sha';

export function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16); }

/** Wymiary PNG z nagłówka IHDR — bez żadnej biblioteki. */
export function wymiaryPng(p) {
  const b = fs.readFileSync(p).subarray(0, 33);
  if (b.length < 24) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

export async function porownajObrazy(wzorzec, swiezy, diffOut, opcje = {}) {
  const prog = opcje.prog ?? 0.1;
  const root = opcje.root ?? process.cwd();
  const aW = wymiaryPng(wzorzec), bW = wymiaryPng(swiezy);
  if (!aW || !bW) return { werdykt: 'BLAD', procent: null, opis: 'nie da się odczytać PNG', diff: '' };
  if (aW.w !== bW.w || aW.h !== bW.h) {
    return { werdykt: 'ROZNI_SIE', procent: 100, opis: `inne wymiary ${aW.w}x${aW.h} vs ${bW.w}x${bW.h}`, diff: '' };
  }
  if (SILNIK === 'sha') {
    const rowne = sha(wzorzec) === sha(swiezy);
    return {
      werdykt: rowne ? 'ZGODNY' : 'ROZNI_SIE',
      procent: rowne ? 0 : null,
      opis: rowne
        ? 'identyczne bajty (porównanie SHA — brak pixelmatch/pngjs/sharp)'
        : 'RÓŻNE BAJTY, ale bez pixelmatch/pngjs/sharp NIE WIEM ILE pikseli — zainstaluj pngjs',
      diff: '',
    };
  }

  let a, b, szer, wys;
  if (SILNIK === 'sharp') {
    const ra = await sharp(wzorzec).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rb = await sharp(swiezy).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    a = ra.data; b = rb.data; szer = ra.info.width; wys = ra.info.height;
  } else {
    const { PNG } = pngjs;
    const pa = PNG.sync.read(fs.readFileSync(wzorzec));
    const pb = PNG.sync.read(fs.readFileSync(swiezy));
    a = pa.data; b = pb.data; szer = pa.width; wys = pa.height;
  }

  const razem = szer * wys;
  const diffBuf = pngjs ? Buffer.alloc(razem * 4) : null;
  let rozne = 0;

  if (SILNIK === 'pixelmatch') {
    rozne = pixelmatch(a, b, diffBuf, szer, wys, { threshold: 0.1 });
  } else {
    for (let i = 0; i < razem; i++) {
      const o = i * 4;
      const d = Math.max(Math.abs(a[o] - b[o]), Math.abs(a[o + 1] - b[o + 1]), Math.abs(a[o + 2] - b[o + 2]));
      const inny = d > 12;
      if (inny) rozne++;
      if (diffBuf) {
        if (inny) { diffBuf[o] = 255; diffBuf[o + 1] = 0; diffBuf[o + 2] = 0; diffBuf[o + 3] = 255; }
        else {
          const szary = Math.min(255, Math.round(((a[o] + a[o + 1] + a[o + 2]) / 3) * 0.25 + 190));
          diffBuf[o] = diffBuf[o + 1] = diffBuf[o + 2] = szary;
          diffBuf[o + 3] = 255;
        }
      }
    }
  }

  let diffSciezka = '';
  if (diffBuf && pngjs && rozne > 0 && diffOut) {
    const { PNG } = pngjs;
    const png = new PNG({ width: szer, height: wys });
    diffBuf.copy(png.data);
    fs.mkdirSync(path.dirname(diffOut), { recursive: true });
    fs.writeFileSync(diffOut, PNG.sync.write(png));
    diffSciezka = path.relative(root, diffOut);
  }
  const procent = (rozne / razem) * 100;
  return {
    werdykt: procent <= prog ? 'ZGODNY' : 'ROZNI_SIE',
    procent,
    opis: `${rozne} / ${razem} pikseli (silnik: ${SILNIK})`,
    diff: diffSciezka,
  };
}
