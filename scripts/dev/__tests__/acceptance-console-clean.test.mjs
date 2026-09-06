import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRASY_16_MODULOW,
  agregujWynik,
  parseArgs,
  podsumuj,
} from '../odbior-zywo/acceptance-console-clean.mjs';

test('parser zachowuje jawny port, host, czas oczekiwania i plik raportu', () => {
  assert.deepEqual(parseArgs(['--host=127.0.0.1', '--port=3097', '--czekaj=2500', '--out=ev/p5.json']), {
    host: '127.0.0.1',
    port: 3097,
    czekajMs: 2500,
    out: 'ev/p5.json',
  });
  assert.equal(TRASY_16_MODULOW.length, 16);
  assert.equal(new Set(TRASY_16_MODULOW).size, 16);
});

test('agregacja liczy console error i tylko odpowiedzi >=400, a pusta allowlista zamyka bramkę', () => {
  const wynik = agregujWynik({
    trasa: '/my-work',
    startedAt: 100,
    finishedAt: 475,
    konsola: [{ typ: 'console', tekst: 'boom' }],
    odpowiedzi: [
      { status: 200, url: 'http://localhost/api/ok' },
      { status: 404, url: 'http://localhost/api/missing' },
      { status: 503, url: 'http://localhost/api/down' },
    ],
  });

  assert.deepEqual(wynik, {
    trasa: '/my-work',
    konsolowychBledow: 1,
    siecUprawnien4xx5xx: [
      { status: 404, url: 'http://localhost/api/missing' },
      { status: 503, url: 'http://localhost/api/down' },
    ],
    czasMs: 375,
  });
  assert.deepEqual(podsumuj([wynik]), {
    tras: 1,
    ekranyZBledami: 1,
    konsolowychBledow: 1,
    odpowiedzi4xx5xx: 2,
    gate: 'FAIL',
  });
});

test('czysty mianownik przechodzi bramkę', () => {
  const wyniki = TRASY_16_MODULOW.map((trasa) =>
    agregujWynik({ trasa, startedAt: 0, finishedAt: 10, konsola: [], odpowiedzi: [] }),
  );
  assert.equal(podsumuj(wyniki).gate, 'PASS');
  assert.equal(podsumuj(wyniki).ekranyZBledami, 0);
});
