import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(path.resolve(__dirname, '../my-work.routes.ts'), 'utf8');
const canvasDrafts = fs.readFileSync(
  path.resolve(__dirname, '../../work-canvas.routes.ts'),
  'utf8'
);
const expand = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../../src/components/MyWork/notebook/notebookExpandToDocument.ts'
  ),
  'utf8'
);

// FIX-15 (Day 3 layer-2 acceptance) closed the original STOP this file was
// named for: "Rozwiń w dokument" is no longer permanently fail-closed for
// everyone. It is now capability-gated the same way notebook delete is —
// allowed for the note's owner, backed by a REAL audit_events row
// ('NOTEBOOK_PAGE_EXPANDED', written by POST /api/work-canvas/drafts,
// owner-scoped) instead of the draft id standing in as a fake receipt. This
// file keeps its original name/path (external references, if any, still
// resolve) but its assertions now prove the resolved contract, not the old
// permanent block.
describe('notebook expand capability contract (was: fail-closed)', () => {
  it('is capability-gated like delete — allowed for the owner, still fail-closed for a non-owner', () => {
    const start = route.indexOf('expandDocument: {');
    expect(start).toBeGreaterThan(-1);
    const closeMatch = route.slice(start).match(/\n {10}\},/);
    expect(closeMatch).not.toBeNull();
    const block = route.slice(start, start + (closeMatch!.index as number));
    expect(block).toContain('allowed: isOwner');
    expect(block).toContain(
      "receiptContract: isOwner ? 'notebook_expand_document_receipt_v1' : null"
    );
    // Still explicitly fail-closed for anyone but the owner.
    expect(block).toContain('Only the note owner can create a document draft from this page.');
  });

  it('writes a real, owner-scoped NOTEBOOK_PAGE_EXPANDED audit receipt when a draft is created from a notebook page', () => {
    expect(canvasDrafts).toContain('action, resource_type, resource_id');
    expect(canvasDrafts).toContain("'NOTEBOOK_PAGE_EXPANDED'");
    expect(canvasDrafts).toContain("provenanceSource?.source === 'notebook-expand'");
    // Owner check before writing the receipt — mirrors notebook delete's own
    // owner-only gate, not a blanket "any draft creation counts" shortcut.
    expect(canvasDrafts).toContain("String(sourcePage.owner_user_id || '') === String(userId)");
  });

  it('the readback endpoint accepts NOTEBOOK_PAGE_EXPANDED, not only the delete action', () => {
    expect(route).toContain('NOTEBOOK_ACTION_RECEIPT_ACTIONS');
    expect(route).toContain("'NOTEBOOK_PAGE_EXPANDED'");
  });

  it('the client prefers the real server-issued receipt over the draft id', () => {
    expect(expand).toContain('realReceiptId || draftId');
    expect(expand).not.toContain('receiptId: draftId');
  });
});
