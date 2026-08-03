/**
 * P0 URODZINOWE (2026-07-27) — end-to-end proof that auto org-context
 * grounding actually moves the Sources QA score, not just that a field
 * "flew through" unread.
 *
 * Wires the real production pieces together (minus the DB-backed
 * `materializeDocumentArtifact` persistence step, which needs a live wave5
 * artifact store — the grounding decision itself happens entirely upstream
 * of persistence):
 *
 *   buildOrgContextSourcePack (DB reads mocked)
 *     -> applyOrgContextGrounding (pure merge — production code)
 *     -> buildDocumentSchema (deterministic content generator — production code)
 *     -> runDocumentQa (production QA engine)
 *
 * This is the same sequence `document-studio.routes.ts`'s
 * `autoGroundGenerateRequest` + `materializeDocumentArtifact` run in
 * production; only the DB-backed persistence tail is out of scope here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();
const buildOrganizationContextMock = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
}));

vi.mock('../../aiContextBuilder.js', () => ({
  default: {
    _buildOrganizationContext: (...args: unknown[]) => buildOrganizationContextMock(...args),
  },
}));

import { buildDocumentSchema } from '../documentContentGenerator.js';
import { planDocumentOutline } from '../documentNarrativePlanner.js';
import {
  applyOrgContextGrounding,
  buildOrgContextSourcePack,
} from '../documentOrgContextSourcePack.js';
import { runDocumentQa } from '../documentQaService.js';
import type { DocumentIntake } from '../documentStudioTypes.js';

function makeIntake(): DocumentIntake {
  return {
    title: 'Raport dla Zarządu — Strategia AI',
    description:
      'Przygotuj executive memo podsumowujące strategię AI dla zarządu: cele, ryzyka, rekomendacje, decyzje wymagane, kolejne kroki.',
    documentType: 'executive_memo',
    language: 'pl',
    density: 'standard',
    goal: 'decide',
    audience: ['Zarząd'],
  } as DocumentIntake;
}

describe('P0 proof: auto org-context grounding raises the Sources QA score', () => {
  beforeEach(() => {
    dbAllMock.mockReset();
    buildOrganizationContextMock.mockReset();
  });

  it('scores Sources at 0 (blocking) today, with zero sourceRefs — reproduces the reported incident', () => {
    const intake = makeIntake();
    const outline = planDocumentOutline(intake);
    // Byte-identical to what document-studio.routes.ts sends today: the
    // frontend never populates sourceRefs (DocumentStudioIntakeForm.tsx has
    // no field for it), so this is the pre-fix production behaviour.
    const schemaBefore = buildDocumentSchema({
      artifactId: 'artifact-before',
      intake,
      outline,
      sourceRefs: [],
    });

    const reportBefore = runDocumentQa(schemaBefore);
    const sourcesBefore = reportBefore.categories.find((c) => c.category === 'sources');
    if (!sourcesBefore) throw new Error('expected sources category');

    expect(sourcesBefore.score).toBe(0);
    expect(sourcesBefore.blocking).toBe(true);
    expect(sourcesBefore.findings.some((f) => f.code === 'document_no_sources')).toBe(true);
  });

  it('raises the Sources score from 0 to 100 once auto-grounding attaches the org-context pack', async () => {
    // Organization has real, live data — the common case this fix targets.
    buildOrganizationContextMock.mockResolvedValue({
      organizationName: 'DBR77',
      industry: 'Consulting',
    });
    dbAllMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects')) {
        return Promise.resolve([{ name: 'Transformacja AI 2026' }]);
      }
      if (sql.includes('FROM initiatives')) {
        return Promise.resolve([{ name: 'Automatyzacja raportowania zarządu' }]);
      }
      return Promise.resolve([]);
    });

    const intake = makeIntake();
    const outline = planDocumentOutline(intake);

    // This is exactly what autoGroundGenerateRequest() does in
    // document-studio.routes.ts before calling materializeDocumentArtifact.
    const pack = await buildOrgContextSourcePack('org-dbr77');
    const grounded = applyOrgContextGrounding(intake, [], pack);
    expect(grounded.autoGrounded).toBe(true);

    const schemaAfter = buildDocumentSchema({
      artifactId: 'artifact-after',
      intake: grounded.intake,
      outline,
      sourceRefs: grounded.sourceRefs,
    });

    // The grounding fact must be real, not decorative: it has to show up in
    // the actual generated content (deterministic path reads
    // intake.description straight into the executive-summary block).
    const executiveSummarySection = schemaAfter.sections.find((s) =>
      s.title.toLowerCase().includes('executive summary')
    );
    expect(executiveSummarySection).toBeDefined();
    const executiveSummaryText = JSON.stringify(executiveSummarySection?.blocks ?? []);
    expect(executiveSummaryText).toContain('DBR77');
    expect(executiveSummaryText).toContain('Transformacja AI 2026');

    // Every section now carries the auto-built sourceRef -> isAssumption
    // clears -> the Sources QA gate stops firing.
    expect(schemaAfter.sourceRefs).toHaveLength(1);
    expect(schemaAfter.sections.every((s) => s.sourceRefs.length > 0)).toBe(true);

    const reportAfter = runDocumentQa(schemaAfter);
    const sourcesAfter = reportAfter.categories.find((c) => c.category === 'sources');
    if (!sourcesAfter) throw new Error('expected sources category');

    expect(sourcesAfter.findings).toEqual([]);
    expect(sourcesAfter.score).toBe(100);
    expect(sourcesAfter.blocking).toBe(false);
  });

  it('does NOT regress a brand-new organization with zero data: still 0 sourceRefs, same pre-fix QA result', async () => {
    buildOrganizationContextMock.mockResolvedValue({ organizationName: 'Unknown', industry: null });
    dbAllMock.mockResolvedValue([]);

    const intake = makeIntake();
    const outline = planDocumentOutline(intake);

    const pack = await buildOrgContextSourcePack('org-brand-new');
    expect(pack).toBeNull();

    const grounded = applyOrgContextGrounding(intake, [], pack);
    expect(grounded.autoGrounded).toBe(false);
    expect(grounded.sourceRefs).toEqual([]);
    expect(grounded.intake).toBe(intake);

    const schema = buildDocumentSchema({
      artifactId: 'artifact-empty-org',
      intake: grounded.intake,
      outline,
      sourceRefs: grounded.sourceRefs,
    });
    const report = runDocumentQa(schema);
    const sources = report.categories.find((c) => c.category === 'sources');
    if (!sources) throw new Error('expected sources category');

    // Same as the "before" case — no crash, no fabricated grounding, just
    // the pre-existing (already-known) empty-org behaviour.
    expect(sources.score).toBe(0);
    expect(sources.blocking).toBe(true);
  });
});
