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
    const block = route.slice(
      route.indexOf('expandDocument: {'),
      route.indexOf('expandDocument: {') + 500
    );
    expect(block).toContain('allowed: false');
    expect(block).toContain('receiptContract: null');
    expect(block).toContain('audit receipt with readback');
  });

  it('documents the pre-existing draft-id receipt substitution as non-audit evidence', () => {
    expect(expand).toContain('receiptId: draftId');
    expect(route).not.toContain("action = 'NOTEBOOK_PAGE_EXPANDED'");
  });
});
