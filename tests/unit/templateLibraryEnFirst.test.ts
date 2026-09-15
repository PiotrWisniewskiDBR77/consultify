/**
 * Template Library — English first (DEC-461, F8b 2026-09-15).
 *
 * The Materials → Template Library screenshot taken for the trade show
 * (cto-codex/final-targi-20260915/zrzuty/47-materials-templates-fin) showed 22
 * Polish cards inside the "Application" bucket. This suite is the regression
 * gate for the two places that produce those cards:
 *
 *   1. the code catalog `deliverableTemplateSeedService.ts`, and
 *   2. the English side of the repair migration
 *      `server/migrations/20260915_template_library_en_first.sql` (which owns
 *      the rows that exist only in the database).
 *
 * The check is a Polish-word dictionary plus diacritics, exactly as specified:
 * a name or description on the English side that contains any of them fails.
 *
 * NOT asserted here: the `[System] … (PL)` templates. Those are a deliberate
 * language pair whose Polish half is the Polish-output template — its name
 * carries the (PL) marker, and renaming it would remove a feature.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DBR77_DECK_TEMPLATES,
  DBR77_DOC_TEMPLATES,
  DBR77_TABLE_TEMPLATES,
} from '../../server/src/services/deliverableTemplateSeedService.js';

/** Spec dictionary + Polish diacritics. Whole words only, case-insensitive. */
const PL_WORDS = [
  'i',
  'oraz',
  'dla',
  'raport',
  'tygodniowy',
  'zadania',
  'obciążenia',
  'status',
  'wskaźniki',
  'rodzin',
  'kontrakt',
];
const PL_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * `status` is also an English word, so a naive substring match would fail every
 * English description that legitimately contains it. Only the Polish-specific
 * dictionary entries and the diacritics decide.
 */
const EN_HOMOGRAPHS = new Set(['i', 'status']);
const PL_ONLY_WORDS = PL_WORDS.filter((w) => !EN_HOMOGRAPHS.has(w));

function polishHitsIn(text: string): string[] {
  const hits: string[] = [];
  if (PL_DIACRITICS.test(text)) hits.push('diacritics');
  for (const word of PL_ONLY_WORDS) {
    if (new RegExp(`\\b${word}\\b`, 'iu').test(text)) hits.push(word);
  }
  return hits;
}

const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../server/migrations/20260915_template_library_en_first.sql'),
  'utf-8'
);

/** Parse the ('pl', 'en name', 'en description') VALUES tuples of the migration. */
function migrationRows(): Array<{ pl: string; enName: string; enDescription: string }> {
  const body = MIGRATION.split('INSERT INTO tmp_tpl_en_first')[1] ?? '';
  const tuple = /\(\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\s*\)/g;
  const rows: Array<{ pl: string; enName: string; enDescription: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = tuple.exec(body))) {
    rows.push({
      pl: match[1].replace(/''/g, "'"),
      enName: match[2].replace(/''/g, "'"),
      enDescription: match[3].replace(/''/g, "'"),
    });
  }
  return rows;
}

describe('Template Library catalog — EN first', () => {
  const catalog = [
    ...DBR77_DOC_TEMPLATES.map((t) => ({ name: t.name, description: t.description })),
    ...DBR77_DECK_TEMPLATES.map((t) => ({ name: t.name, description: t.description })),
    ...DBR77_TABLE_TEMPLATES.map((t) => ({ name: t.name, description: t.description })),
  ];

  it('ships a non-empty catalog (a passing empty set would prove nothing)', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(9);
  });

  it.each(catalog)('template "$name" has no Polish in its name', ({ name }) => {
    expect(polishHitsIn(name)).toEqual([]);
  });

  it.each(catalog)('template "$name" has no Polish in its description', ({ description }) => {
    expect(polishHitsIn(description)).toEqual([]);
  });

  it('has no Polish diacritics anywhere in the catalog source', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../server/src/services/deliverableTemplateSeedService.ts'),
      'utf-8'
    );
    expect(PL_DIACRITICS.test(source)).toBe(false);
  });
});

describe('Template Library repair migration — EN side', () => {
  const rows = migrationRows();

  it('parses every mapped template (guards against a silently empty regex)', () => {
    expect(rows.length).toBe(25);
  });

  it.each(rows)('"$pl" maps to an English name', ({ enName }) => {
    expect(polishHitsIn(enName)).toEqual([]);
  });

  it.each(rows)('"$pl" maps to an English description', ({ enDescription }) => {
    expect(polishHitsIn(enDescription)).toEqual([]);
  });

  it('covers every Polish template name seen on the trade-show screenshot', () => {
    const observed = [
      'Raport Steering',
      'Cotygodniowy status PMO (PMO Weekly Status)',
      'Streszczenie wykonawcze (Executive Summary)',
      'Uzasadnienie biznesowe (Business Case)',
      'Raport diagnostyczny DRD (Diagnostic Report)',
      'Aktualizacja dla komitetu sterującego (Steering Committee Update)',
      'Jednostronicowy raport dla sponsora (Sponsor One-Pager)',
      'Deck raportu końcowego (Final Report Deck)',
      'Przegląd komitetu sterującego (Steering Review)',
      'Deck rekomendacji Minto (Recommendation Deck)',
      'Prezentacja ustaleń SCR (Findings Readout)',
      'Deck otwarcia projektu (Kickoff Deck)',
      'Finance — Sekcja finansowa raportu',
      'Program — Raport 3 osi (czas × zadania × wartość)',
      'Raport statusowy',
      'Raport audytowy',
    ];
    const mapped = new Set(rows.map((r) => r.pl));
    expect(observed.filter((name) => !mapped.has(name))).toEqual([]);
  });

  it('keeps the jargon out of the two descriptions that leaked it', () => {
    for (const fragment of ['Z111', 'financeRatioFamilyCatalog', 'R1-R8', '_KONCEPT_RDZEN']) {
      const inValues = rows.some(
        (r) => r.enName.includes(fragment) || r.enDescription.includes(fragment)
      );
      expect(inValues, `jargon "${fragment}" still in a client-facing string`).toBe(false);
    }
  });
});
