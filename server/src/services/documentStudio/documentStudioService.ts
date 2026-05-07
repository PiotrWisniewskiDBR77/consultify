/**
 * Consultify Document Studio — Orchestrator.
 *
 * Pipeline:
 *   1) `planDocumentOutline` — Document Narrative Planner produces an outline.
 *   2) `materializeDocumentArtifact` — content generator fills the schema and
 *      persists a V8 native artifact via wave5ArtifactRuntimeService. The
 *      artifact `content` field carries the rendered markdown projection of
 *      the schema; the schema itself is stored in the artifact metadata for
 *      structured re-use.
 *   3) `getDocumentArtifact` — fetches the artifact and returns the schema.
 *   4) `exportDocumentArtifact` — returns markdown plus the wave5 export manifest.
 *
 * Modes:
 *   - Mode 1 (no template): outline planned from intake; FormattingSchema is
 *     the canonical default consulting profile.
 *   - Mode 3 (approved template): outline + FormattingSchema + per-section
 *     metadata are hydrated from the registered template. Template draft mode
 *     (Mode 2) is owned by `documentTemplateService.ts`.
 */

import {
  buildWave5ExportManifest,
  createWave5Artifact,
  getWave5Artifact,
  markWave5ArtifactExported,
} from '../wave5ArtifactRuntimeService.js';
import { buildDocumentSchema } from './documentContentGenerator.js';
import { renderDocumentSchemaToDocxBuffer } from './documentDocxRenderer.js';
import { refineEditorTextWithLlm } from './documentEditorRefiner.js';
import { planDocumentOutline } from './documentNarrativePlanner.js';
import { refineOutlineWithLlm } from './documentNarrativeRefiner.js';
import { renderDocumentSchemaToPdfBuffer } from './documentPdfRenderer.js';
import { renderSchemaToMarkdown } from './documentSchemaRenderer.js';
import type {
  DocumentAuditEntry,
  DocumentEditorProposal,
  DocumentEditorProposalInput,
  DocumentExportResult,
  DocumentIntake,
  DocumentOutline,
  DocumentProposalStatus,
  DocumentRunResult,
  DocumentSchema,
  DocumentSourceRef,
  DocumentTemplate,
} from './documentStudioTypes.js';
import {
  getTemplate as getRegisteredTemplate,
  isTemplateUsableForGeneration,
} from './documentTemplateService.js';

const SCHEMA_METADATA_KEY = 'documentStudioSchema';
const STUDIO_MODE_METADATA_KEY = 'documentStudioMode';
const STUDIO_DOC_TYPE_METADATA_KEY = 'documentStudioDocumentType';
const STUDIO_TEMPLATE_ID_METADATA_KEY = 'documentStudioTemplateId';
const STUDIO_TEMPLATE_VERSION_METADATA_KEY = 'documentStudioTemplateVersion';
const proposalStore = new Map<string, DocumentEditorProposal>();
const auditStore = new Map<string, DocumentAuditEntry[]>();

export interface PlanDocumentParams {
  intake: DocumentIntake;
}

export interface PlanDocumentResult {
  outline: DocumentOutline;
}

function validateIntake(
  intake: DocumentIntake | null | undefined
): asserts intake is DocumentIntake {
  if (!intake || typeof intake.description !== 'string') {
    throw new Error('Document intake requires a description string.');
  }
  if (intake.description.trim().length === 0) {
    throw new Error('Document intake description must not be empty.');
  }
}

export function planDocument(params: PlanDocumentParams): PlanDocumentResult {
  validateIntake(params.intake);
  return { outline: planDocumentOutline(params.intake) };
}

/**
 * Async variant of `planDocument` that optionally applies LLM refinement to
 * the deterministic outline. The refinement is bounded (reorder + purpose
 * rewrite) and falls back silently to the deterministic outline on any
 * failure path. See `documentNarrativeRefiner.ts`.
 */
export async function planDocumentAsync(
  params: PlanDocumentParams & { useLlm?: boolean }
): Promise<PlanDocumentResult> {
  validateIntake(params.intake);
  const deterministic = planDocumentOutline(params.intake);
  if (!params.useLlm) return { outline: deterministic };
  const refined = await refineOutlineWithLlm(deterministic, params.intake, { enable: true });
  return { outline: refined };
}

export interface MaterializeDocumentParams {
  organizationId: string;
  userId: string;
  intake: DocumentIntake;
  outline?: DocumentOutline;
  sourceRefs?: DocumentSourceRef[];
  projectId?: string | null;
  useLlm?: boolean;
  /**
   * When set, hydrate the outline and FormattingSchema from an approved
   * registered template (Mode 3). The template must belong to the same
   * organization as the call site; cross-tenant template IDs are rejected.
   */
  templateId?: string | null;
}

/**
 * Source-pack preflight error. Surfaced to callers when a Mode 3 template
 * declares `requiredInputs` that are not satisfied by the call-site source
 * pack. Carries structured `missing` so the UI can render a remediation
 * checklist instead of a generic 400.
 */
export class MissingRequiredSourceError extends Error {
  readonly code = 'missing_required_source';
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Missing required sources: ${missing.join(', ')}`);
    this.name = 'MissingRequiredSourceError';
    this.missing = missing;
  }
}

/**
 * A required input is satisfied when at least one provided source ref
 * mentions every significant token of the requirement, across `sourceType`,
 * `sourceId`, and `sourceTitle`. Match is case-insensitive and tokenized on
 * non-alphanumeric characters; this stays generous on purpose so consultants
 * can express requirements in plain language ("Discovery interview
 * transcript") and still pass when the source pack carries an item titled
 * "Discovery Interview – CFO transcript".
 */
const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'to', 'with', 'on', 'in', 'or']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function isRequirementSatisfied(requirement: string, sourceRefs: DocumentSourceRef[]): boolean {
  const tokens = tokenize(requirement);
  if (tokens.length === 0) return true;
  return sourceRefs.some((ref) => {
    const haystack = tokenize(
      [ref.sourceType ?? '', ref.sourceId ?? '', ref.sourceTitle ?? ''].join(' ')
    );
    if (haystack.length === 0) return false;
    const haystackSet = new Set(haystack);
    return tokens.every((token) => haystackSet.has(token));
  });
}

export function preflightRequiredSources(
  template: DocumentTemplate | null,
  sourceRefs: DocumentSourceRef[]
): { ok: true } | { ok: false; missing: string[] } {
  if (!template || template.requiredInputs.length === 0) return { ok: true };
  const missing = template.requiredInputs.filter((req) => !isRequirementSatisfied(req, sourceRefs));
  if (missing.length === 0) return { ok: true };
  return { ok: false, missing };
}

function outlineFromTemplate(template: DocumentTemplate, intake: DocumentIntake): DocumentOutline {
  return {
    documentType: template.documentType,
    title: intake.title?.trim() || `${template.documentType.replace(/_/g, ' ')}: ${template.name}`,
    sections: template.sectionBlueprint.map((blueprint) => ({
      title: blueprint.title,
      level: blueprint.level,
      purpose: blueprint.purpose,
      expectedLengthHint: blueprint.expectedLengthHint,
    })),
    recommendedDensity: template.density,
    recommendedRegister: template.communicationRegister,
    recommendedLanguageStyle: template.languageStyle,
  };
}

export async function materializeDocumentArtifact(
  params: MaterializeDocumentParams
): Promise<DocumentRunResult> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');

  // Mode resolution: Mode 3 (template-driven) takes precedence if a templateId
  // is provided AND the template is approved for the calling organization.
  let mode: 'mode_1' | 'mode_3' = 'mode_1';
  let template: DocumentTemplate | null = null;
  if (params.templateId) {
    const candidate = getRegisteredTemplate(params.templateId, params.organizationId);
    if (!isTemplateUsableForGeneration(candidate, params.organizationId)) {
      throw new Error('template_not_usable');
    }
    template = candidate;
    mode = 'mode_3';
  }

  // Source-pack preflight. Runs only when a template is in play; templates
  // express their data dependencies explicitly via `requiredInputs`. Mode 1
  // falls back to per-block `isAssumption` flags emitted by the content
  // generator, which is sufficient for the looser "no template" doctrine.
  const incomingSourceRefs = params.sourceRefs ?? [];
  if (template) {
    const preflight = preflightRequiredSources(template, incomingSourceRefs);
    if (!preflight.ok) {
      throw new MissingRequiredSourceError(preflight.missing);
    }
  }

  let outline: DocumentOutline;
  if (params.outline) {
    outline = params.outline;
  } else if (template) {
    outline = outlineFromTemplate(template, params.intake);
  } else {
    outline = planDocumentOutline(params.intake);
    if (params.useLlm) {
      outline = await refineOutlineWithLlm(outline, params.intake, { enable: true });
    }
  }

  const sourceRefs = incomingSourceRefs;

  const provisionalArtifactId = `documentstudio-pending-${Date.now()}`;
  const provisionalSchema = buildDocumentSchema({
    artifactId: provisionalArtifactId,
    intake: params.intake,
    outline,
    sourceRefs,
  });
  if (template) {
    provisionalSchema.formattingSchema = template.formattingSchema;
    provisionalSchema.confidentiality = template.confidentiality;
    provisionalSchema.languageStyle = template.languageStyle;
    provisionalSchema.communicationRegister = template.communicationRegister;
    provisionalSchema.density = template.density;
  }

  const markdown = renderSchemaToMarkdown(provisionalSchema);

  const metadata: Record<string, unknown> = {
    [SCHEMA_METADATA_KEY]: provisionalSchema,
    [STUDIO_MODE_METADATA_KEY]: mode,
    [STUDIO_DOC_TYPE_METADATA_KEY]: outline.documentType,
  };
  if (template) {
    metadata[STUDIO_TEMPLATE_ID_METADATA_KEY] = template.templateId;
    metadata[STUDIO_TEMPLATE_VERSION_METADATA_KEY] = template.version;
  }

  const artifact = await createWave5Artifact({
    organizationId: params.organizationId,
    userId: params.userId,
    artifactType: 'report',
    title: provisionalSchema.title,
    content: markdown,
    canonicalFormat: 'markdown',
    contentMd: markdown,
    contentJson: provisionalSchema,
    contentSchemaVersion: 'document_studio_v1',
    projectId: params.projectId ?? null,
    sourceRefs: sourceRefs as unknown[],
    metadata,
  });

  const artifactId = String(artifact?.artifactId ?? artifact?.artifact_id ?? provisionalArtifactId);
  const finalSchema: DocumentSchema = { ...provisionalSchema, artifactId };

  return { artifactId, schema: finalSchema };
}

export async function getDocumentArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentSchema | null> {
  const artifact = await getWave5Artifact(artifactId, organizationId);
  if (!artifact) return null;

  const metadata = parseMetadata(artifact.metadata_json ?? artifact.metadata);
  const schemaCandidate = metadata?.[SCHEMA_METADATA_KEY];
  if (schemaCandidate && typeof schemaCandidate === 'object') {
    return schemaCandidate as DocumentSchema;
  }

  const contentJson = parseMetadata(artifact.content_json);
  if (contentJson && typeof contentJson === 'object') {
    return contentJson as unknown as DocumentSchema;
  }

  return null;
}

export async function exportDocumentArtifact(
  artifactId: string,
  organizationId: string,
  format: 'markdown' | 'docx' | 'pdf'
): Promise<DocumentExportResult> {
  const artifact = await getWave5Artifact(artifactId, organizationId);
  if (!artifact) throw new Error('Document artifact not found');

  const manifest = await buildWave5ExportManifest(artifactId, organizationId);
  const filename = `${(artifact.title || 'document')
    .toString()
    .replace(/[^a-z0-9_-]+/gi, '_')
    .toLowerCase()}.${format}`;

  if (format === 'markdown') {
    return {
      format,
      filename,
      contentText: String(artifact.content ?? ''),
      manifest,
    };
  }

  // DOCX/PDF: render directly from the structured DocumentSchema so the
  // FormattingSchema (page, margins, headers, footers, page numbering,
  // confidentiality) is honored without round-tripping through markdown.
  // Persist the export through the wave5 pipeline by marking the artifact
  // as `exported` once a binary payload has been produced (audit-friendly:
  // matches `markWave5ArtifactExported` semantics used by the V8 runtime).
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) {
    throw new Error('Document schema not found on artifact');
  }
  let binary: Buffer;
  if (format === 'docx') {
    binary = await renderDocumentSchemaToDocxBuffer(schema);
  } else {
    binary = await renderDocumentSchemaToPdfBuffer(schema);
  }

  try {
    await markWave5ArtifactExported(artifactId, organizationId);
  } catch (err) {
    // The export status update is best-effort. We surface failure in the
    // manifest so callers can audit it but never block the binary delivery.
    (manifest as Record<string, unknown>).exportStatusUpdateError =
      err instanceof Error ? err.message : String(err);
  }

  return {
    format,
    filename,
    contentBase64: binary.toString('base64'),
    manifest: {
      ...manifest,
      renderedFromSchema: true,
      byteLength: binary.byteLength,
    },
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function proposalKey(artifactId: string, proposalId: string): string {
  return `${artifactId}:${proposalId}`;
}

function getAuditKey(artifactId: string, organizationId: string): string {
  return `${artifactId}:${organizationId}`;
}

function pushAuditEntry(entry: DocumentAuditEntry): void {
  const key = getAuditKey(entry.artifactId, entry.organizationId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
}

function blockToEditableText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const payload = content as Record<string, unknown>;
  const text = payload.text;
  if (typeof text === 'string') return text;
  if (Array.isArray(payload.items)) {
    return payload.items.map((item) => String(item)).join('\n');
  }
  return JSON.stringify(content);
}

function applyInstruction(before: string, instruction: string): string {
  const normalizedInstruction = instruction.trim();
  if (!normalizedInstruction) {
    throw new Error('instruction is required');
  }
  const trimmedBefore = before.trim();
  if (!trimmedBefore) {
    return `Edited content: ${normalizedInstruction}`;
  }
  return `${trimmedBefore}\n\n[Edited with instruction: ${normalizedInstruction}]`;
}

function withBlockText(content: unknown, text: string): unknown {
  if (!content || typeof content !== 'object') {
    return { text };
  }
  const payload = { ...(content as Record<string, unknown>) };
  if (typeof payload.text === 'string') {
    payload.text = text;
    return payload;
  }
  if (Array.isArray(payload.items)) {
    payload.items = text
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    return payload;
  }
  payload.text = text;
  return payload;
}

function cloneSchema(schema: DocumentSchema): DocumentSchema {
  return JSON.parse(JSON.stringify(schema)) as DocumentSchema;
}

function findSectionAndBlock(schema: DocumentSchema, sectionId: string, blockId: string) {
  const section = schema.sections.find((item) => item.sectionId === sectionId);
  if (!section) {
    throw new Error('section_not_found');
  }
  const block = section.blocks.find((item) => item.blockId === blockId);
  if (!block) {
    throw new Error('block_not_found');
  }
  return { section, block };
}

async function computeRefinedAfter(
  before: string,
  instruction: string,
  context: {
    schema: DocumentSchema;
    scope: 'local' | 'section' | 'global';
  },
  useLlm: boolean,
  fallback: string
): Promise<string> {
  if (!useLlm) return fallback;
  const refined = await refineEditorTextWithLlm(before, instruction, {
    documentType: context.schema.documentType,
    scope: context.scope,
    communicationRegister: context.schema.communicationRegister,
    language: context.schema.language,
  });
  return refined ?? fallback;
}

export interface CreateLocalEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  input: DocumentEditorProposalInput;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createLocalEditProposal(
  params: CreateLocalEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, input } = params;
  if (input.scope !== 'local') {
    throw new Error('unsupported_scope');
  }
  if (!input.sectionId || !input.blockId) {
    throw new Error('section_and_block_required');
  }
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) {
    throw new Error('artifact_not_found');
  }
  const { block } = findSectionAndBlock(schema, input.sectionId, input.blockId);
  const before = blockToEditableText(block.content);
  const deterministicAfter = applyInstruction(before, input.instruction);
  const after = await computeRefinedAfter(
    before,
    input.instruction,
    { schema, scope: 'local' },
    Boolean(params.useLlm),
    deterministicAfter
  );
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'local',
    sectionId: input.sectionId,
    blockId: input.blockId,
    instruction: input.instruction.trim(),
    affectedSectionIds: [input.sectionId],
    status: 'proposed',
    diff: { before, after },
    createdBy: userId,
    createdAt,
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: { scope: proposal.scope, sectionId: input.sectionId, blockId: input.blockId },
  });
  return proposal;
}

// =============================================================================
// MVP-3 — Editor section + global scope proposals.
// =============================================================================

interface SectionMarkdownProjection {
  sectionId: string;
  title: string;
  before: string;
  after: string;
}

function projectSectionToText(section: DocumentSchema['sections'][number]): string {
  const lines: string[] = [`## ${section.title}`];
  for (const block of section.blocks) {
    const text = blockToEditableText(block.content).trim();
    if (text.length > 0) lines.push(text);
  }
  return lines.join('\n\n');
}

function applyInstructionToBlock(content: unknown, instruction: string): unknown {
  const before = blockToEditableText(content);
  const after = applyInstruction(before, instruction);
  return withBlockText(content, after);
}

export interface CreateSectionEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  sectionId: string;
  instruction: string;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createSectionEditProposal(
  params: CreateSectionEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, sectionId, instruction } = params;
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('instruction is required');
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) throw new Error('artifact_not_found');
  const section = schema.sections.find((s) => s.sectionId === sectionId);
  if (!section) throw new Error('section_not_found');

  const before = projectSectionToText(section);
  const blockRewrites: Record<string, string> = {};
  let llmRefined = false;
  if (params.useLlm) {
    for (const block of section.blocks) {
      const blockBefore = blockToEditableText(block.content);
      const refined = await refineEditorTextWithLlm(blockBefore, trimmed, {
        documentType: schema.documentType,
        scope: 'section',
        communicationRegister: schema.communicationRegister,
        language: schema.language,
      });
      if (refined) {
        blockRewrites[block.blockId] = refined;
        llmRefined = true;
      }
    }
  }
  const previewAfter = llmRefined
    ? section.blocks
        .map((block) => blockRewrites[block.blockId] ?? blockToEditableText(block.content))
        .join('\n\n')
    : `${before}\n\n[Section-scope edit applied at approval: ${trimmed}]`;
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'section',
    sectionId,
    instruction: trimmed,
    affectedSectionIds: [sectionId],
    blockRewrites: llmRefined ? blockRewrites : undefined,
    llmRefined: llmRefined || undefined,
    status: 'proposed',
    diff: { before, after: previewAfter },
    createdBy: userId,
    createdAt,
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: { scope: 'section', sectionId },
  });
  return proposal;
}

export interface CreateGlobalEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  instruction: string;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createGlobalEditProposal(
  params: CreateGlobalEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, instruction } = params;
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('instruction is required');
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) throw new Error('artifact_not_found');
  if (schema.sections.length === 0) {
    throw new Error('document_has_no_sections');
  }

  const blockRewrites: Record<string, string> = {};
  let llmRefined = false;
  if (params.useLlm) {
    for (const section of schema.sections) {
      for (const block of section.blocks) {
        const blockBefore = blockToEditableText(block.content);
        const refined = await refineEditorTextWithLlm(blockBefore, trimmed, {
          documentType: schema.documentType,
          scope: 'global',
          communicationRegister: schema.communicationRegister,
          language: schema.language,
        });
        if (refined) {
          blockRewrites[block.blockId] = refined;
          llmRefined = true;
        }
      }
    }
  }

  const projections: SectionMarkdownProjection[] = schema.sections.map((section) => {
    const before = projectSectionToText(section);
    const after = llmRefined
      ? [
          `## ${section.title}`,
          ...section.blocks.map(
            (block) => blockRewrites[block.blockId] ?? blockToEditableText(block.content)
          ),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n')
      : `${before}\n\n[Global edit at approval: ${trimmed}]`;
    return {
      sectionId: section.sectionId,
      title: section.title,
      before,
      after,
    };
  });

  const before = projections.map((p) => p.before).join('\n\n---\n\n');
  const after = projections.map((p) => p.after).join('\n\n---\n\n');
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'global',
    instruction: trimmed,
    affectedSectionIds: schema.sections.map((s) => s.sectionId),
    blockRewrites: llmRefined ? blockRewrites : undefined,
    llmRefined: llmRefined || undefined,
    status: 'proposed',
    diff: { before, after },
    createdBy: userId,
    createdAt,
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: { scope: 'global', affectedSectionCount: proposal.affectedSectionIds.length },
  });
  return proposal;
}

function updateProposalStatus(
  proposal: DocumentEditorProposal,
  status: DocumentProposalStatus
): DocumentEditorProposal {
  return { ...proposal, status };
}

function getStoredProposal(
  artifactId: string,
  organizationId: string,
  proposalId: string
): DocumentEditorProposal {
  const proposal = proposalStore.get(proposalKey(artifactId, proposalId));
  if (!proposal || proposal.organizationId !== organizationId) {
    throw new Error('proposal_not_found');
  }
  return proposal;
}

export interface ApproveEditProposalResult {
  proposal: DocumentEditorProposal;
  schema: DocumentSchema;
}

/** @deprecated kept for back-compat with MVP-1 callers; alias for `ApproveEditProposalResult`. */
export type ApproveLocalEditProposalResult = ApproveEditProposalResult;

/**
 * Apply a stored proposal to a fresh copy of the schema, dispatching by
 * scope. Local: rewrite a single block. Section: rewrite every editable
 * block in one section. Global: rewrite every editable block in every
 * section. Section/global edits are deterministic: they append the
 * instruction marker to each block, mirroring the local-scope behavior so
 * the diff stays auditable in MVP-3 without an LLM rewrite step.
 */
function applyProposalToSchema(
  schema: DocumentSchema,
  proposal: DocumentEditorProposal
): DocumentSchema {
  const next = cloneSchema(schema);
  const rewrites = proposal.blockRewrites ?? {};

  if (proposal.scope === 'local') {
    if (!proposal.sectionId || !proposal.blockId) {
      throw new Error('proposal_missing_targets');
    }
    const { block } = findSectionAndBlock(next, proposal.sectionId, proposal.blockId);
    // Local proposals encode the rewrite directly in `diff.after`; LLM and
    // deterministic paths share the same field.
    block.content = withBlockText(block.content, proposal.diff.after);
  } else if (proposal.scope === 'section') {
    if (!proposal.sectionId) throw new Error('proposal_missing_targets');
    const section = next.sections.find((s) => s.sectionId === proposal.sectionId);
    if (!section) throw new Error('section_not_found');
    for (const block of section.blocks) {
      const refinedText = rewrites[block.blockId];
      block.content = refinedText
        ? withBlockText(block.content, refinedText)
        : applyInstructionToBlock(block.content, proposal.instruction);
    }
  } else {
    for (const section of next.sections) {
      for (const block of section.blocks) {
        const refinedText = rewrites[block.blockId];
        block.content = refinedText
          ? withBlockText(block.content, refinedText)
          : applyInstructionToBlock(block.content, proposal.instruction);
      }
    }
  }
  next.updatedAt = nowIso();
  return next;
}

export async function approveEditProposal(params: {
  artifactId: string;
  organizationId: string;
  userId: string;
  proposalId: string;
}): Promise<ApproveEditProposalResult> {
  const proposal = getStoredProposal(params.artifactId, params.organizationId, params.proposalId);
  if (proposal.status !== 'proposed') {
    throw new Error('proposal_not_pending');
  }
  const schema = await getDocumentArtifact(params.artifactId, params.organizationId);
  if (!schema) {
    throw new Error('artifact_not_found');
  }
  const nextSchema = applyProposalToSchema(schema, proposal);
  const approvedAt = nowIso();
  let nextProposal = updateProposalStatus(proposal, 'approved');
  nextProposal = {
    ...nextProposal,
    approvedBy: params.userId,
    approvedAt,
  };
  const executedAt = nowIso();
  nextProposal = {
    ...nextProposal,
    status: 'executed',
    executedAt,
  };
  proposalStore.set(proposalKey(params.artifactId, params.proposalId), nextProposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_approved',
    actorId: params.userId,
    occurredAt: approvedAt,
  });
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_executed',
    actorId: params.userId,
    occurredAt: executedAt,
    details: {
      scope: proposal.scope,
      affectedSectionIds: proposal.affectedSectionIds,
      sectionId: proposal.sectionId,
      blockId: proposal.blockId,
    },
  });
  return { proposal: nextProposal, schema: nextSchema };
}

/**
 * @deprecated MVP-1 alias retained for back-compat. New callers should use
 * `approveEditProposal`. Routes still mount under
 * `/proposals/:proposalId/approve` regardless of scope.
 */
export const approveLocalEditProposal = approveEditProposal;

/**
 * Reject a proposal of any scope. Same governance contract as the local
 * rejection from MVP-1; only the recorded audit detail records the scope.
 */
export function rejectEditProposal(params: {
  artifactId: string;
  organizationId: string;
  userId: string;
  proposalId: string;
}): DocumentEditorProposal {
  const proposal = getStoredProposal(params.artifactId, params.organizationId, params.proposalId);
  if (proposal.status !== 'proposed') {
    throw new Error('proposal_not_pending');
  }
  const rejectedAt = nowIso();
  const nextProposal: DocumentEditorProposal = {
    ...proposal,
    status: 'rejected',
    rejectedBy: params.userId,
    rejectedAt,
  };
  proposalStore.set(proposalKey(params.artifactId, params.proposalId), nextProposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_rejected',
    actorId: params.userId,
    occurredAt: rejectedAt,
    details: { scope: proposal.scope },
  });
  return nextProposal;
}

/**
 * @deprecated MVP-1 alias retained for back-compat. New callers should use
 * `rejectEditProposal`.
 */
export const rejectLocalEditProposal = rejectEditProposal;

export function listDocumentAuditEntries(
  artifactId: string,
  organizationId: string
): DocumentAuditEntry[] {
  return [...(auditStore.get(getAuditKey(artifactId, organizationId)) ?? [])];
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
