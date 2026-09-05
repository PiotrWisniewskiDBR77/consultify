/**
 * MVP audit 05/06.09.2026 (evidence/audyt-mvp-20260906/B2/RAPORT_B2.md,
 * WAŻNY #10 / defekt 4): the "ZAKTUALIZOWANO" column header in the Audits
 * library table (`/audit-programs`, Biblioteka tab) was truncated to
 * "ZAKTU" at the canonical 1440px width — confirmed live (not just in code)
 * with a real logged-in Chromium screenshot via
 * scripts/dev/odbior-zywo/zrzut.mjs against the local stanowisko
 * (evidence/mvp-naprawy-noc-3/12-audits-przed.png vs …-po.png).
 *
 * Root cause: `updatedAt`'s declared column `width: '140px'` was too narrow
 * for the 14-character Polish label "ZAKTUALIZOWANO" plus its sort-icon
 * budget once FilterableTable's proportional column-fit shrinks the table
 * to fit 8 data columns + actions into ~1287px of real content width.
 * Fixed inside AuditLibraryTab.tsx's OWN column definitions (widened
 * updatedAt to 200px, freed room by trimming source/sourceType/
 * verificationStatus/publicationStatus and tagging status/date/number
 * `dataType`s) — NOT in FilterableTable.tsx, which is fala 1's territory.
 *
 * This is a source-level regression guard (FilterableTable's canvas-based
 * header measurement can't run under jsdom, so a component-render test
 * can't reproduce the truncation) — the real proof-of-fix is the live
 * screenshot pair above. This test pins down the two things that must not
 * regress silently: the widened `updatedAt` column, and the `dataType`
 * hints that let the fit algorithm shrink the right columns instead.
 *
 * Mutation check: reverting `updatedAt`'s width back to '140px' makes this
 * test fail.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.join(
    process.cwd(),
    'src/components/Audit/method/tabs/AuditLibraryTab.tsx'
  ),
  'utf8'
);

function columnBlock(id: string): string {
  const marker = `id: '${id}',`;
  const start = SOURCE.indexOf(marker);
  expect(start, `column "${id}" not found in AuditLibraryTab.tsx`).toBeGreaterThan(-1);
  return SOURCE.slice(start, start + 400);
}

describe('AuditLibraryTab — "ZAKTUALIZOWANO" column has enough room at 1440px', () => {
  it('declares updatedAt with a width comfortably wider than the truncating 140px', () => {
    const block = columnBlock('updatedAt');
    const match = block.match(/width:\s*'(\d+)px'/);
    expect(match, `no width found in: ${block}`).not.toBeNull();
    const width = Number(match![1]);
    // 140px is the exact value that reproduced "ZAKTU" live; require a real margin.
    expect(width).toBeGreaterThanOrEqual(180);
  });

  it('tags updatedAt as dataType "date" (lets the fit algorithm shrink other columns first)', () => {
    const block = columnBlock('updatedAt');
    expect(block).toMatch(/dataType:\s*'date'/);
  });

  it('tags the status-chip columns as dataType "status" (they need less room than plain text)', () => {
    for (const id of ['sourceType', 'verificationStatus', 'publicationStatus']) {
      const block = columnBlock(id);
      expect(block, `column "${id}"`).toMatch(/dataType:\s*'status'/);
    }
  });
});
