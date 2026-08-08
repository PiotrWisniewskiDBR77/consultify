/**
 * Document Studio service unit tests (MVP-1, Mode 1).
 *
 * Tests focus on the pure deterministic surfaces of MVP-1:
 *   - planDocument outline shape
 *   - buildDocumentSchema content shape (via planner + generator integration)
 *   - is_assumption marking when source pack is empty
 *
 * The materialization path that calls wave5ArtifactRuntimeService is covered
 * by the wave5 service's own integration tests; we test the orchestrator's
 * input validation here to keep this suite lightweight and isolated from
 * database fixtures.
 */

import { describe, expect, it } from 'vitest';

import { buildDocumentSchema } from '../documentContentGenerator.js';
import { planDocumentOutline } from '../documentNarrativePlanner.js';
import { renderSchemaToMarkdown } from '../documentSchemaRenderer.js';
import { planDocument } from '../documentStudioService.js';
import type { DocumentIntake } from '../documentStudioTypes.js';

function baseIntake(overrides: Partial<DocumentIntake> = {}): DocumentIntake {
  // Pure executive memo prompt: keep the description free of trigger words
  // ('audit', 'roadmap', 'workshop'…) so the planner's keyword inference
  // resolves unambiguously to executive_memo for tests in this base group.
  return {
    description:
      'Prepare an executive memo for the board summarizing key findings and a recommendation.',
    audience: ['Board', 'CEO'],
    language: 'en',
    goal: 'decide',
    ...overrides,
  };
}

describe('Document Studio Mode 1', () => {
  describe('planDocument', () => {
    it('rejects missing intake description', () => {
      expect(() => planDocument({ intake: { description: '' } as DocumentIntake })).toThrow();
    });

    it('returns a non-empty outline with at least four sections for a memo', () => {
      const result = planDocument({ intake: baseIntake() });
      expect(result.outline).toBeDefined();
      expect(result.outline.sections.length).toBeGreaterThanOrEqual(4);
      expect(result.outline.documentType).toBe('executive_memo');
    });

    it('infers an audit document type when description mentions audit', () => {
      const outline = planDocumentOutline(
        baseIntake({ description: 'Conduct an AI audit of client X readiness.' })
      );
      expect(outline.documentType).toBe('ai_audit_report');
      const titles = outline.sections.map((s) => s.title);
      expect(titles).toContain('Audit Scope');
    });

    it('respects an explicit document type override', () => {
      const outline = planDocumentOutline(baseIntake({ documentType: 'workshop_summary' }));
      expect(outline.documentType).toBe('workshop_summary');
      expect(outline.sections.map((s) => s.title)).toContain('Decisions');
    });
  });

  describe('buildDocumentSchema', () => {
    it('produces a schema with sections matching the outline order', () => {
      const intake = baseIntake();
      const outline = planDocumentOutline(intake);
      const schema = buildDocumentSchema({
        artifactId: 'artifact-test-1',
        intake,
        outline,
        sourceRefs: [],
      });
      expect(schema.sections.length).toBe(outline.sections.length);
      schema.sections.forEach((section, index) => {
        expect(section.title).toBe(outline.sections[index].title);
        expect(section.orderIndex).toBe(index);
      });
    });

    it('marks substantive blocks as assumptions when source pack is empty', () => {
      const intake = baseIntake();
      const outline = planDocumentOutline(intake);
      const schema = buildDocumentSchema({
        artifactId: 'artifact-test-2',
        intake,
        outline,
        sourceRefs: [],
      });
      const findingsLikeSection = schema.sections.find((section) =>
        ['Findings', 'Context', 'Recommendations'].some((title) => section.title.includes(title))
      );
      expect(findingsLikeSection).toBeDefined();
      const hasAssumption = findingsLikeSection?.blocks.some(
        (block) => block.isAssumption === true
      );
      expect(hasAssumption).toBe(true);
    });

    it('attaches source refs to sections when source pack is provided', () => {
      const intake = baseIntake();
      const outline = planDocumentOutline(intake);
      const schema = buildDocumentSchema({
        artifactId: 'artifact-test-3',
        intake,
        outline,
        sourceRefs: [
          { sourceType: 'ToolSession', sourceId: 'tool-1', sourceTitle: 'Discovery session' },
        ],
      });
      const sectionWithRefs = schema.sections.find((section) => section.sourceRefs.length > 0);
      expect(sectionWithRefs).toBeDefined();
    });

    it('creates an actually empty editable paragraph for the manual Czysto entry', () => {
      const intake = baseIntake({
        title: 'Nowy dokument',
        description: 'Pusty dokument roboczy do samodzielnej edycji.',
        documentType: 'generic_document',
        language: 'pl',
      });
      const outline = {
        documentType: 'generic_document',
        title: 'Nowy dokument',
        sections: [
          {
            title: 'Sekcja 1',
            level: 1 as const,
            purpose: '',
            expectedLengthHint: 'short' as const,
          },
        ],
        recommendedDensity: 'concise' as const,
        recommendedRegister: 'professional' as const,
        recommendedLanguageStyle: 'formal' as const,
      };
      const schema = buildDocumentSchema({
        artifactId: 'artifact-blank-manual',
        intake,
        outline,
        sourceRefs: [],
      });

      expect(schema.sections).toHaveLength(1);
      expect(schema.sections[0].blocks).toEqual([
        expect.objectContaining({
          type: 'paragraph',
          content: { text: '' },
          isAssumption: false,
        }),
      ]);
    });
  });

  describe('renderSchemaToMarkdown', () => {
    it('renders a non-empty markdown payload that includes the title and source notice', () => {
      const intake = baseIntake();
      const outline = planDocumentOutline(intake);
      const schema = buildDocumentSchema({
        artifactId: 'artifact-test-4',
        intake,
        outline,
        sourceRefs: [],
      });
      const markdown = renderSchemaToMarkdown(schema);
      expect(markdown).toContain(`# ${schema.title}`);
      expect(markdown).toContain('No sources attached');
    });
  });
});
