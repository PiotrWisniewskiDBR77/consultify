import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mergeLibraryContentJson, parseLibraryContent } from '../libraryContentMerge.js';

/**
 * Test integracyjny naprawy L11 na JEDNORAZOWEJ bazie PostgreSQL.
 *
 * Dowodzi na realnym silniku bazy, nie w pamięci:
 *  - stara implementacja gubiła 7 z 8 pól,
 *  - nowa zachowuje treść przez wielokrotny „restart procesu",
 *  - dotyczy wszystkich 31 narzędzi.
 *
 * URUCHOMIENIE (baza jednorazowa, NIGDY produkcyjna):
 *   docker run -d --name cfy-l11-pg -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=l11test -p 55433:5432 postgres:15-alpine
 *   L11_PG_URL=postgresql://postgres:test@localhost:55433/l11test npx vitest run <ten plik>
 *
 * Bez `L11_PG_URL` test jest pomijany — nie udaje, że przeszedł.
 */

const PG_URL = process.env.L11_PG_URL;
const describePg = PG_URL ? describe : describe.skip;

/** 31 kanonicznych narzędzi (Gate T0, żywy rejestr `public.tools`). */
const ALL_31 = [
  'dynamic-swot', 'market-forces', 'growth-paths', 'value-chain', 'portfolio-priority',
  'risk-uncertainty', 'capability-mapper', 'ambition-decomposer', 'focus-tradeoff',
  'narrative-engine', 'a3-problem-solving', 'vsm-builder', 'sop-builder',
  'constraint-control', 'decision-engine', 'control-tower', 'automation-pipeline',
  'smed-planner', 'dms-builder', 'inventory-autopilot', 'robotics-feasibility',
  'logistics-automation', 'rpa-scanner', 'ai-discovery', 'integration-diagnostic',
  'digital-value-pool', 'legacy-analyzer', 'data-inventory', 'pain-to-solution',
  'pain-explorer', 'process-automation',
];

const RICH_FIELDS = [
  'whatYouGet', 'whenToUse', 'inputs', 'steps',
  'outputs', 'commonMistakes', 'example', 'nextSteps',
];

/** Treść, jaką realnie wnoszą migracje 559 i 562. */
function migrationContent(toolType: string) {
  const locale = (p: string) => ({
    whatYouGet: [`${p} ${toolType} — co dostajesz`],
    whenToUse: `${p} ${toolType} — kiedy użyć`,
    inputs: [`${p} wejścia`],
    steps: [`${p} krok 1`, `${p} krok 2`],
    outputs: [`${p} wyniki`],
    commonMistakes: [`${p} typowy błąd`],
    example: `${p} przykład`,
    nextSteps: [`${p} następne kroki`],
  });
  return JSON.stringify({ en: locale('EN'), pl: locale('PL') });
}

/** Dokładnie to, co produkuje seed — wyłącznie whatYouGet. */
function seedContent(toolType: string) {
  return JSON.stringify({
    en: { whatYouGet: [`seed EN ${toolType}`] },
    pl: { whatYouGet: [`seed PL ${toolType}`] },
  });
}

describePg('L11 na jednorazowym PostgreSQL', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: PG_URL, ssl: false });
    await client.connect();
    await client.query(`DROP TABLE IF EXISTS tools_l11`);
    await client.query(`
      CREATE TABLE tools_l11 (
        name TEXT PRIMARY KEY,
        tool_type TEXT NOT NULL,
        library_content_translations TEXT
      )
    `);
  }, 60_000);

  afterAll(async () => {
    if (client) {
      await client.query(`DROP TABLE IF EXISTS tools_l11`);
      await client.end();
    }
  });

  /** Symuluje przebieg migracji 559/562 — bogata treść w bazie. */
  async function applyMigrations() {
    await client.query(`DELETE FROM tools_l11`);
    for (const t of ALL_31) {
      await client.query(
        `INSERT INTO tools_l11 (name, tool_type, library_content_translations)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET library_content_translations = EXCLUDED.library_content_translations`,
        [t, t, migrationContent(t)]
      );
    }
  }

  /** STARA implementacja: bezwarunkowy replace w ON CONFLICT. */
  async function legacySeedRun() {
    for (const t of ALL_31) {
      await client.query(
        `INSERT INTO tools_l11 (name, tool_type, library_content_translations)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET
           library_content_translations = EXCLUDED.library_content_translations`,
        [t, t, seedContent(t)]
      );
    }
  }

  /** NOWA implementacja: odczyt + merge per locale i per pole. */
  async function mergingSeedRun() {
    for (const t of ALL_31) {
      const existing = await client.query<{ library_content_translations: string | null }>(
        `SELECT library_content_translations FROM tools_l11 WHERE name = $1 OR tool_type = $1 LIMIT 1`,
        [t]
      );
      const merged = mergeLibraryContentJson(
        existing.rows[0]?.library_content_translations ?? null,
        seedContent(t)
      );
      await client.query(
        `INSERT INTO tools_l11 (name, tool_type, library_content_translations)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET
           library_content_translations = EXCLUDED.library_content_translations`,
        [t, t, merged]
      );
    }
  }

  async function readContent(toolType: string) {
    const r = await client.query<{ library_content_translations: string | null }>(
      `SELECT library_content_translations FROM tools_l11 WHERE name = $1`,
      [toolType]
    );
    return parseLibraryContent(r.rows[0]?.library_content_translations ?? null);
  }

  async function countToolsMissingFields() {
    const broken: Array<{ toolType: string; missing: string[] }> = [];
    for (const t of ALL_31) {
      const c = await readContent(t);
      const missing = RICH_FIELDS.filter((f) => c.pl?.[f] === undefined);
      if (missing.length) broken.push({ toolType: t, missing });
    }
    return broken;
  }

  it('BEFORE: migracje wnoszą 8 pól dla wszystkich 31 narzędzi', async () => {
    await applyMigrations();
    expect(await countToolsMissingFields()).toEqual([]);
  }, 60_000);

  // REPRODUKCJA DEFEKTU na realnej bazie.
  it('stara implementacja GUBI 7 z 8 pól dla wszystkich 31 narzędzi', async () => {
    await applyMigrations();
    await legacySeedRun();

    const broken = await countToolsMissingFields();
    expect(broken).toHaveLength(31);
    broken.forEach((b) => expect(b.missing).toHaveLength(7));

    const swot = await readContent('dynamic-swot');
    expect(swot.pl.whenToUse).toBeUndefined();
    expect(swot.pl.steps).toBeUndefined();
    // whatYouGet przeżywa, ale nadpisany treścią seeda
    expect(swot.pl.whatYouGet).toEqual(['seed PL dynamic-swot']);
  }, 60_000);

  it('AFTER: nowa implementacja zachowuje wszystkie 8 pól dla 31 narzędzi', async () => {
    await applyMigrations();
    await mergingSeedRun();

    expect(await countToolsMissingFields()).toEqual([]);

    const swot = await readContent('dynamic-swot');
    // istniejąca niepusta wartość wygrywa z seedem
    expect(swot.pl.whatYouGet).toEqual(['PL dynamic-swot — co dostajesz']);
    expect(swot.pl.whenToUse).toBe('PL dynamic-swot — kiedy użyć');
    expect(swot.pl.steps).toEqual(['PL krok 1', 'PL krok 2']);
  }, 60_000);

  it('RESTART x2: dwukrotny restart procesu nie degraduje danych', async () => {
    await applyMigrations();
    await mergingSeedRun(); // start 1
    const after1 = await readContent('dynamic-swot');

    await mergingSeedRun(); // restart 1
    const after2 = await readContent('dynamic-swot');

    await mergingSeedRun(); // restart 2
    const after3 = await readContent('dynamic-swot');

    expect(after2).toEqual(after1);
    expect(after3).toEqual(after1);
    expect(await countToolsMissingFields()).toEqual([]);
  }, 90_000);

  it('uzupełnia brakujące pole, nie ruszając istniejących', async () => {
    await client.query(`DELETE FROM tools_l11`);
    await client.query(
      `INSERT INTO tools_l11 (name, tool_type, library_content_translations) VALUES ($1, $1, $2)`,
      ['dynamic-swot', JSON.stringify({ pl: { whenToUse: 'zostaje nietknięte' } })]
    );

    const existing = await client.query<{ library_content_translations: string }>(
      `SELECT library_content_translations FROM tools_l11 WHERE name = 'dynamic-swot'`
    );
    const merged = mergeLibraryContentJson(
      existing.rows[0].library_content_translations,
      seedContent('dynamic-swot')
    );
    await client.query(`UPDATE tools_l11 SET library_content_translations = $1 WHERE name = 'dynamic-swot'`, [merged]);

    const c = await readContent('dynamic-swot');
    expect(c.pl.whenToUse).toBe('zostaje nietknięte');
    expect(c.pl.whatYouGet).toEqual(['seed PL dynamic-swot']);
  }, 60_000);

  it('znosi dane legacy: NULL i zepsuty JSON', async () => {
    await client.query(`DELETE FROM tools_l11`);
    await client.query(
      `INSERT INTO tools_l11 (name, tool_type, library_content_translations) VALUES
       ('a-null', 'a-null', NULL), ('b-broken', 'b-broken', '{zepsute'), ('c-scalar', 'c-scalar', '"tekst"')`
    );

    for (const t of ['a-null', 'b-broken', 'c-scalar']) {
      const row = await client.query<{ library_content_translations: string | null }>(
        `SELECT library_content_translations FROM tools_l11 WHERE name = $1`,
        [t]
      );
      const merged = mergeLibraryContentJson(row.rows[0].library_content_translations, seedContent(t));
      await client.query(`UPDATE tools_l11 SET library_content_translations = $1 WHERE name = $2`, [merged, t]);

      const c = await readContent(t);
      // po scaleniu treść seeda jest obecna, nic nie rzuciło wyjątkiem
      expect(c.pl.whatYouGet).toEqual([`seed PL ${t}`]);
    }
  }, 60_000);

  it('zachowuje nieznane pola i dodatkowe locale', async () => {
    await client.query(`DELETE FROM tools_l11`);
    await client.query(
      `INSERT INTO tools_l11 (name, tool_type, library_content_translations) VALUES ($1, $1, $2)`,
      [
        'dynamic-swot',
        JSON.stringify({
          pl: { whenToUse: 'PL', customField: 'nieznane-pole' },
          de: { whenToUse: 'DE wann' },
        }),
      ]
    );

    const row = await client.query<{ library_content_translations: string }>(
      `SELECT library_content_translations FROM tools_l11 WHERE name = 'dynamic-swot'`
    );
    const merged = mergeLibraryContentJson(row.rows[0].library_content_translations, seedContent('dynamic-swot'));
    await client.query(`UPDATE tools_l11 SET library_content_translations = $1 WHERE name = 'dynamic-swot'`, [merged]);

    const c = await readContent('dynamic-swot');
    expect(c.pl.customField).toBe('nieznane-pole');
    expect(c.de.whenToUse).toBe('DE wann');
  }, 60_000);

  it('ZERO utraconych niepustych wartości na wszystkich 31', async () => {
    await applyMigrations();
    const before = new Map<string, ReturnType<typeof parseLibraryContent>>();
    for (const t of ALL_31) before.set(t, await readContent(t));

    await mergingSeedRun();

    for (const t of ALL_31) {
      const b = before.get(t)!;
      const a = await readContent(t);
      for (const [locale, content] of Object.entries(b)) {
        for (const [field, value] of Object.entries(content as Record<string, unknown>)) {
          expect(a[locale]?.[field], `utracono ${t}.${locale}.${field}`).toEqual(value);
        }
      }
    }
  }, 120_000);
});
