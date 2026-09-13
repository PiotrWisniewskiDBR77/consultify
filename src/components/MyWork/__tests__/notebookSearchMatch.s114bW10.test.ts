/**
 * S1.14b / W10 — the notebook library search was blind to note content.
 *
 * Measured on staging 13.09 (3/3): "Warsaw" (title) → hit; "dunning" and "Peppol"
 * — both proven present in the note body via
 * `GET /api/v8/my-work/notebook/pages/:id` — → empty list showing the first-run
 * screen "No pages yet / Create your first page".
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

import { matchesNoteQuery, normalizeNoteQuery } from '../notebookSearchMatch';

const note = {
  title: 'Order-to-Cash Diagnostic - Warsaw Plant',
  contentText: 'Invoices are issued via Peppol; the dunning process starts on day 14.',
  summary: null,
};

describe('S1.14b/W10 — matchesNoteQuery', () => {
  it('still matches the title (the only thing that used to work)', () => {
    expect(matchesNoteQuery(note, normalizeNoteQuery('Warsaw'))).toBe(true);
  });

  it('matches a word that only exists in the body — the measured defect', () => {
    expect(matchesNoteQuery(note, normalizeNoteQuery('dunning'))).toBe(true);
    expect(matchesNoteQuery(note, normalizeNoteQuery('Peppol'))).toBe(true);
  });

  it('matches the summary too', () => {
    expect(
      matchesNoteQuery({ title: 'x', summary: 'quarterly close' }, normalizeNoteQuery('close'))
    ).toBe(true);
  });

  it('does not match an absent word', () => {
    expect(matchesNoteQuery(note, normalizeNoteQuery('kubernetes'))).toBe(false);
  });

  it('an empty query keeps every note', () => {
    expect(matchesNoteQuery(note, normalizeNoteQuery('   '))).toBe(true);
  });
});

describe('S1.14b/W10 — the library uses it', () => {
  it('NotebookContent filters through matchesNoteQuery', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/MyWork/NotebookContent.tsx'),
      'utf8'
    );
    expect(source).toContain("from './notebookSearchMatch'");
    expect(source).toContain('matchesNoteQuery(p as NotebookSearchablePage, q)');
  });
});
