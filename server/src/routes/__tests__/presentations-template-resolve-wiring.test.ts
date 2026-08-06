/**
 * @vitest-environment node
 *
 * R11 deck slice (2026-07-26) — `POST /presentations/templates/resolve` and
 * `POST /presentations/decks/from-template` WIRING contract.
 *
 * WHY STATIC SOURCE GUARDS INSTEAD OF BOOTING THE ROUTER: `presentations.routes.ts`
 * has a very heavy import graph (pulls in the entire deck/service tree —
 * PptxPipelineService, sharp, pdfkit, multer, dozens of presentation*
 * services). The existing M19 IDOR sweep (`cross-org-idor-m19.test.ts`) and the
 * error-disclosure sweep (`presentations.error-disclosure.test.ts`) both made
 * the same call for the same reason and pin their invariants with static
 * source guards rather than `supertest`-mounting the module. This file follows
 * that established precedent.
 *
 * The resolver's own decision logic (org/scope/status/orphan) is covered
 * end-to-end against DB fixtures by
 * `../../services/materials/__tests__/creationIntentResolver.test.ts`; the
 * deterministic outline->slide copy is covered against a fixture by
 * `../../services/__tests__/mapOutlineBlueprintToDeckSlides.test.ts`. What
 * THIS file proves is the thing a resolver-only unit test cannot: that the
 * PRODUCTION route actually calls that resolver (with a library ref, org from
 * auth — never the request body) instead of silently having zero caller, and
 * that every rejection code is mapped to the SAME honest HTTP status the
 * document-studio counterpart uses.
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

describe('POST /presentations/templates/resolve — wiring', () => {
  it('invokes resolvePresentationTemplateForCreation with a library ref and the auth-context org', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/templates/resolve',").replace(/\s+/g, ' ');

    expect(/resolvePresentationTemplateForCreation\(/.test(block)).toBe(true);
    // Library ref built from the request body's templateArtifactId — never a
    // client-supplied canonical id / originRuntime.
    expect(/\{ kind: 'library', templateArtifactId \}/.test(block)).toBe(true);
    expect(block).not.toMatch(/kind:\s*'internal'/);
    // Org comes from getOrgId(req) (auth context), not req.body.
    expect(/const orgId = getOrgId\(req\)/.test(block)).toBe(true);
    expect(/\{ organizationId: orgId \}/.test(block)).toBe(true);
    expect(block).not.toMatch(/organizationId:\s*req\.body/);
  });

  it('never returns the outline blueprint to the client (only its length)', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/templates/resolve',").replace(/\s+/g, ' ');
    expect(/slideCount: resolved\.outlineBlueprint\.length/.test(block)).toBe(true);
    // Any OTHER use of `outlineBlueprint` (i.e. not immediately `.length`d)
    // would mean the raw array is being assigned into the response body.
    expect(block).not.toMatch(/outlineBlueprint(?!\.length)/);
  });

  it('the shared TEMPLATE_RESOLVE_STATUS table (used by BOTH routes below) maps every code to the documented HTTP status', async () => {
    const src = await readRouterSource();
    const start = src.indexOf('const TEMPLATE_RESOLVE_STATUS');
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf('};', start) + 2);

    expect(/TEMPLATE_NOT_INDEXED:\s*404/.test(block)).toBe(true);
    expect(/TEMPLATE_ORPHANED:\s*404/.test(block)).toBe(true);
    expect(/TEMPLATE_FORBIDDEN:\s*403/.test(block)).toBe(true);
    expect(/TEMPLATE_DEPRECATED:\s*409/.test(block)).toBe(true);
    expect(/TEMPLATE_FORMAT_UNSUPPORTED:\s*422/.test(block)).toBe(true);
  });
});

describe('POST /presentations/decks/from-template — wiring', () => {
  it('re-resolves the template server-side (never trusts a prior /resolve response)', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks/from-template',").replace(/\s+/g, ' ');

    expect(/resolvePresentationTemplateForCreation\(/.test(block)).toBe(true);
    expect(/\{ kind: 'library', templateArtifactId \}/.test(block)).toBe(true);
    expect(/\{ organizationId: orgId \}/.test(block)).toBe(true);
    // No client-supplied canonicalTemplateId is ever read from the body.
    expect(block).not.toMatch(/req\.body\?\.canonicalTemplateId/);
  });

  it('builds slides via mapOutlineBlueprintToDeckSlides — never re-derives the mapping inline', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks/from-template',").replace(/\s+/g, ' ');

    expect(/mapOutlineBlueprintToDeckSlides\(resolved\.outlineBlueprint, brief\)/.test(block)).toBe(
      true
    );
    // The route must consume resolved.outlineBlueprint, not the request body.
    expect(block).not.toMatch(/req\.body\?\.outline/);
  });

  it('inserts one presentation_cards row per mapped slide', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks/from-template',").replace(/\s+/g, ' ');
    expect(/INSERT INTO presentation_cards/.test(block)).toBe(true);
    expect(/for \(let i = 0; i < slides\.length; i\+\+\)/.test(block)).toBe(true);
  });

  it('rejects on the same TEMPLATE_RESOLVE_STATUS table as /templates/resolve', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks/from-template',").replace(/\s+/g, ' ');
    expect(/TEMPLATE_RESOLVE_STATUS\[err\.code\]/.test(block)).toBe(true);
  });

  it('the 500 fallback does not leak raw error text (consistent with the M19 sweep)', async () => {
    const src = await readRouterSource();
    const block = sliceHandler(src, "'/decks/from-template',").replace(/\s+/g, ' ');
    expect(/error: 'Failed to create deck from template'/.test(block)).toBe(true);
    expect(block).not.toMatch(/error:\s*error\?\.message/);
  });
});
