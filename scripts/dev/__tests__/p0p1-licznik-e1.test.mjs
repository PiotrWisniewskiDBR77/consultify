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

test('R1: SHA_NIEISTNIEJACY z DAY320_RESOLUTIONS blokuje z dokładnym powodem', () => {
  const rows = evaluateCorpus(corpus({
    settlement: table(['MYW-CV-REC-001']),
  }), { floor: 1, shaCheck: () => 'SHA_NIEISTNIEJACY' });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'SHA_NIEISTNIEJACY');
  assert.equal(rows[0].proof, 'af75a84e37:SHA_NIEISTNIEJACY');
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
  const rows = [{ id: 'INT-OWN-001', verdict: 'BLOKUJE', reason: 'NIEROZSTRZYGNIETE', proof: 'brak', inheritance: '—', origins: 'settlement' }];
  const first = renderRegister(rows, { marker: 'aaaaaaaaaa', snapshotDate: '2026-09-04' });
  const second = renderRegister(rows, { marker: 'bbbbbbbbbb', snapshotDate: '2026-12-31' });

  assert.match(first, /Marker: `aaaaaaaaaa`/);
  assert.match(first, /--marker aaaaaaaaaa --snapshot-date 2026-09-04/);
  assert.match(second, /Marker: `bbbbbbbbbb`/);
  assert.match(second, /--marker bbbbbbbbbb --snapshot-date 2026-12-31/);
  assert.notEqual(first.split('\n| ID |')[0], second.split('\n| ID |')[0]);
  assert.equal(first.split('\n| ID |')[1], second.split('\n| ID |')[1]);
});

test('dziedziczenie DEC: pozycja bez własnego DEC dziedziczy rodzinę, a bez decyzji blokuje', () => {
  const decision = 'DEC-2026-09-03-777';
  const withFamilyDecision = evaluateCorpus(corpus({
    settlement: table(['INT-OWN-001']),
    owner: `| R-7 | decyzja rodziny | ${decision} |\n## R-7. Rodzina\n| \`INT-OWN-001\` | pozycja bez własnego cytatu |`,
    ledger: `| ${decision} | decyzja istnieje |`,
  }), { floor: 1 });
  assert.equal(withFamilyDecision[0].verdict, 'ZAMKNIETE_DEC');
  assert.equal(withFamilyDecision[0].inheritance, `R-7 → ${decision}`);

  const withoutFamilyDecision = evaluateCorpus(corpus({
    settlement: table(['INT-OWN-001']),
    owner: '## R-7. Rodzina\n| `INT-OWN-001` | pozycja bez własnego cytatu |',
  }), { floor: 1 });
  assert.equal(withoutFamilyDecision[0].verdict, 'BLOKUJE');
  assert.equal(withoutFamilyDecision[0].inheritance, '—');
});

test('R6: rozstrzygnięcia BRAK_SHA wymagają istniejącego SHA lub DEC, a brak dowodu nadal blokuje', () => {
  const decision = 'DEC-2026-08-28-151';
  const rows = evaluateCorpus(corpus({
    settlement: table(['EXE-OWN-006', 'EXE-OWN-001']),
    decisions: `## R1c\n${table(['ASM-OWN-024[OF]'], 'NAPRAWIONE', decision)}\n## Koniec`,
    ledger: `| ${decision} | decyzja istnieje |`,
  }), { floor: 3, shaCheck: (_root, sha) => sha === 'b470536a91' ? 'OK' : 'SHA_NIEISTNIEJACY' });

  assert.deepEqual(rows.map(({ id, verdict, reason }) => ({ id, verdict, reason })), [
    { id: 'ASM-OWN-024[OF]', verdict: 'ZAMKNIETE_DEC', reason: 'DEC_OK' },
    { id: 'EXE-OWN-001', verdict: 'BLOKUJE', reason: 'NIEROZSTRZYGNIETE' },
    { id: 'EXE-OWN-006', verdict: 'NAPRAWIONE', reason: 'SHA_OK' },
  ]);
});
