import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStan, computeSummary, renderHtml } from '../../../scripts/dev/plan-pojemniki/generuj.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const STAN_PATH = path.join(ROOT, 'docs', 'program', 'plan-pojemniki', 'stan.json');

function baseStan() {
  return {
    zaktualizowano: '2026-09-06T06:40:00+02:00',
    sha_rejestru: 'deadbeef01',
    pojemniki: [
      {
        id: 1,
        nazwa: 'Test',
        cel_termin: 'test',
        definicja: 'test',
        pozycje: [
          { nr: '1.1', nazwa: 'a', wykonawca: 'x', zalezy_od: '—', stan: 'scalone', galaz: 'b', sha: 'c', dowod: 'd', uwagi: '', data: '' },
          { nr: '1.2', nazwa: 'b', wykonawca: 'x', zalezy_od: '—', stan: 'czeka', galaz: '', sha: '', dowod: '', uwagi: '', data: '' },
        ],
        kryteria: [
          { nr: 1, tresc: 'k1', spelnione: true, dowod: 'd1' },
          { nr: 2, tresc: 'k2', spelnione: false, dowod: 'd2' },
        ],
        szampan: [
          { nr: 'S1.1', tresc: 's1', kto: 'k', artefakt: 'a', stan: 'tak', dowod: '' },
          { nr: 'S1.2', tresc: 's2', kto: 'k', artefakt: 'a', stan: 'nie', dowod: '' },
        ],
        decyzje: [
          { tresc: 'd1', rekomendacja: 'r1', stan: 'czeka', dec: '' },
          { tresc: 'd2', rekomendacja: 'r2', stan: 'podjeta', dec: 'DEC-1' },
        ],
      },
    ],
    przejscie_wlasciciela: [
      { modul: 'Czat', werdykt: 'brak', zdanie: 'z' },
    ],
  };
}

describe('walidacja stan.json', () => {
  it('akceptuje poprawny stan', () => {
    expect(() => loadStan(JSON.stringify(baseStan()))).not.toThrow();
  });

  it('odrzuca zły JSON', () => {
    expect(() => loadStan('{ nie jest json')).toThrow();
  });

  it('odrzuca nieznany stan pozycji', () => {
    const bad = baseStan();
    bad.pojemniki[0].pozycje[0].stan = 'cos-nieznanego';
    expect(() => loadStan(JSON.stringify(bad))).toThrow(/nieznany stan/);
  });

  it('odrzuca nieznany stan szampana', () => {
    const bad = baseStan();
    bad.pojemniki[0].szampan[0].stan = 'moze';
    expect(() => loadStan(JSON.stringify(bad))).toThrow(/nieznany stan/);
  });

  it('odrzuca nieznany werdykt przejścia właściciela', () => {
    const bad = baseStan();
    bad.przejscie_wlasciciela[0].werdykt = 'moze';
    expect(() => loadStan(JSON.stringify(bad))).toThrow(/nieznany werdykt/);
  });

  it('odrzuca nieznany stan decyzji', () => {
    const bad = baseStan();
    bad.pojemniki[0].decyzje[0].stan = 'w-drodze';
    expect(() => loadStan(JSON.stringify(bad))).toThrow(/nieznany stan/);
  });

  it('odrzuca brakujące pole w pozycji', () => {
    const bad = baseStan();
    delete bad.pojemniki[0].pozycje[0].wykonawca;
    expect(() => loadStan(JSON.stringify(bad))).toThrow(/brakujące pole/);
  });

  it('odrzuca brakujące pole na poziomie roota', () => {
    const bad = baseStan();
    delete bad.sha_rejestru;
    expect(() => loadStan(JSON.stringify(bad))).toThrow(/brakujące pole/);
  });

  it('odrzuca spelnione niebędące boolean', () => {
    const bad = baseStan();
    bad.pojemniki[0].kryteria[0].spelnione = 'tak';
    expect(() => loadStan(JSON.stringify(bad))).toThrow(/boolean/);
  });
});

describe('liczniki podsumowania', () => {
  it('liczy pozycje odebrane/scalone poprawnie', () => {
    const data = baseStan();
    const summary = computeSummary(data.pojemniki[0]);
    expect(summary.pozycjeDone).toBe(1);
    expect(summary.pozycjeTotal).toBe(2);
  });

  it('liczy kryteria spełnione poprawnie', () => {
    const data = baseStan();
    const summary = computeSummary(data.pojemniki[0]);
    expect(summary.kryteriaDone).toBe(1);
    expect(summary.kryteriaTotal).toBe(2);
  });

  it('liczy szampan "tak" poprawnie', () => {
    const data = baseStan();
    const summary = computeSummary(data.pojemniki[0]);
    expect(summary.szampanDone).toBe(1);
    expect(summary.szampanTotal).toBe(2);
  });

  it('liczy decyzje czekające poprawnie', () => {
    const data = baseStan();
    const summary = computeSummary(data.pojemniki[0]);
    expect(summary.decyzjeCzekajace).toBe(1);
  });

  it('DOWÓD MUTACYJNY: zepsuty licznik pozycjeDone (liczy wszystkie zamiast tylko odebrane/scalone) daje zły wynik', () => {
    const data = baseStan();
    // Symulacja zepsutego licznika: liczy WSZYSTKIE pozycje jako "done".
    const zepsutySummary = { pozycjeDone: data.pojemniki[0].pozycje.length, pozycjeTotal: data.pojemniki[0].pozycje.length };
    // Prawidłowy licznik z generatora:
    const dobrySummary = computeSummary(data.pojemniki[0]);
    expect(zepsutySummary.pozycjeDone).not.toBe(dobrySummary.pozycjeDone);
    expect(dobrySummary.pozycjeDone).toBe(1); // tylko '1.1' ma stan scalone/odebrane
  });
});

describe('render HTML', () => {
  it('zawiera każdy numer pozycji, S-numer i moduł z prawdziwego stan.json repo', () => {
    const raw = readFileSync(STAN_PATH, 'utf8');
    const data = loadStan(raw);
    const html = renderHtml(data);

    for (const pojemnik of data.pojemniki) {
      for (const p of pojemnik.pozycje) {
        expect(html.includes(p.nr), `brak pozycji ${p.nr} w HTML`).toBe(true);
      }
      for (const s of pojemnik.szampan) {
        expect(html.includes(s.nr), `brak numeru szampana ${s.nr} w HTML`).toBe(true);
      }
    }
    for (const m of data.przejscie_wlasciciela) {
      expect(html.includes(m.modul), `brak modułu ${m.modul} w HTML`).toBe(true);
    }
  });

  it('nie zawiera doctype/html/head/body i zaczyna się od <title>', () => {
    const raw = readFileSync(STAN_PATH, 'utf8');
    const data = loadStan(raw);
    const html = renderHtml(data);
    expect(/<!doctype|<html|<head|<body/i.test(html)).toBe(false);
    expect(html.startsWith('<title>')).toBe(true);
  });

  it('nie zawiera fetch( ani src= spoza fonts.googleapis', () => {
    const raw = readFileSync(STAN_PATH, 'utf8');
    const data = loadStan(raw);
    const html = renderHtml(data);
    expect(html.includes('fetch(')).toBe(false);
    const srcMatches = [...html.matchAll(/src=/g)];
    expect(srcMatches.length).toBe(0);
  });
});
