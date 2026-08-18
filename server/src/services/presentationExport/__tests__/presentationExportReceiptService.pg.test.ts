/**
 * Lane C (closure) — MAT-MVP-PPT-001 / MAT-MVP-EXPORT-001 (presentation half)
 * acceptance evidence, against a REAL local Postgres (no mocks).
 *
 * Lives under `server/src/services/presentationExport/__tests__/` (not
 * `tests/presentation-export/`) for the same reason as
 * `artifactHandoff/__tests__/handoffSpine.pg.test.ts`: the ROOT
 * `vitest.config.ts` collects `server/src/services/**\/__tests__/**` — a
 * standalone per-directory config would run green locally but be invisible
 * to every frozen gate denominator.
 *
 * Exercises `presentationExportReceiptService.ts`, the presentation-specific
 * wiring on top of the already-built, already-tested spine
 * (`artifactHandoff/handoffSpineService.ts` / `artifact_export_receipts`).
 * That table has NO foreign key to `presentation_decks` (fresh-DB guard, see
 * the spine migration header), so these tests use plain in-memory deck
 * objects — no `presentation_decks` row is written or needed.
 *
 * Every fixture id is prefixed `claude_c_<runId>-...` and `afterAll` deletes
 * every row this file created, verified by a final COUNT(*). The PPTX
 * pipeline call in this suite produces an in-memory `Buffer` only —
 * `PptxPipelineService.generateFromUnifiedJson` never touches disk (only the
 * route-level `ensureCurrentPptxExport`, which this suite does not call,
 * writes to `exportsDir('presentations')`) — so there is nothing to clean up
 * on disk either.
 *
 * Run (root config — no --config flag; MOCK_DB=false is required because
 * `tests/setup.ts:387` does `process.env.MOCK_DB = process.env.MOCK_DB ||
 * 'true'`, which would otherwise force the pooled DB mock under NODE_ENV=test):
 *   export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity"
 *   export DB_TYPE=postgres CI=true MOCK_DB=false RUN_DB_TESTS=1
 *   npx vitest run server/src/services/presentationExport/__tests__/presentationExportReceiptService.pg.test.ts \
 *     --no-file-parallelism --maxWorkers=1
 */
import { createHash, randomUUID } from 'node:crypto';

import JSZip from 'jszip';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  canonicalSourceHash,
  HandoffSpineError,
  recordExportReceipt,
} from '../../artifactHandoff/handoffSpineService.js';
import type { DeckDocument, DeckDocumentCard } from '../../presentationDeckDocumentService.js';
import { deckDocumentToRenderableUnifiedJson } from '../../presentationDeckDocumentService.js';
import { PptxPipelineService } from '../../report/pptx/PptxPipelineService.js';
import {
  beginPresentationExport,
  completePresentationExport,
  type DeckForExportHash,
  deriveDeckSourceHash,
  deriveDeckSourceVersion,
  derivePresentationExportIdempotencyKey,
  failPresentationExport,
  hashBuffer,
  markPresentationExportUnavailable,
  PRESENTATION_EXPORT_PROVIDER_KEYS,
} from '../presentationExportReceiptService.js';

function requireLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `presentationExportReceiptService.pg.test.ts requires a LOCAL DATABASE_URL (got: ${url || '(unset)'}). ` +
        'This suite writes real rows and must never point at a shared/demo/prod database.'
    );
  }
  return url;
}

const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const PREFIX = `claude_c_${RUN_ID}-`;
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-a`;

const pool = new Pool({ connectionString: requireLocalDatabaseUrl() });

async function countFixtureExportRows(): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM artifact_export_receipts WHERE organization_id LIKE $1`,
    [`${PREFIX}%`]
  );
  return result.rows[0].n;
}

beforeAll(async () => {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'artifact_export_receipts'`
  );
  if (tables.rows.length !== 1) {
    throw new Error(
      `presentationExportReceiptService.pg.test.ts requires ` +
        `server/migrations/20260912_claude_c_handoff_spine.sql to be applied ` +
        `(missing table artifact_export_receipts).`
    );
  }
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM artifact_export_receipts WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    expect(await countFixtureExportRows()).toBe(0);
  } finally {
    await pool.end();
  }
});

// ── Fixture builders ────────────────────────────────────────────────────

let deckSeq = 0;
const SPEAKER_NOTE_MARKER = `CLAUDE_C_SPEAKER_NOTE_${RUN_ID.replace(/[^a-zA-Z0-9]/g, '')}`;

/** Minimal DeckDocument — only the fields `deckDocumentToUnifiedJson` /
 * `flattenCardToUnifiedSlide` actually read (title, meta, cards[].*). Cast
 * through `unknown` rather than filling out every field of the full
 * interface (organization_id, theme_id, share_settings, ...), which this
 * suite never exercises. */
function makeMinimalDeckDocument(opts: { title: string; speakerNotes?: string }): DeckDocument {
  const card: Partial<DeckDocumentCard> = {
    card_id: `card-${deckSeq}`,
    order_index: 0,
    intent: 'key_messages',
    title: opts.title,
    key_message: opts.title,
    blocks: [],
    source_refs: [],
    speaker_notes: opts.speakerNotes,
  };
  return {
    title: opts.title,
    meta: { title: opts.title, deckType: 'briefing' },
    cards: [card],
  } as unknown as DeckDocument;
}

/** `DeckForExportHash` — the subset of `presentation_decks` columns the
 * receipt service actually reads. No DB row is written for this: see the
 * file header (`artifact_export_receipts` carries no FK to
 * `presentation_decks`). */
function makeDeckRow(opts: { speakerNotes?: string; version?: number }): {
  deck: DeckForExportHash;
  document: DeckDocument;
  deckId: string;
} {
  deckSeq += 1;
  const deckId = `${PREFIX}deck-${deckSeq}`;
  const document = makeMinimalDeckDocument({
    title: `Claude C export fixture ${deckSeq}`,
    speakerNotes: opts.speakerNotes,
  });
  const deck: DeckForExportHash = {
    id: deckId,
    deck_json: JSON.stringify(document),
    unified_json: null,
    version: opts.version ?? 1,
  };
  return { deck, document, deckId };
}

// ── Pure-function behavior ──────────────────────────────────────────────

describe('deriveDeckSourceHash / deriveDeckSourceVersion', () => {
  it('hashes the parsed deck_json canonically (key order does not matter)', () => {
    const deckA: DeckForExportHash = { id: 'd1', deck_json: JSON.stringify({ b: 2, a: 1 }) };
    const deckB: DeckForExportHash = { id: 'd1', deck_json: JSON.stringify({ a: 1, b: 2 }) };
    expect(deriveDeckSourceHash(deckA)).toBe(deriveDeckSourceHash(deckB));
    expect(deriveDeckSourceHash(deckA)).toBe(canonicalSourceHash({ a: 1, b: 2 }));
  });

  it('falls back to unified_json when deck_json is absent, then to { id }', () => {
    const withUnified: DeckForExportHash = { id: 'd2', unified_json: JSON.stringify({ x: 1 }) };
    expect(deriveDeckSourceHash(withUnified)).toBe(canonicalSourceHash({ x: 1 }));

    const withNeither: DeckForExportHash = { id: 'd3' };
    expect(deriveDeckSourceHash(withNeither)).toBe(canonicalSourceHash({ id: 'd3' }));
  });

  it('coerces a missing/non-integer version to 1, otherwise passes it through', () => {
    expect(deriveDeckSourceVersion({ id: 'd', version: null })).toBe(1);
    expect(deriveDeckSourceVersion({ id: 'd', version: undefined })).toBe(1);
    expect(deriveDeckSourceVersion({ id: 'd', version: 'not-a-number' as any })).toBe(1);
    expect(deriveDeckSourceVersion({ id: 'd', version: 0 })).toBe(1);
    expect(deriveDeckSourceVersion({ id: 'd', version: 7 })).toBe(7);
    expect(deriveDeckSourceVersion({ id: 'd', version: '3' })).toBe(3);
  });
});

describe('derivePresentationExportIdempotencyKey', () => {
  it('scopes a caller-supplied key by deck + format, never collides across either', () => {
    const a = derivePresentationExportIdempotencyKey({
      deckId: 'deck-1',
      sourceVersion: 1,
      format: 'pptx',
      requestKey: 'client-key-1',
    });
    const differentDeck = derivePresentationExportIdempotencyKey({
      deckId: 'deck-2',
      sourceVersion: 1,
      format: 'pptx',
      requestKey: 'client-key-1',
    });
    const differentFormat = derivePresentationExportIdempotencyKey({
      deckId: 'deck-1',
      sourceVersion: 1,
      format: 'pdf',
      requestKey: 'client-key-1',
    });
    expect(a).not.toBe(differentDeck);
    expect(a).not.toBe(differentFormat);
  });

  it('with no requestKey, derives a STABLE default from (deck, version, format)', () => {
    const first = derivePresentationExportIdempotencyKey({
      deckId: 'deck-1',
      sourceVersion: 2,
      format: 'pptx',
    });
    const second = derivePresentationExportIdempotencyKey({
      deckId: 'deck-1',
      sourceVersion: 2,
      format: 'pptx',
    });
    expect(first).toBe(second);

    const laterVersion = derivePresentationExportIdempotencyKey({
      deckId: 'deck-1',
      sourceVersion: 3,
      format: 'png',
    });
    expect(laterVersion).not.toBe(first);
  });
});

// ── Real PPTX bytes + speaker notes survive export → reopen ────────────

describe('real PPTX bytes: receipt binds source hash+version to output hash+size', () => {
  it('labels PDF receipts as pdfkit text summaries without visual-parity semantics', async () => {
    const { deck, deckId } = makeDeckRow({});
    const begin = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pdf',
      createdBy: USER_A,
    });
    expect(begin.receipt).toMatchObject({
      providerKey: 'native:pdfkit',
      policyContractVersion: 'mat-policy-v1',
      renderEngineVersion: '0.17.2',
      renderEngineLicense: 'MIT',
      outputSemantics: 'text_summary',
    });
  });

  it('renders real bytes via PptxPipelineService, records a matching receipt, and speaker notes survive reopen', async () => {
    const { deck, document, deckId } = makeDeckRow({ speakerNotes: SPEAKER_NOTE_MARKER });

    const begin = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pptx',
      createdBy: USER_A,
    });
    expect(begin.replayed).toBe(false);
    expect(begin.receipt.status).toBe('pending');
    expect(begin.receipt.providerKey).toBe(PRESENTATION_EXPORT_PROVIDER_KEYS.pptx);
    expect(begin.receipt).toMatchObject({
      policyContractVersion: 'mat-policy-v1',
      renderEngineVersion: '4.0.1',
      renderEngineLicense: 'MIT',
      outputSemantics: 'presentation',
    });
    expect(begin.sourceContentHash).toBe(deriveDeckSourceHash(deck));
    expect(begin.sourceVersion).toBe(1);

    // Real render — the same pipeline `ensureCurrentPptxExport` in
    // `presentations.routes.ts` calls, not a stand-in.
    const unifiedJson = deckDocumentToRenderableUnifiedJson(document, null);
    const pipeline = new PptxPipelineService();
    const result = await pipeline.generateFromUnifiedJson(unifiedJson, { addClosingSlide: false });
    expect(result.warnings.some((w) => w.includes('render failed'))).toBe(false);
    expect(result.buffer.length).toBeGreaterThan(0);

    // Reopen the produced bytes independently (JSZip, not pptxgenjs) and
    // confirm the speaker note text is actually IN the notes slide XML —
    // "assert it, don't assume" (brief §4).
    const zip = await JSZip.loadAsync(result.buffer);
    const notesFile = zip.file('ppt/notesSlides/notesSlide1.xml');
    expect(notesFile).not.toBeNull();
    const notesXml = await notesFile!.async('string');
    expect(notesXml).toContain(SPEAKER_NOTE_MARKER);

    const complete = await completePresentationExport({
      organizationId: ORG_A,
      exportReceiptId: begin.receipt.exportReceiptId,
      buffer: result.buffer,
    });
    expect(complete.status).toBe('succeeded');
    expect(complete.outputByteSize).toBe(result.buffer.length);
    // Freshly, independently recomputed — not the service's own hashBuffer —
    // to prove the persisted hash is not just "whatever the code said it was".
    const independentHash = createHash('sha256').update(result.buffer).digest('hex');
    expect(complete.outputContentHash).toBe(independentHash);
    expect(complete.outputContentHash).toBe(hashBuffer(result.buffer));

    // Cold readback: a fresh SELECT against the real table, not the JS
    // object the service handed back.
    const row = await pool.query(
      `SELECT * FROM artifact_export_receipts WHERE export_receipt_id = $1 AND organization_id = $2`,
      [begin.receipt.exportReceiptId, ORG_A]
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].status).toBe('succeeded');
    expect(row.rows[0].output_byte_size).toBe(result.buffer.length);
    expect(row.rows[0].output_content_hash).toBe(independentHash);
    expect(row.rows[0].source_content_hash).toBe(begin.sourceContentHash);
    expect(Number(row.rows[0].source_version)).toBe(1);
    expect(row.rows[0].provider_key).toBe('native:pptxgenjs');
    expect(row.rows[0].artifact_kind).toBe('presentation');
  });
});

// ── Idempotent retry ─────────────────────────────────────────────────────

describe('idempotent retry', () => {
  it('the SAME export (no header key) retried sequentially yields exactly ONE receipt', async () => {
    const { deck, deckId } = makeDeckRow({});
    const first = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pdf',
      createdBy: USER_A,
    });
    const retry = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pdf',
      createdBy: USER_A,
    });

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.receipt.exportReceiptId).toBe(first.receipt.exportReceiptId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_export_receipts
        WHERE organization_id = $1 AND source_record_id = $2 AND output_format = 'pdf'`,
      [ORG_A, deckId]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('an explicit Idempotency-Key header also collapses a retry to ONE receipt', async () => {
    const { deck, deckId } = makeDeckRow({});
    const requestIdempotencyKey = `${PREFIX}client-header-key`;
    const first = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pptx',
      createdBy: USER_A,
      requestIdempotencyKey,
    });
    const retry = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pptx',
      createdBy: USER_A,
      requestIdempotencyKey,
    });

    expect(retry.replayed).toBe(true);
    expect(retry.receipt.exportReceiptId).toBe(first.receipt.exportReceiptId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_export_receipts
        WHERE organization_id = $1 AND source_record_id = $2 AND output_format = 'pptx'`,
      [ORG_A, deckId]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('fails closed before a receipt for the unapproved sharp SVG/PNG renderer', async () => {
    const { deck, deckId } = makeDeckRow({});
    await expect(beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'png',
      createdBy: USER_A,
    })).rejects.toThrow('MAT_EXPORT_ENGINE_NOT_APPROVED:native:sharp-svg');
    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_export_receipts
        WHERE organization_id = $1 AND source_record_id = $2`,
      [ORG_A, deckId]
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('two CONCURRENT exports of the same deck+version+format produce exactly ONE receipt', async () => {
    const { deck, deckId } = makeDeckRow({});
    const makeCall = () =>
      beginPresentationExport({
        organizationId: ORG_A,
        deckId,
        deck,
        format: 'pptx',
        createdBy: USER_A,
      });

    const [r1, r2] = await Promise.all([makeCall(), makeCall()]);

    const replayedCount = [r1.replayed, r2.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);
    expect(r1.receipt.exportReceiptId).toBe(r2.receipt.exportReceiptId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_export_receipts
        WHERE organization_id = $1 AND source_record_id = $2 AND output_format = 'pptx'`,
      [ORG_A, deckId]
    );
    expect(rows.rows[0].n).toBe(1);
  });
});

// ── Failure and unavailable-provider paths ──────────────────────────────

describe('render failure', () => {
  it('records "failed", never "succeeded", and never fabricates output bytes', async () => {
    const { deck, deckId } = makeDeckRow({});
    const begin = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pdf',
      createdBy: USER_A,
    });

    const failed = await failPresentationExport({
      organizationId: ORG_A,
      exportReceiptId: begin.receipt.exportReceiptId,
      failureCode: 'PPTX_CURRENT_RENDER_FAILED',
    });
    expect(failed.status).toBe('failed');
    expect(failed.failureCode).toBe('PPTX_CURRENT_RENDER_FAILED');
    expect(failed.outputContentHash).toBeNull();
    expect(failed.outputByteSize).toBeNull();

    const row = await pool.query(
      `SELECT status, output_content_hash, output_byte_size FROM artifact_export_receipts WHERE export_receipt_id = $1`,
      [begin.receipt.exportReceiptId]
    );
    expect(row.rows[0].status).toBe('failed');
    expect(row.rows[0].output_content_hash).toBeNull();
    expect(row.rows[0].output_byte_size).toBeNull();

    // Defense-in-depth: the DB check constraint blocks 'succeeded' without
    // hash+size even if application validation were bypassed — same
    // invariant `handoffSpine.pg.test.ts` proves for other artifact kinds,
    // reproduced here for a 'presentation' row specifically.
    await expect(
      pool.query(
        `UPDATE artifact_export_receipts SET status = 'succeeded' WHERE export_receipt_id = $1`,
        [begin.receipt.exportReceiptId]
      )
    ).rejects.toThrow(/artifact_export_receipts_success_check|violates check constraint/);
  });
});

describe('unavailable provider (MAT-POL-001 fail-closed path)', () => {
  it('records "unavailable" and returns no fake bytes', async () => {
    // None of the three wired presentation export routes (PPTX/PDF/PNG) can
    // reach this today — all three have real, approved, MIT engines
    // installed (pptxgenjs / pdfkit / sharp), per the brief's P00 inventory.
    // This proves the plumbing FUTURE unapproved providers would land on,
    // by calling the spine directly with a non-approved provider key rather
    // than going through `beginPresentationExport` (which only ever emits
    // the three real provider keys in `PRESENTATION_EXPORT_PROVIDER_KEYS`).
    const deckId = `${PREFIX}deck-unavailable`;
    const recorded = await recordExportReceipt({
      organizationId: ORG_A,
      artifactKind: 'presentation',
      sourceRecordId: deckId,
      sourceVersion: 1,
      sourceContentHash: canonicalSourceHash({ id: deckId }),
      outputFormat: 'pptx',
      providerKey: 'unavailable',
      createdBy: USER_A,
    });
    expect(recorded.receipt.status).toBe('pending');

    const unavailable = await markPresentationExportUnavailable({
      organizationId: ORG_A,
      exportReceiptId: recorded.receipt.exportReceiptId,
      failureCode: 'PROVIDER_NOT_APPROVED',
    });
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.outputContentHash).toBeNull();
    expect(unavailable.outputByteSize).toBeNull();

    const row = await pool.query(
      `SELECT status, output_content_hash, output_byte_size FROM artifact_export_receipts WHERE export_receipt_id = $1`,
      [recorded.receipt.exportReceiptId]
    );
    expect(row.rows[0].status).toBe('unavailable');
    expect(row.rows[0].output_content_hash).toBeNull();
    expect(row.rows[0].output_byte_size).toBeNull();
  });
});

// ── Tenant isolation ─────────────────────────────────────────────────────

describe('cross-tenant isolation', () => {
  it('org B cannot complete, fail, or read org A export receipt', async () => {
    const { deck, deckId } = makeDeckRow({});
    const begin = await beginPresentationExport({
      organizationId: ORG_A,
      deckId,
      deck,
      format: 'pdf',
      createdBy: USER_A,
    });

    await expect(
      completePresentationExport({
        organizationId: ORG_B,
        exportReceiptId: begin.receipt.exportReceiptId,
        buffer: Buffer.from('not-org-a-bytes'),
      })
    ).rejects.toThrow(HandoffSpineError);

    await expect(
      failPresentationExport({
        organizationId: ORG_B,
        exportReceiptId: begin.receipt.exportReceiptId,
        failureCode: 'CROSS_TENANT_ATTEMPT',
      })
    ).rejects.toThrow(HandoffSpineError);

    // A tenant-scoped read from org B's perspective sees nothing.
    const crossTenantRead = await pool.query(
      `SELECT * FROM artifact_export_receipts WHERE export_receipt_id = $1 AND organization_id = $2`,
      [begin.receipt.exportReceiptId, ORG_B]
    );
    expect(crossTenantRead.rows).toHaveLength(0);

    // The row is untouched — still 'pending' under its real owner, org A.
    const ownerRead = await pool.query(
      `SELECT status, organization_id FROM artifact_export_receipts WHERE export_receipt_id = $1`,
      [begin.receipt.exportReceiptId]
    );
    expect(ownerRead.rows[0].organization_id).toBe(ORG_A);
    expect(ownerRead.rows[0].status).toBe('pending');

    // Clean up this one explicitly since it was intentionally left pending
    // (afterAll's blanket DELETE also covers it, but fail it here so this
    // test's own intent — "never leave a receipt dangling" — is honored).
    await failPresentationExport({
      organizationId: ORG_A,
      exportReceiptId: begin.receipt.exportReceiptId,
      failureCode: 'TEST_CLEANUP',
    });
  });
});
