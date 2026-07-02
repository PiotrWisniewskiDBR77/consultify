/**
 * @vitest-environment node
 *
 * M19 Presentations (Presentation Studio / DeckBuilder) — cross-org IDOR
 * contract tests (adversarial sweep, wave 6 follow-up).
 *
 * Wave 5/6 closed exactly one presentations hole:
 *   - POST /decks/:deckId/analytics/view looked the deck up by id WITHOUT an
 *     org filter (org A could write analytics rows against / probe org B's
 *     deck). Now org-scoped (`cross-org-idor-m17.test.ts` HOLE-1).
 *
 * This sweep audited the REMAINING ~70 endpoints (deck CRUD, slides/autosave,
 * versions, exports pdf/html/png/pptx-download/parity, revert, agent-history,
 * AI-operation accept/reject/revert/bulk-revert, share GET/DELETE, comments,
 * analytics, templates, governance, alert-subscriptions, public viewer). NO new
 * runtime holes were found — every by-id deck access carries an
 * `organization_id` filter, every child-table read/write (versions,
 * ai_operations, analytics, runtime-events, audit-log) is reached only after an
 * org-verified deck lookup or carries its own org filter, role/capability is
 * enforced server-side per route, and the two pre-auth public routes are
 * token-scoped + sanitized.
 *
 * The presentations router has a very heavy import graph, so — exactly like the
 * wave-6 analytics/view guard in `cross-org-idor-m17.test.ts` — this file pins
 * the contract with STATIC SOURCE GUARDS rather than booting the whole module.
 * These guards lock in the org-scope invariant so a future refactor cannot
 * silently reopen the IDOR shape that wave-5 closed.
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

describe('M19 presentations — every deck lookup is org-scoped (static source guards)', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // GLOBAL INVARIANT — no bare (org-less) deck lookup by id anywhere.
  //
  // The IDOR shape wave-5 closed was `FROM presentation_decks WHERE id = ?`
  // with no immediate org filter. The ONLY legitimate non-org deck lookup is
  // the public share route (`WHERE share_token = ?`), which the `id = ?`
  // anchor below intentionally excludes.
  // ──────────────────────────────────────────────────────────────────────────
  it('no org-less "FROM presentation_decks WHERE id = ?" lookup remains', async () => {
    const src = await readRouterSource();
    const bareById =
      src.match(/FROM presentation_decks\s+WHERE id = \?(?!\s*AND organization_id)/g) || [];
    expect(bareById).toEqual([]);
  });

  it('every "FROM presentation_decks WHERE id" lookup carries an organization_id filter', async () => {
    const src = await readRouterSource();
    // Normalize whitespace so multi-line SQL is matched on one logical line.
    const flat = src.replace(/\s+/g, ' ');
    const idLookups = flat.match(/FROM presentation_decks WHERE id = \?[^;]*?(?=\[|`)/g) || [];
    expect(idLookups.length).toBeGreaterThan(0);
    for (const lookup of idLookups) {
      expect(
        /organization_id = \?/.test(lookup),
        `deck id lookup missing org filter: ${lookup.slice(0, 120)}`
      ).toBe(true);
    }
  });

  it('the only org-less deck lookup is the public share-token route', async () => {
    const src = await readRouterSource();
    const flat = src.replace(/\s+/g, ' ');
    // Every `FROM presentation_decks WHERE <x>` whose predicate is neither
    // `id = ? ... organization_id` nor `share_token = ?` would be a leak.
    const allDeckLookups =
      flat.match(/FROM presentation_decks WHERE [^;]*?(?=ORDER|LIMIT|GROUP|\[|`)/g) || [];
    expect(allDeckLookups.length).toBeGreaterThan(0);
    for (const lookup of allDeckLookups) {
      const hasOrg = /organization_id = \?/.test(lookup);
      const isShareToken = /share_token = \?/.test(lookup);
      expect(
        hasOrg || isShareToken,
        `unscoped deck lookup found: ${lookup.slice(0, 120)}`
      ).toBe(true);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DECK MUTATIONS — every UPDATE / DELETE of a deck row is org-scoped.
  // ──────────────────────────────────────────────────────────────────────────
  it('every UPDATE/DELETE on presentation_decks carries an organization_id filter', async () => {
    const src = await readRouterSource();
    const flat = src.replace(/\s+/g, ' ');
    const writes =
      flat.match(/(UPDATE presentation_decks SET|DELETE FROM presentation_decks) [^;]*?(?=`)/g) || [];
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(
        /organization_id = \?/.test(w),
        `deck write missing org filter: ${w.slice(0, 140)}`
      ).toBe(true);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CHILD-TABLE READS — agent-history, runtime-events, versions, analytics.
  // ──────────────────────────────────────────────────────────────────────────
  it('agent-history read is scoped by deck_id AND organization_id', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks/:deckId/agent-history'");
    const flat = block.replace(/\s+/g, ' ');
    expect(/FROM presentation_ai_operations WHERE deck_id = \? AND organization_id = \?/.test(flat)).toBe(
      true
    );
  });

  it('runtime-events reads are scoped by organization_id AND deck_id', async () => {
    const src = await readRouterSource();
    for (const marker of [
      "'/decks/:deckId/runtime-events/summary'",
      "'/decks/:deckId/runtime-events'",
    ]) {
      const block = sliceHandler(src, marker);
      const flat = block.replace(/\s+/g, ' ');
      expect(
        /organization_id = \?/.test(flat) && /deck_id = \?/.test(flat),
        `runtime-events handler ${marker} not org+deck scoped`
      ).toBe(true);
    }
  });

  it('versions list + analytics + restore verify deck ownership before touching child rows', async () => {
    const src = await readRouterSource();
    for (const marker of [
      "'/decks/:deckId/versions'",
      "'/decks/:deckId/analytics'",
      "'/decks/:deckId/versions/:versionId/restore'",
    ]) {
      const block = sliceHandler(src, marker);
      // An ownership SELECT against presentation_decks scoped to id + org must
      // run inside the handler before any child-table (deck_id-only) query.
      const flat = block.replace(/\s+/g, ' ');
      expect(
        /FROM presentation_decks WHERE id = \? AND organization_id = \?/.test(flat),
        `handler ${marker} missing org-scoped ownership check`
      ).toBe(true);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AGENT-EDIT lifecycle — accept/reject/revert reject foreign-org operations.
  // ──────────────────────────────────────────────────────────────────────────
  it('agent-edit accept/reject reject foreign-org operations (op.organizationId guard)', async () => {
    const src = await readRouterSource();
    for (const marker of [
      "'/decks/:deckId/agent-edit/:operationId/accept'",
      "'/decks/:deckId/agent-edit/:operationId/reject'",
    ]) {
      const block = sliceHandler(src, marker);
      // The pending-op object must be cross-checked against both the deck id
      // and the caller's org before any mutation.
      expect(
        /op\.organizationId !== orgId/.test(block),
        `handler ${marker} missing op.organizationId guard`
      ).toBe(true);
      expect(/op\.deckId !== deckId/.test(block)).toBe(true);
    }
  });

  it('agent-history revert fetches the operation scoped to org AND deck', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks/:deckId/agent-history/:operationId/revert'");
    const flat = block.replace(/\s+/g, ' ');
    expect(
      /FROM presentation_ai_operations WHERE id = \? AND organization_id = \? AND deck_id = \?/.test(
        flat
      )
    ).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // EXPORTS — pdf/html/png/download go through the org-scoped artifact registry.
  // ──────────────────────────────────────────────────────────────────────────
  it('every export route resolves the artifact with the caller organizationId', async () => {
    const src = await readRouterSource();
    for (const marker of [
      "'/decks/:id/download'",
      "'/decks/:deckId/export/pdf'",
      "'/decks/:deckId/export/html'",
      "'/decks/:deckId/export/png'",
    ]) {
      const block = sliceHandler(src, marker);
      const flat = block.replace(/\s+/g, ' ');
      expect(
        /getArtifactByOrigin\(\{ organizationId: orgId/.test(flat),
        `export handler ${marker} not org-scoped via artifact registry`
      ).toBe(true);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC ROUTES — share viewer is sanitized; subscriber dashboard is
  // double-scoped by the token's own org.
  // ──────────────────────────────────────────────────────────────────────────
  it('public /shared/:token route returns a sanitized (deny-listed) deck row', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/shared/:token'");
    // The handler must pass the row through the public sanitizer rather than
    // echoing the raw deck row (which carries share_token, org id, etc.).
    expect(/toPublicDeckRow\(/.test(block)).toBe(true);
    expect(/SELECT \*/.test(block)).toBe(true); // selects all, then strips deny fields
  });

  it('public subscriber dashboard scopes every query by the token row organization_id', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/governance/subscriber/dashboard'");
    const flat = block.replace(/\s+/g, ' ');
    // Subscription + dispatch reads must both be scoped to the token's org.
    expect(
      /WHERE id = \? AND organization_id = \?/.test(flat),
      'subscription load not org-scoped to token row'
    ).toBe(true);
    expect(
      /WHERE subscription_id = \? AND organization_id = \?/.test(flat),
      'dispatch load not org-scoped to token row'
    ).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GOVERNANCE by-id mutations — presets / saved-searches / alert-subscriptions.
  // ──────────────────────────────────────────────────────────────────────────
  it('watchlist-preset + alert-subscription deletes are org-scoped', async () => {
    const src = await readRouterSource();
    const presetBlock = sliceHandler(src, "'/governance/watchlist-presets/:id'");
    expect(
      /DELETE FROM presentation_watchlist_presets\s+WHERE id = \? AND organization_id = \?/.test(
        presetBlock
      )
    ).toBe(true);

    const subBlock = sliceHandler(src, "'/governance/alert-subscriptions/:id'");
    const subFlat = subBlock.replace(/\s+/g, ' ');
    expect(/WHERE id = \? AND organization_id = \?/.test(subFlat)).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SQL INJECTION — the only interpolations in SQL are value-free placeholder /
  // clause builders (`?`-marker IN-lists + static column-name WHERE clauses);
  // no user value is ever interpolated into a query string.
  // ──────────────────────────────────────────────────────────────────────────
  it('only interpolates value-free placeholder/clause builders into SQL', async () => {
    const src = await readRouterSource();
    const interpolated =
      src.match(/(SELECT|INSERT INTO|UPDATE|DELETE FROM)[^;`]*?\$\{[^}]+\}/g) || [];
    // Whitelist: `${placeholders}` (a `?,?,?` IN-list built from `.map(() => '?')`)
    // and `${conditions.join(...)}` (static hardcoded `col = ?` fragments). Both
    // bind every user value via the params array — never inline.
    const SAFE = /\$\{(placeholders|conditions\.join\([^)]*\))\}/;
    const unsafe = interpolated.filter((q) => {
      const interps = q.match(/\$\{[^}]+\}/g) || [];
      return interps.some((i) => !SAFE.test(i));
    });
    expect(unsafe, `unsafe SQL interpolation: ${unsafe.join(' || ')}`).toEqual([]);
  });
});
