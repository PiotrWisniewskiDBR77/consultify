/**
 * Document Studio — DocumentSchema artifact refs tests
 * (Slice E15.artifact).
 *
 * Verifies the four backwards-compatible optional fields added in
 * slice E15.artifact to close the §15.1 gap from
 * CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md (spec
 * §8.1 DocumentArtifact contract):
 *   - `templateRef?: DocumentTemplateRef`
 *   - `sourcePackId?: string`
 *   - `clientId?: string`
 *   - `owner?: string`
 *
 * Also covers the two new public helpers exported from
 * `documentStudioTypes.ts`:
 *   - `documentSchemaHasTemplateBinding(schema)`;
 *   - `summarizeDocumentSchemaArtifactRefs(schema)`.
 *
 * Backwards-compat contract: every legacy schema (without these
 * fields) MUST keep working unchanged. Materialize, hydration,
 * persistence, the QA pipeline, and the rendering pipeline all
 * spread the schema with `...schema, ...overrides`, so optional
 * fields ride along automatically without any code changes in
 * the consumers in this slice.
 */

import { describe, expect, it } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';
import {
  documentSchemaHasTemplateBinding,
  summarizeDocumentSchemaArtifactRefs,
} from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-refs-1',
    artifactId: 'artifact-refs-1',
    title: 'Refs test',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections: [],
    sourceRefs: [],
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('DocumentSchema — backwards-compatible legacy shape (Slice E15.artifact)', () => {
  it('legacy schema leaves all 4 new fields undefined', () => {
    const s = makeSchema();
    expect(s.templateRef).toBeUndefined();
    expect(s.sourcePackId).toBeUndefined();
    expect(s.clientId).toBeUndefined();
    expect(s.owner).toBeUndefined();
  });

  it('spreading a legacy schema preserves the legacy shape', () => {
    const original = makeSchema();
    const next: DocumentSchema = { ...original, title: 'Updated Title' };
    expect(next.title).toBe('Updated Title');
    expect(next.templateRef).toBeUndefined();
    expect(next.sourcePackId).toBeUndefined();
    expect(next.clientId).toBeUndefined();
    expect(next.owner).toBeUndefined();
  });
});

describe('DocumentSchema — new spec §8.1 ref fields (Slice E15.artifact)', () => {
  it('accepts templateRef independently', () => {
    const s = makeSchema({
      templateRef: { templateId: 'doc-template-system-en-executive_memo', templateVersion: '1.0' },
    });
    expect(s.templateRef?.templateId).toBe('doc-template-system-en-executive_memo');
    expect(s.templateRef?.templateVersion).toBe('1.0');
    expect(s.sourcePackId).toBeUndefined();
  });

  it('accepts sourcePackId independently', () => {
    const s = makeSchema({ sourcePackId: 'sp-discovery-2024' });
    expect(s.sourcePackId).toBe('sp-discovery-2024');
    expect(s.templateRef).toBeUndefined();
  });

  it('accepts clientId independently', () => {
    const s = makeSchema({ clientId: 'client-acme-007' });
    expect(s.clientId).toBe('client-acme-007');
  });

  it('accepts owner independently', () => {
    const s = makeSchema({ owner: 'user-piotr' });
    expect(s.owner).toBe('user-piotr');
  });

  it('all four ref fields can coexist', () => {
    const s = makeSchema({
      templateRef: { templateId: 't-1', templateVersion: '1.0' },
      sourcePackId: 'sp-1',
      clientId: 'client-1',
      owner: 'user-1',
    });
    expect(s.templateRef?.templateId).toBe('t-1');
    expect(s.sourcePackId).toBe('sp-1');
    expect(s.clientId).toBe('client-1');
    expect(s.owner).toBe('user-1');
  });
});

describe('documentSchemaHasTemplateBinding (Slice E15.artifact)', () => {
  it('returns false for null / undefined schema', () => {
    expect(documentSchemaHasTemplateBinding(null)).toBe(false);
    expect(documentSchemaHasTemplateBinding(undefined)).toBe(false);
  });

  it('returns false for legacy schema (no templateRef)', () => {
    expect(documentSchemaHasTemplateBinding(makeSchema())).toBe(false);
  });

  it('returns true when both templateId and templateVersion are non-empty', () => {
    const s = makeSchema({
      templateRef: { templateId: 't-1', templateVersion: '1.0' },
    });
    expect(documentSchemaHasTemplateBinding(s)).toBe(true);
  });

  it('returns false when templateId is whitespace-only', () => {
    const s = makeSchema({
      templateRef: { templateId: '   ', templateVersion: '1.0' },
    });
    expect(documentSchemaHasTemplateBinding(s)).toBe(false);
  });

  it('returns false when templateVersion is whitespace-only', () => {
    const s = makeSchema({
      templateRef: { templateId: 't-1', templateVersion: '\t\n' },
    });
    expect(documentSchemaHasTemplateBinding(s)).toBe(false);
  });

  it('returns false when templateId is empty string', () => {
    const s = makeSchema({
      templateRef: { templateId: '', templateVersion: '1.0' },
    });
    expect(documentSchemaHasTemplateBinding(s)).toBe(false);
  });
});

describe('summarizeDocumentSchemaArtifactRefs (Slice E15.artifact)', () => {
  it('returns all-null summary for null / undefined schema', () => {
    expect(summarizeDocumentSchemaArtifactRefs(null)).toEqual({
      templateId: null,
      templateVersion: null,
      sourcePackId: null,
      clientId: null,
      owner: null,
    });
    expect(summarizeDocumentSchemaArtifactRefs(undefined)).toEqual({
      templateId: null,
      templateVersion: null,
      sourcePackId: null,
      clientId: null,
      owner: null,
    });
  });

  it('returns all-null summary for legacy schema', () => {
    expect(summarizeDocumentSchemaArtifactRefs(makeSchema())).toEqual({
      templateId: null,
      templateVersion: null,
      sourcePackId: null,
      clientId: null,
      owner: null,
    });
  });

  it('returns trimmed values for fully-populated schema', () => {
    const s = makeSchema({
      templateRef: { templateId: '  t-1  ', templateVersion: '  1.0  ' },
      sourcePackId: '  sp-1  ',
      clientId: '  client-1  ',
      owner: '  user-1  ',
    });
    expect(summarizeDocumentSchemaArtifactRefs(s)).toEqual({
      templateId: 't-1',
      templateVersion: '1.0',
      sourcePackId: 'sp-1',
      clientId: 'client-1',
      owner: 'user-1',
    });
  });

  it('whitespace-only ref fields collapse to null', () => {
    const s = makeSchema({
      templateRef: { templateId: '  ', templateVersion: '\t' },
      sourcePackId: '   ',
      clientId: '\n\n',
      owner: '\t  \n',
    });
    expect(summarizeDocumentSchemaArtifactRefs(s)).toEqual({
      templateId: null,
      templateVersion: null,
      sourcePackId: null,
      clientId: null,
      owner: null,
    });
  });

  it('partial population produces partial summary (other fields null)', () => {
    const s = makeSchema({
      sourcePackId: 'sp-1',
      owner: 'user-1',
    });
    expect(summarizeDocumentSchemaArtifactRefs(s)).toEqual({
      templateId: null,
      templateVersion: null,
      sourcePackId: 'sp-1',
      clientId: null,
      owner: 'user-1',
    });
  });

  it('does not mutate the input schema', () => {
    const s = makeSchema({
      templateRef: { templateId: 't-1', templateVersion: '1.0' },
      sourcePackId: 'sp-1',
    });
    const before = JSON.stringify(s);
    summarizeDocumentSchemaArtifactRefs(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});
