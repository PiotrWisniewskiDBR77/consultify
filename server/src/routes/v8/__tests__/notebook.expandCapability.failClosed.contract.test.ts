import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(path.resolve(__dirname, '../my-work.routes.ts'), 'utf8');
const expand = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../../src/components/MyWork/notebook/notebookExpandToDocument.ts'
  ),
  'utf8'
);

describe('notebook expand capability fail-closed contract', () => {
  it('does not advertise a durable receipt contract without an audit receipt', () => {
    // FIX-5 (Day 3 acceptance): a fixed "+500 chars" window is brittle — any
    // unrelated edit that shortens/lengthens this object (or adds a comment
    // above it) can silently push `receiptContract: null` outside the slice
    // without failing loudly. Bound the extraction to the actual object
    // literal instead: from `expandDocument: {` to its own matching `},`
    // (same indentation as the opening line), so the assertion tracks the
    // real object regardless of surrounding source drift.
    const start = route.indexOf('expandDocument: {');
    expect(start).toBeGreaterThan(-1);
    const closeMatch = route.slice(start).match(/\n {10}\},/);
    expect(closeMatch).not.toBeNull();
    const block = route.slice(start, start + (closeMatch!.index as number));
    expect(block).toContain('allowed: false');
    expect(block).toContain('receiptContract: null');
    expect(block).toContain('audit receipt with readback');
  });

  it('documents the pre-existing draft-id receipt substitution as non-audit evidence', () => {
    expect(expand).toContain('receiptId: draftId');
    expect(route).not.toContain("action = 'NOTEBOOK_PAGE_EXPANDED'");
  });
});
