/**
 * Day 14 S.2 — `ListRoiCasesQuerySchema.q` (DEC-77 dozbrojenie, Z17
 * extension).
 *
 * Context: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY14_BACKEND_INSTRUKCJA.md`
 * §S.2 landed the identical `q` field on `ListKpisQuerySchema`
 * (resultsVnextKpi.validators.ts) and `ListOkrSetsQuerySchema`
 * (resultsVnextOkr.validators.ts) in commit `d176e7ec4b` — this file's own
 * `RESULTS_EXECUTION_DAY14_REPORT_20260826.md` records the ROI leg as an
 * explicit STOP ("S.2 ROI validator poza Z17": `resultsVnextRoi.validators.ts`
 * was not in that day's WOLNO frame, "Czego brakuje: jawne rozszerzenie
 * Z17"). DEC-77 grants exactly that extension, scoped to the `q` field —
 * this file is the validator-layer half of closing it out.
 *
 * SCOPE NOTE (read before extending this file): this task's license covers
 * `resultsVnextRoi.validators.ts` only. `roi.routes.ts`'s `listRoiCases`
 * handler and `roiRepository.ts`'s `listRoiCases()` do NOT yet read/apply
 * `q` — that SQL-level wiring (§S.2 requirement #3: "filter runs at SQL
 * level, inside the visibility CTE, before LIMIT", reusing
 * `resultsTextMatchPattern`/`resultsTextMatchSql` from `textMatch.ts` the
 * exact way `kpiRepository.ts`'s `listKpis()` and
 * `okrSetRepository.ts`'s `listOkrSets()` already do) is a separately
 * licensed follow-up. What THIS file proves, at the boundary that IS
 * licensed:
 *   1. the schema accepts/normalizes `q` the same way the KPI/OKR schemas
 *      already do (byte-identical shape — same `.trim().min(2).max(200)`);
 *   2. omitting `q` parses to the exact same shape as before this change
 *      (§S.2 requirement #1 — DEC-65 backward compatibility, "no q =
 *      identical behavior, down to row and order");
 *   3. the schema can never become a tenant-scoping side channel — Zod's
 *      default `.object()` strips any unrecognized key, so a client
 *      cannot smuggle `organizationId`/`userId` through this query string
 *      no matter what future repository wiring reads from it (the "negative
 *      tenant" contract this task asked for, applied at the one layer this
 *      license actually reaches);
 *   4. the escaping contract `q` will eventually feed into
 *      (`resultsTextMatchPattern`, already shipped in S.1 and reused
 *      unmodified by KPI/OKR's own `q`) round-trips correctly for every
 *      ILIKE metacharacter, so wiring `q` into `listRoiCases()` later is a
 *      pure plumbing change with no new escaping logic to get wrong.
 */
import { describe, expect, it } from 'vitest';

import { resultsTextMatchPattern } from '../../services/resultsVnext/platform/textMatch.js';
import { ListRoiCasesQuerySchema } from '../resultsVnextRoi.validators.js';

describe('Day 14 S.2 — ListRoiCasesQuerySchema.q (real Postgres-free, DEC-77 dozbrojenie)', () => {
  it('parses a well-formed q and trims surrounding whitespace', () => {
    const result = ListRoiCasesQuerySchema.parse({ q: '  cost overrun  ' });
    expect(result.q).toBe('cost overrun');
  });

  it('omitting q parses to the exact same shape as before this field existed (DEC-65 backward compatibility)', () => {
    const result = ListRoiCasesQuerySchema.parse({ status: 'tracking', limit: '25', offset: '0' });
    expect(result).toEqual({ status: 'tracking', limit: 25, offset: 0 });
    expect('q' in result).toBe(false);
    expect(result.q).toBeUndefined();
  });

  it('rejects a q shorter than 2 characters after trimming (matches ListKpisQuerySchema/ListOkrSetsQuerySchema exactly)', () => {
    expect(() => ListRoiCasesQuerySchema.parse({ q: 'a' })).toThrow();
    // Whitespace-only collapses to length 0 after .trim() — same failure,
    // not a silent pass-through of a 5-character raw string.
    expect(() => ListRoiCasesQuerySchema.parse({ q: '     ' })).toThrow();
  });

  it('rejects a q longer than 200 characters', () => {
    expect(() => ListRoiCasesQuerySchema.parse({ q: 'x'.repeat(201) })).toThrow();
    expect(ListRoiCasesQuerySchema.parse({ q: 'x'.repeat(200) }).q).toHaveLength(200);
  });

  it('q coexists with every pre-existing field without changing their own validation (status/includeArchived/limit/offset untouched)', () => {
    const result = ListRoiCasesQuerySchema.parse({
      q: 'renewal',
      status: 'draft',
      includeArchived: 'true',
      limit: '10',
      offset: '5',
    });
    expect(result).toEqual({
      q: 'renewal',
      status: 'draft',
      includeArchived: true,
      limit: 10,
      offset: 5,
    });
  });

  it('negative tenant: cannot smuggle organizationId/userId through this query — Zod strips unrecognized keys, so the schema itself can never become a tenant-scoping side channel for whatever repository eventually reads q', () => {
    const result = ListRoiCasesQuerySchema.parse({
      q: 'test',
      organizationId: 'org-attacker-supplied',
      userId: 'user-attacker-supplied',
    }) as Record<string, unknown>;

    expect(Object.keys(result).sort()).toEqual(['q']);
    expect(result.organizationId).toBeUndefined();
    expect(result.userId).toBeUndefined();
  });

  it('escaping special characters: the q value this schema hands downstream round-trips correctly through resultsTextMatchPattern — the exact shared function §S.2 requires ROI to reuse from S.1, never a second escaping implementation', () => {
    const parsed = ListRoiCasesQuerySchema.parse({ q: ' 50%_\\ discount ' });
    expect(parsed.q).toBe('50%_\\ discount');
    // Same contract textMatch.test.ts already proves for S.1/KPI/OKR:
    // literal %, _, \ are escaped before the wildcard % wrapping, so a
    // case's title containing a literal percent sign is matched literally,
    // never interpreted as an ILIKE wildcard.
    expect(resultsTextMatchPattern(parsed.q)).toBe('%50\\%\\_\\\\ discount%');
  });

  it('a single-character q (below the search-screen 1-char passthrough §S.1 allows) is correctly rejected here — §S.2 is a stricter, separate contract from §S.1, not an alias for it', () => {
    // §S.1's own contract note: "Fraza 1-znakowa daje 200 + [] bez DB" — a
    // deliberate short-circuit unique to the cross-registry search
    // endpoint. §S.2's per-registry `q` has no such carve-out; min(2) is
    // enforced the same way for KPI/OKR/ROI alike.
    expect(() => ListRoiCasesQuerySchema.parse({ q: 'x' })).toThrow();
  });
});
