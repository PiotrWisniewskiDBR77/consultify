/**
 * MAT-006B — the Materials / Reports-and-Presentations list must never advertise
 * slides a deck cannot serve.
 *
 * This is the surface Piotr actually looks at. It is NOT fed by
 * `GET /presentations/decks` (both deck routes were already gated); it is fed by
 * `GET /api/artifacts` → `artifactRegistryService.listArtifactsForUser`, which
 * selected `d.slide_count AS presentation_slide_count` and surfaced the RAW
 * column. So the exact screen that showed "Ready · 11" over a deck with zero
 * renderable cards was still capable of showing a phantom count.
 *
 * The four broken shapes below are the ones verified on the Railway `demo`
 * store, not hypotheticals:
 *   - `deck_json` holding INVALID JSON (`safeJsonParse` discards it);
 *   - `deck_json` = `'{}'`;
 *   - `deck_json` = `{"schemaVersion":1,"cards":[]}` — a payload with nothing
 *     to render (the builder shows "Card 1 of 0" for it just the same);
 *   - `slide_count = cards + 1` on 40+ rows, because the PPTX pipeline counts
 *     its appended closing slide.
 * Plus the legacy `unified_json`-only shape, which the list resolves in a
 * second pass, and the healthy case (which must NOT be broken by the gate).
 *
 * Anti-false-green: the service runs against a REAL in-memory SQLite through
 * the same `DbPromise` seam production uses, and every assertion is made on the
 * value the service returns after reading rows BACK out of that store — not on
 * a mock's echo of the input. Same harness style as
 * `server/src/services/demo/__tests__/atelierPresentationDeckSeed.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

vi.mock('../../../utils/DbPromise.js', () => ({
  get: <T = unknown>(
    sql: string,
    params: unknown[] = [],
    options?: { fallback?: boolean }
  ): Promise<T | null> =>
    new Promise((resolve, reject) => {
      sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) => {
        if (err && options?.fallback === false) return reject(err);
        resolve(err ? null : ((row || null) as T | null));
      });
    }),
  // `{ fallback: true }` in production RESOLVES an empty set on a database
  // error (e.g. a table this org's deployment does not have). Mirrored here so
  // the backfill probes for tables we deliberately do not create behave the way
  // they do on a real deployment instead of exploding the suite.
  all: <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
    new Promise((resolve) => {
      sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
        resolve(err ? [] : ((rows || []) as T[]))
      );
    }),
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
  transaction: (): Promise<{ success: boolean; results: unknown[] }> =>
    Promise.resolve({ success: true, results: [] }),
}));

vi.mock('../featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(false),
}));

import type { ArtifactListItem } from '../../../types/artifactRegistry.js';
import {
  listArtifactsForUser,
  listArtifactsForUserByExecutionRunId,
} from '../artifactRegistryService.js';

const ORG = 'org-mat006b';
const USER = 'user-mat006b';
const RUN = 'run-mat006b';

function exec(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

/** A deck_json payload with exactly `n` renderable cards. */
function deckJsonWithCards(deckId: string, n: number): string {
  return JSON.stringify({
    schemaVersion: 1,
    deck_id: deckId,
    cards: Array.from({ length: n }, (_, i) => ({
      card_id: `${deckId}-card-${i}`,
      deck_id: deckId,
      order_index: i,
      intent: i === 0 ? 'cover' : 'key_messages',
      title: `Card ${i + 1}`,
      blocks: [],
    })),
  });
}

/** The legacy shape: no deck_json, content only in unified_json. */
function unifiedJsonWithSlides(n: number): string {
  return JSON.stringify({
    meta: { client: 'Atelier', project: 'Legacy', date: '2026-07-01' },
    slides: Array.from({ length: n }, (_, i) => ({
      intent: i === 0 ? 'cover' : 'key_messages',
      key_message: `Slide ${i + 1}`,
      content: { type: i === 0 ? 'cover' : 'key_messages', title: `Slide ${i + 1}` },
    })),
  });
}

interface DeckFixture {
  slug: string;
  title: string;
  slideCount: number;
  deckJson: string | null;
  unifiedJson: string | null;
  executionRunId?: string | null;
}

const DECKS: DeckFixture[] = [
  // (1) invalid JSON in deck_json — parses to nothing, but the column claims 7.
  {
    slug: 'invalid-json',
    title: 'Forward Board Readout',
    slideCount: 7,
    deckJson: '{"schemaVersion":1,"cards":[{"card_id":',
    unifiedJson: null,
  },
  // (2) `'{}'` — a non-empty JSON string that is not proof of anything.
  {
    slug: 'empty-object',
    title: 'Line 3 Steering',
    slideCount: 11,
    deckJson: '{}',
    unifiedJson: null,
  },
  // (3) a payload with an explicitly EMPTY card array.
  {
    slug: 'empty-cards',
    title: 'Connected Play Growth',
    slideCount: 9,
    deckJson: JSON.stringify({ schemaVersion: 1, cards: [] }),
    unifiedJson: null,
  },
  // (4) the generator's cards+1 drift (appended closing slide).
  {
    slug: 'closing-slide-drift',
    title: 'Quarterly Value Review',
    slideCount: 4,
    deckJson: deckJsonWithCards('deck-closing-slide-drift', 3),
    unifiedJson: null,
  },
  // (5) healthy — the gate must not damage a coherent deck.
  {
    slug: 'healthy',
    title: 'Operating Model Briefing',
    slideCount: 5,
    deckJson: deckJsonWithCards('deck-healthy', 5),
    unifiedJson: null,
  },
  // (6) legacy: content only in unified_json, resolved by the second pass.
  {
    slug: 'legacy-unified',
    title: 'Supplier Consolidation Case',
    slideCount: 6,
    deckJson: null,
    unifiedJson: unifiedJsonWithSlides(2),
  },
  // (7) attached to an execution run — covers the second list query.
  {
    slug: 'execution-run',
    title: 'Run Output Deck',
    slideCount: 8,
    deckJson: deckJsonWithCards('deck-execution-run', 2),
    unifiedJson: null,
    executionRunId: RUN,
  },
];

function deckId(slug: string): string {
  return `deck-${slug}`;
}

async function createSchema(): Promise<void> {
  await exec(`CREATE TABLE v8_output_artifacts (
    artifact_id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    output_type TEXT NOT NULL,
    artifact_family TEXT,
    delivery_state TEXT NOT NULL,
    title_snapshot TEXT NOT NULL,
    owner_user_id TEXT,
    visibility_scope TEXT,
    project_id TEXT,
    context_snapshot_id TEXT,
    execution_run_id TEXT,
    template_family_ref TEXT,
    source_initiative_id TEXT,
    ai_governance_preset_ref TEXT,
    origin_summary_json TEXT,
    is_draft INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_transition_at TEXT
  )`);
  await exec(`CREATE TABLE v8_artifact_origin_links (
    link_id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    origin_runtime TEXT NOT NULL,
    origin_record_id TEXT NOT NULL,
    is_primary_origin INTEGER DEFAULT 1,
    created_at TEXT
  )`);
  await exec(`CREATE TABLE presentation_decks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT,
    status TEXT,
    deck_type TEXT,
    presentation_mode TEXT,
    slide_count INTEGER,
    export_format TEXT,
    deck_json TEXT,
    unified_json TEXT,
    source_artifacts TEXT,
    source_id TEXT,
    generated_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`);
  await exec(`CREATE TABLE report_builder_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    title TEXT,
    status TEXT,
    report_type TEXT,
    project_id TEXT,
    source_id TEXT,
    source_refs_json TEXT,
    pdf_path TEXT,
    pptx_path TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`);
  await exec(`CREATE TABLE v8_output_exports (
    export_id TEXT PRIMARY KEY,
    artifact_id TEXT,
    organization_id TEXT,
    format TEXT,
    status TEXT,
    created_at TEXT,
    completed_at TEXT
  )`);
  await exec(`CREATE TABLE v8_publish_records (
    artifact_id TEXT,
    organization_id TEXT,
    current_state TEXT,
    reviewers TEXT
  )`);
  await exec(`CREATE TABLE v8_review_gates (
    artifact_id TEXT,
    organization_id TEXT
  )`);
  await exec(`CREATE TABLE v8_artifact_access_grants (
    grant_id TEXT PRIMARY KEY,
    artifact_id TEXT,
    organization_id TEXT,
    grant_kind TEXT,
    user_id TEXT,
    role_key TEXT,
    created_by TEXT,
    created_at TEXT
  )`);
  await exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT
  )`);
  await exec(`CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT)`);
  await exec(`CREATE TABLE project_members (project_id TEXT, user_id TEXT)`);
}

async function seed(): Promise<void> {
  await exec(`INSERT INTO users (id, first_name, last_name) VALUES (?, ?, ?)`, [
    USER,
    'Justyna',
    'Kowalska',
  ]);
  let index = 0;
  for (const deck of DECKS) {
    index += 1;
    const id = deckId(deck.slug);
    const artifactId = `art-${deck.slug}`;
    const stamp = `2026-07-${String(10 + index).padStart(2, '0')}T00:00:00.000Z`;
    await exec(
      `INSERT INTO presentation_decks
         (id, organization_id, title, status, deck_type, presentation_mode, slide_count,
          export_format, deck_json, unified_json, source_artifacts, generated_by, created_at, updated_at)
       VALUES (?, ?, ?, 'ready', 'tool', 'briefing', ?, 'pptx', ?, ?, '[]', ?, ?, ?)`,
      [id, ORG, deck.title, deck.slideCount, deck.deckJson, deck.unifiedJson, USER, stamp, stamp]
    );
    await exec(
      `INSERT INTO v8_output_artifacts
         (artifact_id, organization_id, output_type, artifact_family, delivery_state,
          title_snapshot, owner_user_id, visibility_scope, execution_run_id, is_draft,
          created_by, created_at, last_transition_at)
       VALUES (?, ?, 'presentation', 'presentation', 'ready', ?, ?, 'organization', ?, 0, ?, ?, ?)`,
      [artifactId, ORG, deck.title, USER, deck.executionRunId ?? null, USER, stamp, stamp]
    );
    await exec(
      `INSERT INTO v8_artifact_origin_links
         (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at)
       VALUES (?, ?, ?, 'presentation', ?, 1, ?)`,
      [`link-${deck.slug}`, artifactId, ORG, id, stamp]
    );
  }

  // A non-presentation artifact: the gate must leave it entirely alone.
  await exec(
    `INSERT INTO report_builder_reports (id, organization_id, title, status, report_type, source_refs_json, created_by, created_at, updated_at)
     VALUES ('rep-1', ?, 'Assessment Findings', 'final', 'assessment', '[]', ?, '2026-07-05T00:00:00.000Z', '2026-07-05T00:00:00.000Z')`,
    [ORG, USER]
  );
  await exec(
    `INSERT INTO v8_output_artifacts
       (artifact_id, organization_id, output_type, artifact_family, delivery_state,
        title_snapshot, owner_user_id, visibility_scope, is_draft, created_by, created_at, last_transition_at)
     VALUES ('art-report', ?, 'report', 'document', 'ready', 'Assessment Findings', ?, 'organization', 0, ?, '2026-07-05T00:00:00.000Z', '2026-07-05T00:00:00.000Z')`,
    [ORG, USER, USER]
  );
  await exec(
    `INSERT INTO v8_artifact_origin_links
       (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at)
     VALUES ('link-report', 'art-report', ?, 'report', 'rep-1', 1, '2026-07-05T00:00:00.000Z')`,
    [ORG]
  );
}

let listed: ArtifactListItem[] = [];

function bySlug(slug: string): ArtifactListItem {
  const item = listed.find((entry) => entry.originRecordId === deckId(slug));
  if (!item) throw new Error(`deck ${slug} missing from the Materials/RAP list`);
  return item;
}

beforeAll(async () => {
  await createSchema();
  await seed();
  listed = await listArtifactsForUser({
    organizationId: ORG,
    userId: USER,
    filters: { limit: 200 },
  });
});

afterAll(() => {
  sqliteCtx.db.close();
});

describe('Materials/RAP list (GET /api/artifacts) — derived slide count', () => {
  it('lists every seeded artifact (the gate hides nothing)', () => {
    expect(listed.length).toBe(DECKS.length + 1);
  });

  it('invalid JSON in deck_json → 0 slides + missing state, never the declared 7', () => {
    const item = bySlug('invalid-json');
    expect(item.slideCount).toBe(0);
    expect(item.contentState).toBe('missing');
    expect(item.declaredSlideCount).toBe(7);
  });

  it("deck_json = '{}' → 0 slides + missing state, never the declared 11", () => {
    const item = bySlug('empty-object');
    expect(item.slideCount).toBe(0);
    expect(item.contentState).toBe('missing');
    expect(item.declaredSlideCount).toBe(11);
  });

  it('deck_json with cards: [] → 0 slides + missing state, never the declared 9', () => {
    const item = bySlug('empty-cards');
    expect(item.slideCount).toBe(0);
    expect(item.contentState).toBe('missing');
    expect(item.declaredSlideCount).toBe(9);
  });

  it('cards+1 closing-slide drift → the derived 3, not the declared 4', () => {
    const item = bySlug('closing-slide-drift');
    expect(item.slideCount).toBe(3);
    expect(item.declaredSlideCount).toBe(4);
    expect(item.contentState).toBe('canonical');
  });

  it('healthy deck keeps its count and reports canonical content', () => {
    const item = bySlug('healthy');
    expect(item.slideCount).toBe(5);
    expect(item.declaredSlideCount).toBe(5);
    expect(item.contentState).toBe('canonical');
  });

  it('legacy unified_json-only deck is resolved by the second pass (2, not the declared 6)', () => {
    const item = bySlug('legacy-unified');
    expect(item.slideCount).toBe(2);
    expect(item.declaredSlideCount).toBe(6);
    expect(item.contentState).toBe('canonical');
  });

  it("contentState 'missing' ALWAYS travels with slideCount 0 (no phantom count survives)", () => {
    const presentations = listed.filter((item) => item.originRuntime === 'presentation');
    expect(presentations.length).toBe(DECKS.length);
    for (const item of presentations) {
      if (item.contentState === 'missing') expect(item.slideCount).toBe(0);
      if ((item.slideCount ?? 0) > 0) expect(item.contentState).toBe('canonical');
    }
  });

  it('never returns a slide count above what the persisted content can serve', () => {
    for (const item of listed.filter((entry) => entry.originRuntime === 'presentation')) {
      expect(item.slideCount ?? 0).toBeLessThanOrEqual(item.declaredSlideCount ?? 0);
    }
  });

  it('non-presentation rows are untouched (report has no slide count / content state)', () => {
    const report = listed.find((item) => item.originRuntime === 'report');
    expect(report).toBeDefined();
    expect(report?.slideCount).toBeNull();
    expect(report?.contentState).toBeNull();
    expect(report?.declaredSlideCount).toBeNull();
  });

  it('does NOT leak deck content columns into the list payload', () => {
    for (const item of listed) {
      expect(item).not.toHaveProperty('presentation_deck_json');
      expect(item).not.toHaveProperty('deck_json');
      expect(item).not.toHaveProperty('presentation_unified_json');
    }
  });
});

describe('execution-run artifact list — missing SELECT aliases', () => {
  it('reports the derived slide count and export format instead of undefined', async () => {
    const runItems = await listArtifactsForUserByExecutionRunId({
      organizationId: ORG,
      executionRunId: RUN,
      userId: USER,
    });
    expect(runItems.length).toBe(1);
    const [item] = runItems;
    // Before the alias fix `d.slide_count` / `d.export_format` were selected
    // WITHOUT the `presentation_*` aliases the row mapper reads, so both of
    // these were permanently `undefined` on this list.
    expect(item.slideCount).toBe(2);
    expect(item.declaredSlideCount).toBe(8);
    expect(item.contentState).toBe('canonical');
    expect(item.exportFormat).toBe('pptx');
  });
});
