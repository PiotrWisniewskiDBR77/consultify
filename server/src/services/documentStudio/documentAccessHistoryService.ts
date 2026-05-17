/**
 * Document Studio — Slice FR-37.access-history aggregator.
 *
 * Returns a unified, chronological feed of every meaningful event
 * that touched a single `DocumentArtifact`. Pulls from the three
 * per-artifact audit feeds the V1 backend already maintains:
 *
 *   1. Document-level audit (`listDocumentAuditEntries`) — covers
 *      proposal lifecycle, comment lifecycle, lifecycle status
 *      transitions, exports, snapshot creation/rollback, etc.
 *   2. Share-link audit (`listShareLinkAuditEntries`) — covers
 *      share-link creation / revocation / consumption / expiry,
 *      including anonymous public consumes.
 *   3. Approval audit (`listDocumentApprovalAuditEntries`) — covers
 *      approval-request lifecycle for review-gated documents.
 *
 * Out of scope (deliberately, since they are tenant-shared rather
 * than artifact-bound): template / source-pack / brand-voice /
 * audience-profile / content-block audit feeds. Those surface in
 * their respective admin views.
 *
 * Performance: aggregates are computed on-demand from in-memory
 * audit stores (no I/O). For wave5 we'll swap to a server-side
 * materialized view; the public surface stays the same.
 */

import {
  listDocumentApprovalAuditEntries,
  listDocumentApprovals,
} from './documentApprovalService.js';
import { listShareLinkAuditEntries, listShareLinks } from './documentShareLinkService.js';
import { listDocumentAuditEntries } from './documentStudioService.js';
import type {
  DocumentAccessHistoryEntry,
  DocumentAccessHistorySource,
} from './documentStudioTypes.js';

export interface GetDocumentAccessHistoryOptions {
  /** Optional source filter — when present, only those sources contribute. */
  sources?: ReadonlyArray<DocumentAccessHistorySource>;
  /** Maximum number of entries returned (default 200, max 1000). */
  limit?: number;
  /** Number of entries to skip (default 0). */
  offset?: number;
}

interface GetDocumentAccessHistoryResult {
  artifactId: string;
  organizationId: string;
  /** Total entries assembled BEFORE applying limit / offset. */
  totalCount: number;
  /** Entries returned, sorted by `occurredAt` descending (newest first). */
  entries: DocumentAccessHistoryEntry[];
}

const DEFAULT_LIMIT = 200;
const HARD_LIMIT = 1000;

function compareOccurredAtDesc(
  a: DocumentAccessHistoryEntry,
  b: DocumentAccessHistoryEntry
): number {
  // Stable secondary sort by composite entryId so two events that
  // share an `occurredAt` to the millisecond have a deterministic
  // order across runs (audit IDs are UUIDs, lexicographic order is
  // arbitrary but consistent).
  if (a.occurredAt > b.occurredAt) return -1;
  if (a.occurredAt < b.occurredAt) return 1;
  if (a.entryId > b.entryId) return -1;
  if (a.entryId < b.entryId) return 1;
  return 0;
}

function clampLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(value), HARD_LIMIT);
}

function clampOffset(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function isSourceEnabled(
  sources: ReadonlyArray<DocumentAccessHistorySource> | undefined,
  source: DocumentAccessHistorySource
): boolean {
  if (!sources || sources.length === 0) return true;
  return sources.includes(source);
}

/**
 * Fold the three per-artifact audit feeds into a single chronological
 * stream. Tenant-scoped; cross-tenant calls return `entries: []`.
 *
 * Defensive: any individual feed that throws is treated as empty so
 * one buggy DAO never poisons the unified view.
 */
export function getDocumentAccessHistory(input: {
  artifactId: string;
  organizationId: string;
  options?: GetDocumentAccessHistoryOptions;
}): GetDocumentAccessHistoryResult {
  const artifactId = String(input.artifactId ?? '').trim();
  const organizationId = String(input.organizationId ?? '').trim();
  const opts: GetDocumentAccessHistoryOptions = input.options ?? {};
  if (!artifactId || !organizationId) {
    return { artifactId, organizationId, totalCount: 0, entries: [] };
  }

  const collected: DocumentAccessHistoryEntry[] = [];

  if (isSourceEnabled(opts.sources, 'document_audit')) {
    try {
      for (const row of listDocumentAuditEntries(artifactId, organizationId)) {
        collected.push({
          entryId: `document_audit::${row.auditId}`,
          source: 'document_audit',
          artifactId,
          organizationId,
          actorId: row.actorId,
          action: row.action,
          occurredAt: row.occurredAt,
          sourceId: row.proposalId,
          details: row.details ? { ...row.details } : undefined,
        });
      }
    } catch {
      // Defensive: never let a single feed kill the aggregator.
    }
  }

  if (isSourceEnabled(opts.sources, 'share_link')) {
    try {
      const links = listShareLinks(organizationId, {
        artifactId,
        includeExpired: true,
      });
      for (const link of links) {
        const audit = listShareLinkAuditEntries(link.shareLinkId, organizationId);
        for (const row of audit) {
          collected.push({
            entryId: `share_link::${row.auditId}`,
            source: 'share_link',
            artifactId,
            organizationId,
            actorId: row.actorId,
            action: row.action,
            occurredAt: row.occurredAt,
            sourceId: link.shareLinkId,
            details: {
              ...(row.details ?? {}),
              accessScope: link.accessScope,
            },
          });
        }
      }
    } catch {
      // Defensive: see above.
    }
  }

  if (isSourceEnabled(opts.sources, 'approval')) {
    try {
      const approvals = listDocumentApprovals(organizationId, { artifactId });
      for (const approval of approvals) {
        const audit = listDocumentApprovalAuditEntries(approval.approvalId, organizationId);
        for (const row of audit) {
          collected.push({
            entryId: `approval::${row.auditId}`,
            source: 'approval',
            artifactId,
            organizationId,
            actorId: row.actorId,
            action: row.action,
            occurredAt: row.occurredAt,
            sourceId: approval.approvalId,
            details: row.details ? { ...row.details } : undefined,
          });
        }
      }
    } catch {
      // Defensive: see above.
    }
  }

  collected.sort(compareOccurredAtDesc);

  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const sliced = collected.slice(offset, offset + limit);

  return {
    artifactId,
    organizationId,
    totalCount: collected.length,
    entries: sliced,
  };
}
