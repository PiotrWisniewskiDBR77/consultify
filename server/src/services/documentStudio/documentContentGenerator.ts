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

import { resolveDeliverableTier } from '../deliverableGenerationTier.js';
import {
  deriveConfidence,
  type EvidenceContract,
  type EvidenceContractSource,
} from '../evidence/evidenceContract.js';
import {
  enforceBlockGrounding,
  type ContentBlock,
  type ContentBlockType,
} from './documentBlockContentGenerator.js';
import type {
  DocumentBlock,
  DocumentBlockType,
  DocumentIntake,
  DocumentOutline,
  DocumentSchema,
  DocumentSection,
  DocumentSourceRef,
} from './documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from './documentStudioTypes.js';

/**
 * HP-16: buduje `EvidenceContract` dokumentu — DETERMINISTYCZNIE, zero LLM, zero I/O.
 * REUŻYWA sygnały już obecne na schemacie (nie liczy drugiego zestawu):
 *   - `sources` = `sourceRefs` dokumentu (1:1 sourceType/sourceId/sourceTitle).
 *   - `unresolvedGaps`/`risks`/`toVerify` = bloki oznaczone `isAssumption: true` — dokładnie
 *     ten sam znacznik, który `buildSectionBlocks` ustawia, gdy `!hasSources`
 *     (doktryna Document Studio §5.4 "Deklaracja—niepotwierdzone"). To NIE jest LLM-owa
 *     samoocena — to deterministyczna flaga ustawiona w tej samej funkcji, która tworzy blok.
 */
export function buildDocumentEvidenceContract(
  sourceRefs: DocumentSourceRef[],
  sections: DocumentSection[]
): EvidenceContract {
  const sources: EvidenceContractSource[] = sourceRefs.map((r) => ({
    type: r.sourceType,
    ref: r.sourceId,
    title: r.sourceTitle,
  }));

  const allBlocks = sections.flatMap((s) => s.blocks);
  const assumptionBlocks = allBlocks.filter((b) => b.isAssumption === true);

  const risks: string[] = [];
  if (assumptionBlocks.length > 0) {
    risks.push(
      `${assumptionBlocks.length}/${allBlocks.length} bloków oznaczonych jako założenie (isAssumption) — brak podpiętego źródła.`
    );
  }

  const toVerify: string[] = [];
  if (sourceRefs.length === 0) {
    toVerify.push(
      'Brak podpiętych źródeł — treść oparta wyłącznie na deklaracji intake (bez cytowań).'
    );
  }
  sections
    .filter((section) => section.blocks.some((b) => b.isAssumption === true))
    .forEach((section) => {
      toVerify.push(`Sekcja "${section.title}" wymaga treści/źródeł (obecnie założenie/stub).`);
    });

  const confidence = deriveConfidence({
    sourceCount: sources.length,
    unresolvedGaps: assumptionBlocks.length,
  });

  return { sources, assumptions: [], risks, confidence, toVerify };
}

/**
 * Final, deterministic safety boundary for the complete generation pipeline.
 * This runs after every LLM enrichment layer, guards metadata rendered outside
 * block content (section titles/purposes), preserves prior assumption flags,
 * and always recomputes EvidenceContract from the final schema.
 */
export function enforceDocumentSchemaGrounding(
  schema: DocumentSchema,
  groundingSource: string
): DocumentSchema {
  const next = JSON.parse(JSON.stringify(schema)) as DocumentSchema;
  const language = next.language;
  const removed =
    language === 'pl'
      ? 'Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).'
      : 'Content removed — unsupported claim (assumption to verify).';

  const guardText = (text: string): { text: string; changed: boolean } => {
    const guarded = enforceBlockGrounding({ text }, groundingSource);
    return {
      text: typeof guarded.content.text === 'string' ? guarded.content.text : removed,
      changed: guarded.changed,
    };
  };

  const guardedTitle = guardText(next.title);
  if (guardedTitle.changed) next.title = removed;

  for (const section of next.sections) {
    const title = guardText(section.title);
    if (title.changed) section.title = removed;
    if (section.purpose) {
      const purpose = guardText(section.purpose);
      if (purpose.changed) section.purpose = removed;
    }
    for (const block of section.blocks) {
      const guarded = enforceBlockGrounding(
        block.content && typeof block.content === 'object'
          ? (block.content as Record<string, unknown>)
          : { text: String(block.content ?? '') },
        groundingSource
      );
      block.content = guarded.content;
      block.isAssumption = block.isAssumption === true || guarded.changed || title.changed;
    }
  }

  next.evidence = buildDocumentEvidenceContract(next.sourceRefs, next.sections);
  return next;
}

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
    text.includes('go here. Replace with grounded') ||
    // naprawa-r2Narr · Problem 2 — the NARRATIVE PLANNER placeholder (a section
    // `purpose` with no PURPOSE_HINTS entry: `Substantive section "X" relevant to
    // the document goal.`) was NOT detected here, so when it leaked into the
    // rendered body (schema renderer emits `_Purpose: …_`, or the skeleton renders
    // each purpose as `*…*` body) the anti-placeholder gate passed and shipped it
    // as if it were real content. This closes that hole: any such text is a
    // placeholder, never final prose. See documentNarrativePlanner.PURPOSE_HINTS.
    text.includes('Substantive section') ||
    text.includes('relevant to the document goal')
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

// B3 ready — wire into buildDocumentSchema when premium doc generation activates:
// planDocumentStructure() (documentStructureGenerator.ts) can replace the
// deterministic buildSectionBlocks() below by choosing block TYPES per section
// (table/kpi_strip/callout/…) via premium LLM, with this proza-only path as the
// STANDARD fallback.
//
// WIRED (W4): the LIVE entry-point is now {@link buildDocumentSchemaPremium}
// below — it is flag-gated via resolveDeliverableTier and FAILS OPEN to this
// exact deterministic function. `buildDocumentSchema` itself is UNCHANGED and
// byte-identical: it remains the synchronous STANDARD path and the fail-open
// target, so every existing caller / test keeps its current behaviour.
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
    evidence: buildDocumentEvidenceContract(sourceRefs, sections),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// W4 — PREMIUM doc generation wire-point.
//
// `buildDocumentSchemaPremium` is the flag-gated entry the live pipeline calls
// when premium doc generation is requested. It composes the two premium
// services (B3 structure architect + content-gen) and maps their output back
// into the canonical DocumentSchema the renderers/editor/QA already consume.
//
// SAFETY (non-negotiable — this touches live client generation):
//   1. Flag-gated: tier resolved via resolveDeliverableTier({orgId,preferPremium}).
//      PREMIUM only when ENABLE_DELIVERABLES_PREMIUM is true (default FALSE).
//   2. tier !== PREMIUM  ⇒  returns buildDocumentSchema(input) VERBATIM, i.e.
//      byte-identical to today's deterministic path. No premium call is made.
//   3. FAIL-OPEN: ANY error in the premium branch falls back to
//      buildDocumentSchema(input). The premium branch NEVER throws into the
//      live generation path.
// ──────────────────────────────────────────────────────────────────────────

export interface PremiumDocumentSchemaOptions {
  /** Organization the generation runs for (telemetry + future per-org policy). */
  orgId: string;
  userId?: string;
  /** Per-call override forwarded to resolveDeliverableTier. */
  preferPremium?: boolean;
  /**
   * Test/DI seam: inject the flag value so the OFF branch is verifiable without
   * touching global config. Production callers omit this. Mirrors
   * resolveDeliverableTier's `premiumEnabled`.
   */
  premiumEnabled?: boolean;
}

/**
 * Maps a content-gen `ContentBlockType` (kpi/text/bulletList/…) onto the
 * canonical `DocumentBlockType` the renderers/QA consume (kpi_strip/paragraph/
 * bullet_list/…). `divider` has no DocumentBlock equivalent → callers drop it.
 */
const CONTENT_TO_DOCUMENT_BLOCK_TYPE: Record<ContentBlockType, DocumentBlockType | null> = {
  heading: 'heading',
  text: 'paragraph',
  bulletList: 'bullet_list',
  numberedList: 'numbered_list',
  quote: 'quote',
  callout: 'callout',
  chart: 'chart',
  table: 'table',
  kpi: 'kpi_strip',
  image: 'image',
  divider: null,
};

/**
 * Map ONE content-gen block into a DocumentBlock. The content-gen normalizers
 * already emit exactly the content shapes the renderers were upgraded to read
 * (callout `{text,tone}`, kpi_strip `{items:[{label,value,delta}]}`, table
 * `{rows:[{cells:{col:{value,style:{bgColor}}}}]}`, chart `{kind,series,…}`,
 * lists `{items}`, quote `{text,author}`, heading/text `{text}`), so the
 * content passes through verbatim — we only translate the type tag and stamp a
 * fresh blockId. Returns `null` for block types with no DocumentBlock analogue
 * (divider) so the caller can drop them.
 */
function contentBlockToDocumentBlock(
  block: ContentBlock,
  plannedType?: string,
  hasSources = false
): DocumentBlock | null {
  const docType =
    plannedType === 'risk_table'
      ? 'risk_table'
      : (CONTENT_TO_DOCUMENT_BLOCK_TYPE[block.type] ?? 'paragraph');
  if (docType === null) return null;
  return {
    blockId: uuidv4(),
    type: docType,
    content: block.content,
    // An LLM result is not evidence. Without an attached source every premium
    // block remains an explicit assumption, including structured KPI/tables.
    isAssumption: block.isAssumption === true || !hasSources,
  };
}

/** Test seam for the premium-to-canonical boundary (no I/O, no LLM). */
export function __contentBlockToDocumentBlockForTests(
  block: ContentBlock,
  plannedType?: string,
  hasSources = false
): DocumentBlock | null {
  return contentBlockToDocumentBlock(block, plannedType, hasSources);
}

/**
 * PREMIUM-or-deterministic document schema builder (W4 live wire-point).
 *
 * When tier resolves to PREMIUM: plan structure (B3) + fill content (content-gen),
 * then map into DocumentSchema. When STANDARD or on ANY failure: returns
 * {@link buildDocumentSchema}(input) unchanged. Never throws.
 */
export async function buildDocumentSchemaPremium(
  input: BuildSchemaInput,
  opts: PremiumDocumentSchemaOptions
): Promise<DocumentSchema> {
  // The deterministic schema is BOTH the STANDARD result and the fail-open
  // target. Build it eagerly so every early-return path is byte-identical to
  // the current behaviour.
  const deterministic = buildDocumentSchema(input);

  let tier: 'PREMIUM' | 'STANDARD';
  try {
    tier = resolveDeliverableTier({
      orgId: opts?.orgId,
      preferPremium: opts?.preferPremium,
      premiumEnabled: opts?.premiumEnabled,
    });
  } catch {
    tier = 'STANDARD';
  }

  // Flag OFF (or explicit opt-out) → today's exact deterministic path. No
  // premium service is invoked; clients stay on STANDARD until quality is proven.
  if (tier !== 'PREMIUM') {
    return deterministic;
  }

  try {
    const { planDocumentStructure } = await import('./documentStructureGenerator.js');
    const { generateDocumentContent } = await import('./documentBlockContentGenerator.js');

    const intent =
      (input.intake.title?.trim() || input.outline.title?.trim() || '') +
      (input.intake.description ? ` — ${input.intake.description.trim()}` : '');
    const outlineSeed = input.outline.sections.map((s) => ({
      title: s.title,
      purpose: s.purpose,
    }));

    const plan = await planDocumentStructure(intent || input.outline.title, outlineSeed, {
      orgId: opts.orgId,
      userId: opts.userId,
      preferPremium: opts.preferPremium,
    });

    const content = await generateDocumentContent(intent || input.outline.title, plan, {
      orgId: opts.orgId,
      userId: opts.userId,
      preferPremium: opts.preferPremium,
      citationCount: input.sourceRefs.length,
    });

    const contentSections = Array.isArray(content?.sections) ? content.sections : [];
    if (contentSections.length === 0) {
      // Premium produced nothing usable → deterministic, never empty output.
      return deterministic;
    }

    const hasSources = input.sourceRefs.length > 0;

    // Map content-gen sections onto DocumentSection. We walk the ORIGINAL
    // outline so section level / purpose / ordering / source-ref attachment
    // stay identical to the deterministic schema; content-gen sections are
    // positional (it preserves outline order), so we zip by index and fall
    // back to the deterministic section's blocks if a content section is
    // missing or empty.
    const sections: DocumentSection[] = input.outline.sections.map((outlineSection, index) => {
      const contentSection = contentSections[index];
      const mapped = Array.isArray(contentSection?.blocks)
        ? contentSection.blocks
            .map((block, blockIndex) =>
              contentBlockToDocumentBlock(
                block,
                plan.sections[index]?.blocks[blockIndex]?.type,
                hasSources
              )
            )
            .filter((b): b is DocumentBlock => b !== null)
        : [];
      const blocks =
        mapped.length > 0
          ? mapped
          : buildSectionBlocks(outlineSection.title, input.intake.description ?? '', hasSources);
      return {
        sectionId: uuidv4(),
        orderIndex: index,
        level: outlineSection.level,
        title: outlineSection.title,
        purpose: outlineSection.purpose,
        blocks,
        sourceRefs: input.sourceRefs.slice(0, 1),
      };
    });

    // Reuse the deterministic envelope (document metadata is identical); only
    // the section blocks differ — recompute evidence against the PREMIUM
    // sections. NOTE: `contentBlockToDocumentBlock` does not carry an
    // `isAssumption` flag (the content-gen service doesn't emit one per block),
    // so the assumption-count signal only reflects sections that fell back to
    // the deterministic stub. Flagged explicitly below rather than silently
    // presenting a higher confidence than warranted.
    const premiumEvidence = buildDocumentEvidenceContract(input.sourceRefs, sections);
    premiumEvidence.toVerify.push(
      'Treść PREMIUM (LLM, contentBlockContentGenerator) — brak per-blokowego znacznika założenia (isAssumption); pewność oparta wyłącznie na liczbie podpiętych źródeł.'
    );
    return {
      ...deterministic,
      sections,
      evidence: premiumEvidence,
    };
  } catch {
    // FAIL-OPEN: any premium failure (LLM, mapping, import) degrades silently
    // to the deterministic path. The live generation must never break because
    // premium hiccuped.
    return deterministic;
  }
}
