/**
 * Consultify Document Studio — Reusable Content Block Library
 * (Epic E10, Slice 10.2).
 *
 * Tenant-scoped catalogue of named, reusable `DocumentBlock` payloads
 * (standard intros, compliance disclaimers, methodology blurbs, …) so
 * a consultant can drop pre-approved language into any document
 * without copy/pasting from older artifacts.
 *
 * Lifecycle: `draft → active → archived`. Multiple actives are allowed
 * per organization (different snippets serve different purposes).
 * Archived entries stay queryable for audit but cannot be inserted
 * into new documents.
 *
 * Each library entry stores:
 *   - `block` — the DocumentBlock payload WITHOUT a `blockId`. Insertion
 *     allocates a fresh id so two copies of the same library entry
 *     never share an id inside a section.
 *   - `documentTypes` — the entry is searchable / suggestable for these
 *     document types. Empty array means "applicable to all types".
 *   - `languageScope` — `'pl'`, `'en'`, or `'all'`.
 *   - `tags` — free-form tags for filter / suggest.
 *
 * Design contract mirrors `documentBrandVoiceService.ts` /
 * `documentAudienceProfileService.ts`:
 *
 *   - Synchronous-friendly public surface; persistence write-through is
 *     fire-and-forget via `void persistX().catch(...)`.
 *   - Hydration via `ensureContentBlockRegistryHydrated(organizationId)`.
 *   - Tenant boundary: cross-tenant reads return `null` /
 *     `'content_block_not_found'` deny-by-default.
 */

import {
  __resetContentBlockRegistryDaoForTests,
  loadAuditForContentBlock,
  loadContentBlockById,
  loadContentBlocksForOrg,
  persistContentBlock,
  persistContentBlockAuditEntry,
} from './documentContentBlockRegistryDao.js';
import type {
  DocumentBlock,
  DocumentContentBlockAuditAction,
  DocumentContentBlockAuditEntry,
  DocumentContentBlockDraftInput,
  DocumentContentBlockStatus,
  DocumentContentBlockTemplate,
  DocumentContentBlockUpdateInput,
  DocumentTypeKey,
} from './documentStudioTypes.js';

// =============================================================================
// Errors
// =============================================================================

export type DocumentContentBlockErrorCode =
  | 'invalid_input'
  | 'content_block_not_found'
  | 'content_block_archived'
  | 'content_block_already_active'
  | 'content_block_already_archived'
  | 'forbidden';

export class DocumentContentBlockError extends Error {
  readonly code: DocumentContentBlockErrorCode;
  constructor(code: DocumentContentBlockErrorCode, message: string) {
    super(message);
    this.name = 'DocumentContentBlockError';
    this.code = code;
  }
}

// =============================================================================
// In-process registry + write-through
// =============================================================================

const registryStore = new Map<string, DocumentContentBlockTemplate>();
const auditStore = new Map<string, DocumentContentBlockAuditEntry[]>();
const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

function libraryKey(organizationId: string, contentBlockId: string): string {
  return `${organizationId}::${contentBlockId}`;
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone(template: DocumentContentBlockTemplate): DocumentContentBlockTemplate {
  return {
    ...template,
    tags: [...template.tags],
    documentTypes: [...template.documentTypes],
    block: JSON.parse(JSON.stringify(template.block)) as DocumentContentBlockTemplate['block'],
  };
}

function pushAudit(entry: DocumentContentBlockAuditEntry): void {
  const key = libraryKey(entry.organizationId, entry.contentBlockId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
  void persistContentBlockAuditEntry(entry).catch(() => undefined);
}

function recordMutation(
  template: DocumentContentBlockTemplate,
  action: DocumentContentBlockAuditAction,
  actorId: string,
  details?: Record<string, unknown>
): void {
  pushAudit({
    auditId: makeId('content-block-audit'),
    contentBlockId: template.contentBlockId,
    organizationId: template.organizationId,
    action,
    actorId,
    occurredAt: nowIso(),
    details,
  });
}

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const templates = await loadContentBlocksForOrg(organizationId);
      for (const template of templates) {
        registryStore.set(libraryKey(template.organizationId, template.contentBlockId), template);
        const audit = await loadAuditForContentBlock(
          template.contentBlockId,
          template.organizationId
        );
        if (audit.length > 0) {
          auditStore.set(libraryKey(template.organizationId, template.contentBlockId), audit);
        }
      }
    } catch {
      // Persistence offline → cache stays empty; subsequent writes still
      // attempt write-through and the in-process state remains operational.
    }
    hydratedOrgs.add(organizationId);
  })();
  hydrationInflight.set(organizationId, promise);
  try {
    await promise;
  } finally {
    hydrationInflight.delete(organizationId);
  }
}

export async function ensureContentBlockRegistryHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Validation helpers
// =============================================================================

const VALID_LANGUAGE_SCOPES: ReadonlySet<'pl' | 'en' | 'all'> = new Set(['pl', 'en', 'all']);

const VALID_BLOCK_TYPES: ReadonlySet<DocumentBlock['type']> = new Set([
  'heading',
  'paragraph',
  'bullet_list',
  'numbered_list',
  'table',
  'callout',
  'quote',
  'kpi_strip',
  'risk_table',
  'image',
  'footnote',
  'citation',
]);

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const dedupKey = trimmed.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push(trimmed);
  }
  return out;
}

function normalizeDocumentTypes(input: unknown): DocumentTypeKey[] {
  if (!Array.isArray(input)) return [];
  const out: DocumentTypeKey[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed as DocumentTypeKey);
  }
  return out;
}

function validateBlockPayload(
  raw: DocumentContentBlockDraftInput['block'] | undefined
): asserts raw is DocumentContentBlockDraftInput['block'] {
  if (!raw || typeof raw !== 'object') {
    throw new DocumentContentBlockError('invalid_input', 'block payload is required');
  }
  const type = (raw as { type?: unknown }).type;
  if (typeof type !== 'string' || !VALID_BLOCK_TYPES.has(type as DocumentBlock['type'])) {
    throw new DocumentContentBlockError('invalid_input', `unsupported block type: ${String(type)}`);
  }
}

function bumpVersion(current: string): string {
  const num = Number.parseInt(current.replace(/^v/i, ''), 10);
  if (Number.isFinite(num) && num >= 0) return `v${num + 1}`;
  return 'v1';
}

// =============================================================================
// Draft / update / activate / archive
// =============================================================================

export interface DraftDocumentContentBlockParams {
  organizationId: string;
  userId: string;
  input: DocumentContentBlockDraftInput;
}

export function draftDocumentContentBlock(
  params: DraftDocumentContentBlockParams
): DocumentContentBlockTemplate {
  if (!params.organizationId) {
    throw new DocumentContentBlockError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new DocumentContentBlockError('invalid_input', 'userId is required');
  }
  if (!params.input || !params.input.name || params.input.name.trim().length === 0) {
    throw new DocumentContentBlockError('invalid_input', 'content block name is required');
  }
  validateBlockPayload(params.input.block);

  const languageScope: 'pl' | 'en' | 'all' =
    params.input.languageScope && VALID_LANGUAGE_SCOPES.has(params.input.languageScope)
      ? params.input.languageScope
      : 'all';

  const now = nowIso();
  const template: DocumentContentBlockTemplate = {
    contentBlockId: makeId('content-block'),
    organizationId: params.organizationId,
    name: params.input.name.trim(),
    description: params.input.description?.trim() || undefined,
    status: 'draft',
    version: 'v1',
    tags: normalizeStringList(params.input.tags),
    documentTypes: normalizeDocumentTypes(params.input.documentTypes),
    languageScope,
    block: JSON.parse(JSON.stringify(params.input.block)) as DocumentContentBlockTemplate['block'],
    notes: params.input.notes?.trim() || undefined,
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
  };

  registryStore.set(libraryKey(params.organizationId, template.contentBlockId), template);
  void persistContentBlock(template).catch(() => undefined);

  recordMutation(template, 'content_block_drafted', params.userId, {
    name: template.name,
    blockType: template.block.type,
    languageScope: template.languageScope,
  });

  return clone(template);
}

export interface UpdateDocumentContentBlockParams {
  organizationId: string;
  userId: string;
  contentBlockId: string;
  input: DocumentContentBlockUpdateInput;
}

export function updateDocumentContentBlock(
  params: UpdateDocumentContentBlockParams
): DocumentContentBlockTemplate {
  if (!params.organizationId) {
    throw new DocumentContentBlockError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new DocumentContentBlockError('invalid_input', 'userId is required');
  }
  const existing = registryStore.get(libraryKey(params.organizationId, params.contentBlockId));
  if (!existing) {
    throw new DocumentContentBlockError(
      'content_block_not_found',
      `content block not found: ${params.contentBlockId}`
    );
  }
  if (existing.status === 'archived') {
    throw new DocumentContentBlockError(
      'content_block_archived',
      `content block is archived: ${params.contentBlockId}`
    );
  }
  if (params.input.block !== undefined) {
    validateBlockPayload(params.input.block);
  }

  const now = nowIso();
  const next: DocumentContentBlockTemplate = {
    ...existing,
    name:
      params.input.name !== undefined && params.input.name.trim().length > 0
        ? params.input.name.trim()
        : existing.name,
    description:
      params.input.description === null
        ? undefined
        : params.input.description !== undefined
          ? params.input.description.trim() || undefined
          : existing.description,
    tags: params.input.tags !== undefined ? normalizeStringList(params.input.tags) : existing.tags,
    documentTypes:
      params.input.documentTypes !== undefined
        ? normalizeDocumentTypes(params.input.documentTypes)
        : existing.documentTypes,
    languageScope:
      params.input.languageScope && VALID_LANGUAGE_SCOPES.has(params.input.languageScope)
        ? params.input.languageScope
        : existing.languageScope,
    block:
      params.input.block !== undefined
        ? (JSON.parse(JSON.stringify(params.input.block)) as DocumentContentBlockTemplate['block'])
        : existing.block,
    notes:
      params.input.notes === null
        ? undefined
        : params.input.notes !== undefined
          ? params.input.notes.trim() || undefined
          : existing.notes,
    version: bumpVersion(existing.version),
    updatedAt: now,
  };

  registryStore.set(libraryKey(params.organizationId, next.contentBlockId), next);
  void persistContentBlock(next).catch(() => undefined);

  recordMutation(next, 'content_block_updated', params.userId, {
    fromVersion: existing.version,
    toVersion: next.version,
  });

  return clone(next);
}

export interface ActivateDocumentContentBlockParams {
  organizationId: string;
  userId: string;
  contentBlockId: string;
}

/**
 * Promote a content block to `active`. Multiple actives are allowed
 * per tenant (different snippets serve different purposes).
 * Idempotency guard via `content_block_already_active`.
 */
export function activateDocumentContentBlock(
  params: ActivateDocumentContentBlockParams
): DocumentContentBlockTemplate {
  if (!params.organizationId) {
    throw new DocumentContentBlockError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new DocumentContentBlockError('invalid_input', 'userId is required');
  }
  const target = registryStore.get(libraryKey(params.organizationId, params.contentBlockId));
  if (!target) {
    throw new DocumentContentBlockError(
      'content_block_not_found',
      `content block not found: ${params.contentBlockId}`
    );
  }
  if (target.status === 'archived') {
    throw new DocumentContentBlockError(
      'content_block_archived',
      `cannot activate an archived content block: ${params.contentBlockId}`
    );
  }
  if (target.status === 'active') {
    throw new DocumentContentBlockError(
      'content_block_already_active',
      `content block is already active: ${params.contentBlockId}`
    );
  }

  const now = nowIso();
  const next: DocumentContentBlockTemplate = {
    ...target,
    status: 'active',
    activatedBy: params.userId,
    activatedAt: now,
    updatedAt: now,
  };
  registryStore.set(libraryKey(params.organizationId, next.contentBlockId), next);
  void persistContentBlock(next).catch(() => undefined);

  recordMutation(next, 'content_block_activated', params.userId, {
    version: next.version,
  });

  return clone(next);
}

export interface ArchiveDocumentContentBlockParams {
  organizationId: string;
  userId: string;
  contentBlockId: string;
  reason?: string;
}

export function archiveDocumentContentBlock(
  params: ArchiveDocumentContentBlockParams
): DocumentContentBlockTemplate {
  if (!params.organizationId) {
    throw new DocumentContentBlockError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new DocumentContentBlockError('invalid_input', 'userId is required');
  }
  const target = registryStore.get(libraryKey(params.organizationId, params.contentBlockId));
  if (!target) {
    throw new DocumentContentBlockError(
      'content_block_not_found',
      `content block not found: ${params.contentBlockId}`
    );
  }
  if (target.status === 'archived') {
    throw new DocumentContentBlockError(
      'content_block_already_archived',
      `content block is already archived: ${params.contentBlockId}`
    );
  }

  const now = nowIso();
  const next: DocumentContentBlockTemplate = {
    ...target,
    status: 'archived',
    archivedBy: params.userId,
    archivedAt: now,
    updatedAt: now,
  };
  registryStore.set(libraryKey(params.organizationId, next.contentBlockId), next);
  void persistContentBlock(next).catch(() => undefined);

  recordMutation(next, 'content_block_archived', params.userId, {
    reason: params.reason?.trim() || undefined,
    fromStatus: target.status,
  });

  return clone(next);
}

// =============================================================================
// Reads
// =============================================================================

export function getDocumentContentBlock(
  contentBlockId: string,
  organizationId: string
): DocumentContentBlockTemplate | null {
  if (!contentBlockId || !organizationId) return null;
  const template = registryStore.get(libraryKey(organizationId, contentBlockId));
  return template ? clone(template) : null;
}

export interface ListDocumentContentBlocksOptions {
  status?: DocumentContentBlockStatus;
  /** When true (default false), include archived templates. */
  includeArchived?: boolean;
  /** Filter by intended document type (matches when entry has empty documentTypes or contains the key). */
  documentType?: DocumentTypeKey;
  /** Filter by language ('all' templates always match). */
  language?: 'pl' | 'en';
  /** Match if any tag is in the entry's tag list (case-insensitive). */
  anyTag?: string[];
}

export function listDocumentContentBlocks(
  organizationId: string,
  options: ListDocumentContentBlocksOptions = {}
): DocumentContentBlockTemplate[] {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentContentBlockTemplate[] = [];
  const lowercasedTagFilter = options.anyTag
    ? options.anyTag.map((t) => t.toLowerCase())
    : undefined;
  for (const [k, template] of registryStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    if (options.status && template.status !== options.status) continue;
    if (!options.includeArchived && !options.status && template.status === 'archived') continue;
    if (
      options.documentType &&
      template.documentTypes.length > 0 &&
      !template.documentTypes.includes(options.documentType)
    ) {
      continue;
    }
    if (
      options.language &&
      template.languageScope !== 'all' &&
      template.languageScope !== options.language
    ) {
      continue;
    }
    if (lowercasedTagFilter && lowercasedTagFilter.length > 0) {
      const tagSet = new Set(template.tags.map((t) => t.toLowerCase()));
      if (!lowercasedTagFilter.some((tag) => tagSet.has(tag))) continue;
    }
    out.push(clone(template));
  }
  return out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export function listDocumentContentBlockAuditEntries(
  contentBlockId: string,
  organizationId: string
): DocumentContentBlockAuditEntry[] {
  if (!contentBlockId || !organizationId) return [];
  const entries = auditStore.get(libraryKey(organizationId, contentBlockId));
  return entries
    ? entries.map((entry) => ({
        ...entry,
        details: entry.details ? { ...entry.details } : undefined,
      }))
    : [];
}

// =============================================================================
// Insert helper
// =============================================================================

export interface InstantiateContentBlockParams {
  organizationId: string;
  contentBlockId: string;
  /** Optional explicit blockId — if omitted, a fresh id is allocated. */
  blockId?: string;
}

export interface InstantiateContentBlockResult {
  block: DocumentBlock;
  template: DocumentContentBlockTemplate;
}

/**
 * Materialize a library entry into a fresh `DocumentBlock` ready to be
 * pushed onto a `DocumentSection.blocks` array. Allocates a new
 * `blockId` (or accepts an explicit override) and deep-clones the
 * payload so two consecutive insertions never share underlying state.
 *
 * Refuses to instantiate archived entries — archived snippets stay
 * queryable for audit but cannot ship into new documents. Active +
 * draft entries are both eligible (consultants want to preview a draft
 * snippet before activating it).
 */
export function instantiateDocumentContentBlock(
  params: InstantiateContentBlockParams
): InstantiateContentBlockResult {
  if (!params.organizationId) {
    throw new DocumentContentBlockError('invalid_input', 'organizationId is required');
  }
  if (!params.contentBlockId) {
    throw new DocumentContentBlockError('invalid_input', 'contentBlockId is required');
  }
  const template = registryStore.get(libraryKey(params.organizationId, params.contentBlockId));
  if (!template) {
    throw new DocumentContentBlockError(
      'content_block_not_found',
      `content block not found: ${params.contentBlockId}`
    );
  }
  if (template.status === 'archived') {
    throw new DocumentContentBlockError(
      'content_block_archived',
      `content block is archived and cannot be inserted: ${params.contentBlockId}`
    );
  }

  const payload = JSON.parse(JSON.stringify(template.block)) as Omit<DocumentBlock, 'blockId'>;
  const blockId = params.blockId?.trim() || makeId('block');
  const block: DocumentBlock = { blockId, ...payload };
  return { block, template: clone(template) };
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetContentBlockServiceForTests(): void {
  registryStore.clear();
  auditStore.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}

/** @internal */
export async function __resetContentBlockServiceAndPersistenceForTests(): Promise<void> {
  __resetContentBlockServiceForTests();
  await __resetContentBlockRegistryDaoForTests();
}

/** @internal */
export async function __loadContentBlockByIdForTests(
  contentBlockId: string,
  organizationId: string
): Promise<DocumentContentBlockTemplate | null> {
  return loadContentBlockById(contentBlockId, organizationId);
}
