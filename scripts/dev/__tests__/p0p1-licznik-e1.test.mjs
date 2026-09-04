import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateCorpus, gateResult, renderRegister } from '../p0p1-licznik-e1.mjs';

const table = (ids, verdict = 'OTWARTE', proof = 'brak') => [
  '| ID | Werdykt | Dowód |',
  '|---|---|---|',
  ...ids.map((id) => `| \`${id}\` | ${verdict} | ${proof} |`),
].join('\n');

const corpus = ({ settlement = '', decisions = '', owner = '', wave2 = '', ledger = '' } = {}) => ({
  settlement,
  decisions,
  owner,
  wave2,
  ledger,
});

test('mutacja: kolizja ASM z owner-feedback zachowuje dwa obiekty', () => {
  const rows = evaluateCorpus(corpus({
    settlement: table(['ASM-OWN-001']),
    decisions: `## R1c\n${table(['ASM-OWN-001[OF]'])}\n## Koniec`,
  }), { floor: 2, shaCheck: () => 'OK' });
  assert.deepEqual(rows.map(({ id }) => id), ['ASM-OWN-001', 'ASM-OWN-001[OF]']);
});

test('mutacja: nieistniejący DEC czerwieni pozycję', () => {
  const rows = evaluateCorpus(corpus({
    settlement: table(['INT-OWN-001']),
    owner: '| R-1 | `INT-OWN-001` | `DEC-2026-09-03-999` |',
  }), { floor: 1, shaCheck: () => 'OK' });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.match(rows[0].reason, /^DEC_NIEISTNIEJACY:/);
});

test('mutacja: nieistniejący SHA czerwieni pozycję', () => {
  const rows = evaluateCorpus(corpus({
    settlement: table(['INT-OWN-001'], 'NAPRAWIONE', 'commit deadbeef00'),
  }), { floor: 1, shaCheck: () => 'SHA_NIEISTNIEJACY' });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'SHA_NIEISTNIEJACY');
});

test('mutacja: mianownik poniżej podłogi zatrzymuje parser', () => {
  assert.throws(
    () => evaluateCorpus(corpus({ settlement: table(['INT-OWN-001']) }), { floor: 2 }),
    /mianownik mniejszy niż spodziewany/,
  );
});

test('mutacja: pozycja bez werdyktu ląduje w BLOKUJE', () => {
  const rows = evaluateCorpus(corpus({ settlement: table(['INT-OWN-001']) }), { floor: 1 });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'NIEROZSTRZYGNIETE');
});

test('bramka: kod wyjścia wynika z rzeczywistej liczby BLOKUJE, a tryb informacyjny nie czerwieni', () => {
  const output = '/tmp/rejestr.md';
  const clear = gateResult([{ verdict: 'NAPRAWIONE' }], output);
  assert.equal(clear.exitCode, 0);

  const blocked = gateResult([{ verdict: 'BLOKUJE' }], output);
  assert.equal(blocked.exitCode, 1);
  assert.match(blocked.message, /BLOKUJE: 1/);
  assert.match(blocked.message, /\/tmp\/rejestr\.md/);

  const informational = gateResult([{ verdict: 'BLOKUJE' }], output, { informational: true });
  assert.equal(informational.exitCode, 0);
});

test('nagłówek: marker i data z argumentów zmieniają metadane, nie tabelę werdyktów', () => {
  const rows = [{ id: 'INT-OWN-001', verdict: 'BLOKUJE', reason: 'NIEROZSTRZYGNIETE', proof: 'brak', origins: 'settlement' }];
  const first = renderRegister(rows, { marker: 'aaaaaaaaaa', snapshotDate: '2026-09-04' });
  const second = renderRegister(rows, { marker: 'bbbbbbbbbb', snapshotDate: '2026-12-31' });

  assert.match(first, /Marker: `aaaaaaaaaa`/);
  assert.match(first, /--marker aaaaaaaaaa --snapshot-date 2026-09-04/);
  assert.match(second, /Marker: `bbbbbbbbbb`/);
  assert.match(second, /--marker bbbbbbbbbb --snapshot-date 2026-12-31/);
  assert.notEqual(first.split('\n| ID |')[0], second.split('\n| ID |')[0]);
  assert.equal(first.split('\n| ID |')[1], second.split('\n| ID |')[1]);
});
