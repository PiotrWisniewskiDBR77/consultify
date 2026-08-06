/**
 * P0 fix — GET /presentations/decks/:id/download must never serve a stale PPTX.
 *
 * Bug (Harvard/wdrozenie-100 P0 report): the on-disk PPTX at
 * `presentation_decks.export_path` was only ever rendered once, at deck
 * creation time (presentationGeneratorService.ts). Autosave / agent-edit /
 * AI-accept all persist edits ONLY into `deck_json`
 * (`UPDATE presentation_decks SET deck_json = ?, version = ? ...`,
 * presentations.routes.ts PUT /decks/:deckId/autosave ~line 2227) and never
 * touch `export_path`. The download route then did a bare
 * `res.sendFile(deck.export_path)` — so after editing a slide, downloading
 * the PPTX returned the ORIGINAL file from creation time, silently dropping
 * every edit.
 *
 * Fix: presentations.routes.ts now re-renders the PPTX from the CURRENT
 * `deck_json` (via `normalizeDeckDocument` -> `deckDocumentToUnifiedJson` ->
 * the same `PptxPipelineService.generateFromUnifiedJson` used at creation
 * time) whenever `deck.updated_at` is newer than the on-disk file's mtime,
 * before serving it — see `regeneratePptxIfStale()` in presentations.routes.ts.
 *
 * This test drives the REAL router + REAL PptxPipelineService (no mocking of
 * the render pipeline) so it proves actual OOXML bytes reflect the edit, not
 * just that some regeneration function was invoked. Only the DB boundary and
 * auth/quality-gate/artifact-registry services are mocked, matching the
 * pattern in presentations.export-gate.route.test.ts /
 * presentations.autosave-conflict.route.test.ts.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import express from 'express';
import JSZip from 'jszip';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', role: 'OWNER', organizationId: 'org-A' };
    req.userId = 'user-1';
    req.userRole = 'OWNER';
    req.organizationId = 'org-A';
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: vi.fn().mockResolvedValue({ artifactId: 'artifact-1' }),
  getArtifactByOriginUnscoped: vi.fn(),
  registerArtifactOrigin: vi.fn(),
  mapPresentationStatusToDeliveryState: vi.fn(() => 'delivered'),
  deriveArtifactVisibilityScope: vi.fn(() => 'private'),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/src/services/presentationQualityGatesService.js', () => ({
  checkDeckQualityGates: vi.fn().mockResolvedValue({
    canExport: true,
    canShare: true,
    result: 'PASS',
    scorecard: { p0: 0, p1: 0, p2: 0, passVocabulary: 'PASS' },
    gates: [],
  }),
}));

// supertest/superagent has no built-in binary parser registered for the
// PPTX OOXML content-type, so it falls back to its text parser and mangles
// multi-byte sequences. Force raw Buffer accumulation instead.
function binaryParser(res: any, callback: (err: Error | null, body: Buffer) => void) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
}

function buildDeckJson(cardTitle: string) {
  return JSON.stringify({
    schemaVersion: 1,
    cards: [
      {
        card_id: 'c1',
        deck_id: 'deck-1',
        order_index: 0,
        intent: 'cover',
        layout_id: 'default',
        title: cardTitle,
        key_message: cardTitle,
        blocks: [],
        source_refs: [],
        has_refreshable_data: false,
        background: { type: 'theme' },
        animations: { entrance: 'none', block_stagger: false },
        is_locked: false,
      },
    ],
  });
}

describe('P0 — GET /presentations/decks/:id/download re-renders a stale PPTX', () => {
  let tmpDir: string;
  let exportPath: string;
  let deckRow: any;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-download-test-'));
    exportPath = path.join(tmpDir, 'deck-1.pptx');

    // Original "at creation time" export: written to disk BEFORE the edit,
    // with an mtime clearly older than the deck's updated_at below.
    fs.writeFileSync(exportPath, Buffer.from('ORIGINAL-PPTX-PLACEHOLDER-BYTES'));
    const oldMtime = new Date(Date.now() - 60_000);
    fs.utimesSync(exportPath, oldMtime, oldMtime);

    deckRow = {
      id: 'deck-1',
      organization_id: 'org-A',
      title: 'Q3 Deck',
      export_path: exportPath,
      export_format: 'pptx',
      confidentiality: 'internal',
      // Edited AFTER the file above was written — this is what makes the
      // file stale and must trigger re-render.
      updated_at: new Date().toISOString(),
      exported_at: oldMtime.toISOString(),
      deck_json: buildDeckJson('EDITED SLIDE TITLE AFTER AUTOSAVE'),
      unified_json: null,
      outline_json: null,
      source_artifacts: null,
      source_refs_json: null,
      validation_warnings: null,
      version: 2,
    };
  });

  afterEach(() => {
    vi.doUnmock('../../../server/src/utils/DbPromise.js');
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
  });

  async function buildApp() {
    vi.resetModules();
    vi.doMock('../../../server/src/utils/DbPromise.js', () => ({
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn(async (sql: string) => {
        if (/FROM presentation_decks/i.test(sql)) return deckRow;
        return null;
      }),
      run: vi.fn(async (sql: string, params: unknown[] = []) => {
        // Mirrors: UPDATE presentation_decks SET slide_count = ?, exported_at = ?, ... WHERE id = ? AND organization_id = ?
        if (/UPDATE presentation_decks SET slide_count/i.test(sql)) {
          const [slideCount, exportedAt] = params as [number, string];
          deckRow = { ...deckRow, slide_count: slideCount, exported_at: exportedAt };
        }
        return { success: true, changes: 1 };
      }),
    }));
    const { default: router } = await import('../../../server/src/routes/presentations.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/presentations', router);
    return app;
  }

  it('re-renders from current deck_json and serves fresh bytes containing the edit', async () => {
    const app = await buildApp();

    const res = await request(app)
      .get('/presentations/decks/deck-1/download')
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );

    const buffer = Buffer.from(res.body as any);
    // No longer the stale placeholder written before the edit.
    expect(buffer.equals(Buffer.from('ORIGINAL-PPTX-PLACEHOLDER-BYTES'))).toBe(false);
    // A real OOXML/ZIP package, not a raw error page.
    expect(buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);

    // Unzip and confirm the edited title made it into the rendered slide XML —
    // this is the actual round-trip proof, not just "a file changed".
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter((f) => /ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slideFiles.length).toBeGreaterThan(0);
    const slideXmls = await Promise.all(slideFiles.map((f) => zip.files[f].async('string')));
    const combined = slideXmls.join('\n');
    expect(combined).toContain('EDITED SLIDE TITLE AFTER AUTOSAVE');

    // The on-disk file at export_path was overwritten in place (what the
    // bundle/ZIP export and any subsequent download will also serve).
    const onDisk = fs.readFileSync(exportPath);
    expect(onDisk.equals(buffer)).toBe(true);
  });

  it('does NOT re-render when the on-disk file matches the current deck version', async () => {
    // Freshness is version-bound, not clock-bound. Matching versions prove
    // that these bytes were rendered from the current canonical deck.
    const freshBytes = Buffer.from('FRESH-UNCHANGED-BYTES');
    fs.writeFileSync(exportPath, freshBytes);
    deckRow.exported_version = deckRow.version;
    const freshMtime = new Date(Date.now() + 60_000);
    fs.utimesSync(exportPath, freshMtime, freshMtime);

    const app = await buildApp();
    const res = await request(app)
      .get('/presentations/decks/deck-1/download')
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    const buffer = Buffer.from(res.body as any);
    expect(buffer.equals(freshBytes)).toBe(true);
  });
});
