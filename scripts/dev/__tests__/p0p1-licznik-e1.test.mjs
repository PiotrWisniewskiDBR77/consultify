import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY320_RESOLUTIONS, collectReportedDates, defaultRoot, evaluateCorpus, gateResult, gitShaState, renderRegister } from '../p0p1-licznik-e1.mjs';

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
    settlement: table(['INT-OWN-001']),
  }), {
    floor: 1,
    resolutions: { ...DAY320_RESOLUTIONS, 'INT-OWN-001': { type: 'SHA', sha: 'af75a84e37' } },
    shaCheck: () => 'SHA_NIEISTNIEJACY',
  });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'SHA_NIEISTNIEJACY');
  assert.equal(rows[0].proof, 'af75a84e37:SHA_NIEISTNIEJACY');
});

test('R3: commit checkpoint jest widoczny i blokuje zamiast udawać naprawę', () => {
  const rows = evaluateCorpus(corpus({
    settlement: table(['INT-OWN-001']),
  }), {
    floor: 1,
    resolutions: { ...DAY320_RESOLUTIONS, 'INT-OWN-001': { type: 'SHA', sha: 'af75a84e37' } },
    shaCheck: gitShaState,
  });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'SHA_CHECKPOINT');
  assert.equal(rows[0].proof, 'af75a84e37:SHA_CHECKPOINT');
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
  const executionDecision = 'DEC-2026-08-24-03';
  const rows = evaluateCorpus(corpus({
    settlement: table(['EXE-OWN-006', 'EXE-OWN-001']),
    decisions: `## R1c\n${table(['ASM-OWN-024[OF]'], 'NAPRAWIONE', decision)}\n## Koniec`,
    ledger: `| ${decision} | decyzja istnieje |\n| ${executionDecision} | decyzja istnieje |`,
  }), { floor: 3, shaCheck: (_root, sha) => sha === 'b470536a91' ? 'OK' : 'SHA_NIEISTNIEJACY' });

  assert.deepEqual(rows.map(({ id, verdict, reason }) => ({ id, verdict, reason })), [
    { id: 'ASM-OWN-024[OF]', verdict: 'ZAMKNIETE_DEC', reason: 'DEC_OK' },
    { id: 'EXE-OWN-001', verdict: 'ZAMKNIETE_DEC', reason: 'DEC_OK' },
    { id: 'EXE-OWN-006', verdict: 'NAPRAWIONE', reason: 'SHA_OK' },
  ]);
});

// ── Zawężone dopasowanie dyspozycji decyzji (przeniesione z dyżuru 334, R3) ──
// Reguła czyta WIERSZ LEDGERU cytowanej decyzji, a nie cały tekst dowodowy
// pozycji. Testy idą realną ścieżką `classify` — bez wstrzykiwania `shaCheck`.

test('R3: jawna decyzja PO BRAMKACH klasyfikuje pozycję jako ODLOZONE_DEC', () => {
  const decision = 'DEC-2026-09-03-364';
  const rows = evaluateCorpus(corpus({
    settlement: table(['ASM-OWN-003']),
    ledger: `| ${decision} | ASM-OWN-003 | OWNER_DECISION | właściciel PO BRAMKACH (fala 2) |`,
  }), {
    floor: 1,
    resolutions: { 'ASM-OWN-003': { type: 'DECISION', decision } },
  });
  assert.equal(rows[0].verdict, 'ODLOZONE_DEC');
  assert.equal(rows[0].reason, 'DEC_OK');
});

test('R3: samo słowo NIE w ledgerze nie odkłada jawnej decyzji', () => {
  const decision = 'DEC-2026-09-03-365';
  const rows = evaluateCorpus(corpus({
    settlement: table(['ASM-OWN-004']),
    ledger: `| ${decision} | ASM-OWN-004 | OWNER_DECISION | naprawić teraz, nie usuwać ekranu |`,
  }), {
    floor: 1,
    resolutions: { 'ASM-OWN-004': { type: 'DECISION', decision } },
  });
  assert.equal(rows[0].verdict, 'ZAMKNIETE_DEC');
});

test('R3: gałąź fallback też czyta ledger, a nie cały tekst dowodowy', () => {
  const decision = 'DEC-2026-09-03-367';
  // Tekst dowodowy zawiera słowo "nie" (kiedyś odkładało pozycję), ale wiersz
  // ledgeru mówi "TAK, teraz" — o dyspozycji decyduje ledger.
  const rows = evaluateCorpus(corpus({
    settlement: table(['ASM-OWN-001[OF]'], 'OTWARTE', `nie ma jeszcze zrzutu; ${decision}`),
    ledger: `| ${decision} | R-4 | OWNER_DECISION | właściciel TAK, teraz |`,
  }), { floor: 1 });
  assert.equal(rows[0].verdict, 'ZAMKNIETE_DEC');

  const deferred = evaluateCorpus(corpus({
    settlement: table(['ASM-OWN-001[OF]'], 'OTWARTE', `zrobione i zamknięte; ${decision}`),
    ledger: `| ${decision} | R-4 | OWNER_DECISION | właściciel PO BRAMKACH (fala 2) |`,
  }), { floor: 1 });
  assert.equal(deferred[0].verdict, 'ODLOZONE_DEC');
});

// ─────────────────────────────────────────────────────────────────────────────
// R3 — bezpiecznik „SHA musi być MŁODSZY niż zgłoszenie defektu".
//
// ★ Te testy NIE wstrzykują `shaCheck`. Wstrzyknięcie `shaCheck: () => '...'`
// omija badane zabezpieczenie i nie dowodzi niczego — dyżur 334 właśnie tak
// „udowodnił" swój bezpiecznik. Poniżej domyślny `gitShaState` liczy realną
// datę realnego commita w realnym repozytorium.
// ─────────────────────────────────────────────────────────────────────────────

// `7b7ec198aa` = 2026-07-15, `d0b5172c19` = 2026-07-24 — dokładnie te SHA,
// którymi dyżur 334 zamknął uwagi właściciela zgłoszone 2026-08-22.
const STARY_SHA = '7b7ec198aa';

test('R3: SHA starszy niż zgłoszenie blokuje (realna ścieżka, bez wstrzykiwania)', () => {
  const rows = evaluateCorpus(corpus({ settlement: table(['MYW-DEC-REC-001']) }), {
    floor: 1,
    root: defaultRoot,
    resolutions: { 'MYW-DEC-REC-001': { type: 'SHA', sha: STARY_SHA } },
    reportedDates: { 'MYW-DEC-REC-001': '2026-08-22' },
  });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'SHA_STARSZY_NIZ_ZGLOSZENIE');
  assert.equal(rows[0].proof, `${STARY_SHA}:SHA_STARSZY_NIZ_ZGLOSZENIE`);
});

test('R3: ten sam SHA pod zgłoszeniem WCZEŚNIEJSZYM od commita przechodzi', () => {
  const rows = evaluateCorpus(corpus({ settlement: table(['MYW-DEC-REC-001']) }), {
    floor: 1,
    root: defaultRoot,
    resolutions: { 'MYW-DEC-REC-001': { type: 'SHA', sha: STARY_SHA } },
    reportedDates: { 'MYW-DEC-REC-001': '2026-07-01' },
  });
  assert.equal(rows[0].verdict, 'NAPRAWIONE');
  assert.equal(rows[0].reason, 'SHA_OK');
});

test('R3: brak daty zgłoszenia NIE przepuszcza po cichu', () => {
  const rows = evaluateCorpus(corpus({ settlement: table(['MYW-DEC-REC-001']) }), {
    floor: 1,
    root: defaultRoot,
    resolutions: { 'MYW-DEC-REC-001': { type: 'SHA', sha: STARY_SHA } },
    reportedDates: {},
  });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'SHA_BRAK_DATY_ZGLOSZENIA');
});

test('R3: bezpiecznik obejmuje też SHA znalezione w wolnym tekście NAPRAWIONE', () => {
  // ID spoza DAY320_RESOLUTIONS — wymuszamy gałąź „SHA z wolnego tekstu".
  const rows = evaluateCorpus(corpus({
    settlement: table(['INT-OWN-001'], 'NAPRAWIONE', `commit ${STARY_SHA}`),
  }), {
    floor: 1,
    root: defaultRoot,
    reportedDates: { 'INT-OWN-001': '2026-08-22' },
  });
  assert.equal(rows[0].verdict, 'BLOKUJE');
  assert.equal(rows[0].reason, 'SHA_STARSZY_NIZ_ZGLOSZENIE');
});

test('R3: gitShaState wprost — ta sama para SHA/data w obie strony', () => {
  assert.equal(gitShaState(defaultRoot, STARY_SHA, '2026-08-22'), 'SHA_STARSZY_NIZ_ZGLOSZENIE');
  assert.equal(gitShaState(defaultRoot, STARY_SHA, '2026-07-01'), 'OK');
  assert.equal(gitShaState(defaultRoot, STARY_SHA, undefined), 'SHA_BRAK_DATY_ZGLOSZENIA');
});

test('R3: pozycja [OF] dziedziczy datę zgłoszenia bazowego ID', () => {
  const rows = evaluateCorpus(corpus({ settlement: table(['ASM-OWN-001[OF]']) }), {
    floor: 1,
    root: defaultRoot,
    resolutions: { 'ASM-OWN-001[OF]': { type: 'SHA', sha: STARY_SHA } },
    reportedDates: { 'ASM-OWN-001': '2026-08-22' },
  });
  assert.equal(rows[0].reason, 'SHA_STARSZY_NIZ_ZGLOSZENIE');
});

test('R3: daty zgłoszeń czytane z repo pokrywają wszystkie pozycje z SHA', () => {
  const dates = collectReportedDates(defaultRoot);
  const withSha = Object.entries(DAY320_RESOLUTIONS)
    .filter(([, resolution]) => resolution.type === 'SHA')
    .map(([id]) => id);
  assert.ok(withSha.length > 0, 'tabela rozstrzygnięć nie ma ani jednej pozycji SHA');
  for (const id of withSha) {
    const date = dates.get(id) ?? dates.get(id.replace('[OF]', ''));
    assert.match(date ?? '', /^\d{4}-\d{2}-\d{2}$/, `brak daty zgłoszenia dla ${id}`);
  }
});
