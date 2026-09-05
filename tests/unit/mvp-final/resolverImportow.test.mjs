/**
 * MVP FINAL — resolver importów na małym fixture.
 * Sprawdza to, na czym stoi cała lista plików modułu: import względny, alias @/,
 * index katalogu, import dynamiczny, re-export, oraz to, czego wciągać NIE WOLNO
 * (pakiety z node_modules i zakomentowane importy).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  wyciagnijSpecyfikatory,
  rozwiazSpecyfikator,
  zbierzPliki,
  jestPozaZamrozeniem,
  jestWymuszoneWspolne,
  wTerytorium,
} from '../../../scripts/mvp-final/moduly.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mvp-final-fx-'));
  const zapisz = (p, t) => { fs.mkdirSync(path.join(root, path.dirname(p)), { recursive: true }); fs.writeFileSync(path.join(root, p), t); };
  zapisz('src/Korzen.tsx', `
import React from 'react';                       // pakiet — pomijamy
import { A } from './A';                          // wzgledny bez rozszerzenia
import { B } from '@/pod/B';                      // alias @/
import Kat from './kat';                          // katalog -> index
export { C } from './C';                          // re-export
// import { Martwy } from './Martwy';             // zakomentowany liniowo
/* import { Martwy2 } from './Martwy2'; */        // zakomentowany blokowo
const leniwy = () => import('@/pod/D');           // import dynamiczny
`);
  zapisz('src/A.tsx', `import { E } from './gleboko/E';`);
  zapisz('src/gleboko/E.ts', 'export const E = 1;');
  zapisz('src/pod/B.tsx', 'export const B = 1;');
  zapisz('src/pod/D.tsx', 'export const D = 1;');
  zapisz('src/kat/index.ts', 'export default 1;');
  zapisz('src/C.ts', 'export const C = 1;');
  zapisz('src/Martwy.tsx', 'export const Martwy = 1;');
  zapisz('src/Martwy2.tsx', 'export const Martwy2 = 1;');
  return root;
}

test('wyciagnijSpecyfikatory: lapie from/import()/require/import bare, pomija komentarze', () => {
  const s = wyciagnijSpecyfikatory(`
import { A } from './A';
const x = await import('./B');
const y = require('./C');
import './D';
// import { Z } from './Z';
/* import { Y } from './Y'; */
`);
  assert.deepEqual(new Set(s), new Set(['./A', './B', './C', './D']));
});

test('rozwiazSpecyfikator: alias @/ i wzgledny; pakiet npm -> null', () => {
  const root = fixture();
  assert.equal(rozwiazSpecyfikator('@/pod/B', 'src/Korzen.tsx', root), 'src/pod/B.tsx');
  assert.equal(rozwiazSpecyfikator('./A', 'src/Korzen.tsx', root), 'src/A.tsx');
  assert.equal(rozwiazSpecyfikator('./kat', 'src/Korzen.tsx', root), 'src/kat/index.ts');
  assert.equal(rozwiazSpecyfikator('react', 'src/Korzen.tsx', root), null);
  assert.equal(rozwiazSpecyfikator('lucide-react', 'src/Korzen.tsx', root), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('zbierzPliki: domkniecie tranzytywne, bez pakietow i bez zakomentowanych', () => {
  const root = fixture();
  const pliki = zbierzPliki(['src/Korzen.tsx'], root);
  assert.deepEqual(pliki, [
    'src/A.tsx',
    'src/C.ts',
    'src/Korzen.tsx',
    'src/gleboko/E.ts',   // tranzytywnie przez A
    'src/kat/index.ts',
    'src/pod/B.tsx',
    'src/pod/D.tsx',      // import dynamiczny
  ]);
  assert.ok(!pliki.includes('src/Martwy.tsx'), 'zakomentowany import liniowo nie moze wciagac pliku');
  assert.ok(!pliki.includes('src/Martwy2.tsx'), 'zakomentowany import blokowo nie moze wciagac pliku');
  fs.rmSync(root, { recursive: true, force: true });
});

test('zbierzPliki: nieistniejacy korzen nie wysadza, ale --rzucajBrakKorzenia tak', () => {
  const root = fixture();
  assert.deepEqual(zbierzPliki(['src/NieMa.tsx'], root), []);
  assert.throws(() => zbierzPliki(['src/NieMa.tsx'], root, { rzucajBrakKorzenia: true }), /Korzeń nie istnieje/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('pliki testowe sa POZA zamrozeniem (zamrazamy produkt, nie dowod)', () => {
  assert.equal(jestPozaZamrozeniem('src/components/AIChat/__tests__/X.test.tsx'), true);
  assert.equal(jestPozaZamrozeniem('src/components/AIChat/X.test.tsx'), true);
  assert.equal(jestPozaZamrozeniem('src/components/AIChat/X.spec.ts'), true);
  assert.equal(jestPozaZamrozeniem('src/components/AIChat/X.tsx'), false);
});

test('kanon UI zawsze idzie do wspolnych (zmiana tam rusza kazdy zamrozony ekran)', () => {
  assert.equal(jestWymuszoneWspolne('src/components/standard/StandardTable.tsx'), true);
  assert.equal(jestWymuszoneWspolne('src/components/shared/ModuleHub/FilterableTable.tsx'), true);
  assert.equal(jestWymuszoneWspolne('src/components/AIChat/UnifiedChatPanel.tsx'), false);
});

test('wTerytorium: prefiks katalogu i dokladny plik', () => {
  assert.equal(wTerytorium('src/components/AIChat/X.tsx', ['src/components/AIChat/']), true);
  assert.equal(wTerytorium('src/components/AIChatOther/X.tsx', ['src/components/AIChat/']), false);
  assert.equal(wTerytorium('src/views/AIChatView.tsx', ['src/views/AIChatView.tsx']), true);
});
