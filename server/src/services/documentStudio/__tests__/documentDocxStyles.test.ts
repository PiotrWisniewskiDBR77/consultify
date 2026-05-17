/**
 * Document Studio — DOCX styles resolver tests (Epic E8, Slice 8.1).
 *
 * The resolver decides:
 *   - which formatting class drives Word styling for a schema, and
 *   - which font family wins when the schema's `formattingSchema.fonts`
 *     stores Word's "Aptos 11" "family + size" hint string.
 *
 * Both decisions are stable contracts the renderer (and downstream tests
 * that unzip the produced .docx) lean on, so we cover them here even
 * though the tests look small.
 */

import { describe, expect, it } from 'vitest';

import {
  buildDocxStyleConfig,
  describeFormattingDecision,
  DOCX_STYLE_IDS,
  resolveDocxFonts,
  resolveFormattingClass,
} from '../documentDocxStyles.js';
import type { DocumentSchema, FormattingSchema } from '../documentStudioTypes.js';

function makeFormattingSchema(overrides: Partial<FormattingSchema> = {}): FormattingSchema {
  return {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
    ...overrides,
  };
}

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Test',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: makeFormattingSchema(),
    sections: [],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveFormattingClass', () => {
  it('maps executive register to the executive formatting class', () => {
    const schema = makeSchema({ communicationRegister: 'executive' });
    expect(resolveFormattingClass(schema)).toBe('executive');
  });

  it('maps professional and technical registers both to professional class', () => {
    expect(resolveFormattingClass(makeSchema({ communicationRegister: 'professional' }))).toBe(
      'professional'
    );
    expect(resolveFormattingClass(makeSchema({ communicationRegister: 'technical' }))).toBe(
      'professional'
    );
  });

  it('maps narrative register to narrative class', () => {
    expect(resolveFormattingClass(makeSchema({ communicationRegister: 'narrative' }))).toBe(
      'narrative'
    );
  });

  it('languageStyle="legal" overrides any register and forces the legal class', () => {
    expect(
      resolveFormattingClass(
        makeSchema({ communicationRegister: 'executive', languageStyle: 'legal' })
      )
    ).toBe('legal');
    expect(
      resolveFormattingClass(
        makeSchema({ communicationRegister: 'narrative', languageStyle: 'legal' })
      )
    ).toBe('legal');
  });
});

describe('resolveDocxFonts', () => {
  it('strips the trailing size hint from the schema font strings', () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({
        fonts: { body: 'Aptos 11', heading: 'Aptos Display 14' },
      }),
    });
    const fonts = resolveDocxFonts(schema, 'professional');
    expect(fonts.body).toBe('Aptos');
    expect(fonts.heading).toBe('Aptos Display');
  });

  it('falls back to Aptos pair when schema fonts are empty', () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ fonts: { body: '', heading: '' } }),
    });
    const fonts = resolveDocxFonts(schema, 'professional');
    expect(fonts.body).toBe('Aptos');
    expect(fonts.heading).toBe('Aptos Display');
  });

  it('falls back to Calibri pair for the legal class when fonts are empty', () => {
    const schema = makeSchema({
      languageStyle: 'legal',
      formattingSchema: makeFormattingSchema({ fonts: { body: '', heading: '' } }),
    });
    const fonts = resolveDocxFonts(schema, 'legal');
    expect(fonts.body).toBe('Calibri');
    expect(fonts.heading).toBe('Calibri');
  });

  it('honors explicit schema fonts even on the legal class', () => {
    const schema = makeSchema({
      languageStyle: 'legal',
      formattingSchema: makeFormattingSchema({
        fonts: { body: 'Garamond 11', heading: 'Garamond' },
      }),
    });
    const fonts = resolveDocxFonts(schema, 'legal');
    expect(fonts.body).toBe('Garamond');
    expect(fonts.heading).toBe('Garamond');
  });
});

describe('buildDocxStyleConfig', () => {
  it('emits every named paragraph style the renderer references', () => {
    const schema = makeSchema();
    const config = buildDocxStyleConfig(schema, 'professional') as {
      paragraphStyles: Array<{ id: string; name: string }>;
    };
    const styleIds = config.paragraphStyles.map((s) => s.id);
    for (const expected of Object.values(DOCX_STYLE_IDS)) {
      expect(styleIds).toContain(expected);
    }
  });

  it('uses larger title and heading sizes for executive than legal', () => {
    const exec = buildDocxStyleConfig(makeSchema(), 'executive') as {
      paragraphStyles: Array<{ id: string; run?: { size?: number } }>;
    };
    const legal = buildDocxStyleConfig(makeSchema(), 'legal') as {
      paragraphStyles: Array<{ id: string; run?: { size?: number } }>;
    };
    const execTitle = exec.paragraphStyles.find((s) => s.id === DOCX_STYLE_IDS.TITLE);
    const legalTitle = legal.paragraphStyles.find((s) => s.id === DOCX_STYLE_IDS.TITLE);
    expect(execTitle?.run?.size).toBeGreaterThan(legalTitle?.run?.size ?? 0);
    const execH1 = exec.paragraphStyles.find((s) => s.id === DOCX_STYLE_IDS.HEADING1);
    const legalH1 = legal.paragraphStyles.find((s) => s.id === DOCX_STYLE_IDS.HEADING1);
    expect(execH1?.run?.size).toBeGreaterThan(legalH1?.run?.size ?? 0);
  });

  it('assigns BlockQuote and Caption distinct visual contracts', () => {
    const schema = makeSchema({ communicationRegister: 'professional' });
    const config = buildDocxStyleConfig(schema, 'professional') as {
      paragraphStyles: Array<{
        id: string;
        run?: { italics?: boolean; color?: string };
      }>;
    };
    const blockQuote = config.paragraphStyles.find((s) => s.id === DOCX_STYLE_IDS.BLOCK_QUOTE);
    const caption = config.paragraphStyles.find((s) => s.id === DOCX_STYLE_IDS.CAPTION);
    expect(blockQuote?.run?.italics).toBe(true);
    expect(caption?.run?.italics).toBe(true);
    expect(caption?.run?.color).toBe('64748B');
    expect(blockQuote?.run?.color).toBe('475569');
  });
});

describe('describeFormattingDecision', () => {
  it('returns a human-readable reason citing the register-based mapping', () => {
    const decision = describeFormattingDecision(makeSchema({ communicationRegister: 'executive' }));
    expect(decision.formattingClass).toBe('executive');
    expect(decision.reason).toContain('register === "executive"');
  });

  it('flags the legal language-style override in the reason string', () => {
    const decision = describeFormattingDecision(
      makeSchema({ communicationRegister: 'narrative', languageStyle: 'legal' })
    );
    expect(decision.formattingClass).toBe('legal');
    expect(decision.reason).toContain('legal');
  });
});
