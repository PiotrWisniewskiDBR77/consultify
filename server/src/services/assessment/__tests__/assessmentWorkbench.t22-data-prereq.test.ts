/**
 * T22-DATA-PREREQ (2026-08-07) — proves the real `RegisterArtifactOriginParamsSchema`
 * (server/src/types/artifactRegistry.ts) now accepts `originRuntime:
 * 'assessment_report'`, the exact value `AssessmentWorkbenchService.recordPromotion`
 * (../AssessmentWorkbenchService.ts, outputs_artifact branch) has always sent.
 *
 * Deliberately does NOT mock `artifactRegistryService` — the existing
 * `assessmentWorkbench.p28c-regression.test.ts` already proves recordPromotion
 * *calls* registerArtifactOrigin with these exact params, but it mocks
 * `../../v8/artifactRegistryService.js` entirely, so it never exercises the
 * real Zod schema and could not have caught (or can prove the fix for) the
 * enum mismatch. This suite exercises the real schema directly instead.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ArtifactOriginRuntimeValues,
  RegisterArtifactOriginParamsSchema,
} from '../../../types/artifactRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/src/services/assessment/__tests__ -> repo root is 5 levels up.
const repoRoot = join(__dirname, '../../../../../');

// Mirrors the exact call AssessmentWorkbenchService.recordPromotion makes for
// the outputs_artifact branch (AssessmentWorkbenchService.ts:1201-1224) —
// not a fabricated shape.
const recordPromotionCallShape = {
  organizationId: 'org-t22',
  outputType: 'report' as const,
  artifactFamily: 'document' as const,
  originRuntime: 'assessment_report' as const,
  originRecordId: 'asmt-t22',
  titleSnapshot: 'Assessment DRD — asmt-t22',
  ownerUserId: 'user-t22',
  createdBy: 'user-t22',
  deliveryState: 'draft',
  visibilityScope: 'organization' as const,
  originSummary: {
    sourceType: 'ASSESSMENT',
    sourceId: 'asmt-t22',
    nativeStatus: 'completed',
    promotionTraceId: 'trace-t22',
    assessmentDefinitionId: 'def-t22',
    limits: 'l',
  },
};

// Strips `//` line comments before extracting quoted tokens — several of the
// real comments in artifactRegistry.ts legitimately reference OTHER array
// values by name in prose (e.g. "'work_canvas' above was already absent..."),
// which a naive quoted-string regex over the raw text would misread as an
// extra array element.
function extractArrayLiteral(source: string, constName: string): string[] {
  const match = source.match(new RegExp(`${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`));
  if (!match) throw new Error(`${constName} array literal not found`);
  const codeOnly = match[1].replace(/\/\/.*$/gm, '');
  return [...codeOnly.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function extractCheckConstraintValues(sql: string): string[] {
  const match = sql.match(/origin_runtime\s+IN\s*\(([\s\S]*?)\)/);
  if (!match) throw new Error('origin_runtime IN (...) not found');
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('T22-DATA-PREREQ — assessment_report origin runtime', () => {
  it('the real Zod schema accepts the exact recordPromotion outputs_artifact call shape', () => {
    const result = RegisterArtifactOriginParamsSchema.safeParse(recordPromotionCallShape);
    expect(result.success).toBe(true);
  });

  it('rejects the same call shape if originRuntime is reverted to an invalid placeholder (schema is a real gate, not a no-op)', () => {
    const result = RegisterArtifactOriginParamsSchema.safeParse({
      ...recordPromotionCallShape,
      originRuntime: 'assessment_report_TYPO',
    });
    expect(result.success).toBe(false);
  });

  it('ArtifactOriginRuntimeValues (server) includes assessment_report', () => {
    expect(ArtifactOriginRuntimeValues).toContain('assessment_report');
  });

  it('server and client ArtifactOriginRuntimeValues are identical, in the same order', () => {
    const serverSource = readFileSync(
      join(repoRoot, 'server/src/types/artifactRegistry.ts'),
      'utf8'
    );
    const clientSource = readFileSync(join(repoRoot, 'src/services/api/artifactRuns.ts'), 'utf8');
    const serverValues = extractArrayLiteral(serverSource, 'ArtifactOriginRuntimeValues');
    const clientValues = extractArrayLiteral(clientSource, 'ArtifactOriginRuntimeValues');

    expect(serverValues).toEqual([...ArtifactOriginRuntimeValues]);
    expect(clientValues).toEqual(serverValues);
    expect(clientValues).toContain('assessment_report');
  });

  it('the new migration is additive-only and restores full DB/TypeScript runtime parity', () => {
    const migration = readFileSync(
      join(repoRoot, 'server/migrations/20260807_origin_runtime_assessment_report.sql'),
      'utf8'
    );
    const priorValues = [
      'report',
      'presentation',
      'sheet',
      'native_artifact',
      'report_template',
      'presentation_template',
      'sheet_template',
      'document_template',
      'work_canvas',
    ];
    const checkValues = extractCheckConstraintValues(migration);
    expect(checkValues).toEqual([...priorValues, 'assessment_report']);
    expect(checkValues).toEqual([...ArtifactOriginRuntimeValues]);
    expect(migration).not.toMatch(/INSERT INTO|UPDATE |DELETE FROM/i);
  });
});

/*
 * ── Negative control (run manually against the real file, not committed as
 *    an additional in-suite assertion — same convention as
 *    tests/components/assessment/AssessmentHub.menu3BulkRow.t20.test.tsx):
 *
 *   Temporarily removed 'assessment_report' from
 *   server/src/types/artifactRegistry.ts's ArtifactOriginRuntimeValues →
 *   this suite dropped to 2/5 passed, 3 failed ("the real Zod schema
 *   accepts...", "ArtifactOriginRuntimeValues (server) includes...", and
 *   "server and client ArtifactOriginRuntimeValues are identical..." — the
 *   parity test correctly caught the server/client divergence too).
 *   Restored identically (diff against the pre-removal copy was empty) and
 *   re-verified 5/5 green before this report.
 */
