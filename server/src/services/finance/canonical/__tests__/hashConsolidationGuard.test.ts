/**
 * W3-hashconsol — strażnik konsolidacji `content_semantic_hash`.
 *
 * `canonicalPayloadHash()` in `../contentHash.ts` is documented there as "the
 * ONE `content_semantic_hash` primitive" (W10-D01). Before this test existed,
 * FOUR compute engines (`baselineComputeService.ts`, `kpiComputeService.ts`,
 * `valuationComputeService.ts`, `predictionComputeService.ts` — two sites)
 * each re-implemented the identical `createHash('sha256').update(JSON.stringify(x)).digest('hex')`
 * expression inline instead of importing the primitive. Today the algorithm
 * is byte-identical, so there is no live divergence — but any FUTURE change
 * to `canonicalPayloadHash()` (e.g. adding stable key-sorting) would silently
 * miss every engine that still inlines its own copy, and the two would drift
 * apart with no test able to catch it. See
 * `docs/validation/finance-v3/generated/gate-d/W3_HASH_CONSOLIDATION_report.md`
 * for the full inventory and the negative-control proof that this guard can
 * actually fail.
 *
 * WHAT THIS DOES NOT DO. It does not forbid `createHash('sha256')`
 * everywhere in `server/src/services/finance` — several sites legitimately
 * hash a DIFFERENT kind of payload for a DIFFERENT role (idempotency key,
 * input fingerprint, AI evidence digest, test-only cold-reopen verification
 * digest) and are correctly allowlisted below, each with the reason it is
 * NOT a `content_semantic_hash` role. Consolidating those into
 * `canonicalPayloadHash()` too would be a mistake — same primitive, wrong
 * semantic claim ("this IS the artifact's content hash") for a value that
 * isn't one.
 *
 * HOW THIS CATCHES A REGRESSION. Every `createHash('sha256')` occurrence
 * under `server/src/services/finance` (excluding `*.test.ts`/`*.pg.test.ts`
 * files, which may legitimately reference the raw primitive while testing
 * it) is counted per file and compared against the allowlist below. A count
 * ABOVE the allowlisted number — a brand new file, or one more inline call
 * in an already-allowlisted file — fails the test. A brand new
 * `content_semantic_hash` computed by some future 5th engine, written the
 * old inline way instead of calling `canonicalPayloadHash()`, is exactly
 * this shape of regression and is caught the same way.
 *
 * Regenerating this allowlist is a DECISION, not a formality: every entry
 * must be re-justified with a role, the same way the table in the W3 report
 * is. Do not bump a count just to make the test pass.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FINANCE_ROOT = path.resolve(__dirname, '../..');

/**
 * `[relative path from server/src/services/finance, expected occurrence
 * count, role]`. The role documents WHY this is intentionally NOT calling
 * `canonicalPayloadHash()` — see the file-by-file table in
 * `W3_HASH_CONSOLIDATION_report.md` for the full reasoning per site.
 */
const ALLOWLIST: Array<{ file: string; count: number; role: string }> = [
  {
    file: 'canonical/contentHash.ts',
    count: 3,
    role:
      'the primitive itself — canonicalPayloadHash() (1 real call; the other 2 matches are ' +
      "this file's own doc comments quoting the phrase `createHash('sha256')` in prose, not code)",
  },
  {
    file: 'canonical/baselineComputeService.ts',
    count: 1,
    role:
      'inputRevisionHash — compute_jobs idempotency key derived from ' +
      '{businessVersionId, entityId, forecastPeriodIds}, not a content_semantic_hash',
  },
  {
    file: 'canonical/kpiComputeService.ts',
    count: 1,
    role:
      'inputRevisionHash — compute_jobs idempotency key derived from ' +
      '{businessVersionId, sourceVersionId, kpiValueIdsSorted}, not a content_semantic_hash',
  },
  {
    file: 'canonical/valuationComputeService.ts',
    count: 1,
    role:
      'inputRevisionHash — compute_jobs idempotency key derived from ' +
      '{valuationBusinessVersionId, entityId, projectionYears, terminal}, not a content_semantic_hash',
  },
  {
    file: 'canonical/predictionComputeService.ts',
    count: 1,
    role:
      'inputRevisionHash — compute_jobs idempotency key derived from ' +
      '{businessVersionId, entityId, forecastPeriodIds}, not a content_semantic_hash ' +
      '(the OTHER inline sha256 in this file — the two contentSemanticHash sites — is ' +
      'already consolidated to canonicalPayloadHash())',
  },
  {
    file: 'canonical/predictionPreflightService.ts',
    count: 1,
    role:
      'assumptionSetSemanticHash — writes finance_prediction_preflight_runs.' +
      'assumption_set_semantic_hash (a DIFFERENT column from content_semantic_hash), a ' +
      'fingerprint of the assumption set used to detect a superseded preflight run, not the ' +
      "artifact's content hash. Hashes tuples (arrays), not objects, so it has no key-order risk.",
  },
  {
    file: 'canonical/valuationAdvisorService.ts',
    count: 1,
    role:
      'evidenceDigest — writes finance_valuation_advisor_outputs.ai_evidence_digest, a ' +
      "tamper-evidence fingerprint of one AI finding's own fields, prefixed 'sha256:'. " +
      'Different column, different format, not a content_semantic_hash.',
  },
  {
    file: 'financeCandidateHandoffCore.ts',
    count: 1,
    role:
      'computeSourceFingerprint — documented in its own doc comment as "NOT a ' +
      'content_semantic_hash", truncated to 16 hex chars, a lineage/idempotency-integrity ' +
      'identifier for Phase-2 handoff, not the artifact content hash.',
  },
  {
    file: 'canonical/__tests__/coldReopenReader.ts',
    count: 1,
    role:
      'digest() — a TEST-ONLY cold-reopen verification digest (W10 FC-05.8/FC-07.9/FC-12.4) ' +
      'over its own canonicalize() (which DOES sort keys, deliberately, for a completely ' +
      'different reason: comparing two `pg` result sets that may differ in column order). ' +
      'Verifies "did a cold reopen return byte-identical state", not a persisted ' +
      'content_semantic_hash.',
  },
];

/** Recursively list every `.ts` file under `dir`, skipping `.test.ts`/`.pg.test.ts` files. */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function countInlineSha256(source: string): number {
  const matches = source.match(/createHash\(\s*['"]sha256['"]\s*\)/g);
  return matches ? matches.length : 0;
}

describe('hash consolidation guard (W3) — createHash(\'sha256\') under server/src/services/finance', () => {
  it('every inline createHash(\'sha256\') site is an allowlisted, non-content-hash role', () => {
    const files = listSourceFiles(FINANCE_ROOT);
    const actual = new Map<string, number>();
    for (const abs of files) {
      const rel = path.relative(FINANCE_ROOT, abs).split(path.sep).join('/');
      const n = countInlineSha256(fs.readFileSync(abs, 'utf8'));
      if (n > 0) actual.set(rel, n);
    }

    const allowed = new Map(ALLOWLIST.map((e) => [e.file, e.count]));

    // 1. Nothing exceeds its allowlisted count — this is the actual regression guard:
    //    a NEW inline createHash('sha256') (new file, or one more occurrence in an
    //    already-allowlisted file — e.g. a 5th engine's contentSemanticHash written the
    //    old inline way instead of calling canonicalPayloadHash()) fails here.
    const overages: string[] = [];
    for (const [file, count] of actual) {
      const cap = allowed.get(file) ?? 0;
      if (count > cap) {
        overages.push(`${file}: found ${count}, allowlisted ${cap} — new inline sha256 call, use canonicalPayloadHash() if this is a content_semantic_hash, or add a justified allowlist entry if it is a genuinely different role (idempotency key / input fingerprint / evidence digest)`);
      }
    }
    expect(overages, overages.join('\n')).toEqual([]);

    // 2. Nothing appears that isn't in the allowlist at all (same check, phrased the
    //    other way round, so an unrecognised file shows up explicitly rather than as
    //    "found 1, allowlisted 0" noise).
    const unknownFiles = [...actual.keys()].filter((f) => !allowed.has(f));
    expect(unknownFiles, `New file(s) with inline createHash('sha256') not yet triaged: ${unknownFiles.join(', ')}`).toEqual([]);
  });

  it('the four consolidated content-hash sites (W3) really do import canonicalPayloadHash', () => {
    const consolidated = [
      'canonical/baselineComputeService.ts',
      'canonical/kpiComputeService.ts',
      'canonical/valuationComputeService.ts',
      'canonical/predictionComputeService.ts',
      // pre-existing from W10-D01, re-asserted here so a future edit can't quietly drop the import
      'canonical/statementReconciliationService.ts',
      'collaboration/autosaveService.ts',
      'canonical/financeImportService.ts',
    ];
    const missing: string[] = [];
    for (const rel of consolidated) {
      const abs = path.join(FINANCE_ROOT, rel);
      const src = fs.readFileSync(abs, 'utf8');
      if (!/canonicalPayloadHash/.test(src) || !/from ['"].*contentHash(\.js)?['"]/.test(src)) {
        missing.push(rel);
      }
    }
    expect(missing, `File(s) that should import canonicalPayloadHash from contentHash.ts but don't: ${missing.join(', ')}`).toEqual([]);
  });
});
