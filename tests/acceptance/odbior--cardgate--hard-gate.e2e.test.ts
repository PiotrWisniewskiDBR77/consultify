/**
 * O7.1 — CARD_CONTENT_FORMULA jako TWARDA BRAMA (decyzja Piotra).
 *
 * REAL runtime (local Postgres :5443, realny lejek createInitiative, realny zapis
 * do DB, zero business-logic mocków). Dowód 4 scenariuszy z zadania:
 *
 *   1. Karta z HARD violation (placeholder/filler) → CardContentGateError(422) z
 *      LISTĄ naruszeń; inicjatywa NIE powstaje w DB.
 *   2. Dobra karta → sukces (id zwrócone, wiersz w DB).
 *   3. Walidator rzuca wyjątek (bug) → karta PRZECHODZI (fail-open) — zepsuty
 *      walidator nie blokuje lejka.
 *   4. Zawór CARD_CONTENT_HARD_GATE=off → stare zachowanie doradcze (filler
 *      przechodzi, powstaje wiersz + qualityWarnings).
 *
 * Wszystkie incydentalne wiersze mają odwracalny prefiks `odbior--cardgate--`.
 * Próba sprząta po sobie (initiatives).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import {
  assertCardMeetsFormula,
  CardContentGateError,
  CARD_GATE_BLOCKING_CODES,
  enforceCardContentGate,
  isCardHardGateEnabled,
  validateInitiativeCard,
} from '../../server/src/services/cardContentFormulaValidator.js';
import { createInitiative } from '../../server/src/services/initiative/createInitiativeService.js';

const PREFIX = 'odbior--cardgate--';

/** Titles used by this probe — cleaned up in afterAll. */
const TITLES = {
  blocked: `${PREFIX} inicjatywa z placeholderem`,
  good: `${PREFIX} skróć lead-time OTIF w linii montażu o 20%`,
  failOpen: `${PREFIX} inicjatywa fail-open`,
  valveOff: `${PREFIX} inicjatywa zawór-off`,
};

async function countByTitle(title: string): Promise<number> {
  const c = pgClient();
  await c.connect();
  try {
    const r = await c.query(
      `SELECT COUNT(*)::int AS n FROM initiatives WHERE organization_id = $1 AND (title = $2 OR name = $2)`,
      [SEED.ORG_ID, title]
    );
    return r.rows[0]?.n ?? 0;
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed(); // idempotent
  // Domyślnie ON dla całej suity; scenariusz 4 nadpisuje lokalnie.
  process.env.CARD_CONTENT_HARD_GATE = 'on';
}, 60_000);

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM initiatives WHERE organization_id = $1 AND title LIKE $2`, [
      SEED.ORG_ID,
      `${PREFIX}%`,
    ]);
    await c.query(`DELETE FROM initiatives WHERE organization_id = $1 AND name LIKE $2`, [
      SEED.ORG_ID,
      `${PREFIX}%`,
    ]);
  } finally {
    await c.end();
  }
  delete process.env.CARD_CONTENT_HARD_GATE;
});

describe('O7.1 hard gate — infrastruktura bramy', () => {
  it('domyślnie jest WŁĄCZONA (decyzja Piotra), a zawór OFF ją wyłącza', () => {
    process.env.CARD_CONTENT_HARD_GATE = 'on';
    expect(isCardHardGateEnabled()).toBe(true);
    for (const v of ['off', 'false', '0', 'no', 'disabled', 'OFF']) {
      process.env.CARD_CONTENT_HARD_GATE = v;
      expect(isCardHardGateEnabled()).toBe(false);
    }
    process.env.CARD_CONTENT_HARD_GATE = 'on';
  });

  it('lista blokująca jest WĄSKA — kompletność (kpi/raid) i heurystyki (hypothesis_format/lang_pl) NIE blokują', () => {
    expect(CARD_GATE_BLOCKING_CODES.has('initiative.no_filler')).toBe(true);
    expect(CARD_GATE_BLOCKING_CODES.has('initiative.title_present')).toBe(true);
    expect(CARD_GATE_BLOCKING_CODES.has('insight.material_quality_complete')).toBe(true);
    // Reguły podatne na false-positive / kompletności — CELOWO poza listą:
    expect(CARD_GATE_BLOCKING_CODES.has('initiative.kpi_baseline_target')).toBe(false);
    expect(CARD_GATE_BLOCKING_CODES.has('initiative.raid_mix')).toBe(false);
    expect(CARD_GATE_BLOCKING_CODES.has('initiative.hypothesis_format')).toBe(false);
    expect(CARD_GATE_BLOCKING_CODES.has('initiative.lang_pl')).toBe(false);
  });

  it('body 422 niesie LISTĘ naruszeń + wskazówki (kontrakt HTTP)', () => {
    const verdict = validateInitiativeCard({
      title: 'x',
      problem_statement: 'To jest [PLACEHOLDER] do uzupełnienia — TODO opis problemu.',
    });
    let caught: CardContentGateError | null = null;
    try {
      enforceCardContentGate(verdict);
    } catch (e) {
      caught = e as CardContentGateError;
    }
    expect(caught).toBeInstanceOf(CardContentGateError);
    const body = caught!.toResponse();
    expect(body.code).toBe('CARD_CONTENT_FORMULA_VIOLATION');
    expect(caught!.statusCode).toBe(422);
    expect(body.violations.length).toBeGreaterThan(0);
    expect(body.violations.map((v) => v.code)).toContain('initiative.no_filler');
    expect(body.violations[0]).toHaveProperty('message');
    expect(body.hint).toContain('•');
  });
});

describe('O7.1 hard gate — realny lejek createInitiative (Postgres :5443)', () => {
  it('SCENARIUSZ 1: karta z HARD violation → 422 z listą; inicjatywa NIE powstaje w DB', async () => {
    process.env.CARD_CONTENT_HARD_GATE = 'on';
    let caught: CardContentGateError | null = null;
    try {
      await createInitiative(
        SEED.ORG_ID,
        {
          title: TITLES.blocked,
          sourceType: 'manual',
          // Placeholder/filler w prozie → initiative.no_filler (HARD, na liście blokującej).
          problemStatement:
            'Opis problemu: [do uzupełnienia] — Lorem ipsum, TODO dokończyć analizę.',
        },
        { validate: false, allowMissingProject: true }
      );
    } catch (e) {
      caught = e as CardContentGateError;
    }
    expect(caught).toBeInstanceOf(CardContentGateError);
    expect(caught!.statusCode).toBe(422);
    expect(caught!.toResponse().violations.map((v) => v.code)).toContain('initiative.no_filler');
    // NIE powstała w DB.
    expect(await countByTitle(TITLES.blocked)).toBe(0);
  });

  it('SCENARIUSZ 2: dobra karta → sukces; wiersz istnieje w DB', async () => {
    process.env.CARD_CONTENT_HARD_GATE = 'on';
    const res = await createInitiative(
      SEED.ORG_ID,
      {
        title: TITLES.good,
        sourceType: 'manual',
        problemStatement:
          'Linia montażu notuje wskaźnik OTIF na poziomie 78% wobec celu 95%, ' +
          'co generuje kary umowne i przestoje. Skrócenie lead-time o 20% odblokuje przepustowość.',
      },
      { validate: false, allowMissingProject: true }
    );
    expect(res.id).toBeTruthy();
    expect(await countByTitle(TITLES.good)).toBe(1);
  });

  it('SCENARIUSZ 3: walidator rzuca wyjątek → karta PRZECHODZI (fail-open)', async () => {
    process.env.CARD_CONTENT_HARD_GATE = 'on';

    // (a) Dowód, że taki wejściowy obiekt FAKTYCZNIE wywala walidator...
    const poison = {
      get title(): string {
        throw new Error('symulowany bug walidatora');
      },
    };
    expect(() => validateInitiativeCard(poison as never)).toThrow('symulowany bug walidatora');

    // (b) ...a mimo to BRAMA go przepuszcza (zwraca null, nie rzuca) — zepsuty
    //     walidator NIGDY nie blokuje lejka.
    let errSeen: unknown = null;
    const verdict = assertCardMeetsFormula('initiative', poison as never, {
      onValidatorError: (e) => {
        errSeen = e;
      },
    });
    expect(verdict).toBeNull();
    expect((errSeen as Error)?.message).toContain('symulowany bug');

    // (c) I dowód w realnym lejku: nawet gdy karta niesie filler (który normalnie
    //     blokuje), z fail-open na poziomie funkcji bramy karta o czystej prozie
    //     przechodzi i powstaje w DB.
    const res = await createInitiative(
      SEED.ORG_ID,
      { title: TITLES.failOpen, sourceType: 'manual', problemStatement: 'Czysty, konkretny opis.' },
      { validate: false, allowMissingProject: true }
    );
    expect(res.id).toBeTruthy();
    expect(await countByTitle(TITLES.failOpen)).toBe(1);
  });

  it('SCENARIUSZ 4: zawór OFF → doradczo (filler przechodzi, powstaje wiersz)', async () => {
    process.env.CARD_CONTENT_HARD_GATE = 'off';
    const res = await createInitiative(
      SEED.ORG_ID,
      {
        title: TITLES.valveOff,
        sourceType: 'manual',
        problemStatement: 'Opis z placeholderem [TODO] — Lorem ipsum.',
      },
      { validate: false, allowMissingProject: true }
    );
    expect(res.id).toBeTruthy();
    expect(await countByTitle(TITLES.valveOff)).toBe(1);
    process.env.CARD_CONTENT_HARD_GATE = 'on';
  });
});
