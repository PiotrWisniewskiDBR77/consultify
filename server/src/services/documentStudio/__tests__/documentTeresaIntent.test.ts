/**
 * Document Studio — Teresa intent auto-detect tests (Epic E3, Slice 4.3).
 *
 * Verifies precedence order and PL/EN trigger phrases for the heuristic
 * classifier:
 *   source > methodology > global > local-with-cursor >
 *   section-with-cursor > pure-cursor-fallback > null.
 */

import { describe, expect, it } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';
import { detectTeresaEditorIntent } from '../documentTeresaIntent.js';

function makeSchema(): DocumentSchema {
  return {
    documentId: 'd1',
    artifactId: 'a1',
    title: 'Intent Test',
    documentType: 'business_case',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'detailed',
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
    sections: [
      {
        sectionId: 'sec-1',
        orderIndex: 0,
        level: 1,
        title: 'Methodology',
        blocks: [
          { blockId: 'blk-1', type: 'paragraph', content: { text: 'Phase one.' } },
          { blockId: 'blk-2', type: 'paragraph', content: { text: 'Phase two.' } },
        ],
        sourceRefs: [],
      },
      {
        sectionId: 'sec-2',
        orderIndex: 1,
        level: 1,
        title: 'Findings',
        blocks: [{ blockId: 'blk-3', type: 'paragraph', content: { text: 'A finding.' } }],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: 'x',
    updatedAt: 'x',
  };
}

describe('Teresa intent auto-detect — precedence order', () => {
  it('returns null on empty message with no cursor', () => {
    const intent = detectTeresaEditorIntent({ message: '', schema: makeSchema() });
    expect(intent).toBeNull();
  });

  it('returns local on empty message when cursor is on a block', () => {
    const intent = detectTeresaEditorIntent({
      message: '',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-1', blockId: 'blk-1' },
    });
    expect(intent).toMatchObject({ scope: 'local', sectionId: 'sec-1', blockId: 'blk-1' });
  });

  it('returns section on empty message when cursor is only on a section', () => {
    const intent = detectTeresaEditorIntent({
      message: '',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-2' },
    });
    expect(intent).toMatchObject({ scope: 'section', sectionId: 'sec-2' });
  });

  it('SOURCE phrases beat everything (English)', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Polish the citations across the entire document.',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-1', blockId: 'blk-1' },
    });
    expect(intent?.scope).toBe('source');
    expect(intent?.reason).toBe('phrase');
  });

  it('SOURCE phrases beat everything (Polish, diacritic-insensitive)', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Popraw cytaty i przypisy w całym dokumencie.',
      schema: makeSchema(),
    });
    expect(intent?.scope).toBe('source');
  });

  it('METHODOLOGY phrases beat global', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Refine the methodology assumptions across the entire document.',
      schema: makeSchema(),
    });
    expect(intent?.scope).toBe('methodology');
  });

  it('METHODOLOGY phrases work with Polish "ryzyka"', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Doprecyzuj sekcję ryzyka i ich mitygacje.',
      schema: makeSchema(),
    });
    expect(intent?.scope).toBe('methodology');
  });

  it('GLOBAL phrases without methodology/source → global', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Tighten language across the document.',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-1', blockId: 'blk-1' },
    });
    expect(intent?.scope).toBe('global');
  });

  it('LOCAL phrase + cursor block → local at that block', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Rewrite this paragraph more concisely.',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-1', blockId: 'blk-2' },
    });
    expect(intent).toMatchObject({
      scope: 'local',
      sectionId: 'sec-1',
      blockId: 'blk-2',
      reason: 'cursor+phrase',
    });
  });

  it('LOCAL phrase WITHOUT cursor block falls through to other rules', () => {
    // No cursor block, no global/methodology/source phrases → message is
    // "rewrite this paragraph" which is a local phrase. Without a cursor
    // block, the local pathway can't be taken, so it falls through to
    // pure-cursor fallback. With no cursor at all, it should return null.
    const intent = detectTeresaEditorIntent({
      message: 'Rewrite this paragraph.',
      schema: makeSchema(),
    });
    expect(intent).toBeNull();
  });

  it('SECTION phrase + cursor section → section', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Tighten this section as a whole.',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-2' },
    });
    expect(intent).toMatchObject({
      scope: 'section',
      sectionId: 'sec-2',
      reason: 'cursor+phrase',
    });
  });

  it('Pure cursor fallback (block) when message lacks scope phrases but is non-trivial', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Make this clearer please',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-1', blockId: 'blk-1' },
    });
    expect(intent).toMatchObject({ scope: 'local', sectionId: 'sec-1', blockId: 'blk-1' });
    expect(intent?.reason).toBe('cursor');
  });

  it('Single-token noise without scope phrase returns null even with cursor', () => {
    const intent = detectTeresaEditorIntent({
      message: 'ok',
      schema: makeSchema(),
      cursor: { sectionId: 'sec-1', blockId: 'blk-1' },
    });
    expect(intent).toBeNull();
  });

  it('Invalid cursor IDs are ignored gracefully', () => {
    const intent = detectTeresaEditorIntent({
      message: 'Tighten language across the document.',
      schema: makeSchema(),
      cursor: { sectionId: 'does-not-exist', blockId: 'also-bogus' },
    });
    expect(intent?.scope).toBe('global');
  });
});
