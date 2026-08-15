/**
 * MAT-006B — canonical Atelier deck seed: idempotency, ownership (CAS),
 * atomicity, and read-back verification.
 *
 * These tests exist because of a live staging blocker, not a hypothesis. On the
 * Railway `demo` PostgreSQL the three Atelier decks were metadata-only rows:
 *
 *   atelier--deck--forward-board-readout  slide_count 14  deck_json NULL  unified_json NULL
 *   atelier--deck--line3-steering         slide_count 11  deck_json NULL  unified_json NULL
 *   atelier--deck--connected-play-growth  slide_count  9  deck_json NULL  unified_json NULL
 *
 * The list read the integer and promised "Ready · 11"; the builder called the
 * canonical GET, got no cards, and rendered "Card 1 of 0".
 *
 * Round 2 hardened the fix against the failure modes a naive upsert has:
 * destroying content it does not own, landing partially, and reporting success
 * for writes the database never accepted.
 *
 * Anti-false-green: the seed runs against a REAL in-memory SQLite through the
 * same `DbPromise` seam production uses — including a `transaction()` that
 * really issues BEGIN / COMMIT / ROLLBACK — and the assertions read rows BACK
 * out of that store; they are not echoes of the input. The fault-injection cases
 * make the DATABASE refuse a write (triggers, constraints), not a stub.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return {
    db: new sqlite3.Database(':memory:'),
    // Lets one test answer the schema probe the way a NON-migrated database
    // would, without dropping the table other tests need.
    tablesExist: true,
  };
});

// Real SQLite behind the persistence seam, with the schema probes answered the
// way a fully-migrated Postgres would answer them.
vi.mock('../../../utils/DbPromise.js', () => ({
  get: <T = unknown>(
    sql: string,
    params: unknown[] = [],
    options?: { fallback?: boolean }
  ): Promise<T | null> => {
    if (/information_schema\.tables/i.test(sql)) {
      return Promise.resolve({ exists: sqliteCtx.tablesExist } as T);
    }
    if (/information_schema\.columns/i.test(sql)) {
      return Promise.resolve({ exists: true } as T);
    }
    return new Promise((resolve, reject) => {
      sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) => {
        // Mirror production: `{ fallback: false }` REJECTS on a database error.
        // A mock that always resolved null would make a failed read look like
        // "no row" — i.e. like a green light to INSERT over content.
        if (err && options?.fallback === false) return reject(err);
        resolve(err ? null : ((row || null) as T | null));
      });
    });
  },
  all: <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
    new Promise((resolve) => {
      sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
        resolve(err ? [] : ((rows || []) as T[]))
      );
    }),
  // ★ Mirrors PRODUCTION semantics for `{ fallback: true }`: DbPromise.run
  // RESOLVES `{ success: false, error }` on a database error, it does NOT
  // reject. A mock that threw here would be kinder than production and would
  // hide the exact bug this suite exists to prevent — a seed that counts a
  // rejected INSERT as a written deck.
  run: (
    sql: string,
    params: unknown[] = [],
    options?: { fallback?: boolean }
  ): Promise<{ success: boolean; changes?: number; error?: string }> =>
    new Promise((resolve, reject) => {
      sqliteCtx.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
        if (err) {
          if (options?.fallback === false) return reject(err);
          return resolve({ success: false, error: err.message });
        }
        resolve({ success: true, changes: this.changes });
      });
    }),
  // ★ A REAL transaction, not a stub that returns success. Same shape as
  // `DbPromise.transaction`: BEGIN, statements in order, COMMIT — and ROLLBACK
  // on the first error. Without a real ROLLBACK here the atomicity test would
  // be measuring the mock instead of the seed.
  transaction: (
    statements: Array<{ sql: string; params: unknown[] }>
  ): Promise<{ success: boolean; error?: string; results: unknown[] }> => {
    const exec = (sql: string, params: unknown[] = []) =>
      new Promise<void>((resolve, reject) => {
        sqliteCtx.db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
      });
    return (async () => {
      try {
        await exec('BEGIN TRANSACTION');
        for (const stmt of statements) await exec(stmt.sql, stmt.params);
        await exec('COMMIT');
        return { success: true, results: [] };
      } catch (error) {
        try {
          await exec('ROLLBACK');
        } catch {
          /* rollback of a never-started transaction is not interesting here */
        }
        return { success: false, error: (error as Error).message, results: [] };
      }
    })();
  },
}));

import { advisoryLockKey } from '../../../utils/pinnedPgTransaction.js';
import { resolveDeckContentCoherence } from '../../presentationDeckDocumentService.js';
import {
  ATELIER_DECK_SLUGS,
  type AtelierDeckBackup,
  type AtelierDeckBackupRow,
  atelierDeckId,
  atelierDeckLockKey,
  type AtelierDeckPostState,
  buildRollbackSql,
  fingerprintDeckContent,
  materializeAtelierDeck,
  planAtelierPresentationDecks,
  readAtelierDeckBackup,
  readAtelierDeckPostState,
  rollbackAtelierDecksOnPinnedClient,
  seedAtelierPresentationDecks,
} from '../atelierPresentationDeckSeed.js';
import {
  getAtelierPresentationDecks,
  isDbWritableDeckStatus,
} from '../atelierPresentationDeckTemplate.js';

const ORG = 'atelier';
const OTHER_ORG = 'other-tenant';
const ANCHOR = '2026-06-01T00:00:00.000Z';
const STEERING = atelierDeckId(ORG, 'line3-steering');

interface DeckRow {
  id: string;
  organization_id: string;
  title: string;
  status: string;
  slide_count: number;
  deck_json: string | null;
  unified_json: string | null;
  version: number;
  updated_at: string;
}

function ddl(): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.exec(
      `CREATE TABLE IF NOT EXISTS presentation_decks (
         id TEXT PRIMARY KEY,
         organization_id TEXT,
         title TEXT,
         description TEXT,
         template_id TEXT NOT NULL DEFAULT 'default',
         deck_type TEXT,
         audience TEXT,
         goal TEXT,
         language TEXT,
         confidentiality TEXT,
         theme TEXT,
         presentation_mode TEXT,
         source_type TEXT,
         source_id TEXT,
         source_artifacts TEXT,
         outline_json TEXT,
         unified_json TEXT,
         deck_json TEXT,
         source_refs_json TEXT,
         slide_count INTEGER DEFAULT 0,
         status TEXT,
         generated_by TEXT,
         created_by TEXT,
         version INTEGER NOT NULL DEFAULT 1,
         created_at TIMESTAMP,
         updated_at TIMESTAMP,
         -- The live CHECK, copied verbatim from the Railway demo PostgreSQL
         -- (verified read-only 2026-08-01) and declared in migrations 568 /
         -- 20260314. Without it this seam is MORE permissive than production and
         -- would happily accept a status the real database rejects, which is
         -- exactly how a seed can be green in tests and write nothing on demo.
         CHECK (status IN ('draft', 'generating', 'ready', 'exported', 'failed'))
       );`,
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function rows(sql: string, params: unknown[] = []): Promise<DeckRow[]> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.all(sql, params, (err: Error | null, result: unknown[]) =>
      err ? reject(err) : resolve((result || []) as DeckRow[])
    );
  });
}

function exec(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

function allRows(): Promise<DeckRow[]> {
  return rows('SELECT * FROM presentation_decks ORDER BY id');
}

/**
 * Every column the seed's upsert names, in the upsert's own order. Used to prove
 * the BACKUP and the ROLLBACK cover all of them — a backup narrower than the
 * write is a restore that silently keeps part of the overwrite.
 */
const UPSERT_TARGET_COLUMNS = [
  'id',
  'organization_id',
  'title',
  'description',
  'template_id',
  'deck_type',
  'audience',
  'goal',
  'language',
  'confidentiality',
  'theme',
  'presentation_mode',
  'source_type',
  'source_id',
  'source_artifacts',
  'outline_json',
  'unified_json',
  'deck_json',
  'source_refs_json',
  'slide_count',
  'status',
  'generated_by',
  'created_by',
  'created_at',
  'updated_at',
  'version',
];

function sampleRow(): AtelierDeckBackupRow {
  return {
    id: atelierDeckId(ORG, 'forward-board-readout'),
    organization_id: ORG,
    title: 'Forward Board Readout',
    description: 'Board readout',
    template_id: 'executive-standard',
    deck_type: 'board_update',
    audience: 'board',
    goal: 'inform',
    language: 'en',
    confidentiality: 'internal',
    theme: 'corporate',
    presentation_mode: 'standard',
    source_type: 'initiative',
    source_id: 'atelier--initiative--x',
    source_artifacts: '[]',
    outline_json: '[]',
    unified_json: '{"slides":[]}',
    deck_json: '{"cards":[]}',
    source_refs_json: '[]',
    slide_count: 14,
    status: 'ready',
    generated_by: 'system',
    created_by: 'system',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    version: 3,
  };
}

beforeAll(() => ddl());
afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
    })
);
beforeEach(async () => {
  sqliteCtx.tablesExist = true;
  await exec('DELETE FROM presentation_decks');
});

describe('MAT-006B — canonical Atelier deck materialization (pure)', () => {
  it('every template materializes exactly one card per declared slide', () => {
    const templates = getAtelierPresentationDecks();
    expect(templates.length).toBe(3);
    for (const template of templates) {
      const materialized = materializeAtelierDeck({
        organizationId: ORG,
        template,
        anchorDate: new Date(ANCHOR),
      });
      expect(materialized.document.cards.length, `${template.slug} lost cards`).toBe(
        template.slides.length
      );
      expect(materialized.slideCount).toBe(materialized.document.cards.length);
      // Every card must carry renderable substance, not an empty husk.
      for (const card of materialized.document.cards) {
        expect(card.title.trim().length, `${template.slug} card without a title`).toBeGreaterThan(
          0
        );
        expect(card.blocks.length, `${template.slug} card without blocks`).toBeGreaterThan(0);
      }
    }
  });

  it('the deck named in the staging blocker carries 11 executive slides', () => {
    const template = getAtelierPresentationDecks().find((d) => d.slug === 'line3-steering');
    expect(template).toBeDefined();
    const materialized = materializeAtelierDeck({
      organizationId: ORG,
      template: template!,
      anchorDate: new Date(ANCHOR),
    });
    expect(materialized.deckId).toBe('atelier--deck--line3-steering');
    expect(materialized.slideCount).toBe(11);
    // Traceability back to the Line 3 Digital Twin initiative must survive
    // materialization — the deck's whole claim is that it is generated from work.
    const refIds = materialized.document.source_refs.map((ref) => ref.artifact_id);
    expect(refIds).toContain('initiative:line-3-digital-twin');
    expect(refIds).toContain('kpi:result-line3-oee');
    // The gate decision the steering committee is asked to take.
    const titles = materialized.document.cards.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('line 3 digital twin'))).toBe(true);
  });

  it('every seeded status is accepted by the LIVE database CHECK, not just by the TS union', () => {
    // The TypeScript `DeckStatus` union admits 'generated' | 'editing' |
    // 'shared' | 'archived'; presentation_decks_status_check does NOT. Asserting
    // against the TS union here is what let `status: 'shared'` reach review.
    for (const template of getAtelierPresentationDecks()) {
      expect(
        isDbWritableDeckStatus(template.status),
        `${template.slug}: '${template.status}' violates presentation_decks_status_check`
      ).toBe(true);
    }
    // Guard the guard: the helper must actually reject a TS-legal but DB-illegal
    // status, otherwise the assertion above is vacuous.
    expect(isDbWritableDeckStatus('shared')).toBe(false);
    expect(isDbWritableDeckStatus('archived')).toBe(false);
  });

  it('the slug list and the template registry cannot drift apart', () => {
    expect([...ATELIER_DECK_SLUGS]).toEqual(getAtelierPresentationDecks().map((t) => t.slug));
  });
});

describe('MAT-006B — content fingerprint (seed ownership marker)', () => {
  it('ignores the seed marker, so a stamped document hashes like an unstamped one', () => {
    const template = getAtelierPresentationDecks()[0];
    const m = materializeAtelierDeck({
      organizationId: ORG,
      template,
      anchorDate: new Date(ANCHOR),
    });
    const bare = JSON.stringify(m.document);
    const unified = JSON.stringify(m.unifiedJson);
    const fingerprint = fingerprintDeckContent(bare, unified);
    const stamped = JSON.stringify({
      ...m.document,
      seed: { source: 'atelier-canonical', fingerprint },
    });
    // Self-consistency: this is the property the whole CAS rests on.
    expect(fingerprintDeckContent(stamped, unified)).toBe(fingerprint);
  });

  it('changes when a single card title changes', () => {
    const template = getAtelierPresentationDecks()[0];
    const m = materializeAtelierDeck({
      organizationId: ORG,
      template,
      anchorDate: new Date(ANCHOR),
    });
    const unified = JSON.stringify(m.unifiedJson);
    const before = fingerprintDeckContent(JSON.stringify(m.document), unified);
    const edited = JSON.parse(JSON.stringify(m.document));
    edited.cards[0].title = 'Human edit';
    expect(fingerprintDeckContent(JSON.stringify(edited), unified)).not.toBe(before);
  });
});

describe('MAT-006B — canonical Atelier deck seed (real SQL)', () => {
  it('persists every deck with slide_count derived from the stored content', async () => {
    const result = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
    });
    // The counter is only trustworthy alongside the failure list — assert both.
    expect(result.failures).toEqual([]);
    expect(result.applied).toBe(true);
    expect(result.decks).toBe(3);
    expect(result.plan.map((p) => p.outcome)).toEqual(['inserted', 'inserted', 'inserted']);
    expect(result.plan.every((p) => p.nextVersion === 1)).toBe(true);

    const stored = await rows(
      'SELECT * FROM presentation_decks WHERE organization_id = ? ORDER BY id',
      [ORG]
    );
    expect(stored.length).toBe(3);

    for (const row of stored) {
      const parsed = JSON.parse(String(row.deck_json));
      expect(parsed.cards.length, `${row.id} content/count mismatch`).toBe(row.slide_count);
      // Both content columns are written — a deck with only one of them is what
      // makes edit and export diverge later in the lifecycle.
      expect(row.unified_json, `${row.id} missing unified_json`).toBeTruthy();
      expect(JSON.parse(String(row.unified_json)).slides.length).toBe(row.slide_count);
      // The ownership marker the CAS depends on is actually persisted.
      expect(parsed.seed?.source).toBe('atelier-canonical');
      expect(parsed.seed?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(row.version).toBe(1);
    }

    const steering = stored.find((r) => r.id === STEERING);
    expect(steering).toBeDefined();
    expect(steering!.slide_count).toBe(11);
    expect(steering!.status).toBe('ready');
  });

  it('is idempotent: a second run writes nothing, leaves byte-identical rows, and does not bump version', async () => {
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    const first = await allRows();

    const second = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    const after = await allRows();

    expect(second.unchanged).toBe(3);
    expect(second.decks).toBe(0);
    expect(second.skipped).toBe(0);
    expect(second.failures).toEqual([]);
    expect(second.plan.every((p) => p.outcome === 'unchanged')).toBe(true);
    // ★ The guarantee: no statement was issued, so not a byte moved — including
    // `version` and `updated_at`, which a blind upsert would have touched.
    expect(after).toEqual(first);
    expect(after.every((r) => r.version === 1)).toBe(true);
  });

  it('converges a pre-existing metadata-only row instead of leaving the count empty', async () => {
    // Reproduce the exact live shape: a "Ready · 11" row with no content at all.
    await exec(
      `INSERT INTO presentation_decks
         (id, organization_id, title, template_id, slide_count, status, version, deck_json, unified_json)
       VALUES (?, ?, ?, 'executive-standard', 11, 'ready', 4, NULL, NULL)`,
      [STEERING, ORG, 'Line 3 Digital Twin — Steering Committee Deck']
    );

    const before = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    // Guard the premise: without the seed this row IS the reported bug.
    expect(resolveDeckContentCoherence(before).cardCount).toBe(0);
    expect(resolveDeckContentCoherence(before).declaredSlideCount).toBe(11);
    expect(resolveDeckContentCoherence(before).coherent).toBe(false);

    const result = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(result.failures).toEqual([]);

    const after = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    const coherence = resolveDeckContentCoherence(after);
    expect(coherence.cardCount).toBe(11);
    expect(coherence.coherent).toBe(true);
    // An empty row carries no content to preserve, so it is a real content
    // change: the version advances by exactly one from what was there (4 -> 5).
    expect(after.version).toBe(5);
    // The upsert converged onto the legacy id — it did not fork a second deck.
    expect((await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING])).length).toBe(
      1
    );
    // ...and the other two canonical decks were created alongside it.
    expect((await allRows()).length).toBe(3);
  });

  it('is tenant-scoped: seeding one org never touches another org’s decks', async () => {
    await seedAtelierPresentationDecks({ organizationId: OTHER_ORG, anchorDate: ANCHOR });
    const foreign = await rows('SELECT * FROM presentation_decks WHERE organization_id = ?', [ORG]);
    expect(foreign.length).toBe(0);

    const own = await rows('SELECT * FROM presentation_decks WHERE organization_id = ?', [
      OTHER_ORG,
    ]);
    expect(own.length).toBe(3);
    expect(own.every((r) => r.id.startsWith(`${OTHER_ORG}--deck--`))).toBe(true);
  });

  it('repairs a slide_count that drifted without the content changing', async () => {
    // Reproduce the PPTX download path exactly: it stamps the RENDERER's tally
    // (which counts the appended closing slide) and deliberately preserves
    // `updated_at`, without touching `deck_json`. Deciding ownership on the
    // fingerprint alone would call this `unchanged` forever and the Materials
    // list would advertise 12 over 11 renderable cards — permanently.
    const first = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(first.failures).toEqual([]);
    const seeded = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    expect(seeded.slide_count).toBe(11);

    await exec(
      `UPDATE presentation_decks SET slide_count = slide_count + 1, updated_at = updated_at WHERE id = ?`,
      [STEERING]
    );
    const drifted = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    expect(drifted.slide_count).toBe(12);
    expect(drifted.deck_json).toBe(seeded.deck_json); // content untouched

    const repair = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(repair.failures).toEqual([]);

    const entry = repair.plan.find((p) => p.deckId === STEERING);
    expect(entry?.outcome).toBe('updated');
    expect(entry?.reason).toMatch(/drift/i);

    const after = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    expect(after.slide_count).toBe(11);
    expect(after.version).toBe(seeded.version + 1);
    // The other two decks were genuinely untouched — a repair is not a rewrite.
    expect(repair.unchanged).toBe(2);
  });

  it('resolves createdBy from the demo user map when one is supplied', async () => {
    await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      userMap: {
        'marc-dubois': { id: 'atelier--user--marc-dubois' },
        'antoine-laurent': { id: 'atelier--user--antoine-laurent' },
      },
      initiativeMap: { 'line-3-digital-twin': 'atelier--initiative--line-3-digital-twin' },
    });
    const steering = (
      await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING])
    )[0] as DeckRow & { created_by: string; source_id: string };
    expect(steering.created_by).toBe('atelier--user--marc-dubois');
    expect(steering.source_id).toBe('atelier--initiative--line-3-digital-twin');
  });
});

describe('MAT-006B — the seed does not destroy content it does not own', () => {
  async function seedThenEdit(): Promise<DeckRow> {
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    const seeded = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    // A presenter opens the deck and rewrites a headline. The seed marker is
    // still in the document (the builder round-trips it), but the CONTENT no
    // longer hashes to it — which is precisely how ownership is disproved.
    const edited = JSON.parse(String(seeded.deck_json));
    edited.cards[0].title = 'HUMAN EDIT — do not overwrite';
    await exec('UPDATE presentation_decks SET deck_json = ? WHERE id = ?', [
      JSON.stringify(edited),
      STEERING,
    ]);
    return (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
  }

  it('a default run SKIPS a human-edited deck and leaves it byte-identical', async () => {
    const edited = await seedThenEdit();

    const result = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

    const entry = result.plan.find((p) => p.deckId === STEERING);
    expect(entry?.outcome).toBe('skipped');
    expect(entry?.ownedBySeed).toBe(false);
    expect(entry?.hasExistingContent).toBe(true);
    expect(entry?.reason).toMatch(/does not own/i);
    expect(result.skipped).toBe(1);
    expect(result.failures).toEqual([]);

    const after = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    expect(after).toEqual(edited);
    expect(JSON.parse(String(after.deck_json)).cards[0].title).toBe(
      'HUMAN EDIT — do not overwrite'
    );
  });

  it('force: true overwrites the human edit and bumps version by exactly 1', async () => {
    const edited = await seedThenEdit();
    expect(edited.version).toBe(1);

    const result = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      force: true,
    });

    const entry = result.plan.find((p) => p.deckId === STEERING);
    expect(entry?.outcome).toBe('updated');
    expect(entry?.reason).toMatch(/force/i);
    expect(result.decks).toBe(1);
    expect(result.failures).toEqual([]);

    const after = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    expect(after.version).toBe(2);
    expect(JSON.parse(String(after.deck_json)).cards[0].title).not.toBe(
      'HUMAN EDIT — do not overwrite'
    );
    expect(resolveDeckContentCoherence(after).coherent).toBe(true);
  });
});

describe('MAT-006B — cross-tenant id collision is a hard failure', () => {
  const FOREIGN_CONTENT = JSON.stringify({
    schemaVersion: 1,
    cards: [{ card_id: 'foreign-1', order_index: 0, title: 'Another tenant’s deck', blocks: [] }],
  });

  async function plantForeignRow(): Promise<DeckRow> {
    await exec(
      `INSERT INTO presentation_decks
         (id, organization_id, title, template_id, slide_count, status, version, deck_json, unified_json)
       VALUES (?, ?, ?, 'executive-standard', 1, 'ready', 7, ?, NULL)`,
      [STEERING, OTHER_ORG, 'Another tenant’s deck', FOREIGN_CONTENT]
    );
    return (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
  }

  it('never writes the foreign row, and aborts the WHOLE batch rather than half-seeding', async () => {
    const before = await plantForeignRow();

    const result = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

    const entry = result.plan.find((p) => p.deckId === STEERING);
    expect(entry?.outcome).toBe('failed');
    expect(entry?.foreignTenant).toBe(OTHER_ORG);
    expect(entry?.reason).toMatch(/collision/i);

    // ★ STRICT ALL-OR-NOTHING. One unplannable deck aborts the batch BEFORE any
    // statement runs. Writing the other two would leave the Materials list
    // half-canonical — the exact state this packet exists to eliminate — and the
    // read-back could never confirm 3/3.
    expect(result.applied).toBe(false);
    expect(result.decks).toBe(0);
    expect(result.deckIds).toEqual([]);
    expect(result.failures.map((f) => f.deckId).sort()).toEqual(
      ATELIER_DECK_SLUGS.map((slug) => atelierDeckId(ORG, slug)).sort()
    );

    // The foreign row is untouched...
    const after = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    expect(after).toEqual(before);
    // ...and the other two decks were never created.
    expect((await allRows()).length).toBe(1);
  });

  it('force: true does NOT unlock a cross-tenant write, and still aborts the batch', async () => {
    const before = await plantForeignRow();

    const result = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      force: true,
    });

    expect(result.plan.find((p) => p.deckId === STEERING)?.outcome).toBe('failed');
    expect(result.applied).toBe(false);
    expect(result.decks).toBe(0);
    expect(result.failures.length).toBe(3);

    const after = (await rows('SELECT * FROM presentation_decks WHERE id = ?', [STEERING]))[0];
    expect(after).toEqual(before);
    expect(after.organization_id).toBe(OTHER_ORG);
    expect(after.version).toBe(7);
    expect((await allRows()).length).toBe(1);
  });
});

describe('MAT-006B — atomicity is REPORTED, never assumed', () => {
  it('reports batched-fallback when no PostgreSQL pool exists, instead of claiming all-or-nothing', async () => {
    // This suite runs against SQLite through the DbPromise seam — there is no
    // pinned PostgreSQL client here, so the seed must NOT advertise one. Saying
    // 'pinned-pg' on this path is the failure mode: an operator would read the
    // field, believe the three decks are all-or-nothing, and skip the re-run
    // that a partially applied batch actually needs.
    const result = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(result.applied).toBe(true);
    expect(result.atomicity).toBe('batched-fallback');

    const second = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(second.unchanged).toBe(3);
    expect(second.atomicity).toBe('batched-fallback');

    const dry = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      dryRun: true,
    });
    expect(dry.atomicity).toBe('batched-fallback');
  });

  it('reports commitState: null where no single real transaction carried the run', async () => {
    // ★ `null` is not "unknown" — it is "the question does not apply". There was
    // no BEGIN/COMMIT of our own on this path, so there is no commit outcome to
    // report, and a caller must read `atomicity` to learn what protected the run.
    // Only `'indeterminate'` means "we do not know", and it can only come from a
    // real transaction.
    const applied = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(applied.applied).toBe(true);
    expect(applied.commitState).toBeNull();

    const dry = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      dryRun: true,
    });
    expect(dry.commitState).toBeNull();
  });
});

describe('MAT-006B — the recovery anchor on the path that has no COMMIT to precede', () => {
  it('still calls the anchor, and a failure there is REPORTED rather than swallowed', async () => {
    // On the degraded path the statements have already autocommitted by the time
    // the anchor can be written, so a failure cannot be undone — it can only be
    // told. Silently returning `applied: true` here would hand an operator rows
    // this tool has no way back from, and no hint that anything is missing.
    const anchored: AtelierDeckPostState[][] = [];
    const ok = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      persistRecoveryAnchor: async (postState) => {
        anchored.push(postState);
      },
    });
    expect(ok.applied).toBe(true);
    expect(ok.failures).toEqual([]);
    expect(anchored.length).toBe(1);
    expect(anchored[0].map((s) => s.deckId)).toEqual(
      ATELIER_DECK_SLUGS.map((slug) => atelierDeckId(ORG, slug))
    );
    expect(anchored[0]).toEqual(ok.postState);

    // A second, forced run whose anchor write fails: the rows are already there,
    // and every deck that claims persisted state says so.
    const failed = await seedAtelierPresentationDecks({
      organizationId: `${ORG}-2`,
      anchorDate: ANCHOR,
      persistRecoveryAnchor: async () => {
        throw new Error('no space left on device');
      },
    });
    expect(failed.failures.length).toBe(3);
    expect(failed.failures.every((f) => /recovery anchor/i.test(f.reason))).toBe(true);
  });
});

describe('MAT-006B — post-state fingerprint (the rollback CAS target)', () => {
  it('is empty on a dry run and populated after a run that wrote', async () => {
    const dry = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      dryRun: true,
    });
    expect(dry.postState).toEqual([]);

    const applied = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(applied.postState.length).toBe(3);
    expect(applied.postState.map((s) => s.deckId)).toEqual(
      ATELIER_DECK_SLUGS.map((slug) => atelierDeckId(ORG, slug))
    );
    expect(applied.postState.every((s) => s.state === 'exists')).toBe(true);
    expect(applied.postState.every((s) => s.organizationId === ORG)).toBe(true);
    expect(applied.postState.every((s) => (s.contentFingerprint || '').length === 64)).toBe(true);
    // The standalone reader sees exactly what the run recorded.
    expect(await readAtelierDeckPostState(ORG)).toEqual(applied.postState);
  });

  it('reports absent — not a fabricated row — for an id that is not there', async () => {
    const state = await readAtelierDeckPostState(ORG);
    expect(state.length).toBe(3);
    expect(state.every((s) => s.state === 'absent')).toBe(true);
    expect(state.every((s) => s.contentFingerprint === null)).toBe(true);
    expect(state.every((s) => s.version === null)).toBe(true);
  });
});

describe('MAT-006B — the rollback executor has NO non-transactional fallback', () => {
  it('returns stage: unavailable instead of "restoring" through a seam that cannot roll back', async () => {
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    const backup = await readAtelierDeckBackup(ORG);
    const postState = await readAtelierDeckPostState(ORG);
    const before = await allRows();

    // Pin the seam shut for the duration of this call: there is no PostgreSQL
    // here, and the executor must SAY so rather than degrade. A "rollback" run
    // through `DbPromise` would be a sequence of autocommitting statements on
    // arbitrary pooled clients — the defect, not a lesser version of the fix.
    const previousType = process.env.DB_TYPE;
    process.env.DB_TYPE = 'sqlite';
    try {
      const outcome = await rollbackAtelierDecksOnPinnedClient({
        organizationId: ORG,
        backup,
        expectedPostState: postState,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.restored).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('unavailable');
        expect(outcome.reason).toMatch(/no non-transactional fallback/i);
      }
    } finally {
      if (previousType === undefined) delete process.env.DB_TYPE;
      else process.env.DB_TYPE = previousType;
    }

    // And it wrote nothing on its way to saying no.
    expect(await allRows()).toEqual(before);
  });

  it('refuses an incomplete backup BEFORE it would even look for a connection', async () => {
    const backup: AtelierDeckBackup = {
      organizationId: ORG,
      entries: ATELIER_DECK_SLUGS.map((slug, index) => ({
        deckId: atelierDeckId(ORG, slug),
        state: index === 0 ? 'unknown' : 'verified_absent',
        row: null,
        error: index === 0 ? 'select failed' : null,
      })),
      complete: false,
    };

    const outcome = await rollbackAtelierDecksOnPinnedClient({
      organizationId: ORG,
      backup,
      expectedPostState: await readAtelierDeckPostState(ORG),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      // NOT 'unavailable': the refusal happened on the input, before any
      // connection question was asked — so the operator is told the real reason.
      expect(outcome.stage).toBe('cas');
      expect(outcome.reason).toMatch(/INCOMPLETE backup/i);
    }
  });

  it('the write path and the rollback path derive the advisory lock key from ONE definition', () => {
    expect(atelierDeckLockKey(ORG)).toBe(advisoryLockKey(`atelier-presentation-decks:${ORG}`));
    expect(atelierDeckLockKey(ORG)).not.toBe(atelierDeckLockKey(OTHER_ORG));
    // A bigint decimal string, so no precision is lost through a JS number.
    expect(atelierDeckLockKey(ORG)).toMatch(/^-?\d+$/);
  });
});

describe('MAT-006B — atomicity and failure reporting', () => {
  it('rolls the WHOLE batch back when the database refuses one deck', async () => {
    // Establish three seed-owned rows, then blank their content so all three
    // become planned writes on the next run.
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    await exec('UPDATE presentation_decks SET deck_json = NULL, unified_json = NULL');
    const before = await allRows();
    expect(before.length).toBe(3);

    // Real database-side refusal of exactly ONE of the three writes.
    await exec(
      `CREATE TRIGGER reject_one BEFORE INSERT ON presentation_decks
       WHEN NEW.id = '${atelierDeckId(ORG, 'connected-play-growth')}'
       BEGIN SELECT RAISE(ABORT, 'simulated constraint violation'); END`
    );

    const result = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

    expect(result.applied).toBe(false);
    expect(result.decks).toBe(0);
    expect(result.slides).toBe(0);
    expect(result.deckIds).toEqual([]);
    expect(result.failures.length).toBe(3);
    expect(result.failures.every((f) => /rolled back/i.test(f.reason))).toBe(true);
    // ★ ALL-OR-NOTHING: the two decks the database would have accepted are still
    // empty. A per-statement loop would have left the Materials list half-fixed.
    expect(await allRows()).toEqual(before);

    await exec('DROP TRIGGER reject_one');
  });

  it('reports three failures — not an empty success — when the table is missing', async () => {
    sqliteCtx.tablesExist = false;

    const result = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

    expect(result.decks).toBe(0);
    expect(result.deckIds).toEqual([]);
    expect(result.applied).toBe(false);
    expect(result.failures.length).toBe(3);
    expect(result.plan.length).toBe(3);
    expect(result.plan.every((p) => p.outcome === 'failed')).toBe(true);
    expect(result.failures.every((f) => /does not exist/i.test(f.reason))).toBe(true);
    // And nothing was written, so the read path will report `missing`, not a lie.
    sqliteCtx.tablesExist = true;
    expect((await allRows()).length).toBe(0);
  });

  it('read-back verification catches a divergence the write itself did not report', async () => {
    // The database ACCEPTS every insert, then silently mutates the row so its
    // declared count no longer matches its content — the staging blocker's shape,
    // arriving after COMMIT. The write results are all green; only reading the
    // rows back can catch it.
    await exec(
      `CREATE TRIGGER diverge AFTER INSERT ON presentation_decks
       BEGIN UPDATE presentation_decks SET slide_count = slide_count + 1 WHERE id = NEW.id; END`
    );

    const result = await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

    expect(result.failures.length).toBe(3);
    expect(result.failures.every((f) => /divergence/i.test(f.reason))).toBe(true);
    // The rows are committed (we cannot un-COMMIT), but the seed refuses to
    // COUNT them: nothing downstream may treat this run as a healthy dataset.
    expect(result.decks).toBe(0);
    expect(result.plan.every((p) => p.outcome === 'failed')).toBe(true);
    const stored = await allRows();
    expect(stored.length).toBe(3);
    expect(resolveDeckContentCoherence(stored[0]).coherent).toBe(false);

    await exec('DROP TRIGGER diverge');
  });
});

describe('MAT-006B — dry run and rollback manifest', () => {
  it('dryRun writes NOTHING and still returns a full plan', async () => {
    const result = await seedAtelierPresentationDecks({
      organizationId: ORG,
      anchorDate: ANCHOR,
      dryRun: true,
    });

    expect(result.applied).toBe(false);
    expect(result.decks).toBe(0);
    expect(result.slides).toBe(0);
    expect(result.deckIds).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(result.plan.length).toBe(3);
    expect(result.plan.map((p) => p.slug)).toEqual([...ATELIER_DECK_SLUGS]);
    expect(result.plan.every((p) => p.outcome === 'inserted')).toBe(true);
    expect(result.plan.every((p) => p.desiredFingerprint.length === 64)).toBe(true);
    expect(result.plan.find((p) => p.deckId === STEERING)?.desiredSlideCount).toBe(11);
    // ★ The table is untouched.
    expect((await allRows()).length).toBe(0);
  });

  it('planAtelierPresentationDecks agrees with a dry run and writes nothing either', async () => {
    const plan = await planAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    expect(plan.applied).toBe(false);
    expect(plan.plan.map((p) => p.outcome)).toEqual(['inserted', 'inserted', 'inserted']);
    expect((await allRows()).length).toBe(0);
  });

  it('the backup manifest snapshots the rows an operator would need to restore', async () => {
    // Nothing seeded yet: absence is PROVEN, not inferred.
    const empty = await readAtelierDeckBackup(ORG);
    expect(empty.entries.length).toBe(3);
    expect(empty.entries.map((e) => e.state)).toEqual([
      'verified_absent',
      'verified_absent',
      'verified_absent',
    ]);
    expect(empty.complete).toBe(true);

    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    const backup = await readAtelierDeckBackup(ORG);
    expect(backup.entries.length).toBe(3);
    expect(backup.entries.every((e) => e.state === 'exists')).toBe(true);
    expect(backup.entries.every((e) => e.row?.organization_id === ORG)).toBe(true);
    expect(backup.entries.every((e) => (e.row?.deck_json || '').length > 0)).toBe(true);
    expect(backup.complete).toBe(true);
    // The entries follow the canonical slug order, so a manifest is diffable
    // between runs.
    expect(backup.entries.map((e) => e.deckId)).toEqual(
      ATELIER_DECK_SLUGS.map((slug) => atelierDeckId(ORG, slug))
    );
  });

  it('captures EVERY column the upsert overwrites — a partial backup is a partial restore', async () => {
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    const backup = await readAtelierDeckBackup(ORG);
    const row = backup.entries.find((e) => e.deckId === STEERING)?.row;
    expect(row).toBeTruthy();

    // Read the column list off the LIVE table and demand the backup covers every
    // column the upsert writes. Asserting a hand-written list here would go stale
    // the first time the upsert gains a column — which is exactly how a backup
    // silently narrows.
    const columns = (await rows('PRAGMA table_info(presentation_decks)')) as unknown as Array<{
      name: string;
    }>;
    const upsertColumns = columns
      .map((c) => c.name)
      .filter((name) => UPSERT_TARGET_COLUMNS.includes(name));
    expect(upsertColumns.length).toBe(26); // 24 overwritten + id + organization_id
    for (const column of upsertColumns) {
      expect(Object.keys(row as object), `backup is missing '${column}'`).toContain(column);
    }
  });
});

describe('MAT-006B — rollback SQL is refused unless the backup can back it', () => {
  it('an unreadable row makes the backup incomplete and buildRollbackSql THROWS', () => {
    const backup: AtelierDeckBackup = {
      organizationId: ORG,
      entries: [
        {
          deckId: atelierDeckId(ORG, 'forward-board-readout'),
          state: 'exists',
          row: sampleRow(),
          error: null,
        },
        {
          deckId: STEERING,
          state: 'unknown',
          row: null,
          error: 'connection terminated unexpectedly',
        },
        {
          deckId: atelierDeckId(ORG, 'connected-play-growth'),
          state: 'verified_absent',
          row: null,
          error: null,
        },
      ],
      complete: false,
    };

    // ★ THE POINT. A failed SELECT and "there was no row" have the same shape and
    // opposite meanings. Emitting a DELETE for the first would destroy a row the
    // seed never touched, and the operator would read "rollback applied".
    expect(() => buildRollbackSql(backup)).toThrow(/incomplete backup/i);
    expect(() => buildRollbackSql(backup)).toThrow(new RegExp(STEERING));
  });

  it('emits a DELETE only for a verified_absent id, and an UPDATE of all 24 columns for an existing one', () => {
    const present = sampleRow();
    const sql = buildRollbackSql({
      organizationId: ORG,
      entries: [
        { deckId: present.id, state: 'exists', row: present, error: null },
        { deckId: STEERING, state: 'verified_absent', row: null, error: null },
        {
          deckId: atelierDeckId(ORG, 'connected-play-growth'),
          state: 'verified_absent',
          row: null,
          error: null,
        },
      ],
      complete: true,
    });

    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).toMatch(/^COMMIT;$/m);
    expect(sql).toContain(`DELETE FROM presentation_decks WHERE id = '${STEERING}'`);
    // Tenant-guarded: a rollback must never reach across organizations either.
    expect(sql).toContain(`AND organization_id = '${ORG}'`);
    expect((sql.match(/^DELETE FROM/gm) || []).length).toBe(2);
    expect((sql.match(/^UPDATE presentation_decks SET$/gm) || []).length).toBe(1);
    for (const column of UPSERT_TARGET_COLUMNS) {
      if (column === 'id' || column === 'organization_id') continue;
      expect(sql, `rollback does not restore '${column}'`).toContain(`  ${column} = `);
    }
  });

  it('emits ISO-8601 for a timestamp the driver returned as a JS Date, not String(date)', () => {
    const row = sampleRow();
    // Exactly what node-pg hands back for `timestamptz`. `String(date)` would
    // produce "Wed Jul 01 2026 ..." — which PostgreSQL cannot parse, so the
    // rollback would fail at the one moment it is needed.
    const withDates = {
      ...row,
      updated_at: new Date('2026-07-01T09:00:00.000Z') as unknown as string,
      created_at: new Date('2026-06-01T00:00:00.000Z') as unknown as string,
    };
    const sql = buildRollbackSql({
      organizationId: ORG,
      entries: [{ deckId: row.id, state: 'exists', row: withDates, error: null }],
      complete: true,
    });
    expect(sql).toContain(`updated_at = '2026-07-01T09:00:00.000Z'`);
    expect(sql).toContain(`created_at = '2026-06-01T00:00:00.000Z'`);
    expect(sql).not.toMatch(/GMT\+0000/);
  });

  it('dollar-quotes JSON content instead of trusting quote escaping', () => {
    const row = sampleRow();
    row.deck_json = JSON.stringify({ cards: [{ title: "it's a 'quoted' \\ backslash" }] });
    const sql = buildRollbackSql({
      organizationId: ORG,
      entries: [{ deckId: row.id, state: 'exists', row, error: null }],
      complete: true,
    });
    expect(sql).toContain('$rb$');
    // The payload survives verbatim between the dollar tags.
    expect(sql).toContain(row.deck_json);
  });
});

describe('MAT-006B — count/content coherence resolver', () => {
  it('reports 0 cards and incoherence for a declared count with no content', () => {
    const coherence = resolveDeckContentCoherence({
      id: 'deck-x',
      organization_id: ORG,
      title: 'Ghost deck',
      status: 'ready',
      slide_count: 11,
      deck_json: null,
      unified_json: null,
    });
    expect(coherence.document).toBeNull();
    expect(coherence.cardCount).toBe(0);
    expect(coherence.declaredSlideCount).toBe(11);
    expect(coherence.hasCanonicalContent).toBe(false);
    expect(coherence.coherent).toBe(false);
  });

  it('flags the off-by-one shape the generator writes (cards + closing slide)', () => {
    // 40+ rows on the live demo store carry slide_count = cards + 1 because the
    // PPTX pipeline counts its appended closing slide. The resolver reports the
    // count that can actually be served.
    const coherence = resolveDeckContentCoherence({
      id: 'deck-y',
      organization_id: ORG,
      title: 'Generated deck',
      status: 'ready',
      slide_count: 11,
      deck_json: JSON.stringify({
        schemaVersion: 1,
        cards: Array.from({ length: 10 }, (_, i) => ({ card_id: `c${i}`, order_index: i })),
      }),
      unified_json: null,
    });
    expect(coherence.cardCount).toBe(10);
    expect(coherence.declaredSlideCount).toBe(11);
    expect(coherence.coherent).toBe(false);
  });

  it('reports coherence for a deck the canonical seed produced', () => {
    const template = getAtelierPresentationDecks().find((d) => d.slug === 'line3-steering')!;
    const materialized = materializeAtelierDeck({
      organizationId: ORG,
      template,
      anchorDate: new Date(ANCHOR),
    });
    const coherence = resolveDeckContentCoherence({
      id: materialized.deckId,
      organization_id: ORG,
      title: template.title,
      status: template.status,
      slide_count: materialized.slideCount,
      deck_json: JSON.stringify(materialized.document),
      unified_json: JSON.stringify(materialized.unifiedJson),
    });
    expect(coherence.cardCount).toBe(11);
    expect(coherence.coherent).toBe(true);
    expect(coherence.hasCanonicalContent).toBe(true);
  });
});
