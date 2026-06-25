/**
 * @vitest-environment node
 *
 * M19 Presentations — ERROR-RESPONSE INFO-DISCLOSURE contract tests.
 *
 * Axis: raw error text must NOT leak into 5xx response bodies. A handler that
 * returns `err.message` / `err.stack` / `String(err)` / DB-driver text to the
 * client exposes internal structure (table names, file paths, stack frames).
 *
 * Fix shape (preserved across the router): on a server error, the response
 * carries a GENERIC `error` string + a stable `code`, while the REAL error is
 * logged server-side via `logger.*`. The FE-visible response shape
 * (`{ success: false, error, code? }`) is unchanged — only the leaky VALUE is
 * replaced.
 *
 * The presentations router has a very heavy import graph (booting it pulls in
 * the entire deck/service tree), so — exactly like `cross-org-idor-m19.test.ts`
 * — this file pins the contract with STATIC SOURCE GUARDS rather than booting
 * the module. The guards lock in the no-raw-leak invariant so a future refactor
 * cannot silently re-introduce `error: err.message` in a 5xx body.
 *
 * Sweep result (2026-06-16): exactly ONE genuine leak existed —
 *   `POST /decks` 500 returned `error: error?.message || 'Failed to create deck'`.
 * It is now `{ success: false, error: 'Failed to create deck', code: 'DECK_CREATE_FAILED' }`
 * with the raw error logged via `logger.error`. Every other 5xx in the file was
 * already generic. The two non-5xx uses of `error.message` (the LEGAL_HOLD 403
 * domain message and the export-trace `errorCategory` persisted server-side) are
 * intentionally out of scope.
 */

import { describe, expect, it } from 'vitest';

async function readRouterSource(): Promise<string> {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = url.fileURLToPath(new URL('../presentations.routes.ts', import.meta.url));
  return fs.readFileSync(path, 'utf8');
}

/** Slice one route handler block: from its path marker to the next router.<verb>( call. */
function sliceHandler(src: string, marker: string): string {
  const start = src.indexOf(marker);
  expect(start, `route marker not found: ${marker}`).toBeGreaterThan(-1);
  const after = src.slice(start + marker.length);
  const end = after.search(/router\.(get|post|put|patch|delete)\(/);
  return end === -1 ? after : after.slice(0, end);
}

describe('M19 presentations — no raw error text in 5xx response bodies', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // SPECIFIC FIX — POST /decks 500 must return a generic message + stable code,
  // never `error?.message`. (This was the single genuine leak in the sweep.)
  // ──────────────────────────────────────────────────────────────────────────
  it('POST /decks 500 returns generic message + DECK_CREATE_FAILED code, not error.message', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks',");
    const flat = block.replace(/\s+/g, ' ');

    // Shape preserved: success:false + error key still present.
    expect(/success: false/.test(flat)).toBe(true);
    // Generic message + stable code now used in the 500 body.
    expect(/error: 'Failed to create deck', code: 'DECK_CREATE_FAILED'/.test(flat)).toBe(true);
    // The real error is logged server-side.
    expect(/logger\.error\('\[presentations\] Failed to create deck:', error\)/.test(flat)).toBe(
      true
    );
    // The leaky pattern must be gone from this handler's RESPONSE.
    expect(/error: error\?\.message \|\| 'Failed to create deck'/.test(flat)).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GLOBAL INVARIANT — no res.status(5xx).json({ ... error: <raw> ... }) writes
  // raw error text. We scan every `res.status(5NN)...json({...})` body and
  // assert the `error:` value is a string LITERAL (or a curated `.error` field),
  // never `err.message` / `error.message` / `String(err)` / `err.stack`.
  // ──────────────────────────────────────────────────────────────────────────
  it('no 5xx json body uses err.message / err.stack / String(err) as its error value', async () => {
    const src = await readRouterSource();
    const flat = src.replace(/\s+/g, ' ');

    // Capture each `res.status(5NN)...json({ ... })` body (non-greedy to the
    // first closing brace of the json object).
    const bodies =
      flat.match(/res\s*\.?\s*status\(5\d\d\)\s*\.json\(\{[^}]*\}/g) || [];
    expect(bodies.length, 'expected at least one 5xx response body').toBeGreaterThan(0);

    const LEAKY =
      /error:\s*[^,}]*(\berr(or)?\??\.(message|stack)\b|String\(\s*err(or)?\s*\)|\(error as[^)]*\)\?\.\s*message)/;
    const leaks = bodies.filter((b) => LEAKY.test(b));
    expect(leaks, `5xx body leaks raw error text: ${leaks.join(' || ')}`).toEqual([]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // LOGGING PRESERVED — the create-deck catch still logs the real error object
  // so observability is not lost by the redaction.
  // ──────────────────────────────────────────────────────────────────────────
  it('create-deck catch logs the real error server-side (logger imported + used)', async () => {
    const src = await readRouterSource();
    expect(/import logger from '\.\.\/utils\/Logger\.js'/.test(src)).toBe(true);
  });
});
