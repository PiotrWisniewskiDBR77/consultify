#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const TRASY_16_MODULOW = Object.freeze([
  '/organization',
  '/interview',
  '/discovery-tools',
  '/assessment',
  '/initiatives',
  '/execution',
  '/my-work',
  '/meeting',
  '/results',
  '/finance',
  '/presentations',
  '/audit-programs',
  '/chat',
  '/admin',
  '/settings',
  '/partner',
]);

// Każdy przyszły wyjątek musi mieć jawny wpis i uzasadnienie w przeglądzie kodu.
export const ALLOWLISTA = Object.freeze([]);

export function parseArgs(argv) {
  const wartosc = (nazwa, domyslna) => {
    const prefiks = `--${nazwa}=`;
    const argument = argv.find((element) => element.startsWith(prefiks));
    return argument ? argument.slice(prefiks.length) : domyslna;
  };

  return {
    host: wartosc('host', 'localhost'),
    port: Number(wartosc('port', '3000')),
    czekajMs: Number(wartosc('czekaj', '1800')),
    out: wartosc('out', ''),
  };
}

export function agregujWynik({ trasa, startedAt, finishedAt, konsola, odpowiedzi, allowlista = ALLOWLISTA }) {
  const dozwolony = (zdarzenie) =>
    allowlista.some((wpis) => wpis.trasa === trasa && wpis.test(zdarzenie));
  const konsolowe = konsola.filter((zdarzenie) => !dozwolony(zdarzenie));
  const sieciowe = odpowiedzi.filter((zdarzenie) => zdarzenie.status >= 400 && !dozwolony(zdarzenie));

  return {
    trasa,
    konsolowychBledow: konsolowe.length,
    siecUprawnien4xx5xx: sieciowe,
    czasMs: Math.max(0, finishedAt - startedAt),
  };
}

export function podsumuj(wyniki) {
  const ekranyZBledami = wyniki.filter(
    (wynik) => wynik.konsolowychBledow > 0 || wynik.siecUprawnien4xx5xx.length > 0,
  ).length;
  return {
    tras: wyniki.length,
    ekranyZBledami,
    konsolowychBledow: wyniki.reduce((suma, wynik) => suma + wynik.konsolowychBledow, 0),
    odpowiedzi4xx5xx: wyniki.reduce((suma, wynik) => suma + wynik.siecUprawnien4xx5xx.length, 0),
    gate: ekranyZBledami === 0 ? 'PASS' : 'FAIL',
  };
}

async function main() {
  const { chromium } = await import('playwright');
  const opcje = parseArgs(process.argv.slice(2));
  const auth = process.env.ODBIOR_AUTH_STATE;
  if (!opcje.out || !auth || !fs.existsSync(auth)) {
    console.error('Wymagane: --out oraz ODBIOR_AUTH_STATE wskazujący istniejący plik sesji');
    process.exitCode = 2;
    return;
  }
  if (!Number.isInteger(opcje.port) || opcje.port < 1 || !Number.isFinite(opcje.czekajMs) || opcje.czekajMs < 0) {
    console.error('Niepoprawne --port lub --czekaj');
    process.exitCode = 2;
    return;
  }

  const baza = `http://${opcje.host}:${opcje.port}`;
  const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
  sesja.origins = (sesja.origins || []).map((origin) => ({
    ...origin,
    origin: String(origin.origin).replace('http://localhost:3000', baza),
  }));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: sesja,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    locale: 'pl-PL',
  });
  await context.addInitScript(() => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const zapis = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      zapis.state = { ...(zapis.state || {}), theme: 'light' };
      localStorage.setItem('consultify-storage', JSON.stringify(zapis));
      document.documentElement.classList.remove('dark');
    } catch {}
  });

  const wyniki = [];
  try {
    for (const trasa of TRASY_16_MODULOW) {
      const page = await context.newPage();
      const konsola = [];
      const odpowiedzi = [];
      page.on('console', (komunikat) => {
        if (komunikat.type() === 'error') konsola.push({ typ: 'console', tekst: komunikat.text().slice(0, 500) });
      });
      page.on('pageerror', (blad) => konsola.push({ typ: 'pageerror', tekst: String(blad).slice(0, 500) }));
      page.on('response', (response) => {
        if (response.status() >= 400) odpowiedzi.push({ status: response.status(), url: response.url() });
      });

      const startedAt = Date.now();
      try {
        await page.goto(baza + trasa, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(opcje.czekajMs);
      } catch (blad) {
        konsola.push({ typ: 'nawigacja', tekst: String(blad).slice(0, 500) });
      }
      wyniki.push(agregujWynik({ trasa, startedAt, finishedAt: Date.now(), konsola, odpowiedzi }));
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const raport = { kiedy: new Date().toISOString(), baza, allowlista: ALLOWLISTA.length, wyniki, podsumowanie: podsumuj(wyniki) };
  fs.mkdirSync(path.dirname(opcje.out), { recursive: true });
  fs.writeFileSync(opcje.out, JSON.stringify(raport, null, 2) + '\n');
  console.log(JSON.stringify(raport, null, 2));
  if (raport.podsumowanie.gate !== 'PASS') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
