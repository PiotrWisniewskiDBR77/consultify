/**
 * MVP FINAL — rejestr i mapa modułów.
 * Pilnuje trzech rzeczy, na których stoi cała mechanika:
 *  1) rejestr ma kształt, którego oczekuje bezpiecznik,
 *  2) mapa 16 modułów nie rozjeżdża się z kanonicznym bindingiem (SSOT wave3),
 *  3) korzenie i katalogi zrzutów naprawdę istnieją (a nie tylko są wpisane).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  MODULY,
  KLUCZ_WSPOLNE,
  SCIEZKA_REJESTRU,
  KATALOG_ZRZUTOW_ZYWO,
  zamrozonePliki,
} from '../../../scripts/mvp-final/moduly.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const BINDINGS = 'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json';

test('rejestr istnieje, jest poprawnym JSON-em i ma pola, których szuka bezpiecznik', () => {
  const p = path.join(repoRoot, SCIEZKA_REJESTRU);
  assert.ok(fs.existsSync(p), `${SCIEZKA_REJESTRU} musi istnieć — bezpiecznik czyta ten plik`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(typeof j.moduly, 'object');
  assert.ok('wspolne' in j, 'rejestr musi mieć osobną listę wspólnych');
  assert.match(j._opis, /ODMROZENIE/, 'opis rejestru ma tłumaczyć, jak odmrozić');
});

test('zamrozonePliki: skleja moduły i wspólne w jedną mapę plik -> moduł', () => {
  const mapa = zamrozonePliki({
    moduly: { '13_CHAT': { pliki: ['a.tsx', 'b.tsx'] }, '14_ADMIN': { pliki: ['c.tsx'] } },
    wspolne: { pliki: ['d.tsx'] },
  });
  assert.equal(mapa.get('a.tsx'), '13_CHAT');
  assert.equal(mapa.get('c.tsx'), '14_ADMIN');
  assert.equal(mapa.get('d.tsx'), KLUCZ_WSPOLNE);
  assert.equal(mapa.size, 4);
});

test('mapa ma dokładnie 16 modułów i pokrywa się z kanonicznym bindingiem wave3', () => {
  const klucze = Object.keys(MODULY);
  assert.equal(klucze.length, 16, 'denominator = 16, tak jak w verify:canonical-16');
  const bindings = JSON.parse(fs.readFileSync(path.join(repoRoot, BINDINGS), 'utf8'));
  const zBindingu = new Set(bindings.modules.map((m) => m.id));
  const zMapy = new Set(klucze.map((k) => MODULY[k].bindingId));
  assert.deepEqual([...zMapy].sort(), [...zBindingu].sort(), 'każdy moduł mapy ma swój wpis w bindings.json');
});

test('klucze modułów odpowiadają katalogom rejestru odbioru WAVE_03', () => {
  const kat = path.join(repoRoot, 'docs/program/waves/WAVE_03_ACCEPTANCE/modules');
  const naDysku = fs.readdirSync(kat).filter((d) => fs.statSync(path.join(kat, d)).isDirectory()).sort();
  assert.deepEqual(Object.keys(MODULY).sort(), naDysku);
});

test('każdy korzeń modułu naprawdę istnieje w src/', () => {
  const braki = [];
  for (const [k, def] of Object.entries(MODULY)) {
    for (const kor of def.korzenie) if (!fs.existsSync(path.join(repoRoot, kor))) braki.push(`${k}: ${kor}`);
  }
  assert.deepEqual(braki, [], 'korzeń nieistniejący = pusta lista plików = zamrożenie-atrapa');
});

test('każde terytorium modułu naprawdę istnieje (katalog albo plik)', () => {
  const braki = [];
  for (const [k, def] of Object.entries(MODULY)) {
    for (const t of def.terytorium || []) if (!fs.existsSync(path.join(repoRoot, t))) braki.push(`${k}: ${t}`);
  }
  assert.deepEqual(braki, []);
});

test('zadeklarowane katalogi zrzutów są rozłączne (jeden katalog = jeden moduł)', () => {
  const widziane = new Map();
  for (const [k, def] of Object.entries(MODULY)) {
    for (const kat of def.katalogi) {
      assert.ok(!widziane.has(kat), `katalog ${kat} przypisany do ${widziane.get(kat)} i ${k}`);
      widziane.set(kat, k);
    }
  }
});

test('zamroz.mjs --dry-run nic nie zapisuje i podaje liczby', () => {
  const przed = fs.readFileSync(path.join(repoRoot, SCIEZKA_REJESTRU), 'utf8');
  const r = spawnSync('node', ['scripts/mvp-final/zamroz.mjs', '--modul=13_CHAT', '--dry-run'], {
    cwd: repoRoot, encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /plików własnych \(zamrażanych\): \d+/);
  assert.match(r.stdout, /POZA zamrożeniem/);
  assert.equal(fs.readFileSync(path.join(repoRoot, SCIEZKA_REJESTRU), 'utf8'), przed, '--dry-run nie ma prawa dotknąć rejestru');
});

test('zamroz.mjs odmawia bez --decyzja i przy nieznanym module', () => {
  const bezDecyzji = spawnSync('node', ['scripts/mvp-final/zamroz.mjs', '--modul=13_CHAT'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(bezDecyzji.status, 2);
  assert.match(bezDecyzji.stderr, /--decyzja/);
  const zly = spawnSync('node', ['scripts/mvp-final/zamroz.mjs', '--modul=99_NIE_MA', '--decyzja=x'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(zly.status, 2);
});

test('katalog zrzutów odbioru na żywo: raportujemy stan, nie udajemy że jest', () => {
  // Ten test nie wymaga, żeby zrzuty istniały (powstają w dniu odbioru) — pilnuje tylko,
  // że stała ścieżki jest ta sama, na którą wskazuje instrukcja odbioru.
  assert.equal(KATALOG_ZRZUTOW_ZYWO, 'evidence/odbior-zywo-20260905');
});
