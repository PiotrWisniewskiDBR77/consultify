/**
 * Document Content Generator — MVP-1 (Mode 1 only).
 *
 * Builds a Document Schema from an intake plus an outline. Each section gets
 * one or more blocks. Analytical claims are marked `isAssumption: true` when
 * no source ref is available, per Document Studio doctrine §5.4.
 *
 * MVP-1 boundary: deterministic block content based on intake and outline.
 * MVP-1 finalization (a follow-up wiring pass) will plug this generator into
 * the existing AI service abstraction so that each section is filled with
 * grounded narrative produced by the Narrative Engine
 * (REPORT_GENERATOR_V3 §5.6.1, layer 4 — linguistic realization).
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  DocumentBlock,
  DocumentIntake,
  DocumentOutline,
  DocumentSchema,
  DocumentSection,
  DocumentSourceRef,
} from './documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from './documentStudioTypes.js';

interface BuildSchemaInput {
  artifactId: string;
  intake: DocumentIntake;
  outline: DocumentOutline;
  sourceRefs: DocumentSourceRef[];
}

function normalizeAudience(audience: unknown): string[] {
  if (Array.isArray(audience)) {
    return audience
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
  }

  if (typeof audience === 'string') {
    return audience
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function buildSectionBlocks(
  sectionTitle: string,
  intakeDescription: string,
  hasSources: boolean
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  if (sectionTitle.toLowerCase().includes('executive summary')) {
    blocks.push({
      blockId: uuidv4(),
      type: 'paragraph',
      content: {
        text: shortenForExecutiveSummary(intakeDescription),
      },
      isAssumption: !hasSources,
    });
    blocks.push({
      blockId: uuidv4(),
      type: 'callout',
      content: {
        variant: 'key_message',
        text: 'This section is awaiting content — key message and recommended next step. Add sources or use AI generation to fill it.',
      },
      isAssumption: true,
    });
    return blocks;
  }

  if (sectionTitle.toLowerCase().includes('decisions required')) {
    blocks.push({
      blockId: uuidv4(),
      type: 'numbered_list',
      content: {
        items: [
          'Decision 1 — describe the choice the audience must make and the recommended option.',
          'Decision 2 — describe the next decision; include owner and deadline.',
        ],
      },
      isAssumption: true,
    });
    return blocks;
  }

  if (sectionTitle.toLowerCase().includes('risks')) {
    blocks.push({
      blockId: uuidv4(),
      type: 'risk_table',
      content: {
        columns: ['Risk', 'Likelihood', 'Impact', 'Owner', 'Mitigation'],
        rows: [
          ['Risk 1', 'Medium', 'High', 'TBD', 'Mitigation plan TBD'],
          ['Risk 2', 'Low', 'Medium', 'TBD', 'Mitigation plan TBD'],
        ],
      },
      isAssumption: true,
    });
    return blocks;
  }

  if (sectionTitle.toLowerCase().includes('next steps')) {
    blocks.push({
      blockId: uuidv4(),
      type: 'bullet_list',
      content: {
        items: [
          'Owner, action, deadline (1).',
          'Owner, action, deadline (2).',
          'Owner, action, deadline (3).',
        ],
      },
      isAssumption: true,
    });
    return blocks;
  }

  if (sectionTitle.toLowerCase().includes('appendix')) {
    blocks.push({
      blockId: uuidv4(),
      type: 'paragraph',
      content: {
        text: 'Reference materials and source list for this document.',
      },
      isAssumption: false,
    });
    return blocks;
  }

  // Generic substantive section.
  blocks.push({
    blockId: uuidv4(),
    type: 'paragraph',
    content: {
      text: sectionStubText(sectionTitle),
    },
    isAssumption: !hasSources,
  });

  return blocks;
}

/**
 * D-L2-3 (DELIVERABLES_LIGHT_TARGET §11.1): stuby sekcji są pisane językiem
 * użytkownika — żaden wewnętrzny żargon (dawniej „MVP-1 ships this as a
 * structured placeholder…") nie może trafić do outputu. Stałe są eksportowane,
 * żeby warstwy wyżej (lekki runtime) wykrywały stub jedną prawdą, bez
 * duplikowania sygnatur.
 */
export const SECTION_STUB_PREFIX = 'This section is awaiting content';
export const EXEC_SUMMARY_STUB =
  'Add a short description of the document goal to generate the executive summary.';

function sectionStubText(sectionTitle: string): string {
  return `${SECTION_STUB_PREFIX} — "${sectionTitle}". Add sources or use AI generation to fill it.`;
}

/** Czy tekst to stub/placeholder silnika deterministycznego (nie realna treść)? */
export function isPlaceholderDocumentProse(text: string): boolean {
  return (
    text.includes(SECTION_STUB_PREFIX) ||
    text.includes(EXEC_SUMMARY_STUB) ||
    text.includes('MVP-1') ||
    text.includes('go here. Replace with grounded')
  );
}

function shortenForExecutiveSummary(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return EXEC_SUMMARY_STUB;
  }
  if (trimmed.length <= 360) return trimmed;
  return `${trimmed.slice(0, 357)}...`;
}

export function buildDocumentSchema(input: BuildSchemaInput): DocumentSchema {
  const { artifactId, intake, outline, sourceRefs } = input;
  const now = new Date().toISOString();
  const hasSources = sourceRefs.length > 0;

  const sections: DocumentSection[] = outline.sections.map((outlineSection, index) => ({
    sectionId: uuidv4(),
    orderIndex: index,
    level: outlineSection.level,
    title: outlineSection.title,
    purpose: outlineSection.purpose,
    blocks: buildSectionBlocks(outlineSection.title, intake.description ?? '', hasSources),
    sourceRefs: sourceRefs.slice(0, 1),
  }));

  return {
    documentId: uuidv4(),
    artifactId,
    title: outline.title,
    documentType: outline.documentType,
    language: intake.language ?? 'pl',
    audience: normalizeAudience((intake as { audience?: unknown }).audience),
    goal: intake.goal ?? 'inform',
    communicationRegister: outline.recommendedRegister,
    density: outline.recommendedDensity,
    languageStyle: outline.recommendedLanguageStyle,
    confidentiality: intake.confidentiality ?? 'internal',
    formattingSchema: DEFAULT_CONSULTING_FORMATTING_SCHEMA,
    sections,
    sourceRefs,
    createdAt: now,
    updatedAt: now,
  };
}
