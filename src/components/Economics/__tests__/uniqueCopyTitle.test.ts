/**
 * FIN-005 — the four-duplicate failure mode.
 *
 * Staging showed four rows literally named `DBR77 Staging Finance Model (kopia)`
 * in Finance → Models. Root cause was in the UI, not the database: the
 * duplicate action built its title as `${row.title} (${copySuffix})` from the
 * SAME source row every time, so N clicks produced N identical names, with no
 * constraint anywhere to notice.
 *
 * This test reproduces those four clicks and asserts the names now diverge.
 */

import { describe, expect, it } from 'vitest';

import { uniqueCopyTitle } from '../hooks/useFinanceRowActions';

const SUFFIX_PL = 'kopia';
const SUFFIX_EN = 'copy';

describe('uniqueCopyTitle', () => {
  it('first copy keeps the plain suffix a user expects', () => {
    expect(uniqueCopyTitle('Atelier Toys — Transformation 2015 ROI', SUFFIX_EN, [])).toBe(
      'Atelier Toys — Transformation 2015 ROI (copy)'
    );
  });

  it('reproduces the staging incident: four duplicates of one source row', () => {
    const source = 'DBR77 Staging Finance Model';
    const existing = [source];
    const produced: string[] = [];

    // Four clicks on "Duplikuj", each from the same source row — exactly what
    // the operator did on staging.
    for (let click = 0; click < 4; click += 1) {
      const title = uniqueCopyTitle(source, SUFFIX_PL, existing);
      produced.push(title);
      existing.push(title);
    }

    expect(produced).toEqual([
      'DBR77 Staging Finance Model (kopia)',
      'DBR77 Staging Finance Model (kopia 2)',
      'DBR77 Staging Finance Model (kopia 3)',
      'DBR77 Staging Finance Model (kopia 4)',
    ]);
    // The property that actually matters: no two records share a name.
    expect(new Set(produced).size).toBe(produced.length);
  });

  it('collision matching is case- and whitespace-insensitive', () => {
    expect(uniqueCopyTitle('Model A', SUFFIX_EN, ['  model a (COPY)  '])).toBe('Model A (copy 2)');
  });

  it('ignores empty and nullish names in the existing list', () => {
    expect(uniqueCopyTitle('Model A', SUFFIX_EN, ['', '   ', null as unknown as string])).toBe(
      'Model A (copy)'
    );
  });

  it('trims the source title instead of baking whitespace into the copy', () => {
    expect(uniqueCopyTitle('  Model A  ', SUFFIX_EN, [])).toBe('Model A (copy)');
  });

  it('falls back to a bare counter when there is no suffix translation', () => {
    expect(uniqueCopyTitle('Model A', '', ['Model A'])).toBe('Model A 2');
  });

  it('terminates instead of spinning when the namespace is saturated', () => {
    const source = 'Model A';
    const existing = [`${source} (copy)`];
    for (let counter = 2; counter <= 999; counter += 1) {
      existing.push(`${source} (copy ${counter})`);
    }
    // No infinite loop; it gives up and returns the plain form.
    expect(uniqueCopyTitle(source, SUFFIX_EN, existing)).toBe('Model A (copy)');
  });
});
