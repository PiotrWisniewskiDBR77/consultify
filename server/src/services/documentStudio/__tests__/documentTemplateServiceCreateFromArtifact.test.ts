/**
 * Document Studio — `createTemplateFromArtifact` (WORD clone mode).
 *
 * Brief §1/§10 ("Komplet od razu"): save an existing native-artifact
 * document as a new draft template (clone → edit → save-as-new). Unlike
 * `draftTemplate` (deterministic taxonomy probe, no real content), this
 * function carries over the ACTUAL section structure of the source
 * document's schema.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from '../documentStudioTypes.js';
import {
  __resetTemplateRegistryForTests,
  createTemplateFromArtifact,
  getTemplate,
  listTemplateAuditEntries,
} from '../documentTemplateService.js';

function buildSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Audyt procesów IT',
    documentType: 'ai_audit_report',
    language: 'pl',
    audience: ['CIO', 'CTO'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'dense',
    languageStyle: 'formal',
    confidentiality: 'client_confidential',
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    sections: [
      {
        sectionId: 'sec-1',
        orderIndex: 1,
        level: 1,
        title: 'Wprowadzenie',
        purpose: 'Kontekst i cel audytu',
        blocks: [{ blockId: 'b1', type: 'paragraph', content: 'x' }],
        sourceRefs: [],
      },
      {
        sectionId: 'sec-0',
        orderIndex: 0,
        level: 1,
        title: 'Streszczenie',
        purpose: 'Najważniejsze ustalenia',
        blocks: [
          { blockId: 'b2', type: 'paragraph', content: 'x' },
          { blockId: 'b3', type: 'paragraph', content: 'y' },
          { blockId: 'b4', type: 'paragraph', content: 'z' },
          { blockId: 'b5', type: 'paragraph', content: 'w' },
          { blockId: 'b6', type: 'paragraph', content: 'v' },
          { blockId: 'b7', type: 'paragraph', content: 'u' },
        ],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as DocumentSchema;
}

describe('createTemplateFromArtifact', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('requires organizationId, userId and a schema', () => {
    expect(() =>
      createTemplateFromArtifact({ organizationId: '', userId: 'u1', schema: buildSchema() })
    ).toThrow('organizationId is required');
    expect(() =>
      createTemplateFromArtifact({ organizationId: 'org-A', userId: '', schema: buildSchema() })
    ).toThrow('userId is required');
    expect(() =>
      createTemplateFromArtifact({
        organizationId: 'org-A',
        userId: 'u1',
        schema: null as unknown as DocumentSchema,
      })
    ).toThrow('source document schema is required');
  });

  it('carries the source sections into sectionBlueprint, sorted by orderIndex', () => {
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema: buildSchema(),
    });

    expect(template.sectionBlueprint).toHaveLength(2);
    // orderIndex 0 ("Streszczenie") sorts before orderIndex 1 ("Wprowadzenie"),
    // even though the source array lists them in the opposite order.
    expect(template.sectionBlueprint[0]?.title).toBe('Streszczenie');
    expect(template.sectionBlueprint[1]?.title).toBe('Wprowadzenie');
    expect(template.sectionBlueprint.every((s) => s.required)).toBe(true);
    // 6 blocks -> 'long', 1 block -> 'short' (coarse block-count heuristic).
    expect(template.sectionBlueprint[0]?.expectedLengthHint).toBe('long');
    expect(template.sectionBlueprint[1]?.expectedLengthHint).toBe('short');
  });

  it('falls back to the section title when purpose is missing', () => {
    const schema = buildSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 2,
          title: 'Załączniki',
          blocks: [],
          sourceRefs: [],
        },
      ],
    });
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema,
    });
    expect(template.sectionBlueprint[0]).toMatchObject({
      title: 'Załączniki',
      purpose: 'Załączniki',
      level: 2,
      expectedLengthHint: 'short',
    });
  });

  it('falls back to a deterministic taxonomy blueprint when the source has zero sections', () => {
    const schema = buildSchema({ sections: [] });
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema,
    });
    expect(template.sectionBlueprint.length).toBeGreaterThan(0);
  });

  it('copies category/documentType/language/audience/formattingSchema from the source schema', () => {
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema: buildSchema(),
    });
    expect(template.documentType).toBe('ai_audit_report');
    expect(template.category).toBe('audit');
    expect(template.language).toBe('pl');
    expect(template.audience).toEqual(['CIO', 'CTO']);
    expect(template.confidentiality).toBe('client_confidential');
    expect(template.formattingSchema).toEqual(DEFAULT_CONSULTING_FORMATTING_SCHEMA);
  });

  it('defaults the name to "<source title> (Copy)" and records provenance in notes', () => {
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema: buildSchema(),
    });
    expect(template.name).toBe('Audyt procesów IT (Copy)');
    expect(template.notes).toContain('artifact-1');
  });

  it('honors an explicit name and notes override', () => {
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema: buildSchema(),
      name: 'My custom template',
      notes: 'hand-picked notes',
    });
    expect(template.name).toBe('My custom template');
    expect(template.notes).toBe('hand-picked notes');
  });

  it('is a draft, versioned 0.1, and lands in the registry with an audit entry', () => {
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema: buildSchema(),
    });
    expect(template.status).toBe('draft');
    expect(template.version).toBe('0.1');

    const fetched = getTemplate(template.templateId, 'org-A');
    expect(fetched?.templateId).toBe(template.templateId);

    const audit = listTemplateAuditEntries(template.templateId, 'org-A');
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe('template_drafted');
    expect(audit[0]?.actorId).toBe('user-1');
    expect(audit[0]?.details).toMatchObject({ clonedFromArtifactId: 'artifact-1' });
  });

  it('is tenant-isolated: not visible under a different organizationId', () => {
    const { template } = createTemplateFromArtifact({
      organizationId: 'org-A',
      userId: 'user-1',
      schema: buildSchema(),
    });
    expect(getTemplate(template.templateId, 'org-B')).toBeNull();
  });
});
