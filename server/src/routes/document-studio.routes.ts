/**
 * Consultify Document Studio — Routes.
 *
 * Mode 1 / Mode 3 generation:
 *   POST /api/document-studio/plan
 *     Body: { intake, useLlm? }
 *     Returns: { outline, llmRefined? }
 *
 *   POST /api/document-studio/generate
 *     Body: { intake, outline?, sourceRefs?, projectId?, useLlm?, templateId? }
 *     Returns: { artifactId, schema }
 *
 *   GET /api/document-studio/:artifactId
 *     Returns: { schema }
 *
 *   PUT /api/document-studio/:artifactId/content
 *     P0 fix — manual (non-AI) TipTap editor autosave. Content-only save;
 *     never touches the proposal/approve pipeline.
 *     Body: { sections, expectedVersion }
 *     Returns: { schema }
 *     Errors: 409 manual_save_conflict (optimistic-lock, mirrors
 *             PUT /api/v8/notebook/pages/:noteId/content) with
 *             { conflict: { yourVersion, serverVersion } }.
 *
 *   GET /api/document-studio/:artifactId/export/:format
 *     Query: qaOverride=true to bypass the QA soft-block (audited; requires
 *            a privileged role per `canOverrideQa`).
 *     Returns: export payload (markdown / docx / pdf).
 *     Errors: 403 qa_blocking when an approval-gated document type has any
 *             blocking QA category and qaOverride was not set.
 *             403 qa_override_unauthorized when qaOverride was set but the
 *             actor's role is not authorized.
 *
 *   GET /api/document-studio/policy
 *     Returns: { policy: { canOverrideQa: boolean, role: string|null } }
 *
 * Mode 2 — Document Template Architect (MVP-2):
 *   GET  /api/document-studio/templates
 *     Query: status?, documentType?
 *     Returns: { templates: DocumentTemplate[] }
 *
 *   POST /api/document-studio/templates/plan
 *     Body: { input: TemplateDraftInput }
 *     Returns: { template: DocumentTemplate }
 *
 *   POST /api/document-studio/templates/from-artifact/:artifactId
 *     CLONE — save an existing native-artifact document as a new draft
 *     template (clone → edit → save-as-new). Body: { name?, notes? }
 *     Returns: { template: DocumentTemplate } (201). 404 document_not_found.
 *
 *   GET  /api/document-studio/templates/:templateId
 *     Returns: { template }
 *
 *   POST /api/document-studio/templates/:templateId/approve
 *     Body: { notes? }
 *     Returns: { template }
 *
 *   POST /api/document-studio/templates/:templateId/deprecate
 *     Body: { reason? }
 *     Returns: { template }
 *
 *   PATCH /api/document-studio/templates/:templateId/structure
 *     Body: { sections: TemplateSectionBlueprint[] }  (draft-only, author edit)
 *     Returns: { template }
 *
 *   GET  /api/document-studio/templates/:templateId/audit
 *     Returns: { auditEntries }
 *
 * QA Engine — MVP-3 hardening:
 *   GET  /api/document-studio/:artifactId/qa
 *     Returns: { report: DocumentQaReport } (10/10 QA categories)
 *
 * Source Pack registry — Epic E4:
 *   POST   /api/document-studio/source-packs                       — draft a pack
 *   GET    /api/document-studio/source-packs                       — list packs (status?, language?, includeArchived?)
 *   GET    /api/document-studio/source-packs/:packId               — get pack
 *   GET    /api/document-studio/source-packs/:packId/audit         — list audit
 *   POST   /api/document-studio/source-packs/:packId/items         — ingest via { connector, input }
 *                                                                    connectors: text | url | file | v8_artifact | integration
 *   DELETE /api/document-studio/source-packs/:packId/items/:itemId — remove an item
 *   POST   /api/document-studio/source-packs/:packId/ready         — mark ready
 *   POST   /api/document-studio/source-packs/:packId/archive       — irreversible archive
 *   POST   /api/document-studio/source-packs/:packId/attach        — attach to document, returns { pack, sourceRefs }
 *
 * Document Lifecycle — Epic E5:
 *   GET    /api/document-studio/:artifactId/lifecycle                              — current status + history
 *   POST   /api/document-studio/:artifactId/status                                 — body: { to, reason? }; transitions per matrix
 *                                                                                     409 invalid_transition / 400 unknown_status / 404 unknown_artifact
 *   GET    /api/document-studio/:artifactId/snapshots                              — list snapshots (versionNumber asc)
 *   POST   /api/document-studio/:artifactId/snapshots                              — body: { label?, reason? }; capture current schema
 *                                                                                     201 with { snapshot }; 404 document_not_found
 *   GET    /api/document-studio/:artifactId/snapshots/:versionId                   — get a specific snapshot
 *   POST   /api/document-studio/:artifactId/snapshots/:versionId/rollback          — body: { reason? }; restore snapshot, capture
 *                                                                                     rollback_revert, force lifecycle to draft.
 *                                                                                     Returns { schema, revertSnapshot, restoredFrom, lifecycle }
 *
 * Comments + review mode — Epic E6:
 *   GET    /api/document-studio/:artifactId/comments                               — flat list (status?, sectionId?, blockId?, hideDeleted?)
 *   POST   /api/document-studio/:artifactId/comments                               — body: { body, anchor: { kind, sectionId?, blockId? } }
 *                                                                                     201 with { comment }
 *   GET    /api/document-studio/:artifactId/comments/threads                       — grouped view (status?, sectionId?, blockId?)
 *   GET    /api/document-studio/:artifactId/comments/counts                        — totals + per-section / per-block buckets
 *   GET    /api/document-studio/:artifactId/comments/:commentId                    — single comment
 *   POST   /api/document-studio/:artifactId/comments/:commentId/reply              — body: { body }
 *   POST   /api/document-studio/:artifactId/comments/:commentId/resolve            — body: { reason? }; thread-wide
 *   POST   /api/document-studio/:artifactId/comments/:commentId/reopen             — body: { reason? }; thread-wide
 *   DELETE /api/document-studio/:artifactId/comments/:commentId                    — author-only soft-delete
 *
 * Per-tenant Brand Voice profile — Epic E7:
 *   GET    /api/document-studio/brand-voice/active                                — currently active profile or 204 No Content
 *   GET    /api/document-studio/brand-voice/profiles                              — list profiles (status?, includeArchived?)
 *   POST   /api/document-studio/brand-voice/profiles                              — draft a new profile
 *   GET    /api/document-studio/brand-voice/profiles/:profileId                   — single profile
 *   PATCH  /api/document-studio/brand-voice/profiles/:profileId                   — partial update (draft + active only)
 *   POST   /api/document-studio/brand-voice/profiles/:profileId/activate          — promote to active; auto-archives previous active
 *   POST   /api/document-studio/brand-voice/profiles/:profileId/archive           — body: { reason? }; irreversible
 *   GET    /api/document-studio/brand-voice/profiles/:profileId/audit             — list audit entries
 *
 * Audience-driven warianty — Epic E9:
 *   GET    /api/document-studio/audience-profiles                                 — list profiles (status?, includeArchived?, includeSystem?)
 *   POST   /api/document-studio/audience-profiles                                 — draft a new profile (forbidden under 'system' org)
 *   GET    /api/document-studio/audience-profiles/:profileId                      — single profile (tenant + system seeds visible)
 *   PATCH  /api/document-studio/audience-profiles/:profileId                      — partial update (draft + active only; system seeds immutable)
 *   POST   /api/document-studio/audience-profiles/:profileId/activate             — promote to active (multiple actives allowed; system seeds rejected)
 *   POST   /api/document-studio/audience-profiles/:profileId/archive              — body: { reason? }; irreversible (system seeds rejected)
 *   GET    /api/document-studio/audience-profiles/:profileId/audit                — list audit entries
 *   GET    /api/document-studio/:artifactId/variants                              — list candidate variants (active profiles + system seeds) with projection plans
 *   GET    /api/document-studio/:artifactId/variants/:profileId                   — projected DocumentSchema + provenance for a single profile
 *
 * Enterprise Collaboration — Epic E10:
 *   Approval workflow (multi-reviewer, quorum-driven):
 *   GET    /api/document-studio/:artifactId/approvals                             — list approvals (status?)
 *   POST   /api/document-studio/:artifactId/approvals                             — request approval; body: { participants[], quorumPolicy?, reason? }
 *   GET    /api/document-studio/:artifactId/approvals/active                      — current non-terminal approval or 204 No Content
 *   GET    /api/document-studio/:artifactId/approvals/:approvalId                 — single approval
 *   POST   /api/document-studio/:artifactId/approvals/:approvalId/decisions       — record reviewer decision; body: { kind, comment? }
 *                                                                                    (reviewerId is the authenticated user)
 *   POST   /api/document-studio/:artifactId/approvals/:approvalId/cancel          — body: { reason? }; only the requester may cancel
 *   GET    /api/document-studio/:artifactId/approvals/:approvalId/audit           — list audit entries
 *
 *   Reusable Content Block library:
 *   GET    /api/document-studio/content-blocks                                    — list (status?, includeArchived?, documentType?, language?, anyTag?)
 *   POST   /api/document-studio/content-blocks                                    — draft a new entry
 *   GET    /api/document-studio/content-blocks/:contentBlockId                    — single entry
 *   PATCH  /api/document-studio/content-blocks/:contentBlockId                    — partial update (draft + active only)
 *   POST   /api/document-studio/content-blocks/:contentBlockId/activate           — promote to active (multiple actives allowed)
 *   POST   /api/document-studio/content-blocks/:contentBlockId/archive            — body: { reason? }; irreversible
 *   POST   /api/document-studio/content-blocks/:contentBlockId/instantiate        — body: { blockId? }; returns { block, template }
 *   GET    /api/document-studio/content-blocks/:contentBlockId/audit              — list audit entries
 *
 * Share-link surface — Epic E13 (FR-40):
 *   POST   /api/document-studio/:artifactId/share-links                            — body: { accessScope, expiresAt?, label? }; 201 { shareLink }
 *   GET    /api/document-studio/:artifactId/share-links                            — query: status?, includeExpired?; returns links + runtimeStatus
 *   GET    /api/document-studio/share-links/:shareLinkId                           — single link + runtimeStatus
 *   POST   /api/document-studio/share-links/:shareLinkId/revoke                    — body: { reason? }; idempotent
 *   GET    /api/document-studio/share-links/:shareLinkId/audit                     — list audit entries
 *   POST   /api/document-studio/share-links/resolve                                — UNAUTHENTICATED public consume; body: { token, consumerFingerprint? }
 *   POST   /api/document-studio/share-links/document                               — UNAUTHENTICATED; body: { token }; whitelisted read-only DocumentSchema projection (F1/F3 client reader)
 *   POST   /api/document-studio/share-links/comments/list                          — UNAUTHENTICATED; body: { token }; comment/edit scope only; lists existing threads (F1/F3 client reader)
 *   POST   /api/document-studio/share-links/edit-session                           — UNAUTHENTICATED; body: { token, consumerFingerprint }; comment/edit scope only (despite the name — see doc-comment above `ANONYMOUS_SESSION_SCOPES`)
 *   POST   /api/document-studio/share-links/comments                               — UNAUTHENTICATED; body: { token, editSessionToken, consumerFingerprint, body, anchor }
 *   POST   /api/document-studio/share-links/comments/:commentId/reply              — UNAUTHENTICATED; same session contract as above
 *
 * Auth: reuses verifyToken + tenant guards used across artifact routes.
 *       The public share-link consume endpoint is intentionally exempt
 *       and mounts on a separate sub-router (see `documentShareLinkPublicRoutes`).
 */

import { type Request, type Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { getDocumentAccessHistory } from '../services/documentStudio/documentAccessHistoryService.js';
import {
  cancelApproval,
  DocumentApprovalError,
  type DocumentApprovalErrorCode,
  ensureApprovalRegistryHydrated,
  flushApprovalPersistence,
  getActiveApprovalForArtifact,
  getApproval,
  listDocumentApprovalAuditEntries,
  listDocumentApprovals,
  markDocumentApprovalsStaleForVersionChange,
  recordApprovalDecision,
  requestDocumentApproval,
} from '../services/documentStudio/documentApprovalService.js';
import {
  archiveAsset,
  DOCUMENT_ASSET_MAX_BYTES,
  getActiveOrgLogo,
  getAssetById,
  listAssetAudit,
  listAssetsForOrg,
  registerLogo,
} from '../services/documentStudio/documentAssetRegistryService.js';
import {
  activateAudienceProfile,
  archiveAudienceProfile,
  AudienceProfileError,
  type AudienceProfileErrorCode,
  draftAudienceProfile,
  ensureAudienceProfileRegistryHydrated,
  getAudienceProfile,
  listActiveAudienceProfiles,
  listAudienceProfileAuditEntries,
  listAudienceProfiles,
  updateAudienceProfile,
} from '../services/documentStudio/documentAudienceProfileService.js';
import {
  describeAudienceProjectionPlan,
  projectDocumentForAudience,
} from '../services/documentStudio/documentAudienceProjector.js';
import {
  activateBrandVoiceProfile,
  archiveBrandVoiceProfile,
  BrandVoiceProfileError,
  type BrandVoiceProfileErrorCode,
  draftBrandVoiceProfile,
  ensureBrandVoiceRegistryHydrated,
  getActiveBrandVoiceProfile,
  getBrandVoiceProfile,
  listBrandVoiceProfileAuditEntries,
  listBrandVoiceProfiles,
  updateBrandVoiceProfile,
} from '../services/documentStudio/documentBrandVoiceService.js';
import {
  activateDocumentContentBlock,
  archiveDocumentContentBlock,
  DocumentContentBlockError,
  type DocumentContentBlockErrorCode,
  draftDocumentContentBlock,
  ensureContentBlockRegistryHydrated,
  getDocumentContentBlock,
  instantiateDocumentContentBlock,
  listDocumentContentBlockAuditEntries,
  listDocumentContentBlocks,
  updateDocumentContentBlock,
} from '../services/documentStudio/documentContentBlockService.js';
// MAT-010 (Codex final review) — durable DB point-lookups for idempotent
// replay + durability confirmation, used instead of the in-memory
// snapshotStore/registryStore/lifecycleStore getters at those specific
// call sites (see the checkpoint/restore/share_minted routes below).
import { loadSchemaOverlay } from '../services/documentStudio/documentEditorStateRegistryDao.js';
import { loadLifecycleStateForArtifact } from '../services/documentStudio/documentLifecycleRegistryDao.js';
import {
  applyOrgContextGrounding,
  buildOrgContextSourcePack,
} from '../services/documentStudio/documentOrgContextSourcePack.js';
import {
  computeDocumentSchemaDiff,
  summarizeDocumentSchemaDiff,
} from '../services/documentStudio/documentSchemaDiffService.js';
import { loadShareLinkById } from '../services/documentStudio/documentShareLinkRegistryDao.js';
import {
  authorizeShareLinkEditSession,
  consumeShareLink,
  createShareLinkDurable,
  createShareLinkEditSession,
  ensureShareLinkRegistryHydrated,
  getShareLink,
  getShareLinkRuntimeStatus,
  listShareLinkAuditEntries,
  listShareLinks,
  revokeShareLinkDurable,
  rotateShareLinkTokenDurable,
} from '../services/documentStudio/documentShareLinkService.js';
import {
  ingestFileSource,
  ingestIntegrationSource,
  ingestRawTextSource,
  ingestUrlSource,
  ingestV8ArtifactSource,
  SourcePackConnectorError,
} from '../services/documentStudio/documentSourcePackConnectors.js';
import {
  addSourcePackItem,
  archiveSourcePack,
  attachSourcePackToDocument,
  draftSourcePack,
  ensureSourcePackRegistryHydrated,
  getSourcePack,
  listSourcePackAuditEntries,
  listSourcePacks,
  markSourcePackReady,
  removeSourcePackItem,
} from '../services/documentStudio/documentSourcePackService.js';
import {
  approveEditProposal,
  canOverrideQa,
  createDocumentComment,
  createDocumentSnapshot,
  createGlobalEditProposal,
  createLocalEditProposal,
  createMethodologyEditProposal,
  createSectionEditProposal,
  createSourceEditProposal,
  createTransformativeEditProposal,
  deleteDocumentComment,
  DocumentCheckpointVersionConflictError,
  DocumentCommentError,
  DocumentContentBlockInsertError,
  DocumentLifecycleTransitionError,
  DocumentManualSaveConflictError,
  DocumentManualSaveNotFoundError,
  DocumentManualStructureMismatchError,
  DocumentRollbackError,
  DocumentRollbackVersionConflictError,
  ensureDocumentCommentsHydrated,
  ensureDocumentLifecycleHydrated,
  ensureDocumentVersionSnapshotsHydrated,
  exportDocumentArtifact,
  getDocumentArtifact,
  getDocumentComment,
  getDocumentCommentSectionCounts,
  getDocumentGenerationWarnings,
  getDocumentLifecycleState,
  getDocumentVersionLineage,
  getDocumentVersionSnapshot,
  insertDocumentContentBlock,
  listDocumentAuditEntriesAsync,
  listDocumentComments,
  listDocumentCommentThreads,
  listDocumentVersionSnapshots,
  materializeDocumentArtifact,
  MissingRequiredSourceError,
  planDocument,
  planDocumentAsync,
  QaBlockingError,
  QaOverrideUnauthorizedError,
  rejectEditProposal,
  reopenDocumentComment,
  replyToDocumentComment,
  resolveDocumentComment,
  rollbackDocumentToVersion,
  runQaForDocument,
  transitionDocumentStatus,
  updateDocumentManualContent,
} from '../services/documentStudio/documentStudioService.js';
import type {
  AudienceProfileAppendixPolicy,
  AudienceProfileExecutiveSummaryPolicy,
  AudienceProfileJargonPolicy,
  AudienceProfileStatus,
  AudienceProfileTagFilter,
  BrandVoiceGlossaryEntry,
  BrandVoiceProfileLanguageScope,
  BrandVoiceProfileStatus,
  CommunicationRegister,
  DocumentApprovalDecisionKind,
  DocumentApprovalParticipant,
  DocumentApprovalQuorumPolicy,
  DocumentApprovalStatus,
  DocumentBlock,
  DocumentCommentAnchor,
  DocumentCommentStatus,
  DocumentContentBlockStatus,
  DocumentDensity,
  DocumentEditorProposalInput,
  DocumentIntake,
  DocumentLanguageStyle,
  DocumentOutline,
  DocumentSchema,
  DocumentShareLinkAccessScope,
  DocumentShareLinkStatus,
  DocumentSourceRef,
  DocumentStatus,
  DocumentTypeKey,
  SourcePackStatus,
  TemplateDraftInput,
} from '../services/documentStudio/documentStudioTypes.js';
import {
  approveTemplate,
  cloneTemplateAsDraft,
  createTemplateFromArtifact,
  deleteDraftTemplate,
  deprecateTemplate,
  draftTemplate,
  draftTemplateAsync,
  ensureTemplateRegistryHydrated,
  getTemplate,
  listTemplateAuditEntries,
  listTemplates,
  recordTemplateFeedback,
  recordTemplateUsage,
  restoreTemplateAuditSnapshotAsDraft,
  reviseTemplateStructureDurably,
  validateTemplate,
} from '../services/documentStudio/documentTemplateService.js';
import { loadSnapshotById } from '../services/documentStudio/documentVersionSnapshotRegistryDao.js';
// MAT-010 — canonical artifact lineage (fail-open hooks only).
import {
  deriveCreatedEventIdempotencyKey,
  deriveRequestBoundIdempotencyKey,
  recordLineageEventSafe,
  recordLineageEventTracked,
} from '../services/lineage/artifactLineageService.js';
// MAT-010 (round-5 redesign) — the dedicated operation-claim mechanism,
// structurally separate from the lineage outbox above. See
// `operationClaimService.ts`'s own doc comment for the full state machine.
import {
  acquireOrReclaimOperationClaim,
  finalizeOperationClaim,
  startClaimHeartbeat,
} from '../services/lineage/operationClaimService.js';
import {
  isTemplateResolveError,
  resolveDocumentTemplateForCreation,
  type TemplateResolveErrorCode,
} from '../services/materials/creationIntent.js';
import { removeTemplateArtifactByOrigin } from '../services/v8/artifactRegistryService.js';
import * as artifactRegistryService from '../services/v8/artifactRegistryService.js';
import * as reportsPresModelService from '../services/v8/reportsPresModelService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { evaluateArtifactExportPolicy } from '../services/artifactExportPolicy.js';
import logger from '../utils/Logger.js';
import { retryWithBackoff } from '../utils/retryWithBackoff.js';

const router = Router();

/**
 * Generic client-facing message for unexpected 5xx failures.
 *
 * INFO-DISCLOSURE guard: handlers MUST NOT echo raw `err.message` / `String(err)`
 * (which can carry DB-driver text, file paths, or internal structure) in 5xx
 * response bodies. The real error is logged server-side; the client receives this
 * stable, opaque message plus the handler's stable `error` code. Field-level 4xx
 * validation messages and typed domain-error codes (e.g. DocumentCommentError.code)
 * are intentionally preserved.
 */
const GENERIC_5XX_MESSAGE = 'An unexpected error occurred. Please try again later.';

/**
 * Shape check for internal service "domain codes" thrown as `Error(message)`
 * (e.g. `template_not_found`, `share_link_scope_forbidden`) — the deliberate,
 * bounded control-flow convention used across `documentStudio/*Service.ts`.
 *
 * Several handlers below pass `err.message` straight into the JSON body when
 * it doesn't match one of a handful of explicitly-checked codes. Without this
 * guard an unexpected exception (LLM SDK failure, DB-driver error, a bug)
 * would leak its raw free-text message to the client (H6.4 500-leak sweep,
 * fala 3). A lowercase snake_case code never contains that free text — real
 * exception messages have spaces/punctuation/uppercase — so this is a safe,
 * future-proof allowlist-by-shape rather than an exhaustive code enumeration.
 */
function isSafeErrorCode(message: string): boolean {
  return /^[a-z][a-z0-9_]{0,63}$/.test(message);
}

/**
 * MAT-010 (Codex review, second round) — the closing half of the durability
 * fix, mirroring `workbook.routes.ts`'s helper of the same name.
 * `recordLineageEventTracked` tells the truth about whether an event's
 * intent survived ANYWHERE (direct write or the durable pending/outbox
 * fallback). When it did not — a genuine double failure — the calling route
 * must not report unconditional success (the business mutation already
 * committed and is NOT rolled back; only the HTTP response is honest about
 * the audit trail). Returns `true` when the caller should send this 500 and
 * stop; `false` when the caller should proceed with its normal response.
 *
 * Client-retry safety after this 500 is verified per event type at each call
 * site's own comment, not assumed uniformly — see
 * `recordLineageEventTracked`'s doc comment in artifactLineageService.ts for
 * the general reasoning. Unlike Workbook, this file's `checkpoint` and
 * `restore` sites do NOT have a version/CAS guard on the underlying mutation
 * (verified against `documentStudioService.ts`: `createDocumentSnapshot` and
 * `rollbackDocumentToVersion` both apply unconditionally, no
 * `expectedVersion` check) — those two call sites' own comments say so
 * plainly rather than borrowing Workbook's CAS story.
 */
function respondIfLineageLost(
  res: import('express').Response,
  outcome: { durable: boolean }
): boolean {
  if (outcome.durable) return false;
  res.status(500).json({
    success: false,
    error: 'Lineage could not be durably recorded for this operation',
    code: 'LINEAGE_RECOVERY_REQUIRED',
  });
  return true;
}

/**
 * The narrow, honest residual of lease-based claim fencing: this caller's
 * lease expired WHILE its mutation was still genuinely running (not
 * crashed, just slower than the lease), a different caller already
 * reclaimed the operation claim, and `finalizeOperationClaim`'s token+
 * fencing-token CAS correctly refused to transition the claim under this
 * caller's now-stale credentials (see `operationClaimService.ts`'s state
 * machine — this is the `{outcome:'fenced'}` case). This process already
 * ran the business mutation — that cannot be undone — but it is no longer
 * the authority on the canonical result, so it must NOT report its own
 * outcome as success, and must NOT write a lineage event for it either. The
 * client is told to retry: a retry's `acquireOrReclaimOperationClaim` fast
 * path will find the claim already `completed` (by whichever caller DID win
 * the reclaim and finalize) and replay that canonical result.
 */
function respondIfClaimFenced(
  res: import('express').Response,
  outcome: { outcome: 'finalized' | 'fenced' | 'failed' }
): boolean {
  if (outcome.outcome !== 'fenced') return false;
  res.status(409).json({
    success: false,
    error: 'This operation was reclaimed by another request before it could be finalized; retry',
    code: 'IDEMPOTENCY_STALE_CLAIM',
  });
  return true;
}

/**
 * Codex final review, Blocker 2 (restart recovery) — checkpoint, restore,
 * and share_minted each write their business-mutation side effect through a
 * synchronous, frozen service function that persists to Postgres
 * fire-and-forget (`void persistX(...).catch(() => undefined)`), because
 * changing those functions to `async`/awaited would ripple into ~27
 * unrelated pre-existing unit tests across three files that call them
 * synchronously today — rebuilding that contract is explicitly out of this
 * package's authorization. Instead, THIS polls the read side (existing DAO
 * point-lookups, already tenant-scoped) until the write is confirmed
 * present, bounded by a short timeout. Only engaged for idempotency-tracked
 * requests — a caller with no `Idempotency-Key` gets the exact pre-existing
 * fire-and-forget behavior, unchanged.
 */
async function pollForDurability<T>(
  read: () => Promise<T | null>,
  timeoutMs = 8000,
  intervalMs = 50
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await read();
    if (found) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_ASSET_MAX_BYTES },
});

function logoUploadSingleMiddleware(
  req: Request,
  res: Response,
  next: (err?: unknown) => void
): void {
  logoUpload.single('file')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'asset_too_large' });
      return;
    }
    res.status(400).json({ error: 'asset_invalid_upload' });
  });
}

router.use(verifyToken);
router.use(requireOrgAccess());

function getAuthContext(req: AuthRequest): {
  userId: string;
  organizationId: string;
  userRole: string;
} {
  const userId = String((req as any)?.user?.id || (req as any)?.userId || '');
  const organizationId = String(
    (req as any)?.user?.organizationId || (req as any)?.organizationId || ''
  );
  const userRole = String((req as any)?.userRole || (req as any)?.user?.role || '');
  return { userId, organizationId, userRole };
}

router.post(
  '/plan',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuthContext(req as AuthRequest);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const intake = (req.body?.intake ?? null) as DocumentIntake | null;
    if (!intake || typeof intake !== 'object') {
      res.status(400).json({ error: 'intake is required' });
      return;
    }
    const useLlm = req.body?.useLlm === true;
    try {
      const result = useLlm
        ? await planDocumentAsync({ intake, useLlm: true })
        : planDocument({ intake });
      res.json({ outline: result.outline, llmRefined: useLlm });
    } catch (err) {
      logger.error('[DocumentStudio] plan failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      const rawMessage = err instanceof Error ? err.message : String(err);
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'Failed to plan document outline';
      res.status(400).json({
        error: 'plan_failed',
        message,
      });
    }
  })
);

/**
 * Shared payload shape parsed from a generate / generate-stream request body.
 * Keeps the sync `/generate` route and the streaming `/generate/stream` route
 * byte-identical in how they interpret the input, so `done.schema` on the
 * stream matches the `schema` returned by the sync path for the same input.
 */
interface ParsedGenerateRequest {
  intake: DocumentIntake;
  outline: DocumentOutline | undefined;
  sourceRefs: DocumentSourceRef[];
  projectId: string | null;
  useLlm: boolean;
  templateId: string | null;
  templateVersion: string | null;
}

/** Parse & validate a generate request body. Returns `null` when intake is missing. */
function parseGenerateRequest(body: unknown): ParsedGenerateRequest | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const intake = (b.intake ?? null) as DocumentIntake | null;
  if (!intake || typeof intake !== 'object') return null;
  return {
    intake,
    outline: (b.outline ?? undefined) as DocumentOutline | undefined,
    sourceRefs: Array.isArray(b.sourceRefs) ? (b.sourceRefs as DocumentSourceRef[]) : [],
    projectId:
      typeof b.projectId === 'string' && b.projectId.length > 0 ? (b.projectId as string) : null,
    useLlm: b.useLlm === true,
    templateId:
      typeof b.templateId === 'string' && (b.templateId as string).trim().length > 0
        ? (b.templateId as string)
        : null,
    templateVersion:
      typeof b.templateVersion === 'string' && (b.templateVersion as string).trim().length > 0
        ? (b.templateVersion as string)
        : null,
  };
}

/**
 * P0 URODZINOWE (2026-07-27) — auto-ground a generate request in the calling
 * organization's context when the caller (frontend) supplied NO sourceRefs
 * at all. Today `DocumentStudioIntakeForm.tsx` never sends any, so every
 * document was generated with zero organizational grounding — tripping the
 * Sources QA gate (`documentQaService.runSourceQa`) and shipping generic
 * content with no facts about the org.
 *
 * Deliberately minimal (see `documentOrgContextSourcePack.ts` for full
 * rationale + explicitly deferred scope): builds one synthetic source ref
 * (org name + active projects/initiatives) and prepends a short PL summary
 * to `intake.description` so both the deterministic and premium/LLM content
 * paths actually see the facts (not just a metadata pointer nothing reads —
 * see the module doc for why `sourcePackId` alone does not achieve this).
 *
 * Fail-open: any lookup failure or empty-org result returns the request
 * UNCHANGED — brand-new organizations with no data yet see zero regression.
 * An explicit, curator-picked `sourceRefs` from the caller always wins and
 * is never silently mixed with the auto-built one.
 */
async function autoGroundGenerateRequest(
  organizationId: string,
  intake: DocumentIntake,
  sourceRefs: DocumentSourceRef[]
): Promise<{ intake: DocumentIntake; sourceRefs: DocumentSourceRef[] }> {
  if (sourceRefs.length > 0) return { intake, sourceRefs };
  try {
    const pack = await buildOrgContextSourcePack(organizationId);
    const grounded = applyOrgContextGrounding(intake, sourceRefs, pack);
    if (grounded.autoGrounded) {
      logger.debug('[DocumentStudio] auto-grounded generate request from org context', {
        organizationId,
        sourceRef: grounded.sourceRefs[0]?.sourceId,
      });
    }
    return { intake: grounded.intake, sourceRefs: grounded.sourceRefs };
  } catch (err) {
    logger.warn('[DocumentStudio] auto-grounding failed (fail-open, no regression)', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { intake, sourceRefs };
  }
}

/**
 * G5 + X6 — register a freshly materialized document in the Outputs registry.
 * Shared by the sync `/generate` and streaming `/generate/stream` routes so
 * both surface the document in the Outputs Library identically. Best-effort:
 * a registration failure never fails generation (the document itself is
 * already durably saved by the time this runs) — but see the fala
 * sprzątania 1b hardening below, which used to be a single unretried
 * attempt logged at `warn` with no `artifactId` in the structured fields,
 * i.e. a document could materialize and never appear in the Outputs Library
 * with no findable trace (rejestr: "dokument może powstać i nigdy nie
 * pojawić się w bibliotece").
 *
 * Hardening (2026-07-27):
 *   (a) each registration call gets 3 in-process attempts with linear
 *       backoff (`retryWithBackoff`) — both calls are idempotent
 *       (`registerArtifactOrigin` / `registerOutputArtifactTransactional`
 *       look up the existing origin link before inserting), so retrying is
 *       always safe;
 *   (b) if all attempts are exhausted, log at `error` (not `warn`) WITH
 *       `artifactId` so the failure is actually findable/alertable;
 *   (c) `backfillNativeArtifactsForOrg` (artifactRegistryService.ts) is the
 *       lazy reconciliation safety net for whatever still slips through —
 *       retry only shrinks the failure window, it doesn't replace the net.
 */
function registerGeneratedDocumentOrigin(args: {
  organizationId: string;
  userId: string;
  artifactId: string;
  title: string;
  projectId: string | null;
  templateId: string | null;
}): void {
  const { organizationId, userId, artifactId, title, projectId, templateId } = args;

  // MAT-010 lineage hook (fail-open) — head of the lineage chain for documents.
  // `artifactId` here is the `wave5_artifacts` row id, i.e. exactly the
  // `origin_record_id` the registration below uses, so both point at the same
  // record. Fire-and-forget to match this function's existing `void` posture:
  // it is deliberately synchronous-looking and must not delay the response.
  // `recordLineageEventSafe` never throws, so no unhandled rejection is
  // possible, but `.catch` is kept explicit for the reader.
  void recordLineageEventSafe({
    organizationId,
    artifactKind: 'document',
    sourceRecordId: artifactId,
    eventType: 'created',
    actorUserId: userId,
    titleSnapshot: title,
    idempotencyKey: deriveCreatedEventIdempotencyKey({
      artifactKind: 'document',
      sourceRecordId: artifactId,
    }),
    sourceContext: {
      sourceType: 'document_studio',
      projectId: projectId ?? null,
      templateId: templateId ? String(templateId) : null,
    },
  }).catch(() => null);

  // G5 — canonical origin registration (Outputs Library).
  void retryWithBackoff(
    () =>
      artifactRegistryService.registerArtifactOrigin({
        organizationId,
        outputType: 'report',
        artifactFamily: 'document',
        originRuntime: 'native_artifact',
        originRecordId: artifactId,
        titleSnapshot: title,
        ownerUserId: userId,
        createdBy: userId,
        visibilityScope: undefined,
        projectId,
        originSummary: {
          sourceType: 'document_studio',
          templateId: templateId ? String(templateId) : null,
          sourceTable: 'document_studio_artifacts',
        },
      }),
    {
      onAttemptFailed: (attempt, attempts, err) => {
        logger.warn('[DocumentStudio] Outputs registration attempt failed (will retry)', {
          artifactId,
          organizationId,
          attempt,
          attempts,
          message: err instanceof Error ? err.message : String(err),
        });
      },
    }
  ).catch((regErr: unknown) => {
    logger.error(
      '[DocumentStudio] Outputs registration permanently failed after retries — document saved but not indexed in Outputs Library until the next reconciliation pass',
      {
        artifactId,
        organizationId,
        message: regErr instanceof Error ? regErr.message : String(regErr),
      }
    );
  });

  // X6 — W5 Transactional Outputs Registry (v8_output_artifacts + origin links).
  void retryWithBackoff(
    () =>
      import('../services/v8/outputsTransactionalRegistry.js').then(
        ({ registerOutputArtifactTransactional }) =>
          registerOutputArtifactTransactional({
            organizationId,
            outputType: 'report',
            artifactFamily: 'document',
            originRuntime: 'native_artifact',
            originRecordId: artifactId,
            titleSnapshot: title,
            ownerUserId: userId,
            createdBy: userId,
            projectId,
            originSummary: {
              sourceType: 'document_studio',
              templateId: templateId ? String(templateId) : null,
              sourceTable: 'document_studio_artifacts',
            },
          })
      ),
    {
      onAttemptFailed: (attempt, attempts, err) => {
        logger.warn('[DocumentStudio] X6 transactional registration attempt failed (will retry)', {
          artifactId,
          organizationId,
          attempt,
          attempts,
          message: err instanceof Error ? err.message : String(err),
        });
      },
    }
  ).catch((x6Err: unknown) => {
    logger.error(
      '[DocumentStudio] X6 transactional registration permanently failed after retries (non-blocking)',
      {
        artifactId,
        organizationId,
        message: x6Err instanceof Error ? x6Err.message : String(x6Err),
      }
    );
  });
}

router.post(
  '/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = parseGenerateRequest(req.body);
    if (!parsed) {
      res.status(400).json({ error: 'intake is required' });
      return;
    }
    const { outline, projectId, useLlm, templateId, templateVersion } = parsed;
    const { intake, sourceRefs } = await autoGroundGenerateRequest(
      organizationId,
      parsed.intake,
      parsed.sourceRefs
    );

    try {
      const result = await materializeDocumentArtifact({
        organizationId,
        userId,
        intake,
        outline,
        sourceRefs,
        projectId,
        useLlm,
        templateId,
        templateVersion,
      });

      registerGeneratedDocumentOrigin({
        organizationId,
        userId,
        artifactId: String(result.artifactId),
        title: String(result.schema?.title || intake.title || 'Untitled document'),
        projectId,
        templateId,
      });

      res.json({
        artifactId: result.artifactId,
        schema: result.schema,
        // A4 — surface any generation-time warnings (e.g. LLM prose
        // fallback) so the FE can show the "generated with limitations"
        // chip. Absent / empty for full-fidelity documents.
        generationWarnings: result.generationWarnings ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate document artifact';
      logger.error('[DocumentStudio] generate failed', { message });
      if (err instanceof MissingRequiredSourceError) {
        res.status(400).json({
          error: 'missing_required_source',
          message,
          missing: err.missing,
        });
        return;
      }
      const templateError =
        message === 'template_not_usable' || message === 'template_version_mismatch';
      const status = templateError ? 400 : 500;
      res.status(status).json({
        error: templateError ? message : 'generate_failed',
        message: status === 400 ? message : GENERIC_5XX_MESSAGE,
      });
    }
  })
);

// =============================================================================
// C1 — Streaming generation (SSE).
//
//   POST /api/document-studio/generate/stream
//     Body: identical to POST /generate.
//     Content-Type: text/event-stream
//     Events (each `event:` + `data:` JSON):
//       plan     { outline }                                — after outline resolved
//       section  { sectionId, index, total, title, blocks } — per finalized section
//       warning  DocumentGenerationWarning                  — on any soft-fallback
//       done     { artifactId, schema, generationWarnings } — after persistence
//       error    { code, message }                          — fatal; stream closes
//     Heartbeat: `:\n\n` comment every ~15s to defeat proxy idle timeouts.
//
// The `done.schema` is guaranteed byte-identical to what the sync `/generate`
// route would return for the same input, because both delegate to the SAME
// `materializeDocumentArtifact` pipeline — streaming only adds pure observer
// hooks that never influence the result. The existing sync `/generate` route
// is untouched (chat `generate_deliverable` depends on it).
// =============================================================================

/** Serialize a single SSE frame (`event:` + `data:`). */
function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

router.post(
  '/generate/stream',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = parseGenerateRequest(req.body);
    if (!parsed) {
      res.status(400).json({ error: 'intake is required' });
      return;
    }
    const { outline, projectId, useLlm, templateId, templateVersion } = parsed;
    const { intake, sourceRefs } = await autoGroundGenerateRequest(
      organizationId,
      parsed.intake,
      parsed.sourceRefs
    );

    // Long-running SSE: raise socket timeout + disable Nagle so events flush
    // in real time (mirrors ai.routes streaming setup).
    if (req.socket) {
      req.socket.setTimeout(120_000);
      req.socket.setNoDelay(true);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering for SSE
    res.flushHeaders();

    let clientConnected = true;
    let finished = false;
    req.on('close', () => {
      clientConnected = false;
    });

    const write = (chunk: string): void => {
      if (!clientConnected) return;
      try {
        res.write(chunk);
      } catch {
        clientConnected = false;
      }
    };

    // Heartbeat: SSE comment every 15s so proxies / ALB don't kill an idle
    // connection while prose generation runs.
    const heartbeat = setInterval(() => {
      if (!clientConnected || finished) {
        clearInterval(heartbeat);
        return;
      }
      write(':\n\n');
    }, 15_000);

    const closeStream = (): void => {
      finished = true;
      clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        /* connection already gone */
      }
    };

    try {
      const result = await materializeDocumentArtifact({
        organizationId,
        userId,
        intake,
        outline,
        sourceRefs,
        projectId,
        useLlm,
        templateId,
        templateVersion,
        hooks: {
          onPlan: (resolvedOutline) => {
            write(sseFrame('plan', { outline: resolvedOutline }));
          },
          onSection: (section, index, total) => {
            write(
              sseFrame('section', {
                sectionId: section.sectionId,
                index,
                total,
                title: section.title,
                blocks: section.blocks,
              })
            );
          },
          onWarning: (warning) => {
            write(sseFrame('warning', warning));
          },
        },
      });

      registerGeneratedDocumentOrigin({
        organizationId,
        userId,
        artifactId: String(result.artifactId),
        title: String(result.schema?.title || intake.title || 'Untitled document'),
        projectId,
        templateId,
      });

      write(
        sseFrame('done', {
          artifactId: result.artifactId,
          schema: result.schema,
          generationWarnings: result.generationWarnings ?? [],
        })
      );
      closeStream();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate document artifact';
      logger.error('[DocumentStudio] stream generate failed', { message });
      let code = 'generate_failed';
      let clientMessage = GENERIC_5XX_MESSAGE;
      if (err instanceof MissingRequiredSourceError) {
        code = 'missing_required_source';
        clientMessage = message;
      } else if (message === 'template_not_usable') {
        code = 'template_not_usable';
        clientMessage = message;
      } else if (message === 'template_version_mismatch') {
        code = 'template_version_mismatch';
        clientMessage = message;
      }
      // Headers are already flushed (SSE), so a fatal error is delivered as an
      // `error` event rather than an HTTP status code.
      write(sseFrame('error', { code, message: clientMessage }));
      closeStream();
    }
  })
);

// =============================================================================
// MVP-2 — Document Template Architect routes.
// MUST be registered BEFORE the `/:artifactId` GET handler to avoid having
// `/templates` swallowed by the generic artifact-id matcher.
// =============================================================================

router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const documentType =
      typeof req.query.documentType === 'string' ? req.query.documentType : undefined;
    await ensureTemplateRegistryHydrated(organizationId);
    const templates = listTemplates(organizationId, {
      status:
        status === 'draft' || status === 'approved' || status === 'deprecated' ? status : undefined,
      documentType: (documentType as TemplateDraftInput['documentType']) ?? undefined,
    });
    res.json({ templates });
  })
);

router.post(
  '/templates/plan',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const input = (req.body?.input ?? null) as TemplateDraftInput | null;
    if (!input || typeof input !== 'object' || typeof input.purpose !== 'string') {
      res.status(400).json({ error: 'template input is required' });
      return;
    }
    const useLlm = req.body?.useLlm === true;
    try {
      if (useLlm) {
        const result = await draftTemplateAsync({
          organizationId,
          userId,
          input,
          useLlm: true,
        });
        res.json({ template: result.template, llmRefined: result.llmRefined });
        return;
      }
      const result = draftTemplate({ organizationId, userId, input });
      res.json({ template: result.template, llmRefined: false });
    } catch (err) {
      logger.warn('[DocumentStudio] template plan failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      const rawMessage = err instanceof Error ? err.message : 'template_plan_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'template_plan_failed';
      res.status(400).json({ error: 'template_plan_failed', message });
    }
  })
);

/**
 * POST /api/document-studio/templates/from-artifact/:artifactId
 *
 * CLONE mode for Word (Document Studio) — brief §1/§10, "Komplet od razu".
 * Saves an existing native-artifact document as a new draft template
 * (clone → edit → save-as-new), the Document Studio counterpart of
 * Deck's `POST /templates/:id/clone` and the sheet/presentation branches
 * of `POST /api/artifacts/:id/save-as-template`.
 *
 * `save-as-template` was NOT extended to cover this case: Document Studio
 * artifacts carry `originRuntime='native_artifact'` and their schema
 * (sections/blocks) has no equivalent in `report_builder_templates`
 * (the table `save-as-template`'s 'report' branch writes into) — mapping
 * would either misuse that table or require a new
 * `origin_runtime` CHECK-constraint value on `v8_artifact_origin_links`
 * (migration; out of scope here). This dedicated route instead writes
 * through the existing Document Template Architect surface
 * (`document_studio_templates`, already reachable via `templateId` on
 * `POST /document-studio/generate`) — no schema change needed.
 *
 * Body: { name?, notes? }
 * Returns: { template: DocumentTemplate } (201)
 * Errors: 404 document_not_found (source artifact missing/cross-tenant)
 */
/**
 * R1 doc slice (2026-07-24) — SERVER-SIDE template resolution for "Użyj wzorca".
 *
 * The Template Library is an INDEX, not a source of truth. Its rows are keyed
 * by `artifactIndexId` (`v8_artifact_origin_links.artifact_id`). The generator,
 * however, needs the CANONICAL registry id (`document_studio_templates.id`).
 *
 * The client must never bridge that gap itself: a canonical id arriving as a
 * URL parameter would be an unvalidated, client-supplied pointer straight into
 * generation. Instead the client sends only the index id it legitimately has,
 * and THIS route performs the trusted translation via
 * `resolveDocumentTemplateForCreation` — which validates org access, scope,
 * status and that the canonical record still exists (orphan check).
 *
 * The resolved `sectionBlueprint` is deliberately NOT returned: the client has
 * no use for it and Mode 3 re-reads it from the canonical registry at
 * generation time. Only the validated canonical id crosses back.
 *
 * Body: { templateArtifactId: string }
 * Returns 200: { template: { canonicalTemplateId, originRuntime, format,
 *                            scope, status, source, legacy, sectionCount } }
 * Errors: 400 templateArtifactId_required · 401 Unauthorized
 *         404 TEMPLATE_NOT_INDEXED | TEMPLATE_ORPHANED
 *         403 TEMPLATE_FORBIDDEN · 409 TEMPLATE_DEPRECATED
 *         422 TEMPLATE_FORMAT_UNSUPPORTED
 */
const TEMPLATE_RESOLVE_STATUS: Record<TemplateResolveErrorCode, number> = {
  TEMPLATE_NOT_INDEXED: 404,
  TEMPLATE_ORPHANED: 404,
  TEMPLATE_FORBIDDEN: 403,
  TEMPLATE_DEPRECATED: 409,
  TEMPLATE_FORMAT_UNSUPPORTED: 422,
};

router.post(
  '/templates/resolve',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateArtifactId = String(req.body?.templateArtifactId || '').trim();
    if (!templateArtifactId) {
      res.status(400).json({ error: 'templateArtifactId_required' });
      return;
    }

    try {
      const resolved = await resolveDocumentTemplateForCreation(
        { kind: 'library', templateArtifactId },
        { organizationId }
      );
      res.json({
        template: {
          canonicalTemplateId: resolved.canonicalTemplateId,
          originRuntime: resolved.originRuntime,
          format: resolved.format,
          scope: resolved.scope,
          status: resolved.status,
          source: resolved.source,
          legacy: resolved.legacy,
          sectionCount: resolved.sectionBlueprint.length,
        },
      });
    } catch (err) {
      if (isTemplateResolveError(err)) {
        logger.info(
          `[DocumentStudio] template resolve rejected: ${err.code} (artifact ${templateArtifactId})`
        );
        res.status(TEMPLATE_RESOLVE_STATUS[err.code]).json({ error: err.code });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/templates/from-artifact/:artifactId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : undefined;
    // Fala 2 (2026-07-28) — answers to the 3-5 clarifying questions the
    // "Zrób z tego wzorzec" modal asks (see `CreateTemplateFromArtifactModal`
    // client-side, and `CreateTemplateFromArtifactParams` doc comments for
    // why each one can't be deduced mechanically).
    const optionalSectionIds = Array.isArray(req.body?.optionalSectionIds)
      ? req.body.optionalSectionIds.filter((id: unknown) => typeof id === 'string')
      : undefined;
    const dataRefreshHints = Array.isArray(req.body?.dataRefreshHints)
      ? req.body.dataRefreshHints.filter((s: unknown) => typeof s === 'string')
      : undefined;
    const carryColorPattern = req.body?.carryColorPattern === false ? false : true;
    const sensitiveContentNotes =
      typeof req.body?.sensitiveContentNotes === 'string'
        ? req.body.sensitiveContentNotes.trim()
        : undefined;

    await ensureTemplateRegistryHydrated(organizationId);
    try {
      const result = createTemplateFromArtifact({
        organizationId,
        userId,
        schema,
        name: name || undefined,
        notes,
        optionalSectionIds,
        dataRefreshHints,
        carryColorPattern,
        sensitiveContentNotes,
      });
      res.status(201).json({ template: result.template });
    } catch (err) {
      logger.warn('[DocumentStudio] template-from-artifact failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      const rawMessage = err instanceof Error ? err.message : 'template_from_artifact_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'template_from_artifact_failed';
      res.status(400).json({ error: 'template_from_artifact_failed', message });
    }
  })
);

router.get(
  '/templates/:templateId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    await ensureTemplateRegistryHydrated(organizationId);
    const template = getTemplate(templateId, organizationId);
    if (!template) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }
    res.json({ template });
  })
);

router.get(
  '/templates/:templateId/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) return void res.status(401).json({ error: 'Unauthorized' });
    await ensureTemplateRegistryHydrated(organizationId);
    const template = getTemplate(String(req.params.templateId || ''), organizationId);
    if (!template) return void res.status(404).json({ error: 'template_not_found' });
    const issues = validateTemplate(template);
    res.json({ valid: !issues.some((issue) => issue.blocking), issues });
  })
);

router.post(
  '/templates/:templateId/new-version',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) return void res.status(401).json({ error: 'Unauthorized' });
    await ensureTemplateRegistryHydrated(organizationId);
    try {
      const template = cloneTemplateAsDraft({
        templateId: String(req.params.templateId || ''),
        organizationId,
        userId,
      });
      res.status(201).json({ template });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'template_clone_failed';
      res.status(message === 'template_not_found' ? 404 : 400).json({ error: message });
    }
  })
);

router.post(
  '/templates/:templateId/audit/:auditId/restore-as-draft',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) return void res.status(401).json({ error: 'Unauthorized' });
    await ensureTemplateRegistryHydrated(organizationId);
    try {
      const template = restoreTemplateAuditSnapshotAsDraft({
        templateId: String(req.params.templateId || ''),
        auditId: String(req.params.auditId || ''),
        organizationId,
        userId,
      });
      res.status(201).json({ template });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'template_restore_failed';
      const status = message.endsWith('_not_found')
        ? 404
        : message === 'template_snapshot_unavailable'
          ? 409
          : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.delete(
  '/templates/:templateId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, userRole } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) return void res.status(401).json({ error: 'Unauthorized' });
    if (!['admin', 'owner', 'superadmin'].includes(userRole.toLowerCase())) {
      return void res
        .status(403)
        .json({ error: 'Admin or owner role required to delete templates' });
    }
    const templateId = String(req.params.templateId || '');
    await ensureTemplateRegistryHydrated(organizationId);
    try {
      await deleteDraftTemplate({ templateId, organizationId });
      await removeTemplateArtifactByOrigin({
        organizationId,
        originRuntime: 'document_template',
        originRecordId: templateId,
      });
      res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'template_delete_failed';
      const status =
        message === 'template_not_found' ? 404 : message === 'template_not_draft' ? 409 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/templates/:templateId/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, userRole } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!['admin', 'owner', 'superadmin'].includes(userRole.toLowerCase())) {
      res.status(403).json({ error: 'Admin or owner role required to approve templates' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    try {
      const current = getTemplate(templateId, organizationId);
      if (!current) return void res.status(404).json({ error: 'template_not_found' });
      const issues = validateTemplate(current);
      if (issues.some((issue) => issue.blocking)) {
        return void res.status(422).json({ error: 'template_validation_failed', issues });
      }
      const template = approveTemplate({ templateId, organizationId, userId, notes });
      res.json({ template });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'template_approve_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'template_approve_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] template approve failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status =
        message === 'template_not_found' ? 404 : message === 'template_deprecated' ? 409 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/templates/:templateId/deprecate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, userRole } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!['admin', 'owner', 'superadmin'].includes(userRole.toLowerCase())) {
      res.status(403).json({ error: 'Admin or owner role required to deprecate templates' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const template = deprecateTemplate({ templateId, organizationId, userId, reason });
      res.json({ template });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'template_deprecate_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'template_deprecate_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] template deprecate failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status = message === 'template_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

// C1 — author manual structure editor. Persists structural edits
// (add/remove/reorder/rename) to a DRAFT template's section blueprint. Unlike
// the LLM refiner (purpose-rewrite only), this accepts full structural change
// because the caller is the template author. Draft-only; approved/deprecated
// templates stay immutable.
router.patch(
  '/templates/:templateId/structure',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    const sections = req.body?.sections;
    if (!Array.isArray(sections)) {
      res.status(400).json({ error: 'sections array is required' });
      return;
    }
    // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31). Optional; omitted body
    // field leaves the saved color pattern untouched.
    const colorTemplateId =
      'colorTemplateId' in (req.body ?? {})
        ? typeof req.body.colorTemplateId === 'string'
          ? req.body.colorTemplateId
          : null
        : undefined;
    await ensureTemplateRegistryHydrated(organizationId);
    try {
      const template = await reviseTemplateStructureDurably({
        templateId,
        organizationId,
        userId,
        sections,
        colorTemplateId,
        formattingSchema:
          req.body?.formattingSchema && typeof req.body.formattingSchema === 'object'
            ? req.body.formattingSchema
            : undefined,
        requiredInputs: Array.isArray(req.body?.requiredInputs)
          ? req.body.requiredInputs
          : undefined,
      });
      res.json({ template });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'template_revise_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'template_revise_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] template structure revise failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status =
        message === 'template_not_found' ? 404 : message === 'template_not_draft' ? 409 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.get(
  '/templates/:templateId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    await ensureTemplateRegistryHydrated(organizationId);
    const template = getTemplate(templateId, organizationId);
    if (!template) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }
    const auditEntries = listTemplateAuditEntries(templateId, organizationId);
    res.json({ auditEntries });
  })
);

// Slice E14.persistence — usage + feedback recorder routes. Both
// emit a fresh audit row + persist the updated template via the
// DAO write-through pipeline.
router.post(
  '/templates/:templateId/usage',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    await ensureTemplateRegistryHydrated(organizationId);
    const artifactId = typeof req.body?.artifactId === 'string' ? req.body.artifactId : undefined;
    const template = recordTemplateUsage({
      templateId,
      organizationId,
      userId,
      artifactId,
    });
    if (!template) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }
    res.json({ template });
  })
);

router.post(
  '/templates/:templateId/feedback',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const templateId = String(req.params.templateId || '');
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    const ratingRaw = req.body?.rating;
    const rating = Number(ratingRaw);
    if (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'rating_must_be_integer_1_to_5' });
      return;
    }
    const comment = typeof req.body?.comment === 'string' ? req.body.comment : undefined;
    await ensureTemplateRegistryHydrated(organizationId);
    const template = recordTemplateFeedback({
      templateId,
      organizationId,
      userId,
      rating,
      comment,
    });
    if (!template) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }
    res.json({ template });
  })
);

// =============================================================================
// Epic E4 — Source Pack registry routes.
// MUST be registered BEFORE the `/:artifactId` GET handler so the static
// `/source-packs/...` prefix wins over the generic artifact-id matcher.
// All routes are tenant-scoped via the JWT-derived organizationId.
//
// Connector ingestion is dispatched via { connector, input } in the
// POST /:packId/items body so the route stays connector-agnostic and
// every connector adapter keeps the same SourcePackConnectorError
// vocabulary (mapped to HTTP statuses below).
// =============================================================================

interface SourcePackConnectorPayload {
  connector?: string;
  input?: Record<string, unknown>;
}

function mapConnectorErrorToStatus(code: SourcePackConnectorError['code']): number {
  switch (code) {
    case 'invalid_input':
    case 'unsupported_scheme':
    case 'integration_not_configured':
      return 400;
    case 'artifact_not_found':
      return 404;
    case 'fetch_failed':
    case 'fetch_timeout':
    case 'fetch_too_large':
    case 'extraction_failed':
      return 422;
    default:
      return 500;
  }
}

function mapServiceErrorToStatus(message: string): number {
  if (message === 'source_pack_not_found' || message === 'source_pack_item_not_found') return 404;
  if (
    message === 'source_pack_archived' ||
    message === 'source_pack_empty' ||
    message === 'source_pack_not_ready' ||
    message.startsWith('unsupported source pack item type')
  ) {
    return 400;
  }
  return 500;
}

/**
 * Shape-preserving error responder for the source-pack family.
 *
 * Known service errors map to a 4xx with their stable code echoed (validation-style).
 * Anything that maps to 5xx is an unexpected failure: the real message is already
 * logged by the caller, and the client receives a stable `service_error` code plus a
 * generic opaque message — never the raw `err.message` (INFO-DISCLOSURE guard).
 */
function respondServiceError(res: Response, message: string, fallbackCode: string): void {
  const status = mapServiceErrorToStatus(message);
  if (status >= 500) {
    res.status(status).json({ error: fallbackCode, message: GENERIC_5XX_MESSAGE });
    return;
  }
  res.status(status).json({ error: message, message });
}

/** Epic E5 — map DocumentLifecycleTransitionError codes to HTTP. */
function mapLifecycleErrorToStatus(code: DocumentLifecycleTransitionError['code']): number {
  switch (code) {
    case 'unknown_status':
      return 400;
    case 'invalid_transition':
      return 409;
    case 'unknown_artifact':
      return 404;
    default:
      return 500;
  }
}

/** Epic E5 — map DocumentRollbackError codes to HTTP. */
function mapRollbackErrorToStatus(code: DocumentRollbackError['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'snapshot_not_found':
    case 'document_not_found':
      return 404;
    case 'tenant_mismatch':
      return 403;
    default:
      return 500;
  }
}

/** Epic E6 — map DocumentCommentError codes to HTTP. */
function mapCommentErrorToStatus(code: DocumentCommentError['code']): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'unknown_comment':
    case 'unknown_thread':
      return 404;
    case 'comment_already_resolved':
    case 'comment_not_resolved':
    case 'reply_to_reply_forbidden':
    case 'comment_deleted':
      return 409;
    case 'forbidden':
      return 403;
    default:
      return 500;
  }
}

function parseCommentAnchorFromBody(body: unknown): DocumentCommentAnchor | null {
  if (!body || typeof body !== 'object') return null;
  const a = (body as { anchor?: unknown }).anchor;
  if (!a || typeof a !== 'object') return null;
  const obj = a as { kind?: unknown; sectionId?: unknown; blockId?: unknown };
  if (obj.kind === 'document') return { kind: 'document' };
  if (obj.kind === 'section' && typeof obj.sectionId === 'string') {
    return { kind: 'section', sectionId: obj.sectionId };
  }
  if (
    obj.kind === 'block' &&
    typeof obj.sectionId === 'string' &&
    typeof obj.blockId === 'string'
  ) {
    return { kind: 'block', sectionId: obj.sectionId, blockId: obj.blockId };
  }
  return null;
}

router.post(
  '/source-packs',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    const language =
      req.body?.language === 'pl' || req.body?.language === 'en' ? req.body.language : 'pl';
    const description =
      typeof req.body?.description === 'string' ? req.body.description : undefined;
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    if (!name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    try {
      const pack = await draftSourcePack({
        organizationId,
        userId,
        name,
        language,
        description,
        notes,
      });
      res.status(201).json({ pack });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'source_pack_draft_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'source_pack_draft_failed';
      logger.warn('[DocumentStudio] source pack draft failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      res.status(400).json({ error: 'source_pack_draft_failed', message });
    }
  })
);

router.get(
  '/source-packs',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureSourcePackRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const allowedStatus: SourcePackStatus[] = ['draft', 'ready', 'archived'];
    const status =
      statusRaw && allowedStatus.includes(statusRaw as SourcePackStatus)
        ? (statusRaw as SourcePackStatus)
        : undefined;
    const language =
      req.query.language === 'pl' || req.query.language === 'en'
        ? (req.query.language as 'pl' | 'en')
        : undefined;
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const packs = listSourcePacks(organizationId, { status, language, includeArchived });
    res.json({ packs });
  })
);

router.get(
  '/source-packs/:packId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    await ensureSourcePackRegistryHydrated(organizationId);
    const pack = getSourcePack(packId, organizationId);
    if (!pack) {
      res.status(404).json({ error: 'source_pack_not_found' });
      return;
    }
    res.json({ pack });
  })
);

router.get(
  '/source-packs/:packId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    await ensureSourcePackRegistryHydrated(organizationId);
    const pack = getSourcePack(packId, organizationId);
    if (!pack) {
      res.status(404).json({ error: 'source_pack_not_found' });
      return;
    }
    const auditEntries = listSourcePackAuditEntries(packId, organizationId);
    res.json({ auditEntries });
  })
);

router.post(
  '/source-packs/:packId/items',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    const payload = (req.body ?? {}) as SourcePackConnectorPayload;
    const connector = typeof payload.connector === 'string' ? payload.connector : '';
    const input = (payload.input ?? {}) as Record<string, unknown>;
    if (!connector) {
      res.status(400).json({ error: 'connector is required' });
      return;
    }
    try {
      let draft;
      switch (connector) {
        case 'text':
          draft = ingestRawTextSource({
            title: String(input.title ?? ''),
            body: String(input.body ?? ''),
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            sourceTitle: typeof input.sourceTitle === 'string' ? input.sourceTitle : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'url':
          draft = await ingestUrlSource({
            url: String(input.url ?? ''),
            title: typeof input.title === 'string' ? input.title : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
            timeoutMs: typeof input.timeoutMs === 'number' ? input.timeoutMs : undefined,
          });
          break;
        case 'file':
          draft = ingestFileSource({
            filename: String(input.filename ?? ''),
            mimeType: String(input.mimeType ?? 'text/plain'),
            body: String(input.body ?? ''),
            title: typeof input.title === 'string' ? input.title : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'v8_artifact':
          draft = await ingestV8ArtifactSource({
            artifactId: String(input.artifactId ?? ''),
            organizationId,
            title: typeof input.title === 'string' ? input.title : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        case 'integration':
          draft = ingestIntegrationSource({
            integration: input.integration as 'notion' | 'drive' | 'sharepoint' | 'confluence',
            externalId: String(input.externalId ?? ''),
            title: String(input.title ?? ''),
            preview: typeof input.preview === 'string' ? input.preview : undefined,
            language:
              input.language === 'pl' || input.language === 'en'
                ? (input.language as 'pl' | 'en')
                : undefined,
            notes: typeof input.notes === 'string' ? input.notes : undefined,
          });
          break;
        default:
          res.status(400).json({ error: 'unknown_connector', connector });
          return;
      }
      const pack = await addSourcePackItem({
        organizationId,
        userId,
        packId,
        item: draft,
      });
      res.status(201).json({ pack });
    } catch (err) {
      if (err instanceof SourcePackConnectorError) {
        const status = mapConnectorErrorToStatus(err.code);
        res.status(status).json({
          error: err.code,
          message: err.message,
          details: err.details,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'source_pack_item_failed';
      logger.warn('[DocumentStudio] source pack item add failed', { message });
      respondServiceError(res, message, 'source_pack_item_failed');
    }
  })
);

router.delete(
  '/source-packs/:packId/items/:itemId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const itemId = String(req.params.itemId || '');
    if (!packId || !itemId) {
      res.status(400).json({ error: 'packId and itemId are required' });
      return;
    }
    try {
      const pack = await removeSourcePackItem({ organizationId, userId, packId, itemId });
      res.json({ pack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_item_remove_failed';
      logger.warn('[DocumentStudio] source pack item remove failed', { message });
      respondServiceError(res, message, 'source_pack_item_remove_failed');
    }
  })
);

router.post(
  '/source-packs/:packId/ready',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    try {
      const pack = await markSourcePackReady({ organizationId, userId, packId, notes });
      res.json({ pack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_ready_failed';
      logger.warn('[DocumentStudio] source pack ready failed', { message });
      respondServiceError(res, message, 'source_pack_ready_failed');
    }
  })
);

router.post(
  '/source-packs/:packId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    if (!packId) {
      res.status(400).json({ error: 'packId is required' });
      return;
    }
    try {
      const pack = await archiveSourcePack({ organizationId, userId, packId, reason });
      res.json({ pack });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_archive_failed';
      logger.warn('[DocumentStudio] source pack archive failed', { message });
      respondServiceError(res, message, 'source_pack_archive_failed');
    }
  })
);

router.post(
  '/source-packs/:packId/attach',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const packId = String(req.params.packId || '');
    const artifactId = typeof req.body?.artifactId === 'string' ? req.body.artifactId : '';
    if (!packId || !artifactId) {
      res.status(400).json({ error: 'packId and artifactId are required' });
      return;
    }
    try {
      const result = attachSourcePackToDocument({
        organizationId,
        userId,
        packId,
        artifactId,
      });
      res.json({ pack: result.pack, sourceRefs: result.sourceRefs });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'source_pack_attach_failed';
      logger.warn('[DocumentStudio] source pack attach failed', { message });
      respondServiceError(res, message, 'source_pack_attach_failed');
    }
  })
);

// =============================================================================
// Epic E7 — Per-tenant Brand Voice profile.
//
// All routes are scoped under `/brand-voice/...` so the static prefix wins
// over the generic `/:artifactId` matcher (registered later in this file).
// Lifecycle: draft → active → archived; at most one active row per tenant.
// =============================================================================

const VALID_BRAND_VOICE_STATUSES: ReadonlyArray<BrandVoiceProfileStatus> = [
  'draft',
  'active',
  'archived',
];

const VALID_BRAND_VOICE_LANGUAGE_SCOPES: ReadonlyArray<BrandVoiceProfileLanguageScope> = [
  'pl',
  'en',
  'all',
];

const VALID_REGISTERS: ReadonlyArray<CommunicationRegister> = [
  'executive',
  'professional',
  'narrative',
];

function mapBrandVoiceErrorToStatus(code: BrandVoiceProfileErrorCode): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'profile_not_found':
      return 404;
    case 'profile_archived':
    case 'profile_already_active':
    case 'profile_already_archived':
      return 409;
    case 'forbidden':
      return 403;
    default:
      return 400;
  }
}

function parseStringArray(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') out.push(item);
  }
  return out;
}

function parseGlossaryEntries(raw: unknown): BrandVoiceGlossaryEntry[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: BrandVoiceGlossaryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<BrandVoiceGlossaryEntry>;
    if (typeof candidate.avoid !== 'string' || typeof candidate.prefer !== 'string') continue;
    out.push({
      avoid: candidate.avoid,
      prefer: candidate.prefer,
      note: typeof candidate.note === 'string' ? candidate.note : undefined,
    });
  }
  return out;
}

function parseLanguageScope(raw: unknown): BrandVoiceProfileLanguageScope | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_BRAND_VOICE_LANGUAGE_SCOPES.includes(raw as BrandVoiceProfileLanguageScope)
    ? (raw as BrandVoiceProfileLanguageScope)
    : undefined;
}

function parseRegisterOverride(raw: unknown): CommunicationRegister | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_REGISTERS.includes(raw as CommunicationRegister)
    ? (raw as CommunicationRegister)
    : undefined;
}

router.get(
  '/brand-voice/active',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const profile = getActiveBrandVoiceProfile(organizationId);
    if (!profile) {
      res.status(204).end();
      return;
    }
    res.json({ profile });
  })
);

router.get(
  '/brand-voice/profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && VALID_BRAND_VOICE_STATUSES.includes(statusRaw as BrandVoiceProfileStatus)
        ? (statusRaw as BrandVoiceProfileStatus)
        : undefined;
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const profiles = listBrandVoiceProfiles(organizationId, { status, includeArchived });
    res.json({ profiles });
  })
);

router.post(
  '/brand-voice/profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = draftBrandVoiceProfile({
        organizationId,
        userId,
        input: {
          name: typeof body.name === 'string' ? body.name : '',
          description: typeof body.description === 'string' ? body.description : undefined,
          languageScope: parseLanguageScope(body.languageScope),
          bannedPhrases: parseStringArray(body.bannedPhrases),
          disabledGlobalBannedPhrases: parseStringArray(body.disabledGlobalBannedPhrases),
          preferredPhrases: parseStringArray(body.preferredPhrases),
          glossaryEntries: parseGlossaryEntries(body.glossaryEntries),
          requiredKeywords: parseStringArray(body.requiredKeywords),
          registerOverride:
            parseRegisterOverride(body.registerOverride) === null
              ? undefined
              : (parseRegisterOverride(body.registerOverride) as CommunicationRegister | undefined),
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.status(201).json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/brand-voice/profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const profile = getBrandVoiceProfile(profileId, organizationId);
    if (!profile) {
      res.status(404).json({ error: 'profile_not_found' });
      return;
    }
    res.json({ profile });
  })
);

router.patch(
  '/brand-voice/profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = updateBrandVoiceProfile({
        organizationId,
        userId,
        profileId,
        input: {
          name: typeof body.name === 'string' ? body.name : undefined,
          description: typeof body.description === 'string' ? body.description : undefined,
          languageScope: parseLanguageScope(body.languageScope),
          bannedPhrases: parseStringArray(body.bannedPhrases),
          disabledGlobalBannedPhrases: parseStringArray(body.disabledGlobalBannedPhrases),
          preferredPhrases: parseStringArray(body.preferredPhrases),
          glossaryEntries: parseGlossaryEntries(body.glossaryEntries),
          requiredKeywords: parseStringArray(body.requiredKeywords),
          registerOverride: parseRegisterOverride(body.registerOverride),
          notes:
            body.notes === null ? null : typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/brand-voice/profiles/:profileId/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    try {
      const profile = activateBrandVoiceProfile({ organizationId, userId, profileId });
      res.json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/brand-voice/profiles/:profileId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const profile = archiveBrandVoiceProfile({ organizationId, userId, profileId, reason });
      res.json({ profile });
    } catch (err) {
      if (err instanceof BrandVoiceProfileError) {
        res
          .status(mapBrandVoiceErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/brand-voice/profiles/:profileId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const auditEntries = listBrandVoiceProfileAuditEntries(profileId, organizationId);
    res.json({ auditEntries });
  })
);

// =============================================================================
// Epic E9 — Audience-driven warianty.
//
// AudienceProfile CRUD + lifecycle routes follow the brand-voice contract.
// Variant projection routes (/:artifactId/variants/...) are registered in
// the Epic E5/E6 block below alongside other /:artifactId/... routes so
// the path matcher always reaches them before the generic /:artifactId.
// =============================================================================

const VALID_AUDIENCE_PROFILE_STATUSES: ReadonlyArray<AudienceProfileStatus> = [
  'draft',
  'active',
  'archived',
];

const VALID_AUDIENCE_REGISTERS: ReadonlyArray<CommunicationRegister> = [
  'executive',
  'professional',
  'technical',
  'narrative',
];

const VALID_AUDIENCE_DENSITIES: ReadonlyArray<DocumentDensity> = [
  'concise',
  'standard',
  'detailed',
  'comprehensive',
];

const VALID_AUDIENCE_LANGUAGE_STYLES: ReadonlyArray<DocumentLanguageStyle> = [
  'formal',
  'consulting',
  'legal',
  'narrative',
];

const VALID_AUDIENCE_EXEC_SUMMARY_POLICIES: ReadonlyArray<AudienceProfileExecutiveSummaryPolicy> = [
  'preserve',
  'expand',
  'drop',
];

const VALID_AUDIENCE_APPENDIX_POLICIES: ReadonlyArray<AudienceProfileAppendixPolicy> = [
  'preserve',
  'drop',
];

const VALID_AUDIENCE_JARGON_POLICIES: ReadonlyArray<AudienceProfileJargonPolicy> = [
  'as_is',
  'plain_language',
];

function mapAudienceProfileErrorToStatus(code: AudienceProfileErrorCode): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'profile_not_found':
      return 404;
    case 'profile_archived':
    case 'profile_already_active':
    case 'profile_already_archived':
      return 409;
    case 'system_profile_immutable':
    case 'forbidden':
      return 403;
    default:
      return 400;
  }
}

function parseAudienceRegister(raw: unknown): CommunicationRegister | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_REGISTERS.includes(raw as CommunicationRegister)
    ? (raw as CommunicationRegister)
    : undefined;
}

function parseAudienceDensity(raw: unknown): DocumentDensity | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_DENSITIES.includes(raw as DocumentDensity)
    ? (raw as DocumentDensity)
    : undefined;
}

function parseAudienceLanguageStyle(raw: unknown): DocumentLanguageStyle | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_LANGUAGE_STYLES.includes(raw as DocumentLanguageStyle)
    ? (raw as DocumentLanguageStyle)
    : undefined;
}

function parseAudienceExecutiveSummaryPolicy(
  raw: unknown
): AudienceProfileExecutiveSummaryPolicy | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_EXEC_SUMMARY_POLICIES.includes(raw as AudienceProfileExecutiveSummaryPolicy)
    ? (raw as AudienceProfileExecutiveSummaryPolicy)
    : undefined;
}

function parseAudienceAppendixPolicy(raw: unknown): AudienceProfileAppendixPolicy | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_APPENDIX_POLICIES.includes(raw as AudienceProfileAppendixPolicy)
    ? (raw as AudienceProfileAppendixPolicy)
    : undefined;
}

function parseAudienceJargonPolicy(raw: unknown): AudienceProfileJargonPolicy | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_AUDIENCE_JARGON_POLICIES.includes(raw as AudienceProfileJargonPolicy)
    ? (raw as AudienceProfileJargonPolicy)
    : undefined;
}

function parseAudienceTagFilter(raw: unknown): AudienceProfileTagFilter | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const candidate = raw as { include?: unknown; exclude?: unknown };
  return {
    include: parseStringArray(candidate.include),
    exclude: parseStringArray(candidate.exclude),
  };
}

router.get(
  '/audience-profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && VALID_AUDIENCE_PROFILE_STATUSES.includes(statusRaw as AudienceProfileStatus)
        ? (statusRaw as AudienceProfileStatus)
        : undefined;
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const includeSystem = !(req.query.includeSystem === 'false' || req.query.includeSystem === '0');
    const profiles = listAudienceProfiles(organizationId, {
      status,
      includeArchived,
      includeSystem,
    });
    res.json({ profiles });
  })
);

router.post(
  '/audience-profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = draftAudienceProfile({
        organizationId,
        userId,
        input: {
          name: typeof body.name === 'string' ? body.name : '',
          description: typeof body.description === 'string' ? body.description : undefined,
          audienceLabels: parseStringArray(body.audienceLabels),
          registerOverride:
            parseAudienceRegister(body.registerOverride) === null
              ? undefined
              : (parseAudienceRegister(body.registerOverride) as CommunicationRegister | undefined),
          densityOverride:
            parseAudienceDensity(body.densityOverride) === null
              ? undefined
              : (parseAudienceDensity(body.densityOverride) as DocumentDensity | undefined),
          languageStyleOverride:
            parseAudienceLanguageStyle(body.languageStyleOverride) === null
              ? undefined
              : (parseAudienceLanguageStyle(body.languageStyleOverride) as
                  DocumentLanguageStyle | undefined),
          sectionFilters: parseAudienceTagFilter(body.sectionFilters),
          blockFilters: parseAudienceTagFilter(body.blockFilters),
          executiveSummaryPolicy: parseAudienceExecutiveSummaryPolicy(body.executiveSummaryPolicy),
          appendixPolicy: parseAudienceAppendixPolicy(body.appendixPolicy),
          jargonPolicy: parseAudienceJargonPolicy(body.jargonPolicy),
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.status(201).json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/audience-profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const profile = getAudienceProfile(profileId, organizationId);
    if (!profile) {
      res.status(404).json({ error: 'profile_not_found' });
      return;
    }
    res.json({ profile });
  })
);

router.patch(
  '/audience-profiles/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const profile = updateAudienceProfile({
        organizationId,
        userId,
        profileId,
        input: {
          name: typeof body.name === 'string' ? body.name : undefined,
          description:
            body.description === null
              ? null
              : typeof body.description === 'string'
                ? body.description
                : undefined,
          audienceLabels: parseStringArray(body.audienceLabels),
          registerOverride: parseAudienceRegister(body.registerOverride),
          densityOverride: parseAudienceDensity(body.densityOverride),
          languageStyleOverride: parseAudienceLanguageStyle(body.languageStyleOverride),
          sectionFilters: parseAudienceTagFilter(body.sectionFilters),
          blockFilters: parseAudienceTagFilter(body.blockFilters),
          executiveSummaryPolicy: parseAudienceExecutiveSummaryPolicy(body.executiveSummaryPolicy),
          appendixPolicy: parseAudienceAppendixPolicy(body.appendixPolicy),
          jargonPolicy: parseAudienceJargonPolicy(body.jargonPolicy),
          notes:
            body.notes === null ? null : typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/audience-profiles/:profileId/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    try {
      const profile = activateAudienceProfile({ organizationId, userId, profileId });
      res.json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/audience-profiles/:profileId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const profile = archiveAudienceProfile({ organizationId, userId, profileId, reason });
      res.json({ profile });
    } catch (err) {
      if (err instanceof AudienceProfileError) {
        res
          .status(mapAudienceProfileErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/audience-profiles/:profileId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const profileId = String(req.params.profileId || '');
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const auditEntries = listAudienceProfileAuditEntries(profileId, organizationId);
    res.json({ auditEntries });
  })
);

// =============================================================================
// Epic E10 — Reusable Content Block library (CRUD + lifecycle + insert).
//
// Top-level under /content-blocks (NOT artifact-scoped) so the route
// matcher does not collide with /:artifactId. Includes a /instantiate
// helper that materializes a library entry into a fresh DocumentBlock
// payload ready to be appended to a section.
// =============================================================================

const VALID_CONTENT_BLOCK_STATUSES: ReadonlyArray<DocumentContentBlockStatus> = [
  'draft',
  'active',
  'archived',
];

const VALID_CONTENT_BLOCK_LANGUAGE_SCOPES: ReadonlyArray<'pl' | 'en' | 'all'> = ['pl', 'en', 'all'];

function mapContentBlockErrorToStatus(code: DocumentContentBlockErrorCode): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'content_block_not_found':
      return 404;
    case 'content_block_archived':
    case 'content_block_already_active':
    case 'content_block_already_archived':
      return 409;
    case 'forbidden':
      return 403;
    default:
      return 400;
  }
}

function parseContentBlockLanguageScope(raw: unknown): 'pl' | 'en' | 'all' | undefined {
  if (typeof raw !== 'string') return undefined;
  return VALID_CONTENT_BLOCK_LANGUAGE_SCOPES.includes(raw as 'pl' | 'en' | 'all')
    ? (raw as 'pl' | 'en' | 'all')
    : undefined;
}

function parseDocumentTypeArray(raw: unknown): DocumentTypeKey[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: DocumentTypeKey[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed as DocumentTypeKey);
  }
  return out;
}

function parseDocumentBlockPayload(raw: unknown): Omit<DocumentBlock, 'blockId'> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const candidate = raw as { type?: unknown; content?: unknown };
  if (typeof candidate.type !== 'string') return undefined;
  return raw as Omit<DocumentBlock, 'blockId'>;
}

router.get(
  '/content-blocks',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureContentBlockRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && VALID_CONTENT_BLOCK_STATUSES.includes(statusRaw as DocumentContentBlockStatus)
        ? (statusRaw as DocumentContentBlockStatus)
        : undefined;
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const documentType =
      typeof req.query.documentType === 'string' && req.query.documentType.trim().length > 0
        ? (req.query.documentType.trim() as DocumentTypeKey)
        : undefined;
    const languageRaw = typeof req.query.language === 'string' ? req.query.language : undefined;
    const language =
      languageRaw === 'pl' || languageRaw === 'en' ? (languageRaw as 'pl' | 'en') : undefined;
    const anyTagRaw = req.query.anyTag;
    const anyTag = Array.isArray(anyTagRaw)
      ? anyTagRaw.filter((v): v is string => typeof v === 'string')
      : typeof anyTagRaw === 'string'
        ? anyTagRaw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : undefined;
    const templates = listDocumentContentBlocks(organizationId, {
      status,
      includeArchived,
      documentType,
      language,
      anyTag,
    });
    res.json({ contentBlocks: templates });
  })
);

router.post(
  '/content-blocks',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const block = parseDocumentBlockPayload(body.block);
    if (!block) {
      res.status(400).json({ error: 'invalid_input', message: 'block payload is required' });
      return;
    }
    try {
      const template = draftDocumentContentBlock({
        organizationId,
        userId,
        input: {
          name: typeof body.name === 'string' ? body.name : '',
          description: typeof body.description === 'string' ? body.description : undefined,
          tags: parseStringArray(body.tags),
          documentTypes: parseDocumentTypeArray(body.documentTypes),
          languageScope: parseContentBlockLanguageScope(body.languageScope),
          block,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.status(201).json({ contentBlock: template });
    } catch (err) {
      if (err instanceof DocumentContentBlockError) {
        res
          .status(mapContentBlockErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/content-blocks/:contentBlockId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const contentBlockId = String(req.params.contentBlockId || '');
    if (!contentBlockId) {
      res.status(400).json({ error: 'contentBlockId is required' });
      return;
    }
    await ensureContentBlockRegistryHydrated(organizationId);
    const template = getDocumentContentBlock(contentBlockId, organizationId);
    if (!template) {
      res.status(404).json({ error: 'content_block_not_found' });
      return;
    }
    res.json({ contentBlock: template });
  })
);

router.patch(
  '/content-blocks/:contentBlockId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const contentBlockId = String(req.params.contentBlockId || '');
    if (!contentBlockId) {
      res.status(400).json({ error: 'contentBlockId is required' });
      return;
    }
    await ensureContentBlockRegistryHydrated(organizationId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const blockPayload =
      body.block === undefined ? undefined : parseDocumentBlockPayload(body.block);
    if (body.block !== undefined && !blockPayload) {
      res.status(400).json({ error: 'invalid_input', message: 'block payload is invalid' });
      return;
    }
    try {
      const template = updateDocumentContentBlock({
        organizationId,
        userId,
        contentBlockId,
        input: {
          name: typeof body.name === 'string' ? body.name : undefined,
          description:
            body.description === null
              ? null
              : typeof body.description === 'string'
                ? body.description
                : undefined,
          tags: parseStringArray(body.tags),
          documentTypes: parseDocumentTypeArray(body.documentTypes),
          languageScope: parseContentBlockLanguageScope(body.languageScope),
          block: blockPayload,
          notes:
            body.notes === null ? null : typeof body.notes === 'string' ? body.notes : undefined,
        },
      });
      res.json({ contentBlock: template });
    } catch (err) {
      if (err instanceof DocumentContentBlockError) {
        res
          .status(mapContentBlockErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/content-blocks/:contentBlockId/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const contentBlockId = String(req.params.contentBlockId || '');
    if (!contentBlockId) {
      res.status(400).json({ error: 'contentBlockId is required' });
      return;
    }
    await ensureContentBlockRegistryHydrated(organizationId);
    try {
      const template = activateDocumentContentBlock({
        organizationId,
        userId,
        contentBlockId,
      });
      res.json({ contentBlock: template });
    } catch (err) {
      if (err instanceof DocumentContentBlockError) {
        res
          .status(mapContentBlockErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/content-blocks/:contentBlockId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const contentBlockId = String(req.params.contentBlockId || '');
    if (!contentBlockId) {
      res.status(400).json({ error: 'contentBlockId is required' });
      return;
    }
    await ensureContentBlockRegistryHydrated(organizationId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const template = archiveDocumentContentBlock({
        organizationId,
        userId,
        contentBlockId,
        reason,
      });
      res.json({ contentBlock: template });
    } catch (err) {
      if (err instanceof DocumentContentBlockError) {
        res
          .status(mapContentBlockErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/content-blocks/:contentBlockId/instantiate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const contentBlockId = String(req.params.contentBlockId || '');
    if (!contentBlockId) {
      res.status(400).json({ error: 'contentBlockId is required' });
      return;
    }
    await ensureContentBlockRegistryHydrated(organizationId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const overrideBlockId = typeof body.blockId === 'string' ? body.blockId : undefined;
    try {
      const result = instantiateDocumentContentBlock({
        organizationId,
        contentBlockId,
        blockId: overrideBlockId,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof DocumentContentBlockError) {
        res
          .status(mapContentBlockErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/:artifactId/content-blocks/:contentBlockId/insert',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const contentBlockId = String(req.params.contentBlockId || '');
    if (!artifactId || !contentBlockId) {
      res.status(400).json({ error: 'artifactId and contentBlockId are required' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sectionId = typeof body.sectionId === 'string' ? body.sectionId : '';
    const position =
      body.position === 'start' || body.position === 'after_block' || body.position === 'end'
        ? body.position
        : undefined;
    try {
      const result = await insertDocumentContentBlock({
        organizationId,
        artifactId,
        userId,
        contentBlockId,
        sectionId,
        position,
        afterBlockId: typeof body.afterBlockId === 'string' ? body.afterBlockId : undefined,
        blockId: typeof body.blockId === 'string' ? body.blockId : undefined,
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof DocumentContentBlockInsertError) {
        const status =
          err.code === 'document_not_found' || err.code === 'section_not_found'
            ? 404
            : err.code === 'content_block_not_found'
              ? 404
              : err.code === 'content_block_archived'
                ? 409
                : 400;
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/content-blocks/:contentBlockId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const contentBlockId = String(req.params.contentBlockId || '');
    if (!contentBlockId) {
      res.status(400).json({ error: 'contentBlockId is required' });
      return;
    }
    await ensureContentBlockRegistryHydrated(organizationId);
    const auditEntries = listDocumentContentBlockAuditEntries(contentBlockId, organizationId);
    res.json({ auditEntries });
  })
);

// =============================================================================
// Epic E10 — Approval workflow (multi-reviewer + quorum-driven).
//
// All routes are scoped under /:artifactId/approvals/... and registered
// alongside other /:artifactId/... routes so the path matcher always
// reaches them BEFORE the generic /:artifactId GET handler near the end
// of the file.
// =============================================================================

const VALID_APPROVAL_STATUSES: ReadonlyArray<DocumentApprovalStatus> = [
  'pending',
  'approved',
  'rejected',
  'changes_requested',
  'cancelled',
];

const VALID_APPROVAL_QUORUM_POLICIES: ReadonlyArray<DocumentApprovalQuorumPolicy> = [
  'unanimous',
  'majority',
  'single_approval',
];

const VALID_APPROVAL_DECISION_KINDS: ReadonlyArray<DocumentApprovalDecisionKind> = [
  'approve',
  'reject',
  'request_changes',
];

function withApprovalCurrentness(
  approval: ReturnType<typeof getApproval> extends infer T ? Exclude<T, null> : never,
  currentVersionId: string
) {
  const currentForVersion = approval.versionId === currentVersionId;
  return {
    ...approval,
    currentForVersion,
    effectiveStatus:
      approval.status === 'approved' && !currentForVersion ? ('stale' as const) : approval.status,
  };
}

function mapApprovalErrorToStatus(code: DocumentApprovalErrorCode): number {
  switch (code) {
    case 'invalid_input':
      return 400;
    case 'approval_not_found':
      return 404;
    case 'approval_already_open':
    case 'approval_already_resolved':
    case 'decision_already_recorded':
      return 409;
    case 'reviewer_not_participant':
    case 'self_approval_forbidden':
    case 'forbidden':
      return 403;
    default:
      return 400;
  }
}

function parseApprovalParticipants(raw: unknown): DocumentApprovalParticipant[] {
  if (!Array.isArray(raw)) return [];
  const out: DocumentApprovalParticipant[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== 'object') continue;
    const c = candidate as { userId?: unknown; role?: unknown; required?: unknown };
    if (typeof c.userId !== 'string') continue;
    out.push({
      userId: c.userId,
      role: typeof c.role === 'string' ? c.role : undefined,
      required: c.required !== false,
    });
  }
  return out;
}

router.get(
  '/:artifactId/approvals',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureApprovalRegistryHydrated(organizationId, artifactId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && VALID_APPROVAL_STATUSES.includes(statusRaw as DocumentApprovalStatus)
        ? (statusRaw as DocumentApprovalStatus)
        : undefined;
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const approvals = listDocumentApprovals(organizationId, { artifactId, status }).map((approval) =>
      withApprovalCurrentness(approval, schema.updatedAt)
    );
    res.json({ approvals });
  })
);

router.post(
  '/:artifactId/approvals',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureApprovalRegistryHydrated(organizationId, artifactId);
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const participants = parseApprovalParticipants(body.participants);
    const quorumPolicyRaw = typeof body.quorumPolicy === 'string' ? body.quorumPolicy : undefined;
    const quorumPolicy =
      quorumPolicyRaw &&
      VALID_APPROVAL_QUORUM_POLICIES.includes(quorumPolicyRaw as DocumentApprovalQuorumPolicy)
        ? (quorumPolicyRaw as DocumentApprovalQuorumPolicy)
        : undefined;
    try {
      const approval = requestDocumentApproval({
        organizationId,
        artifactId,
        versionId: schema.updatedAt,
        userId,
        participants,
        quorumPolicy,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
      });
      if (!(await flushApprovalPersistence(organizationId, approval.approvalId))) {
        res.status(503).json({ error: 'approval_persistence_failed' });
        return;
      }
      res.status(201).json({ approval });
    } catch (err) {
      if (err instanceof DocumentApprovalError) {
        res
          .status(mapApprovalErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/:artifactId/approvals/active',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureApprovalRegistryHydrated(organizationId, artifactId);
    const active = getActiveApprovalForArtifact(organizationId, artifactId);
    if (!active) {
      res.status(204).end();
      return;
    }
    res.json({ approval: active });
  })
);

router.get(
  '/:artifactId/approvals/:approvalId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const approvalId = String(req.params.approvalId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    if (!approvalId) {
      res.status(400).json({ error: 'approvalId is required' });
      return;
    }
    await ensureApprovalRegistryHydrated(organizationId, artifactId);
    const approval = getApproval(approvalId, organizationId);
    if (!approval || approval.artifactId !== artifactId) {
      res.status(404).json({ error: 'approval_not_found' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    res.json({ approval: withApprovalCurrentness(approval, schema.updatedAt) });
  })
);

router.post(
  '/:artifactId/approvals/:approvalId/decisions',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const approvalId = String(req.params.approvalId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    if (!approvalId) {
      res.status(400).json({ error: 'approvalId is required' });
      return;
    }
    await ensureApprovalRegistryHydrated(organizationId, artifactId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kindRaw = typeof body.kind === 'string' ? body.kind : '';
    if (!VALID_APPROVAL_DECISION_KINDS.includes(kindRaw as DocumentApprovalDecisionKind)) {
      res
        .status(400)
        .json({ error: 'invalid_input', message: `unsupported decision kind: ${kindRaw}` });
      return;
    }
    try {
      const approval = recordApprovalDecision({
        organizationId,
        approvalId,
        reviewerId: userId,
        kind: kindRaw as DocumentApprovalDecisionKind,
        comment: typeof body.comment === 'string' ? body.comment : undefined,
      });
      if (!(await flushApprovalPersistence(organizationId, approval.approvalId))) {
        res.status(503).json({ error: 'approval_persistence_failed' });
        return;
      }
      res.status(201).json({ approval });
    } catch (err) {
      if (err instanceof DocumentApprovalError) {
        res
          .status(mapApprovalErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  '/:artifactId/approvals/:approvalId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const approvalId = String(req.params.approvalId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    if (!approvalId) {
      res.status(400).json({ error: 'approvalId is required' });
      return;
    }
    await ensureApprovalRegistryHydrated(organizationId, artifactId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const approval = cancelApproval({
        organizationId,
        approvalId,
        userId,
        reason,
      });
      if (!(await flushApprovalPersistence(organizationId, approval.approvalId))) {
        res.status(503).json({ error: 'approval_persistence_failed' });
        return;
      }
      res.json({ approval });
    } catch (err) {
      if (err instanceof DocumentApprovalError) {
        res
          .status(mapApprovalErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  '/:artifactId/approvals/:approvalId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const approvalId = String(req.params.approvalId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    if (!approvalId) {
      res.status(400).json({ error: 'approvalId is required' });
      return;
    }
    await ensureApprovalRegistryHydrated(organizationId, artifactId);
    const auditEntries = listDocumentApprovalAuditEntries(approvalId, organizationId);
    res.json({ auditEntries });
  })
);

// =============================================================================
// Epic E5 — Document Lifecycle (status mutation + version snapshot +
// rollback). All routes are scoped under /:artifactId/... and registered
// before the generic /:artifactId GET handler so the path matcher always
// hits the most specific route first.
// =============================================================================

const VALID_DOCUMENT_STATUSES: ReadonlyArray<DocumentStatus> = [
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
];

router.get(
  '/:artifactId/lifecycle',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentLifecycleHydrated(organizationId);
    const lifecycle = getDocumentLifecycleState(artifactId, organizationId);
    if (!lifecycle) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ lifecycle });
  })
);

router.post(
  '/:artifactId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const to = req.body?.to as DocumentStatus | undefined;
    if (!to || !VALID_DOCUMENT_STATUSES.includes(to)) {
      res.status(400).json({
        error: 'invalid_target_status',
        message: `to must be one of: ${VALID_DOCUMENT_STATUSES.join(', ')}`,
      });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentLifecycleHydrated(organizationId);
    try {
      const lifecycle = transitionDocumentStatus({
        organizationId,
        artifactId,
        userId,
        to,
        reason,
      });
      res.json({ lifecycle });
    } catch (err) {
      if (err instanceof DocumentLifecycleTransitionError) {
        const status = mapLifecycleErrorToStatus(err.code);
        res
          .status(status)
          .json({ error: err.code, message: err.message, from: err.from, to: err.to });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] status transition failed', { message });
      res.status(500).json({ error: 'transition_failed', message: GENERIC_5XX_MESSAGE });
    }
  })
);

router.get(
  '/:artifactId/snapshots',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentVersionSnapshotsHydrated(organizationId);
    const snapshots = listDocumentVersionSnapshots(artifactId, organizationId);
    res.json({ snapshots });
  })
);

router.post(
  '/:artifactId/snapshots',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const label = typeof req.body?.label === 'string' ? req.body.label : undefined;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    // MAT-MVP-DOC-001 (Lane C) part (b) — optional CAS token: the caller's
    // last-known "current latest snapshot" versionId. `undefined` (field
    // omitted) means INFER — see `createDocumentSnapshot`'s own doc comment
    // for the full compatibility reasoning. `null` explicitly asserts "no
    // snapshot should exist yet".
    const expectedVersion: string | null | undefined =
      typeof req.body?.expectedVersion === 'string'
        ? req.body.expectedVersion
        : req.body?.expectedVersion === null
          ? null
          : undefined;
    await ensureDocumentLifecycleHydrated(organizationId);
    await ensureDocumentVersionSnapshotsHydrated(organizationId);

    // Blocker B (Codex, third round) — request-bound idempotency.
    // `createDocumentSnapshot` now ALSO carries its own CAS guard (part b,
    // MAT-MVP-DOC-001) independent of this header — see that function's doc
    // comment. This idempotency layer stays as defence in depth for a
    // client retry of the SAME request (network timeout, disconnect before
    // the response arrived, etc.) must not be allowed to call it a second
    // time. Opt-in: a caller that sends no `Idempotency-Key` gets the exact
    // pre-existing behavior. A caller that does gets the SAME snapshot back
    // on any retry, reconstructed from the durable lineage event rather than
    // by re-running the capture.
    const idempotencyHeader = req.headers['idempotency-key'];
    const requestKey =
      typeof idempotencyHeader === 'string' && idempotencyHeader.trim() !== ''
        ? idempotencyHeader.trim()
        : null;
    const checkpointIdempotencyKey = requestKey
      ? deriveRequestBoundIdempotencyKey({
          artifactKind: 'document',
          sourceRecordId: artifactId,
          eventType: 'checkpoint',
          requestKey,
        })
      : null;

    async function replayCheckpointFromResultId(versionId: string | null): Promise<void> {
      // round-5 redesign — reads the CANONICAL result directly via the
      // claim's own `completedResultId` (an owner-table id), independent of
      // whether a lineage event was ever durably recorded for it. Durable DB
      // read, not the in-memory `getDocumentVersionSnapshot` getter, so the
      // replay is correct even on a process that never hydrated this org's
      // cache.
      const snapshot = versionId ? await loadSnapshotById(versionId, organizationId) : null;
      res.status(201).json({ snapshot: snapshot ?? { versionId }, idempotentReplay: true });
    }

    // round-5 redesign — set only when this request won (fresh acquire) or
    // reclaimed (expired lease) the operation claim below. Gates whether
    // `finalizeOperationClaim` runs after the mutation; a request with no
    // Idempotency-Key never claims anything and keeps the exact pre-existing
    // fire-and-forget behavior.
    let checkpointClaim: { ownerToken: string; fencingToken: number } | null = null;
    // G22 fix — periodic lease renewal for the duration of the (potentially
    // slow) mutation below, so a normal-but-slower-than-30s checkpoint does
    // not lose its claim to a reclaim while genuinely still in progress.
    // Started right after acquiring, stopped in the `finally` below.
    let checkpointHeartbeat: ReturnType<typeof startClaimHeartbeat> | null = null;

    if (checkpointIdempotencyKey) {
      // round-5 redesign — durable, cross-instance, lease-fenced claim
      // BEFORE the business mutation, via the DEDICATED
      // `artifact_lineage_operation_claims` table (see
      // `operationClaimService.ts`). This table is structurally incapable of
      // being confused with a lineage outbox row — it is not the same table.
      const claim = await acquireOrReclaimOperationClaim({
        organizationId,
        operationKey: checkpointIdempotencyKey,
      });
      if (claim.outcome === 'completed') {
        await replayCheckpointFromResultId(claim.completedResultId);
        return;
      }
      if (claim.outcome === 'active_elsewhere') {
        res.status(409).json({
          success: false,
          error: 'Another request is currently completing this checkpoint',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
        return;
      }
      if (claim.outcome === 'failed') {
        // The durable claim write itself failed: abort BEFORE
        // `createDocumentSnapshot` ever runs — a genuine double lineage-
        // write failure can no longer produce a duplicate mutation, because
        // no mutation runs without first holding a claim.
        res.status(500).json({
          success: false,
          error: 'The operation could not be durably claimed before this request',
          code: 'CLAIM_ACQUIRE_FAILED',
        });
        return;
      }
      // claim.outcome === 'acquired' — this caller alone proceeds below.
      checkpointClaim = { ownerToken: claim.ownerToken, fencingToken: claim.fencingToken };
      checkpointHeartbeat = startClaimHeartbeat({
        organizationId,
        operationKey: checkpointIdempotencyKey,
        ownerToken: claim.ownerToken,
        fencingToken: claim.fencingToken,
      });
    }

    try {
      const snapshot = await createDocumentSnapshot({
        organizationId,
        artifactId,
        userId,
        label,
        reason,
        // 'manual' — the explicit-origin path stays @internal and only
        // the rollback orchestrator and (future) auto-status-change
        // hooks set it.
        expectedVersion,
      });
      const versionId = (snapshot as { versionId?: string } | null)?.versionId ?? null;

      // G22 fix — if the heartbeat already lost ownership (a newer owner
      // reclaimed while this mutation was still running), this worker must
      // not report success, write a lineage event, or attempt to finalize —
      // it is no longer the authority on the durable result.
      if (checkpointHeartbeat?.isFenced()) {
        res.status(409).json({
          success: false,
          error:
            'This operation was reclaimed by another request before it could be finalized; retry',
          code: 'IDEMPOTENCY_STALE_CLAIM',
        });
        return;
      }

      // Codex final review, Blocker 2 — confirm the fire-and-forget
      // `persistSnapshot` write inside `createDocumentSnapshot` actually
      // landed in Postgres BEFORE telling the client it succeeded. Without
      // this, a process killed between the HTTP response and that async
      // write completing would lose data the client was told was saved,
      // and a fresh process's retry-replay (above) would find nothing.
      const durableSnapshot = checkpointIdempotencyKey
        ? await pollForDurability(() => loadSnapshotById(versionId as string, organizationId))
        : true;
      if (checkpointIdempotencyKey && !durableSnapshot) {
        logger.error('[DocumentStudio] checkpoint snapshot did not durably persist in time', {
          artifactId,
          organizationId,
          versionId,
        });
        // The claim is deliberately left ACTIVE (not finalized) here: we
        // cannot yet prove the mutation's own durability, so we must not
        // record a canonical result for it either. It remains reclaimable
        // once its lease expires, same as any claim whose winner never
        // finalizes.
        res.status(500).json({
          success: false,
          error: 'Snapshot could not be confirmed durable',
          code: 'SNAPSHOT_PERSIST_UNCONFIRMED',
        });
        return;
      }

      // MAT-010 lineage hook (fail-safe). This is the Document type's explicit
      // CHECKPOINT: a user-initiated, labelled snapshot — the direct analogue
      // of Workbook's `POST /:id/checkpoint`. Recorded only after
      // `createDocumentSnapshot` resolved AND (when idempotency-tracked) its
      // durability was confirmed, so a failed/unconfirmed capture never
      // appears in the lineage.
      const checkpointOutcome = await recordLineageEventTracked({
        organizationId,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'checkpoint',
        actorUserId: userId,
        idempotencyKey: checkpointIdempotencyKey ?? undefined,
        detail: { versionId, label: label ?? null, reason: reason ?? null },
      });

      // round-5 redesign — finalize the CLAIM regardless of whether the
      // lineage event above landed durably: the claim's job is "exactly one
      // canonical result per operation_key", a fact already true the moment
      // `pollForDurability` confirmed the snapshot — independent of the
      // outbox's own (separately handled, separately reported) durability.
      if (checkpointClaim) {
        const finalizeResult = await finalizeOperationClaim({
          organizationId,
          operationKey: checkpointIdempotencyKey as string,
          ownerToken: checkpointClaim.ownerToken,
          fencingToken: checkpointClaim.fencingToken,
          completedResultId: versionId as string,
        });
        if (respondIfClaimFenced(res, finalizeResult)) return;
        if (finalizeResult.outcome === 'failed') {
          res.status(500).json({
            success: false,
            error: 'The operation completed but its claim could not be finalized',
            code: 'CLAIM_FINALIZE_FAILED',
          });
          return;
        }
      }
      if (respondIfLineageLost(res, checkpointOutcome)) return;

      res.status(201).json({ snapshot });
    } catch (err) {
      // MAT-MVP-DOC-001 (Lane C) part (b) — CAS conflict. Envelope shape
      // mirrors `manual_save_conflict` (see `DocumentManualSaveConflictError`
      // handling on the manual-content-save route below).
      if (err instanceof DocumentCheckpointVersionConflictError) {
        res.status(409).json({
          error: 'checkpoint_conflict',
          code: 'DOC_CHECKPOINT_CONFLICT',
          conflict: {
            yourVersion: err.yourVersion,
            serverVersion: err.serverVersion,
          },
        });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'document_not_found') {
        res.status(404).json({ error: 'document_not_found', message: 'document_not_found' });
        return;
      }
      logger.warn('[DocumentStudio] snapshot capture failed', { message });
      res.status(500).json({ error: 'snapshot_failed', message: GENERIC_5XX_MESSAGE });
    } finally {
      // G22 fix — the heartbeat must never outlive this request, success or
      // failure alike.
      checkpointHeartbeat?.stop();
    }
  })
);

router.get(
  '/:artifactId/snapshots/:versionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const versionId = String(req.params.versionId);
    if (!artifactId || !versionId) {
      res.status(400).json({ error: 'artifactId and versionId are required' });
      return;
    }
    await ensureDocumentVersionSnapshotsHydrated(organizationId);
    const snapshot = getDocumentVersionSnapshot(versionId, organizationId);
    if (!snapshot || snapshot.artifactId !== artifactId) {
      // Don't leak existence across artifacts in the same tenant — same
      // 404 for missing AND mismatched.
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ snapshot });
  })
);

// MAT-MVP-DOC-001 (Lane C) part (c) — "immutable-lineage readback": the
// full version -> parent -> hash chain for a document. Deliberately reads
// COLD from Postgres (see `getDocumentVersionLineage`'s doc comment) rather
// than the in-process snapshot cache the routes above use, so the chain's
// durability is provable rather than merely reflecting this process's
// current in-memory view. Tenant-scoped via the auth context's
// `organizationId`, never a request parameter — an artifact belonging to
// another tenant resolves to an empty chain, same deny-by-default shape as
// the rest of this router.
router.get(
  '/:artifactId/lineage',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const lineage = await getDocumentVersionLineage(artifactId, organizationId);
    res.json({ artifactId, lineage });
  })
);

router.get(
  '/:artifactId/diff',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentVersionSnapshotsHydrated(organizationId);
    const liveSchema = await getDocumentArtifact(artifactId, organizationId);
    if (!liveSchema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
    const snapshot = versionId
      ? getDocumentVersionSnapshot(versionId, organizationId)
      : (listDocumentVersionSnapshots(artifactId, organizationId).at(-1) ?? null);
    if (!snapshot || snapshot.artifactId !== artifactId) {
      res.status(404).json({ error: 'snapshot_not_found' });
      return;
    }
    const diff = computeDocumentSchemaDiff(snapshot.schema, liveSchema);
    res.json({
      baseSnapshot: {
        versionId: snapshot.versionId,
        versionNumber: snapshot.versionNumber,
        capturedAt: snapshot.capturedAt,
        label: snapshot.label,
        origin: snapshot.origin,
      },
      comparedAt: new Date().toISOString(),
      summary: summarizeDocumentSchemaDiff(diff),
      diff,
    });
  })
);

router.post(
  '/:artifactId/snapshots/:versionId/rollback',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const versionId = String(req.params.versionId);
    if (!artifactId || !versionId) {
      res.status(400).json({ error: 'artifactId and versionId are required' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    // MAT-MVP-DOC-001 (Lane C) part (b) — optional CAS token: the live
    // document's `updatedAt` the caller last observed. Omitted → INFER
    // (see `rollbackDocumentToVersion`'s `expectedVersion` doc comment).
    const expectedVersion: string | undefined =
      typeof req.body?.expectedVersion === 'string' ? req.body.expectedVersion : undefined;
    await ensureDocumentLifecycleHydrated(organizationId);
    await ensureDocumentVersionSnapshotsHydrated(organizationId);

    // Blocker B (Codex, third round) — the same request-bound idempotency as
    // the checkpoint route above: `rollbackDocumentToVersion` has no CAS
    // guard, so a retried request must not re-run the rollback. Opt-in via
    // `Idempotency-Key`; no header means no behavior change.
    const idempotencyHeader = req.headers['idempotency-key'];
    const requestKey =
      typeof idempotencyHeader === 'string' && idempotencyHeader.trim() !== ''
        ? idempotencyHeader.trim()
        : null;
    const restoreIdempotencyKey = requestKey
      ? deriveRequestBoundIdempotencyKey({
          artifactKind: 'document',
          sourceRecordId: artifactId,
          eventType: 'restore',
          requestKey,
        })
      : null;

    async function replayRestoreFromResultId(revertVersionId: string | null): Promise<void> {
      // round-5 redesign — `restoredFrom` is the request's OWN `versionId`
      // path param, already known without needing anything stored on the
      // claim. `revertSnapshot` is read via the claim's `completedResultId`
      // (the NEW snapshot the rollback itself created) — an owner-table id,
      // read through the durable DAO function, not the in-memory
      // `getDocumentVersionSnapshot` getter. `getDocumentArtifact`/
      // `getDocumentLifecycleState` hydrate-from-DB-on-first-access per
      // artifact/org regardless of process history — verified by the
      // restart-recovery test, not assumed.
      const restoredFrom = await loadSnapshotById(versionId, organizationId);
      const revertSnapshot = revertVersionId
        ? await loadSnapshotById(revertVersionId, organizationId)
        : null;
      const schema = await getDocumentArtifact(artifactId, organizationId);
      const lifecycle = getDocumentLifecycleState(artifactId, organizationId);
      res.json({ schema, revertSnapshot, restoredFrom, lifecycle, idempotentReplay: true });
    }

    // See the checkpoint route's `checkpointClaim` for what this gates.
    let restoreClaim: { ownerToken: string; fencingToken: number } | null = null;
    // G22 fix — see the checkpoint route's identical `checkpointHeartbeat`.
    let restoreHeartbeat: ReturnType<typeof startClaimHeartbeat> | null = null;

    if (restoreIdempotencyKey) {
      // round-5 redesign — see the checkpoint route above and
      // `operationClaimService.ts`'s doc comment for the full mechanism.
      const claim = await acquireOrReclaimOperationClaim({
        organizationId,
        operationKey: restoreIdempotencyKey,
      });
      if (claim.outcome === 'completed') {
        await replayRestoreFromResultId(claim.completedResultId);
        return;
      }
      if (claim.outcome === 'active_elsewhere') {
        res.status(409).json({
          success: false,
          error: 'Another request is currently completing this restore',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
        return;
      }
      if (claim.outcome === 'failed') {
        res.status(500).json({
          success: false,
          error: 'The operation could not be durably claimed before this request',
          code: 'CLAIM_ACQUIRE_FAILED',
        });
        return;
      }
      // claim.outcome === 'acquired' — this caller alone proceeds below.
      restoreClaim = { ownerToken: claim.ownerToken, fencingToken: claim.fencingToken };
      restoreHeartbeat = startClaimHeartbeat({
        organizationId,
        operationKey: restoreIdempotencyKey,
        ownerToken: claim.ownerToken,
        fencingToken: claim.fencingToken,
      });
    }

    try {
      const result = await rollbackDocumentToVersion({
        organizationId,
        artifactId,
        userId,
        versionId,
        reason,
        expectedVersion,
      });
      const revertVersionId = result.revertSnapshot?.versionId ?? null;

      // G22 fix — see the checkpoint route's identical check.
      if (restoreHeartbeat?.isFenced()) {
        res.status(409).json({
          success: false,
          error:
            'This operation was reclaimed by another request before it could be finalized; retry',
          code: 'IDEMPOTENCY_STALE_CLAIM',
        });
        return;
      }

      // Codex final review, Blocker 2 — confirm all three durable side
      // effects of the rollback (revert snapshot, schema overlay, lifecycle
      // transition) actually landed before responding success. See
      // `pollForDurability`'s doc comment above.
      if (restoreIdempotencyKey) {
        const targetUpdatedAt = result.schema?.updatedAt;
        const targetStatusChangedAt = result.lifecycle?.statusChangedAt;
        const allDurable =
          (revertVersionId
            ? await pollForDurability(() => loadSnapshotById(revertVersionId, organizationId))
            : true) &&
          (targetUpdatedAt
            ? await pollForDurability(async () => {
                const overlay = await loadSchemaOverlay(artifactId, organizationId);
                return overlay && overlay.updatedAt === targetUpdatedAt ? overlay : null;
              })
            : true) &&
          (targetStatusChangedAt
            ? await pollForDurability(async () => {
                const state = await loadLifecycleStateForArtifact(artifactId, organizationId);
                return state && state.statusChangedAt === targetStatusChangedAt ? state : null;
              })
            : true);
        if (!allDurable) {
          logger.error('[DocumentStudio] rollback side effects did not durably persist in time', {
            artifactId,
            organizationId,
            revertVersionId,
          });
          // Claim deliberately left ACTIVE — see the checkpoint route's
          // identical comment on the SNAPSHOT_PERSIST_UNCONFIRMED branch.
          res.status(500).json({
            success: false,
            error: 'Rollback could not be confirmed durable',
            code: 'ROLLBACK_PERSIST_UNCONFIRMED',
          });
          return;
        }
      }

      // MAT-010 lineage hook (fail-safe). Only past a successful rollback —
      // `DocumentRollbackError` (400/403/404, see `mapRollbackErrorToStatus`
      // — no version-conflict code exists here) is handled below and never
      // reaches here, so a losing rollback stays out of the lineage. The
      // claim above is what now prevents a client retry from re-running
      // `rollbackDocumentToVersion` a second time. `revertSnapshotVersionId`
      // is recorded here (not just `restoredFromVersionId`) so a later
      // replay via the lineage event can reconstruct the FULL result too.
      const restoreOutcome = await recordLineageEventTracked({
        organizationId,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'restore',
        actorUserId: userId,
        idempotencyKey: restoreIdempotencyKey ?? undefined,
        detail: {
          restoredFromVersionId: versionId,
          revertSnapshotVersionId: revertVersionId,
          reason: reason ?? null,
        },
      });

      // round-5 redesign — see the checkpoint route's identical comment:
      // finalize the CLAIM (canonical result = the revert snapshot's own
      // id) regardless of the outbox's own durability outcome.
      if (restoreClaim) {
        const finalizeResult = await finalizeOperationClaim({
          organizationId,
          operationKey: restoreIdempotencyKey as string,
          ownerToken: restoreClaim.ownerToken,
          fencingToken: restoreClaim.fencingToken,
          completedResultId: revertVersionId as string,
        });
        if (respondIfClaimFenced(res, finalizeResult)) return;
        if (finalizeResult.outcome === 'failed') {
          res.status(500).json({
            success: false,
            error: 'The operation completed but its claim could not be finalized',
            code: 'CLAIM_FINALIZE_FAILED',
          });
          return;
        }
      }
      if (respondIfLineageLost(res, restoreOutcome)) return;

      res.json(result);
    } catch (err) {
      // MAT-MVP-DOC-001 (Lane C) part (b) — CAS conflict. Envelope shape
      // mirrors `manual_save_conflict`, same as the checkpoint route above.
      if (err instanceof DocumentRollbackVersionConflictError) {
        res.status(409).json({
          error: 'rollback_conflict',
          code: 'DOC_ROLLBACK_CONFLICT',
          conflict: {
            yourVersion: err.yourVersion,
            serverVersion: err.serverVersion,
          },
        });
        return;
      }
      if (err instanceof DocumentRollbackError) {
        const status = mapRollbackErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] rollback failed', { message });
      res.status(500).json({ error: 'rollback_failed', message: GENERIC_5XX_MESSAGE });
    } finally {
      restoreHeartbeat?.stop();
    }
  })
);

// =============================================================================
// Epic E6 — Comments + review mode. Routes scoped under
// /:artifactId/comments and /:artifactId/comments/threads, all
// registered before the generic /:artifactId GET so the path matcher
// hits the most specific route first. Lifecycle gating (e.g.
// preventing comment mutations on archived documents) is intentionally
// NOT enforced here — review mode must stay usable on any document
// status; the lifecycle check belongs in a UI / governance layer.
// =============================================================================

const VALID_COMMENT_STATUSES: ReadonlyArray<DocumentCommentStatus> = ['open', 'resolved'];

router.get(
  '/:artifactId/comments/threads',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const status =
      typeof req.query.status === 'string' &&
      VALID_COMMENT_STATUSES.includes(req.query.status as DocumentCommentStatus)
        ? (req.query.status as DocumentCommentStatus)
        : undefined;
    const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
    const blockId = typeof req.query.blockId === 'string' ? req.query.blockId : undefined;
    const threads = listDocumentCommentThreads(artifactId, organizationId, {
      status,
      sectionId,
      blockId,
    });
    res.json({ threads });
  })
);

router.get(
  '/:artifactId/comments/counts',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const counts = getDocumentCommentSectionCounts(artifactId, organizationId);
    res.json({ counts });
  })
);

router.get(
  '/:artifactId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const status =
      typeof req.query.status === 'string' &&
      VALID_COMMENT_STATUSES.includes(req.query.status as DocumentCommentStatus)
        ? (req.query.status as DocumentCommentStatus)
        : undefined;
    const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
    const blockId = typeof req.query.blockId === 'string' ? req.query.blockId : undefined;
    const hideDeleted = req.query.hideDeleted !== 'false';
    const comments = listDocumentComments(artifactId, organizationId, {
      status,
      sectionId,
      blockId,
      hideDeleted,
    });
    res.json({ comments });
  })
);

router.post(
  '/:artifactId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const anchor = parseCommentAnchorFromBody(req.body);
    if (!anchor) {
      res.status(400).json({
        error: 'invalid_anchor',
        message:
          'anchor must be { kind: "document" } | { kind: "section", sectionId } | { kind: "block", sectionId, blockId }',
      });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const comment = createDocumentComment({
        organizationId,
        artifactId,
        authorId: userId,
        body,
        anchor,
      });
      res.status(201).json({ comment });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] create comment failed', { message });
      res.status(500).json({ error: 'create_comment_failed', message: GENERIC_5XX_MESSAGE });
    }
  })
);

router.get(
  '/:artifactId/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    if (!artifactId || !commentId) {
      res.status(400).json({ error: 'artifactId and commentId are required' });
      return;
    }
    await ensureDocumentCommentsHydrated(organizationId);
    const comment = getDocumentComment(commentId, organizationId);
    if (!comment || comment.artifactId !== artifactId) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ comment });
  })
);

router.post(
  '/:artifactId/comments/:commentId/reply',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const parentCommentId = String(req.params.commentId);
    if (!artifactId || !parentCommentId) {
      res.status(400).json({ error: 'artifactId and commentId are required' });
      return;
    }
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const reply = replyToDocumentComment({
        organizationId,
        artifactId,
        authorId: userId,
        parentCommentId,
        body,
      });
      res.status(201).json({ comment: reply });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] reply comment failed', { message });
      res.status(500).json({ error: 'reply_comment_failed', message: GENERIC_5XX_MESSAGE });
    }
  })
);

router.post(
  '/:artifactId/comments/:commentId/resolve',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const root = resolveDocumentComment({
        organizationId,
        artifactId,
        userId,
        commentId,
        reason,
      });
      res.json({ comment: root });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] resolve comment failed', { message });
      res.status(500).json({ error: 'resolve_comment_failed', message: GENERIC_5XX_MESSAGE });
    }
  })
);

router.post(
  '/:artifactId/comments/:commentId/reopen',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const root = reopenDocumentComment({
        organizationId,
        artifactId,
        userId,
        commentId,
        reason,
      });
      res.json({ comment: root });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] reopen comment failed', { message });
      res.status(500).json({ error: 'reopen_comment_failed', message: GENERIC_5XX_MESSAGE });
    }
  })
);

router.delete(
  '/:artifactId/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const commentId = String(req.params.commentId);
    await ensureDocumentCommentsHydrated(organizationId);
    try {
      const deleted = deleteDocumentComment({
        organizationId,
        artifactId,
        userId,
        commentId,
      });
      res.json({ comment: deleted });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        const status = mapCommentErrorToStatus(err.code);
        res.status(status).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[DocumentStudio] delete comment failed', { message });
      res.status(500).json({ error: 'delete_comment_failed', message: GENERIC_5XX_MESSAGE });
    }
  })
);

// =============================================================================
// Epic E9 — Audience-driven warianty: variant projection routes.
//
// Registered alongside other /:artifactId/... routes so the path matcher
// always reaches them BEFORE the generic /:artifactId GET handler below.
//
// Both routes are read-only projections of the source DocumentSchema —
// they do not run QA on the variant nor mutate the underlying artifact.
// =============================================================================

router.get(
  '/:artifactId/variants',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const profiles = listActiveAudienceProfiles(organizationId, { includeSystem: true });
    const variants = profiles.map((profile) => ({
      profile,
      plan: describeAudienceProjectionPlan(schema, profile),
    }));
    res.json({ variants });
  })
);

router.get(
  '/:artifactId/variants/:profileId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const profileId = String(req.params.profileId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    if (!profileId) {
      res.status(400).json({ error: 'profileId is required' });
      return;
    }
    await ensureAudienceProfileRegistryHydrated(organizationId);
    const profile = getAudienceProfile(profileId, organizationId);
    if (!profile) {
      res.status(404).json({ error: 'profile_not_found' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    const variant = projectDocumentForAudience(schema, profile);
    res.json({ variant });
  })
);

// Lightweight policy lookup so the frontend can hide / disable
// privilege-only actions (currently: the QA export-gate override) before
// the user attempts them. Cheap enough to call on every Document Studio
// session bootstrap.
router.get(
  '/policy',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId, userRole } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({
      policy: {
        canOverrideQa: canOverrideQa(userRole),
        role: userRole || null,
      },
    });
  })
);

router.post(
  '/:artifactId/editor/proposals/local',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const input = (req.body ?? null) as Partial<DocumentEditorProposalInput> | null;
    if (!input || typeof input !== 'object') {
      res.status(400).json({ error: 'proposal input is required' });
      return;
    }
    if (
      input.scope !== 'local' ||
      typeof input.sectionId !== 'string' ||
      typeof input.blockId !== 'string' ||
      typeof input.instruction !== 'string'
    ) {
      res.status(400).json({ error: 'invalid proposal input' });
      return;
    }
    try {
      const proposal = await createLocalEditProposal({
        artifactId,
        organizationId,
        userId,
        input: {
          scope: 'local',
          sectionId: input.sectionId,
          blockId: input.blockId,
          instruction: input.instruction,
        },
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'proposal_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'proposal_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] local edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status =
        message === 'artifact_not_found' ||
        message === 'section_not_found' ||
        message === 'block_not_found'
          ? 404
          : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.get(
  '/:artifactId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    // A4 — hydrate the persisted generation-warnings channel so the FE
    // can render the "generated with limitations" chip on reload, not
    // just immediately after generation. Best-effort ([] on any miss).
    const generationWarnings = await getDocumentGenerationWarnings(artifactId, organizationId);
    res.json({ schema, generationWarnings });
  })
);

// P0 data-loss fix — manual (non-AI) TipTap editor autosave.
// Body: { sections, expectedVersion }. `expectedVersion` is the
// `schema.updatedAt` the client last read; mirrors the notebook
// pattern (`PUT /api/v8/notebook/pages/:noteId/content`). Returns 409
// with { conflict: { yourVersion, serverVersion } } on a stale write —
// never a silent overwrite. This is a content-only save; it never
// touches the proposal/approve pipeline (see
// `updateDocumentManualContent` doc-comment).
router.put(
  '/:artifactId/content',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const body = (req.body ?? {}) as {
      sections?: unknown;
      expectedVersion?: unknown;
      // P-10 (2026-07-28): optional title rename riding along the same
      // durable content save — see `updateDocumentManualContent` doc-comment.
      title?: unknown;
      sourceRefs?: unknown;
    };
    if (!Array.isArray(body.sections)) {
      res.status(400).json({ error: 'sections_required', code: 'DOC_CONTENT_SECTIONS_REQUIRED' });
      return;
    }
    if (!body.expectedVersion || typeof body.expectedVersion !== 'string') {
      res
        .status(400)
        .json({ error: 'expectedVersion_required', code: 'DOC_CONTENT_EXPECTED_VERSION_REQUIRED' });
      return;
    }
    if (body.title !== undefined && typeof body.title !== 'string') {
      res.status(400).json({ error: 'title_must_be_string', code: 'DOC_CONTENT_TITLE_INVALID' });
      return;
    }
    if (body.sourceRefs !== undefined && !Array.isArray(body.sourceRefs)) {
      res
        .status(400)
        .json({ error: 'sourceRefs_must_be_array', code: 'DOC_CONTENT_SOURCE_REFS_INVALID' });
      return;
    }
    try {
      const result = await updateDocumentManualContent({
        artifactId,
        organizationId,
        userId,
        sections: body.sections as DocumentSchema['sections'],
        expectedVersion: body.expectedVersion,
        title: typeof body.title === 'string' ? body.title : undefined,
        sourceRefs: Array.isArray(body.sourceRefs)
          ? (body.sourceRefs as DocumentSchema['sourceRefs'])
          : undefined,
      });
      // MAT-010 lineage hook (fail-safe). The Document type's real
      // version-producing route (durable content save with a compare-and-swap
      // on `expectedVersion`). Recorded only past that guard —
      // `DocumentManualSaveConflictError` (409) is handled below and never
      // reaches here, so a losing writer stays out of the lineage.
      // `...Tracked` + `respondIfLineageLost` (Codex review, second round):
      // retry-safe — confirmed against `updateDocumentManualContent`
      // (documentStudioService.ts), which rejects a stale `expectedVersion`
      // with `DocumentManualSaveConflictError` (409) BEFORE writing, so a
      // retry of an already-applied save can never double-apply.
      const versionOutcome = await recordLineageEventTracked({
        organizationId,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'version',
        actorUserId: userId,
        titleSnapshot: typeof body.title === 'string' ? body.title : null,
        detail: {
          previousVersion: body.expectedVersion,
          sectionCount: Array.isArray(body.sections) ? body.sections.length : null,
        },
      });
      if (respondIfLineageLost(res, versionOutcome)) return;

      const staleApprovalIds = markDocumentApprovalsStaleForVersionChange({
        organizationId,
        artifactId,
        previousVersionId: body.expectedVersion,
        currentVersionId: result.schema.updatedAt,
        actorId: userId,
      });
      const staleAuditPersisted = await Promise.all(
        staleApprovalIds.map((approvalId) => flushApprovalPersistence(organizationId, approvalId))
      );
      if (staleAuditPersisted.some((persisted) => !persisted)) {
        res.status(503).json({ error: 'approval_stale_audit_persistence_failed' });
        return;
      }
      res.json({ schema: result.schema });
    } catch (err) {
      if (err instanceof DocumentManualSaveNotFoundError) {
        res.status(404).json({ error: 'document_not_found' });
        return;
      }
      if (err instanceof DocumentManualSaveConflictError) {
        res.status(409).json({
          error: 'manual_save_conflict',
          code: 'DOC_CONTENT_CONFLICT',
          conflict: {
            yourVersion: body.expectedVersion,
            serverVersion: err.serverVersion,
          },
        });
        return;
      }
      if (err instanceof DocumentManualStructureMismatchError) {
        res.status(422).json({
          error: err.code,
          code: 'DOC_CONTENT_TEMPLATE_STRUCTURE_MISMATCH',
          expectedSectionCount: err.expectedSectionCount,
          receivedSectionCount: err.receivedSectionCount,
        });
        return;
      }
      const rawMessage = err instanceof Error ? err.message : 'manual_save_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'manual_save_failed';
      logger.error('[DocumentStudio] manual content save failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      res.status(400).json({ error: message });
    }
  })
);

router.get(
  '/:artifactId/export/:format',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId);
    const formatRaw = String(req.params.format).toLowerCase();
    if (formatRaw !== 'markdown' && formatRaw !== 'docx' && formatRaw !== 'pdf') {
      res.status(400).json({ error: 'unsupported_format' });
      return;
    }
    const format = formatRaw as 'markdown' | 'docx' | 'pdf';
    const modeRaw = typeof req.query.mode === 'string' ? req.query.mode.toLowerCase() : null;
    if (modeRaw !== null && modeRaw !== 'draft' && modeRaw !== 'final') {
      res.status(400).json({ error: 'unsupported_export_mode' });
      return;
    }
    const exportMode = modeRaw as 'draft' | 'final' | null;
    const qaOverride = req.query.qaOverride === 'true' || req.query.qaOverride === '1';
    const { userRole } = getAuthContext(req as AuthRequest);

    try {
      // Explicit v2 final exports require a current approval. Calls without a
      // mode retain the historical endpoint contract during staged rollout.
      if (exportMode === 'final') {
        const schema = await getDocumentArtifact(artifactId, organizationId);
        if (!schema) {
          res.status(404).json({ error: 'document_not_found' });
          return;
        }
        const approvalCurrentForVersion = listDocumentApprovals(organizationId, {
          artifactId,
          status: 'approved',
        }).some((approval) => approval.versionId === schema.updatedAt);
        const policy = evaluateArtifactExportPolicy({
          mode: 'final',
          channel: 'download',
          classification: schema.confidentiality === 'public' ? 'public' : 'internal',
          criticalQaFindings: 0,
          approvalCurrentForVersion,
        });
        if (!policy.allowed) {
          res.status(409).json({
            error: 'artifact_export_blocked',
            code: 'ARTIFACT_EXPORT_BLOCKED',
            mode: 'final',
            blocks: policy.blocks,
          });
          return;
        }
      }
      const result = await exportDocumentArtifact(artifactId, organizationId, format, {
        userId,
        userRole,
        qaOverride,
        ...(exportMode ? { mode: exportMode } : {}),
      });
      res.setHeader('X-Artifact-Export-Mode', exportMode ?? 'legacy-final');
      if (exportMode === 'draft') res.setHeader('X-Artifact-Draft', 'true');
      if (format === 'docx' || format === 'pdf') {
        await reportsPresModelService
          .recordCompletedExport(artifactId, organizationId, format, userId)
          .catch(() => null);
      }

      // MAT-010 lineage hook (fail-safe). Only a genuinely completed export
      // becomes a lineage entry — the QA-blocked (403) and failure paths are
      // handled in the catch below and never reach here. Covers all three
      // formats, unlike `recordCompletedExport` above which is docx/pdf only:
      // before MAT-010, Document markdown exports were recorded NOWHERE.
      // `...Tracked` + `respondIfLineageLost` (Codex review, second round):
      // re-running an export has no exactly-once side effect to duplicate —
      // it regenerates the same file and appends another (legitimate) export
      // record, same reasoning as Workbook's export hook.
      const exportOutcome = await recordLineageEventTracked({
        organizationId,
        artifactKind: 'document',
        sourceRecordId: artifactId,
        eventType: 'export',
        actorUserId: userId,
        detail: { format, qaOverride },
      });
      if (respondIfLineageLost(res, exportOutcome)) return;

      res.json(result);
    } catch (err) {
      if (err instanceof QaOverrideUnauthorizedError) {
        res.status(403).json({
          error: 'qa_override_unauthorized',
          message: err.message,
          role: err.role,
        });
        return;
      }
      if (err instanceof QaBlockingError) {
        res.status(403).json({
          error: 'qa_blocking',
          message:
            'Document QA produced blocking findings. Resolve the findings or re-run with qaOverride=true (audited).',
          report: err.report,
        });
        return;
      }
      if (format === 'docx' || format === 'pdf') {
        await reportsPresModelService
          .recordFailedExport(artifactId, organizationId, format, userId)
          .catch(() => null);
      }
      const message = err instanceof Error ? err.message : 'Failed to export document';
      logger.error('[DocumentStudio] export failed', { message });
      const notFound = message.toLowerCase().includes('not found');
      const status = notFound ? 404 : 500;
      res.status(status).json({
        error: notFound ? 'document_not_found' : 'export_failed',
        message: notFound ? 'Document not found' : GENERIC_5XX_MESSAGE,
      });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/section',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const sectionId = typeof req.body?.sectionId === 'string' ? req.body.sectionId : '';
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
    if (!sectionId || !instruction) {
      res.status(400).json({ error: 'sectionId and instruction are required' });
      return;
    }
    try {
      const proposal = await createSectionEditProposal({
        artifactId,
        organizationId,
        userId,
        sectionId,
        instruction,
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'proposal_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'proposal_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] section edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status =
        message === 'artifact_not_found' || message === 'section_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/global',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
    if (!instruction) {
      res.status(400).json({ error: 'instruction is required' });
      return;
    }
    try {
      const proposal = await createGlobalEditProposal({
        artifactId,
        organizationId,
        userId,
        instruction,
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'proposal_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'proposal_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] global edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status = message === 'artifact_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

// Slice E3.5 — methodology scope. Service-side existed since E3.1;
// HTTP surface added here so the frontend's `DocumentEditorScope`
// can grow from 3 → 5 values and the Teresa intent classifier's
// methodology branch becomes invokable end-to-end.
router.post(
  '/:artifactId/editor/proposals/methodology',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
    if (!instruction) {
      res.status(400).json({ error: 'instruction is required' });
      return;
    }
    try {
      const proposal = await createMethodologyEditProposal({
        artifactId,
        organizationId,
        userId,
        instruction,
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'proposal_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'proposal_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] methodology edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      // `no_methodology_sections` is a 400 — the artifact exists but
      // the document type does not surface methodology-aligned sections
      // (e.g. a pure executive_memo with no methodology kind blocks).
      const status = message === 'artifact_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

// Slice E3.5 — source scope. Operates on blocks that carry a
// `sourceRef`, preserving the citation multiset (refiner guard from
// E3.2). Returns 400 `no_source_anchored_blocks` when no source-
// backed blocks exist so the UI can surface a remediation hint
// (e.g. "attach sources before invoking source scope").
router.post(
  '/:artifactId/editor/proposals/source',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
    if (!instruction) {
      res.status(400).json({ error: 'instruction is required' });
      return;
    }
    try {
      const proposal = await createSourceEditProposal({
        artifactId,
        organizationId,
        userId,
        instruction,
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'proposal_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'proposal_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] source edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status = message === 'artifact_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

// Slice E3.6 — transformative scope (6th poziom edycji). The user has
// explicitly authorized a dramatic rebuild. Service-side guardrails
// relax structural constraints but keep absolute safety caps; audit
// trail tags the proposal with `authority: 'user_explicit_rebuild'`
// so reviewers can filter for elevated-authority edits when triaging.
router.post(
  '/:artifactId/editor/proposals/transformative',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction : '';
    if (!instruction) {
      res.status(400).json({ error: 'instruction is required' });
      return;
    }
    try {
      const proposal = await createTransformativeEditProposal({
        artifactId,
        organizationId,
        userId,
        instruction,
        useLlm: req.body?.useLlm === true,
      });
      res.json({ proposal });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'proposal_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'proposal_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] transformative edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      // `document_has_no_sections` mirrors the global-route behavior: a
      // freshly-skeletoned artifact with zero sections cannot be
      // transformatively rewritten because there is nothing to rewrite.
      const status = message === 'artifact_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/:proposalId/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const proposalId = String(req.params.proposalId || '');
    if (!artifactId || !proposalId) {
      res.status(400).json({ error: 'artifactId and proposalId are required' });
      return;
    }
    try {
      const result = await approveEditProposal({
        artifactId,
        organizationId,
        userId,
        proposalId,
      });
      res.json(result);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'approve_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'approve_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] approve edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status =
        message === 'artifact_not_found' || message === 'proposal_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.post(
  '/:artifactId/editor/proposals/:proposalId/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    const proposalId = String(req.params.proposalId || '');
    if (!artifactId || !proposalId) {
      res.status(400).json({ error: 'artifactId and proposalId are required' });
      return;
    }
    try {
      const proposal = await rejectEditProposal({
        artifactId,
        organizationId,
        userId,
        proposalId,
      });
      res.json({ proposal });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'reject_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'reject_failed';
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] reject edit proposal failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      const status = message === 'proposal_not_found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  })
);

router.get(
  '/:artifactId/editor/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'artifact_not_found' });
      return;
    }
    const auditEntries = await listDocumentAuditEntriesAsync(artifactId, organizationId);
    res.json({ auditEntries });
  })
);

// Slice FR-37.access-history — unified, chronological view of every
// touch on the document (proposals, comments, lifecycle, exports,
// share-link consumes, approvals, ...). Replaces the per-service
// audit drill-down with a single feed for the right-panel "Access
// History" tab.
//
// GET /api/document-studio/:artifactId/access-history?limit=&offset=&source=
//   - `source` repeats are allowed: ?source=document_audit&source=share_link
//   - default limit = 200; hard cap = 1000.
router.get(
  '/:artifactId/access-history',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const schema = await getDocumentArtifact(artifactId, organizationId);
    if (!schema) {
      res.status(404).json({ error: 'artifact_not_found' });
      return;
    }
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const limit = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : undefined;
    const offset = typeof offsetRaw === 'string' ? Number.parseInt(offsetRaw, 10) : undefined;
    const sourceRaw = req.query.source;
    const sourcesArr: ('document_audit' | 'share_link' | 'approval')[] = [];
    const validSources = new Set(['document_audit', 'share_link', 'approval'] as const);
    if (typeof sourceRaw === 'string') {
      if (validSources.has(sourceRaw as never))
        sourcesArr.push(sourceRaw as 'document_audit' | 'share_link' | 'approval');
    } else if (Array.isArray(sourceRaw)) {
      for (const s of sourceRaw) {
        if (typeof s === 'string' && validSources.has(s as never)) {
          sourcesArr.push(s as 'document_audit' | 'share_link' | 'approval');
        }
      }
    }
    const result = getDocumentAccessHistory({
      artifactId,
      organizationId,
      options: {
        limit,
        offset,
        sources: sourcesArr.length > 0 ? sourcesArr : undefined,
      },
    });
    res.json(result);
  })
);

router.get(
  '/:artifactId/qa',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const report = await runQaForDocument(artifactId, organizationId);
    if (!report) {
      res.status(404).json({ error: 'artifact_not_found' });
      return;
    }
    res.json({ report });
  })
);

// =============================================================================
// Asset registry surface — Slice E15.5.coverPageLogo.
//
// Tenant-scoped binary assets (currently `'logo'`) the cover-page
// renderer can embed. Auth required for every route — the asset
// bytes never leave the authenticated boundary, even though the
// rendered cover does (via authored exports).
//
//   POST   /api/document-studio/assets/logo                 — body { mimeType, dataBase64, filename? }
//   GET    /api/document-studio/assets/logo/active          — returns { asset } or 404
//   GET    /api/document-studio/assets                      — list (status?, kind?)
//   GET    /api/document-studio/assets/:assetId             — get one
//   POST   /api/document-studio/assets/:assetId/archive     — body { reason? }
//   GET    /api/document-studio/assets/:assetId/audit       — audit chain
//
// Validation errors map to 400 with `error: <asset_invalid_*>` codes;
// missing / cross-tenant assets return 404 `asset_not_found`.
// =============================================================================

router.post(
  '/assets/logo',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : '';
    const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';
    const filename = typeof req.body?.filename === 'string' ? req.body.filename : undefined;
    try {
      const asset = registerLogo({
        organizationId,
        actorId: userId,
        mimeType,
        dataBase64,
        filename,
      });
      res.status(201).json({ asset });
    } catch (err) {
      const rawCode = err instanceof Error ? err.message : 'asset_invalid';
      const code = isSafeErrorCode(rawCode) ? rawCode : 'asset_invalid';
      if (code !== rawCode) {
        logger.error('[DocumentStudio] logo registration failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(400).json({ error: code });
    }
  })
);

router.post(
  '/assets/logo/upload',
  logoUploadSingleMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const uploaded = (req as Request & { file?: Express.Multer.File }).file;
    if (!uploaded || !uploaded.buffer || uploaded.buffer.length === 0) {
      res.status(400).json({ error: 'asset_file_required' });
      return;
    }
    const filename =
      typeof req.body?.filename === 'string' && req.body.filename.trim().length > 0
        ? req.body.filename
        : uploaded.originalname;
    try {
      const asset = registerLogo({
        organizationId,
        actorId: userId,
        mimeType: uploaded.mimetype ?? '',
        dataBase64: uploaded.buffer.toString('base64'),
        filename,
      });
      res.status(201).json({ asset });
    } catch (err) {
      const rawCode = err instanceof Error ? err.message : 'asset_invalid';
      const code = isSafeErrorCode(rawCode) ? rawCode : 'asset_invalid';
      if (code !== rawCode) {
        logger.error('[DocumentStudio] logo registration failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(400).json({ error: code });
    }
  })
);

router.get(
  '/assets/logo/active',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const asset = getActiveOrgLogo(organizationId);
    if (!asset) {
      res.status(404).json({ error: 'asset_not_found' });
      return;
    }
    res.json({ asset });
  })
);

router.get(
  '/assets',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const status =
      req.query.status === 'active' || req.query.status === 'archived'
        ? (req.query.status as 'active' | 'archived')
        : undefined;
    const kind = req.query.kind === 'logo' ? ('logo' as const) : undefined;
    const assets = listAssetsForOrg(organizationId, { status, kind });
    res.json({ assets });
  })
);

router.get(
  '/assets/:assetId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const assetId = String(req.params.assetId || '');
    try {
      const asset = getAssetById({ assetId, organizationId });
      res.json({ asset });
    } catch (err) {
      const rawCode = err instanceof Error ? err.message : 'asset_not_found';
      const code = isSafeErrorCode(rawCode) ? rawCode : 'asset_not_found';
      if (code !== rawCode) {
        logger.error('[DocumentStudio] get asset failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(code === 'asset_not_found' ? 404 : 400).json({ error: code });
    }
  })
);

router.post(
  '/assets/:assetId/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const assetId = String(req.params.assetId || '');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const asset = archiveAsset({
        assetId,
        organizationId,
        actorId: userId,
        reason,
      });
      res.json({ asset });
    } catch (err) {
      const rawCode = err instanceof Error ? err.message : 'asset_not_found';
      const code = isSafeErrorCode(rawCode) ? rawCode : 'asset_not_found';
      if (code !== rawCode) {
        logger.error('[DocumentStudio] archive asset failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(code === 'asset_not_found' ? 404 : 400).json({ error: code });
    }
  })
);

router.get(
  '/assets/:assetId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const assetId = String(req.params.assetId || '');
    try {
      const audit = listAssetAudit(assetId, organizationId);
      res.json({ audit });
    } catch (err) {
      const rawCode = err instanceof Error ? err.message : 'asset_not_found';
      const code = isSafeErrorCode(rawCode) ? rawCode : 'asset_not_found';
      if (code !== rawCode) {
        logger.error('[DocumentStudio] asset audit failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(code === 'asset_not_found' ? 404 : 400).json({ error: code });
    }
  })
);

// =============================================================================
// Share-link surface — Epic E13 (FR-40).
//
// Authed routes (creator / admin side). The public consume route lives
// in `documentShareLinkPublicRoutes` below — it MUST run before
// `verifyToken` so an unauthenticated consumer can resolve the token.
// =============================================================================

router.post(
  '/:artifactId/share-links',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    const accessScopeRaw =
      typeof req.body?.accessScope === 'string' ? req.body.accessScope : 'read';
    const allowedScopes: DocumentShareLinkAccessScope[] = ['read', 'comment', 'download', 'edit'];
    if (!allowedScopes.includes(accessScopeRaw as DocumentShareLinkAccessScope)) {
      res.status(400).json({ error: 'invalid_access_scope', message: accessScopeRaw });
      return;
    }
    const expiresAt = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : undefined;
    const label = typeof req.body?.label === 'string' ? req.body.label : undefined;
    // Blocker C (Codex, third round) — the same request-bound idempotency as
    // checkpoint/restore. `createShareLink` mints a brand-new, independent,
    // live token on every call with no dedup, so a retried request must be
    // caught here rather than by the mutation itself. Opt-in via
    // `Idempotency-Key`; no header means no behavior change.
    const idempotencyHeader = req.headers['idempotency-key'];
    const requestKey =
      typeof idempotencyHeader === 'string' && idempotencyHeader.trim() !== ''
        ? idempotencyHeader.trim()
        : null;
    const shareIdempotencyKey = requestKey
      ? deriveRequestBoundIdempotencyKey({
          artifactKind: 'document',
          sourceRecordId: artifactId,
          eventType: 'share_minted',
          requestKey,
        })
      : null;

    async function replayShareMintFromResultId(shareLinkId: string | null): Promise<void> {
      // round-5 redesign — durable DB read via the claim's own
      // `completedResultId` (the minted link's own id), not the in-memory
      // `getShareLink` getter. `document_share_links.token` already stores
      // the raw token in plaintext (pre-existing design, confirmed against
      // `documentShareLinkRegistryDao.ts` — not something this round
      // introduces or downgrades), so a replay after a restart returns the
      // SAME usable token without ever writing a NEW plaintext credential.
      const shareLink = shareLinkId ? await loadShareLinkById(shareLinkId, organizationId) : null;
      res.status(201).json({ shareLink: shareLink ?? { shareLinkId }, idempotentReplay: true });
    }

    const runShareMint = async (): Promise<void> => {
      // See the checkpoint route's `checkpointClaim` for what this gates.
      let shareClaim: { ownerToken: string; fencingToken: number } | null = null;
      // G22 fix — see the checkpoint route's identical `checkpointHeartbeat`.
      let shareHeartbeat: ReturnType<typeof startClaimHeartbeat> | null = null;

      if (shareIdempotencyKey) {
        // round-5 redesign — see the checkpoint route above and
        // `operationClaimService.ts`'s doc comment for the full mechanism.
        const claim = await acquireOrReclaimOperationClaim({
          organizationId,
          operationKey: shareIdempotencyKey,
        });
        if (claim.outcome === 'completed') {
          await replayShareMintFromResultId(claim.completedResultId);
          return;
        }
        if (claim.outcome === 'active_elsewhere') {
          res.status(409).json({
            success: false,
            error: 'Another request is currently completing this share mint',
            code: 'IDEMPOTENCY_IN_PROGRESS',
          });
          return;
        }
        if (claim.outcome === 'failed') {
          res.status(500).json({
            success: false,
            error: 'The operation could not be durably claimed before this request',
            code: 'CLAIM_ACQUIRE_FAILED',
          });
          return;
        }
        // claim.outcome === 'acquired' — this caller alone proceeds below.
        shareClaim = { ownerToken: claim.ownerToken, fencingToken: claim.fencingToken };
        shareHeartbeat = startClaimHeartbeat({
          organizationId,
          operationKey: shareIdempotencyKey,
          ownerToken: claim.ownerToken,
          fencingToken: claim.fencingToken,
        });
      }

      try {
        // Never mint a public capability for a guessed/non-existent id. The
        // tenant-scoped canonical read is the ownership/existence gate.
        const document = await getDocumentArtifact(artifactId, organizationId);
        if (!document) {
          res.status(404).json({ error: 'document_not_found' });
          return;
        }
        const publicLinkPolicy = evaluateArtifactExportPolicy({
          mode: 'draft',
          channel: 'public_link',
          classification: document.confidentiality === 'public' ? 'public' : 'internal',
          criticalQaFindings: 0,
          approvalCurrentForVersion: false,
        });
        if (!publicLinkPolicy.allowed) {
          res.status(409).json({
            error: 'public_link_classification_blocked',
            code: 'PUBLIC_LINK_CLASSIFICATION_BLOCKED',
            blocks: publicLinkPolicy.blocks,
          });
          return;
        }
        const link = await createShareLinkDurable({
          artifactId,
          organizationId,
          userId,
          accessScope: accessScopeRaw as DocumentShareLinkAccessScope,
          expiresAt,
          label,
        });

        // G22 fix — see the checkpoint route's identical check.
        if (shareHeartbeat?.isFenced()) {
          res.status(409).json({
            success: false,
            error:
              'This operation was reclaimed by another request before it could be finalized; retry',
            code: 'IDEMPOTENCY_STALE_CLAIM',
          });
          return;
        }

        // Preserve the existing idempotency read-back check even though the
        // durable creator already awaits persistence.
        const durable = shareIdempotencyKey
          ? await pollForDurability(() => loadShareLinkById(link.shareLinkId, organizationId))
          : true;
        if (shareIdempotencyKey && !durable) {
          logger.error('[DocumentStudio] share link did not durably persist in time', {
            artifactId,
            organizationId,
            shareLinkId: link.shareLinkId,
          });
          // Claim deliberately left ACTIVE — see the checkpoint route's
          // identical comment on the SNAPSHOT_PERSIST_UNCONFIRMED branch.
          res.status(500).json({
            success: false,
            error: 'Share link could not be confirmed durable',
            code: 'SHARE_LINK_PERSIST_UNCONFIRMED',
          });
          return;
        }

        // MAT-010 lineage hook (fail-safe). Records the non-secret
        // `shareLinkId` and scope ONLY — never `link.token` or `link.tokenHash`.
        // `shareLinkId` is what the revoke route keys on, so mint and revoke
        // correlate exactly without putting any token material in the lineage.
        // The claim above is what now prevents a client retry from
        // re-running `createShareLink` a second time.
        const shareOutcome = await recordLineageEventTracked({
          organizationId,
          artifactKind: 'document',
          sourceRecordId: artifactId,
          eventType: 'share_minted',
          actorUserId: userId,
          idempotencyKey: shareIdempotencyKey ?? undefined,
          detail: {
            shareLinkId: link.shareLinkId,
            accessScope: link.accessScope,
            expiresAt: link.expiresAt ?? null,
          },
        });

        // round-5 redesign — see the checkpoint route's identical comment:
        // finalize the CLAIM (canonical result = the minted link's own id)
        // regardless of the outbox's own durability outcome.
        if (shareClaim) {
          const finalizeResult = await finalizeOperationClaim({
            organizationId,
            operationKey: shareIdempotencyKey as string,
            ownerToken: shareClaim.ownerToken,
            fencingToken: shareClaim.fencingToken,
            completedResultId: link.shareLinkId,
          });
          if (respondIfClaimFenced(res, finalizeResult)) return;
          if (finalizeResult.outcome === 'failed') {
            res.status(500).json({
              success: false,
              error: 'The operation completed but its claim could not be finalized',
              code: 'CLAIM_FINALIZE_FAILED',
            });
            return;
          }
        }
        if (respondIfLineageLost(res, shareOutcome)) return;

        res.status(201).json({ shareLink: link });
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : 'share_link_create_failed';
        const message = isSafeErrorCode(rawMessage) ? rawMessage : 'share_link_create_failed';
        logger.warn('[DocumentStudio] share-link create failed', {
          err,
          correlationId: (req as any).correlationId,
        });
        res
          .status(message === 'share_link_persistence_failed' ? 503 : 400)
          .json({ error: 'share_link_create_failed', message });
      } finally {
        shareHeartbeat?.stop();
      }
    };

    await runShareMint();
  })
);

router.get(
  '/:artifactId/share-links',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const artifactId = String(req.params.artifactId || '');
    if (!artifactId) {
      res.status(400).json({ error: 'artifactId is required' });
      return;
    }
    await ensureShareLinkRegistryHydrated(organizationId);
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const allowedStatus: DocumentShareLinkStatus[] = ['active', 'revoked', 'expired'];
    const status =
      statusRaw && allowedStatus.includes(statusRaw as DocumentShareLinkStatus)
        ? (statusRaw as DocumentShareLinkStatus)
        : undefined;
    const includeExpired = req.query.includeExpired === 'true' || req.query.includeExpired === '1';
    const links = listShareLinks(organizationId, {
      artifactId,
      status,
      includeExpired,
    });
    // Decorate each link with its runtime status so the FE-E2 right
    // panel surface can render "expired" / "revoked" / "active" badges
    // without re-deriving them.
    const decorated = links.map((link) => ({
      ...link,
      runtimeStatus: getShareLinkRuntimeStatus(link),
    }));
    res.json({ shareLinks: decorated });
  })
);

router.get(
  '/share-links/:shareLinkId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const shareLinkId = String(req.params.shareLinkId || '');
    if (!shareLinkId) {
      res.status(400).json({ error: 'shareLinkId is required' });
      return;
    }
    await ensureShareLinkRegistryHydrated(organizationId);
    const link = getShareLink(shareLinkId, organizationId);
    if (!link) {
      res.status(404).json({ error: 'share_link_not_found' });
      return;
    }
    res.json({
      shareLink: link,
      runtimeStatus: getShareLinkRuntimeStatus(link),
    });
  })
);

router.post(
  '/share-links/:shareLinkId/revoke',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const shareLinkId = String(req.params.shareLinkId || '');
    if (!shareLinkId) {
      res.status(400).json({ error: 'shareLinkId is required' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    try {
      const revoked = await revokeShareLinkDurable({
        shareLinkId,
        organizationId,
        userId,
        reason,
      });

      // MAT-010 lineage hook (fail-safe). The artifact comes from the REVOKED
      // RECORD (`revoked.artifactId`), not from the request — this route is
      // keyed by `shareLinkId` alone and never receives an artifact id, so
      // trusting the caller for it would be unsound. `revokeShareLink` is
      // already org-scoped and throws `share_link_not_found` (404 below) for
      // another tenant's link, so a cross-tenant revoke never reaches here.
      // `...Tracked` + `respondIfLineageLost` (Codex review, second round):
      // retry-safe — confirmed against `revokeShareLink`
      // (documentShareLinkService.ts), which explicitly treats an
      // already-revoked link as a no-op and returns it unchanged, so a
      // retried revoke cannot double-apply anything.
      const revokeOutcome = await recordLineageEventTracked({
        organizationId,
        artifactKind: 'document',
        sourceRecordId: revoked.artifactId,
        eventType: 'share_revoked',
        actorUserId: userId,
        detail: { shareLinkId: revoked.shareLinkId, reason: reason ?? null },
      });
      if (respondIfLineageLost(res, revokeOutcome)) return;

      res.json({ shareLink: revoked });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'share_link_revoke_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'share_link_revoke_failed';
      if (message === 'share_link_not_found') {
        res.status(404).json({ error: message });
        return;
      }
      if (message === 'share_link_concurrent_change') {
        res.status(409).json({ error: message });
        return;
      }
      logger.warn('[DocumentStudio] share-link revoke failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      res
        .status(message === 'share_link_persistence_failed' ? 503 : 400)
        .json({ error: 'share_link_revoke_failed', message });
    }
  })
);

router.get(
  '/share-links/:shareLinkId/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const shareLinkId = String(req.params.shareLinkId || '');
    if (!shareLinkId) {
      res.status(400).json({ error: 'shareLinkId is required' });
      return;
    }
    await ensureShareLinkRegistryHydrated(organizationId);
    // Verify the link exists for this tenant before exposing its audit
    // (cross-tenant audit reads must be deny-by-default).
    const link = getShareLink(shareLinkId, organizationId);
    if (!link) {
      res.status(404).json({ error: 'share_link_not_found' });
      return;
    }
    const auditEntries = listShareLinkAuditEntries(shareLinkId, organizationId);
    res.json({ auditEntries });
  })
);

// Slice E13.hardening — token rotation route. Mints a new token +
// HMAC hash; the previous token is invalidated immediately. Common
// use cases: leaked link, periodic rotation policy, near-miss
// security incident.
router.post(
  '/share-links/:shareLinkId/rotate',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, organizationId } = getAuthContext(req as AuthRequest);
    if (!userId || !organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const shareLinkId = String(req.params.shareLinkId || '');
    if (!shareLinkId) {
      res.status(400).json({ error: 'shareLinkId is required' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await ensureShareLinkRegistryHydrated(organizationId);
    try {
      const rotated = await rotateShareLinkTokenDurable({
        shareLinkId,
        organizationId,
        userId,
        reason,
      });
      res.json({ shareLink: rotated });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'share_link_rotate_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'share_link_rotate_failed';
      if (message === 'share_link_not_found') {
        res.status(404).json({ error: message });
        return;
      }
      if (message === 'share_link_not_active') {
        res.status(409).json({ error: message });
        return;
      }
      if (message === 'share_link_concurrent_change') {
        res.status(409).json({ error: message });
        return;
      }
      logger.warn('[DocumentStudio] share-link rotate failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      res
        .status(message === 'share_link_persistence_failed' ? 503 : 400)
        .json({ error: 'share_link_rotate_failed', message });
    }
  })
);

// =============================================================================
// Public share-link consume route — UNAUTHENTICATED on purpose.
//
// Mounted as a SEPARATE router so it can run before `verifyToken`. The
// Gateway mounts this on the same `/api/document-studio` prefix so the
// URL is `POST /api/document-studio/share-links/resolve`.
//
// Body: { token: string, consumerFingerprint?: string }
// 200 { artifactId, organizationId, accessScope, shareLinkId, consumeCount }
// 404 share_link_invalid_or_expired (catch-all for missing / revoked /
//     expired tokens — never leak which of the three it is to a
//     consumer).
// =============================================================================

export const documentShareLinkPublicRoutes = Router();

const publicShareLinkLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

/**
 * F1/F3 — client-reader (`ff_client_reader`). Whitelisted public
 * projection of a `DocumentSchema` for an unauthenticated share-link
 * consumer.
 *
 * Deliberately DROPS every field that is internal to the consulting
 * org and not needed to render read-only prose: `clientId`, `owner`,
 * `sourcePackId`, `templateRef`, `evidence`, `documentStatus*`
 * lifecycle bookkeeping, section/block `sourceRefs` + `sourceRef`
 * (internal source-system ids/titles), and `audienceTags` (internal
 * targeting metadata). Only `title` + rendered section/block content
 * survive — the same shape a client is meant to read, nothing an
 * internal reviewer would see in the editor's Properties tab.
 */
function projectDocumentForPublicReader(schema: DocumentSchema): {
  title: string;
  documentType: string;
  language: string;
  sections: Array<{
    sectionId: string;
    title: string;
    level: number;
    kind: string;
    blocks: Array<{ blockId: string; type: string; content: unknown; isAssumption: boolean }>;
  }>;
} {
  const sections = [...schema.sections]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((section) => ({
      sectionId: section.sectionId,
      title: section.title,
      level: section.level,
      kind: section.kind ?? 'body',
      blocks: section.blocks.map((block) => ({
        blockId: block.blockId,
        type: block.type,
        content: block.content,
        isAssumption: Boolean(block.isAssumption),
      })),
    }));
  return {
    title: schema.title,
    documentType: schema.documentType,
    language: schema.language,
    sections,
  };
}

documentShareLinkPublicRoutes.post(
  '/share-links/resolve',
  publicShareLinkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const consumerFingerprint =
      typeof req.body?.consumerFingerprint === 'string' ? req.body.consumerFingerprint : undefined;
    if (!token.trim()) {
      res.status(400).json({ error: 'token_required' });
      return;
    }
    const result = await consumeShareLink({ token, consumerFingerprint });
    if (!result) {
      // Single 404 surface for missing / revoked / expired so a
      // consumer cannot enumerate which tokens existed once.
      res.status(404).json({ error: 'share_link_invalid_or_expired' });
      return;
    }
    const { organizationId: _orgId, ...publicResult } = result;
    res.json({ resolved: publicResult });
  })
);

// F1/F3 client-reader — serves the actual document content for a
// resolved share link. `resolve` above intentionally returns ONLY the
// authorization tuple (never content); the reader FE calls this route
// to get the whitelisted, read-only projection to render. Any
// accessScope that resolves successfully (read / comment / download /
// edit) may view the document — the scope only gates MUTATION
// (comment / edit), never viewing.
documentShareLinkPublicRoutes.post(
  '/share-links/document',
  publicShareLinkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token.trim()) {
      res.status(400).json({ error: 'token_required' });
      return;
    }
    const result = await consumeShareLink({ token });
    if (!result) {
      res.status(404).json({ error: 'share_link_invalid_or_expired' });
      return;
    }
    const schema = await getDocumentArtifact(result.artifactId, result.organizationId);
    if (!schema) {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }

    // MAT-010 lineage hook (fail-safe). The Document type's genuine
    // UNAUTHENTICATED public reader (this router is mounted OUTSIDE
    // `router.use(verifyToken)`), so it is the true counterpart of
    // `GET /api/workbook/shared/:token` and `GET /api/presentations/shared/:token`.
    //
    // The tenant comes from the RESOLVED LINK (`result.organizationId`),
    // server-side — never from the requester, who is anonymous. There is no
    // actor, hence `actorUserId: null`. Placed after `consumeShareLink`
    // matched AND the document resolved, so an unknown / revoked / expired
    // token (404'd above) can never manufacture a `public_open`.
    await recordLineageEventSafe({
      organizationId: result.organizationId,
      artifactKind: 'document',
      sourceRecordId: result.artifactId,
      eventType: 'public_open',
      actorUserId: null,
      detail: { via: 'public_share_link', shareLinkId: result.shareLinkId },
    });

    res.json({
      shareLinkId: result.shareLinkId,
      accessScope: result.accessScope,
      artifactId: result.artifactId,
      document: projectDocumentForPublicReader(schema),
    });
  })
);

// F1/F3 client-reader — read the existing comment threads for a
// `comment` / `edit` scoped link so the reader can show the
// conversation before (and after) adding a new comment. `read` /
// `download` scopes have no comment UI and get 403 here, same as the
// mutation routes below.
documentShareLinkPublicRoutes.post(
  '/share-links/comments/list',
  publicShareLinkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token.trim()) {
      res.status(400).json({ error: 'token_required' });
      return;
    }
    const result = await consumeShareLink({ token });
    if (!result) {
      res.status(404).json({ error: 'share_link_invalid_or_expired' });
      return;
    }
    if (result.accessScope !== 'comment' && result.accessScope !== 'edit') {
      res.status(403).json({ error: 'share_link_scope_forbidden' });
      return;
    }
    await ensureDocumentCommentsHydrated(result.organizationId);
    const comments = listDocumentComments(result.artifactId, result.organizationId, {
      hideDeleted: true,
    });
    // `DocumentComment` carries `organizationId` (internal tenant id) —
    // every other public share-link response strips it (see `resolve`
    // above), so strip it here too rather than leak the tenant id to
    // an anonymous consumer through the comments feed.
    const publicComments = comments.map(({ organizationId: _orgId, ...rest }) => rest);
    res.json({ comments: publicComments });
  })
);

documentShareLinkPublicRoutes.post(
  '/share-links/edit-session',
  publicShareLinkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const consumerFingerprint =
      typeof req.body?.consumerFingerprint === 'string' ? req.body.consumerFingerprint : '';
    try {
      const session = await createShareLinkEditSession({ token, consumerFingerprint });
      res.status(201).json({ session });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'share_link_edit_session_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'share_link_edit_session_failed';
      if (message === 'share_link_invalid_or_expired') {
        res.status(404).json({ error: message });
        return;
      }
      if (message === 'share_link_scope_forbidden') {
        res.status(403).json({ error: message });
        return;
      }
      if (message === 'token_required' || message === 'consumer_fingerprint_required') {
        res.status(400).json({ error: message });
        return;
      }
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] public share-link edit-session failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(400).json({ error: 'share_link_edit_session_failed', message });
    }
  })
);

documentShareLinkPublicRoutes.post(
  '/share-links/comments',
  publicShareLinkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const editSessionToken =
      typeof req.body?.editSessionToken === 'string' ? req.body.editSessionToken : '';
    const consumerFingerprint =
      typeof req.body?.consumerFingerprint === 'string' ? req.body.consumerFingerprint : '';
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const anchor = parseCommentAnchorFromBody(req.body);
    if (!anchor) {
      res.status(400).json({
        error: 'invalid_anchor',
        message:
          'anchor must be { kind: "document" } | { kind: "section", sectionId } | { kind: "block", sectionId, blockId }',
      });
      return;
    }
    try {
      const auth = await authorizeShareLinkEditSession({
        token,
        editSessionToken,
        consumerFingerprint,
      });
      await ensureDocumentCommentsHydrated(auth.organizationId);
      const comment = createDocumentComment({
        organizationId: auth.organizationId,
        artifactId: auth.artifactId,
        authorId: `share-link:${auth.shareLinkId}`,
        body,
        anchor,
      });
      res.status(201).json({ comment });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        res
          .status(mapCommentErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      const rawMessage = err instanceof Error ? err.message : 'share_link_comment_create_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'share_link_comment_create_failed';
      if (message === 'share_link_not_found' || message === 'share_link_edit_session_invalid') {
        res.status(404).json({ error: message });
        return;
      }
      if (message === 'share_link_scope_forbidden' || message === 'share_link_not_active') {
        res.status(403).json({ error: message });
        return;
      }
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] public share-link comment create failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(400).json({ error: 'share_link_comment_create_failed', message });
    }
  })
);

documentShareLinkPublicRoutes.post(
  '/share-links/comments/:commentId/reply',
  publicShareLinkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const editSessionToken =
      typeof req.body?.editSessionToken === 'string' ? req.body.editSessionToken : '';
    const consumerFingerprint =
      typeof req.body?.consumerFingerprint === 'string' ? req.body.consumerFingerprint : '';
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const parentCommentId = String(req.params.commentId || '');
    try {
      const auth = await authorizeShareLinkEditSession({
        token,
        editSessionToken,
        consumerFingerprint,
      });
      await ensureDocumentCommentsHydrated(auth.organizationId);
      const comment = replyToDocumentComment({
        organizationId: auth.organizationId,
        artifactId: auth.artifactId,
        authorId: `share-link:${auth.shareLinkId}`,
        parentCommentId,
        body,
      });
      res.status(201).json({ comment });
    } catch (err) {
      if (err instanceof DocumentCommentError) {
        res
          .status(mapCommentErrorToStatus(err.code))
          .json({ error: err.code, message: err.message });
        return;
      }
      const rawMessage = err instanceof Error ? err.message : 'share_link_comment_reply_failed';
      const message = isSafeErrorCode(rawMessage) ? rawMessage : 'share_link_comment_reply_failed';
      if (message === 'share_link_not_found' || message === 'share_link_edit_session_invalid') {
        res.status(404).json({ error: message });
        return;
      }
      if (message === 'share_link_scope_forbidden' || message === 'share_link_not_active') {
        res.status(403).json({ error: message });
        return;
      }
      if (message !== rawMessage) {
        logger.error('[DocumentStudio] public share-link comment reply failed', {
          err,
          correlationId: (req as any).correlationId,
        });
      }
      res.status(400).json({ error: 'share_link_comment_reply_failed', message });
    }
  })
);

export default router;
