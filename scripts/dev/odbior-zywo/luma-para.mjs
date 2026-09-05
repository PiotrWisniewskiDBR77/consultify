#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { meanLuma } from '../lib/meanLuma.mjs';

export const PROGI_LUMA = Object.freeze({ jasnyMin: 150, ciemnyMax: 110, roznicaMin: 40 });

export async function sprawdzPare(jasnyPath, ciemnyPath) {
  const jasny = await meanLuma(jasnyPath);
  const ciemny = await meanLuma(ciemnyPath);
  const roznica = jasny - ciemny;
  const warunki = {
    jasny: jasny > PROGI_LUMA.jasnyMin,
    ciemny: ciemny < PROGI_LUMA.ciemnyMax,
    roznica: roznica >= PROGI_LUMA.roznicaMin,
  };
  return { ok: Object.values(warunki).every(Boolean), jasny, ciemny, roznica, warunki };
}

async function main() {
  const [jasnyPath, ciemnyPath] = process.argv.slice(2);
  if (!jasnyPath || !ciemnyPath || !fs.existsSync(jasnyPath) || !fs.existsSync(ciemnyPath)) {
    console.error('Użycie: node scripts/dev/odbior-zywo/luma-para.mjs <jasny.png> <ciemny__dark.png>');
    process.exitCode = 2;
    return;
  }
  const wynik = await sprawdzPare(jasnyPath, ciemnyPath);
  console.log(JSON.stringify({
    ...wynik,
    jasny: Number(wynik.jasny.toFixed(2)),
    ciemny: Number(wynik.ciemny.toFixed(2)),
    roznica: Number(wynik.roznica.toFixed(2)),
  }));
  if (!wynik.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
