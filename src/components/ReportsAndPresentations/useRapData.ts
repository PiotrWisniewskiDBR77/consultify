/**
 * useRapData — Hook for fetching real data from backend for Reports & Presentations Hub
 *
 * Canonical list reads:
 *   - GET /api/artifacts?outputType=report
 *   - GET /api/artifacts?outputType=presentation
 *   - GET /api/artifacts?view=mine|review
 *
 * Origin actions remain delegated to the runtime that owns the document/deck:
 *   - /api/report-builder/*            → report mutations + exports
 *   - /api/presentations/decks/*       → deck mutations + exports
 *   - /api/artifacts/*                 → governance/read-model actions (review/access)
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  isTemplateOriginRuntime,
  type TemplateOriginRuntime,
  type TemplateScope as MaterialTemplateScope,
  type TemplateSource,
  type TemplateStatus as MaterialTemplateStatus,
} from '@/types/materials';

import { API_URL, getHeaders, shouldAllowDemoData } from '../../services/api';
import { resolveMaterialFileFormat } from './materialFileFormat';
import {
  isMaterialsOwnerSampleEnabled,
  materialsOwnerRegistryRows,
} from './materialsOwnerSampleData';
import type {
  ArtifactGovernanceSummary,
  PresentationItem,
  ReportItem,
  SheetOrigin,
  TemplateItem,
  UnifiedOutputRow,
} from './types';

export type ReportActionTarget =
  | string
  | Pick<ReportItem, 'id' | 'artifactId' | 'title' | 'governance'>
  | Pick<UnifiedOutputRow, 'originRecordId' | 'artifactId' | 'title' | 'governance'>;

export type PresentationActionTarget =
  | string
  | Pick<PresentationItem, 'id' | 'artifactId' | 'title' | 'governance'>
  | Pick<UnifiedOutputRow, 'originRecordId' | 'artifactId' | 'title' | 'governance'>;

type ArtifactOriginActionTarget = ReportActionTarget | PresentationActionTarget;

export interface AssessmentOriginOutputRow {
  kind: 'assessment';
  artifactId?: string;
  originRecordId: string;
  title: string;
  statusKey: string;
  owner: string;
  updatedAt: string;
  governance?: {
    visibilityScope?: 'private' | 'project' | 'organization' | 'review_shared' | 'demo';
  };
}

type ArtifactActionTargetPayload = {
  artifactId: string;
  originRuntime: string | null;
  originRecordId: string | null;
  openPath: string | null;
  exportPath: string | null;
  deletePath: string | null;
  reviewPath: string;
  authority: string;
};

function isOriginRuntimeEntry(
  entry:
    | readonly [
        `report:${string}` | `presentation:${string}` | `sheet:${string}`,
        { readonly runtime: 'report' | 'presentation' | 'sheet'; readonly id: string },
      ]
    | null
): entry is readonly [
  `report:${string}` | `presentation:${string}` | `sheet:${string}`,
  { readonly runtime: 'report' | 'presentation' | 'sheet'; readonly id: string },
] {
  return !!entry;
}

function isAssessmentOriginEntry(
  entry: readonly [`assessment:${string}`, { readonly id: string }] | null
): entry is readonly [`assessment:${string}`, { readonly id: string }] {
  return !!entry;
}

function isAssessmentOutputRow(
  item: AssessmentOriginOutputRow | null
): item is AssessmentOriginOutputRow {
  return !!item;
}

function normalizeArtifactOriginActionTarget(target: ArtifactOriginActionTarget): {
  originRecordId: string;
  artifactId?: string;
  label: string;
} {
  if (typeof target === 'string') {
    return {
      originRecordId: target,
      label: target,
    };
  }

  if ('originRecordId' in target) {
    return {
      originRecordId: target.originRecordId,
      artifactId: target.artifactId,
      label: target.title,
    };
  }

  return {
    originRecordId: target.id,
    artifactId: target.artifactId,
    label: target.title,
  };
}

export function normalizeReportActionTarget(target: ReportActionTarget): {
  originRecordId: string;
  artifactId?: string;
  label: string;
} {
  return normalizeArtifactOriginActionTarget(target);
}

export function normalizePresentationActionTarget(target: PresentationActionTarget): {
  originRecordId: string;
  artifactId?: string;
  label: string;
} {
  return normalizeArtifactOriginActionTarget(target);
}

/**
 * Approval-before-export client guard.
 *
 * The server already enforces quality/approval gates on the export routes
 * (`report-builder.routes.ts` → `enforceQualityGatesForExport`,
 * `presentations.routes.ts` → quality + legal-hold gates). This client-side
 * pre-flight ensures the hub never *offers* export on an unapproved artifact:
 * it reads `governance.publishState` from the registry row that the action
 * was invoked with (already mapped via `mapArtifactGovernance`) and refuses
 * to call the export endpoint unless the artifact is approved/published.
 *
 * Backward-compatible: when the target carries no governance (e.g. a bare
 * originRecordId string, or a legacy report/deck row without a registry
 * publishState), the guard is a no-op and export proceeds — the server gate
 * remains the hard backstop.
 */
const EXPORTABLE_PUBLISH_STATES = new Set(['approved', 'published']);

function readTargetPublishState(target: ArtifactOriginActionTarget): string | null {
  if (!target || typeof target !== 'object') return null;
  const governance = target.governance;
  if (!governance) return null;
  const publishState = governance.publishState;
  return publishState ? String(publishState).toLowerCase() : null;
}

/**
 * Returns true when the artifact is safe to export (no governance signal, or an
 * approved/published publishState). Returns false only when governance is
 * present AND the publishState is a non-approved value — i.e. the export must be
 * blocked at the client.
 */
function isExportApproved(target: ArtifactOriginActionTarget): boolean {
  const publishState = readTargetPublishState(target);
  if (!publishState) return true;
  return EXPORTABLE_PUBLISH_STATES.has(publishState);
}

async function fetchArtifactActionTarget(
  artifactId: string | undefined
): Promise<ArtifactActionTargetPayload | null> {
  if (!artifactId) return null;
  try {
    const res = await fetch(`${API_URL}/artifacts/${artifactId}/action-target`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  } catch {
    return null;
  }
}

// ─── Reports ──────────────────────────────────────────────────────

function mapReport(raw: any): ReportItem {
  const exportFormats = raw.export_formats
    ? typeof raw.export_formats === 'string'
      ? JSON.parse(raw.export_formats)
      : raw.export_formats
    : [];

  return {
    id: raw.id,
    title: raw.title || raw.name || 'Untitled',
    reportType:
      raw.report_type_v3 ||
      raw.reportTypeV3 ||
      raw.report_type ||
      raw.reportType ||
      raw.source_type ||
      'custom',
    status: (raw.status || 'draft').toLowerCase() as ReportItem['status'],
    owner: raw.created_by_name || raw.owner || raw.created_by || '—',
    goal: raw.goal_v3 || raw.goal || undefined,
    communicationRegister: raw.communication_register || raw.communicationRegister || undefined,
    confidentiality: raw.confidentiality || undefined,
    periodFrom: raw.period_from || raw.periodFrom || undefined,
    periodTo: raw.period_to || raw.periodTo || undefined,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    exportFormats: Array.isArray(exportFormats) ? exportFormats : [],
    fileFormat: resolveMaterialFileFormat(raw),
    sourceRefs: raw.source_refs_json
      ? typeof raw.source_refs_json === 'string'
        ? JSON.parse(raw.source_refs_json)
        : raw.source_refs_json
      : [],
    sourceType: raw.source_type,
    sourceId: raw.source_id,
  };
}

function mapArtifactReport(raw: any): ReportItem {
  const delivery = String(raw.originStatus || raw.deliveryState || 'draft').toLowerCase();
  const reportStatus: ReportItem['status'] =
    delivery === 'ready'
      ? 'ready'
      : delivery === 'archived'
        ? 'archived'
        : delivery === 'shared' || delivery === 'exported'
          ? 'exported'
          : 'draft';

  return {
    id: raw.originRecordId || raw.origin_record_id || raw.id,
    artifactId: raw.artifactId || raw.artifact_id,
    title: resolveArtifactTitle(raw, 'Document'),
    reportType: raw.reportType || 'custom',
    status: reportStatus,
    owner: raw.ownerName || raw.created_by_name || raw.createdByName || '—',
    goal: raw.goal || undefined,
    communicationRegister: raw.communicationRegister || undefined,
    confidentiality: raw.confidentiality || undefined,
    periodFrom: raw.periodFrom || undefined,
    periodTo: raw.periodTo || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.lastTransitionAt || raw.updatedAt || new Date().toISOString(),
    exportFormats: raw.exportFormat ? [raw.exportFormat] : [],
    fileFormat: resolveMaterialFileFormat(raw),
    sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs : [],
    governance: mapArtifactGovernance(raw),
    sourceType: raw.originRuntime,
    sourceId: raw.originRecordId || undefined,
  };
}

export function useReports() {
  // Sample/demo R&P artifacts are gated behind explicit demo mode (shouldAllowDemoData);
  // for real tenants only canonical artifacts are ever served. In demo mode an empty
  // canonical load is expected (data arrives via the Atelier Toys seed), not an error.
  const allowDemoData = shouldAllowDemoData();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // M17 junk filter (S6.3): server excludes drafts + dedupes by default.
  // Pass includeDrafts=true (the "Robocze" toggle) to also surface drafts.
  const fetchReports = useCallback(async (includeDrafts = false) => {
    setLoading(true);
    try {
      if (isMaterialsOwnerSampleEnabled()) {
        setReports(
          materialsOwnerRegistryRows
            .filter((item) => item.originRuntime === 'native_artifact')
            .map(mapArtifactReport)
        );
        setError(null);
        return;
      }
      const draftParam = includeDrafts ? '&include=drafts' : '';
      const artifactRes = await fetch(
        `${API_URL}/artifacts?outputType=report&limit=200${draftParam}`,
        {
          headers: getHeaders(),
        }
      );
      if (artifactRes.ok) {
        const artifactData = await artifactRes.json();
        const list = artifactData.data || [];
        // P0.2 fix (2026-07-26): documents created in Document Studio register
        // with originRuntime='native_artifact' (a DIFFERENT engine from the
        // report_builder-backed 'report' runtime), but both are outputType
        // 'report' / artifactFamily 'document'. Excluding 'native_artifact'
        // here made every Document-Studio document invisible in the
        // Documents tab even though the registry indexed it correctly.
        const isDocumentRuntime = (runtime: unknown) =>
          runtime === 'report' || runtime === 'native_artifact';
        const mapped = list
          .filter((item: any) => isDocumentRuntime(item.originRuntime) && item.originRecordId)
          .map(mapArtifactReport);
        setReports(mapped);
        setError(null);
        return;
      }

      setReports([]);
      setError(allowDemoData ? null : 'Canonical artifact registry failed to load reports.');
    } catch {
      setReports([]);
      setError(allowDemoData ? null : 'Canonical artifact registry failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const deleteReport = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/report-builder/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        return true;
      }
    } catch {
      /* noop */
    }
    return false;
  }, []);

  return { reports, loading, error, fetchReports, deleteReport };
}

// ─── Presentations (Decks) ────────────────────────────────────────

function mapDeck(raw: any): PresentationItem {
  const sourceRefs = raw.source_refs_json
    ? typeof raw.source_refs_json === 'string'
      ? JSON.parse(raw.source_refs_json)
      : raw.source_refs_json
    : raw.source_refs
      ? typeof raw.source_refs === 'string'
        ? JSON.parse(raw.source_refs)
        : raw.source_refs
      : [];

  return {
    id: raw.id,
    title: raw.title || 'Untitled',
    sourceType: raw.deck_type || raw.sourceType || 'tool',
    owner: raw.owner || raw.created_by || '—',
    status: (raw.status || 'draft').toLowerCase() as PresentationItem['status'],
    presentationMode: raw.presentation_mode || raw.presentationMode || 'briefing',
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    slideCount: raw.slide_count || raw.slideCount || 0,
    exportFormats: raw.export_format ? [raw.export_format] : [],
    sourceId: raw.source_id,
    thumbnailUrl: raw.thumbnail_url,
    sourceRefs: Array.isArray(sourceRefs) ? sourceRefs : [],
  };
}

const PRESENTATION_SOURCE_TYPES = new Set(['tool', 'assessment', 'finance', 'upload']);
const UUID_LIKE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const GENERIC_TITLES = new Set([
  '',
  'untitled',
  'untitled artifact',
  'untitled presentation',
  'untitled report',
  'untitled deck',
  'executive presentation draft',
]);

/**
 * Resolve a presentation's SOURCE to one of the known human labels.
 *
 * The canonical artifact registry list does NOT expose a top-level
 * `sourceType`; the real source kind lives in `originSummary.deckType` (e.g.
 * `tool`, `assessment`, `finance`). Earlier code blindly read `raw.sourceType`
 * (always undefined), and other call sites surfaced raw record IDs. Guard
 * against UUID-like values so the SOURCE column never renders an ID.
 */
function resolvePresentationSourceType(raw: any): PresentationItem['sourceType'] {
  const candidates = [
    raw?.sourceType,
    raw?.originSummary?.deckType,
    raw?.originSummary?.sourceType,
    raw?.deckType,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '')
      .trim()
      .toLowerCase();
    if (!value || UUID_LIKE.test(value)) continue;
    if (PRESENTATION_SOURCE_TYPES.has(value)) return value as PresentationItem['sourceType'];
  }
  return 'tool';
}

/**
 * Resolve a human title, falling back to "<Kind> · <date>" when the registry
 * only has a generic/placeholder snapshot (never a raw UUID or a shared
 * constant like "Executive presentation draft").
 */
function resolveArtifactTitle(raw: any, kindLabel: string): string {
  const candidate = String(raw?.resolvedTitle || raw?.titleSnapshot || raw?.title || '').trim();
  const normalized = candidate.toLowerCase();
  if (candidate && !UUID_LIKE.test(candidate) && !GENERIC_TITLES.has(normalized)) {
    return candidate;
  }
  const dateRaw = raw?.lastTransitionAt || raw?.updatedAt || raw?.createdAt;
  const date = dateRaw ? new Date(dateRaw) : null;
  const dateLabel =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
  return dateLabel ? `${kindLabel} · ${dateLabel}` : kindLabel;
}

function mapArtifactPresentation(raw: any): PresentationItem {
  return {
    id: raw.originRecordId || raw.origin_record_id || raw.id,
    artifactId: raw.artifactId || raw.artifact_id,
    title: resolveArtifactTitle(raw, 'Presentation'),
    sourceType: resolvePresentationSourceType(raw),
    owner: raw.ownerName || raw.created_by_name || raw.createdByName || '—',
    status: (
      raw.originStatus ||
      raw.deliveryState ||
      'draft'
    ).toLowerCase() as PresentationItem['status'],
    presentationMode: raw.presentationMode || 'briefing',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.lastTransitionAt || raw.updatedAt || new Date().toISOString(),
    slideCount: raw.slideCount || 0,
    exportFormats: raw.exportFormat ? [raw.exportFormat] : [],
    sourceId: raw.originRecordId || undefined,
    thumbnailUrl: raw.thumbnailUrl,
    sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs : [],
    governance: mapArtifactGovernance(raw),
  };
}

/**
 * Distinguish a governed Table Studio export from a real generated workbook
 * for `kind === 'sheet'` rows (inwentarz Excel 27.07: 61/75 sheet artifacts on
 * demo are flat exports, 6 are real workbooks — the list showed both as a
 * bare "Sheet", making the export lane look like empty/pointless tables).
 *
 * Both writers register with `originRuntime: 'sheet'` (registry can't tell
 * them apart on runtime alone — see `server/src/services/v8/artifactRegistryService.ts`):
 *   - `registerGovernedTableSheetArtifact` (table-platform.routes.ts ~2243/2350,
 *     called from the `excele` materialization lane ~L3924) always stamps
 *     `originSummary: { sourceTable: 'tp_tables', exportFormat: 'xlsx',
 *     governanceMode: 'governed' }`.
 *   - the `/api/workbook` routes (workbook.routes.ts ~L284/~L663) register (or
 *     adopt) with an `originSummary` that carries `sheetCount`/`source` but
 *     never `sourceTable` — those are real `generated_workbooks` rows.
 *
 * `sourceTable === 'tp_tables'` is therefore the reliable discriminator.
 * Defaults to 'workbook' (the richer, real-artifact interpretation) when the
 * marker is absent, matching current writer behavior above.
 */
export function resolveSheetOrigin(raw: any): SheetOrigin {
  const originSummary = raw?.originSummary;
  const sourceTable =
    originSummary && typeof originSummary === 'object' ? originSummary.sourceTable : undefined;
  return sourceTable === 'tp_tables' ? 'table_export' : 'workbook';
}

export function mapRegistryItemToUnified(raw: any): UnifiedOutputRow | null {
  const runtime = raw?.originRuntime || raw?.origin_runtime;
  const originId = raw?.originRecordId || raw?.origin_record_id;
  if (!runtime || !originId) return null;

  const baseGov = mapArtifactGovernance(raw);

  // P0.2 fix (2026-07-26): 'report' (report_builder) and 'native_artifact'
  // (Document Studio) are two DIFFERENT runtimes for the same document
  // family — see the ZAKAZ naiwnej unifikacji note above `mapRegistryItemToUnified`.
  // They share this branch only because `mapArtifactReport` is runtime-agnostic
  // (it reads generic registry fields, not runtime-specific ones) and because
  // opening/exporting is already delegated correctly per-row via
  // `governance.openPath`, which the server sets per-runtime
  // (buildActionTargetPayload in artifacts.routes.ts). Before this fix,
  // 'native_artifact' had no case here at all, so every Document-Studio-made
  // document silently vanished from Documents/All (mapped to `null` → filtered).
  if (runtime === 'report' || runtime === 'native_artifact') {
    const r = mapArtifactReport(raw);
    return {
      kind: 'document',
      originRecordId: r.id,
      artifactId: r.artifactId,
      title: r.title,
      statusKey: r.status,
      owner: r.owner,
      updatedAt: r.updatedAt,
      reportType: r.reportType,
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      exportFormats: r.exportFormats,
      fileFormat: r.fileFormat || 'Unknown',
      governance: r.governance || baseGov,
    };
  }

  if (runtime === 'presentation') {
    const p = mapArtifactPresentation(raw);
    return {
      kind: 'presentation',
      originRecordId: p.id,
      artifactId: p.artifactId,
      title: p.title,
      statusKey: p.status,
      owner: p.owner,
      updatedAt: p.updatedAt,
      sourceType: p.sourceType,
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      slideCount: p.slideCount,
      exportFormats: p.exportFormats,
      fileFormat: resolveMaterialFileFormat(raw),
      governance: p.governance || baseGov,
    };
  }

  if (runtime === 'report_template') {
    const delivery = String(raw.originStatus || raw.deliveryState || 'draft').toLowerCase();
    return {
      kind: 'document',
      originRecordId: String(originId),
      artifactId: raw.artifactId || raw.artifact_id,
      title: resolveArtifactTitle(raw, 'Document template'),
      statusKey: delivery,
      owner: raw.ownerName || raw.created_by_name || raw.createdByName || '—',
      updatedAt: raw.lastTransitionAt || raw.updatedAt || raw.createdAt || new Date().toISOString(),
      reportType:
        String((raw?.originSummary as any)?.template?.reportType || raw.reportType || 'custom') ||
        'custom',
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      exportFormats: [],
      fileFormat: resolveMaterialFileFormat(raw),
      governance: baseGov,
    };
  }

  if (runtime === 'presentation_template') {
    const delivery = String(raw.originStatus || raw.deliveryState || 'draft').toLowerCase();
    const outline =
      (raw?.originSummary as any)?.template?.structureBlueprint?.outline &&
      Array.isArray((raw?.originSummary as any)?.template?.structureBlueprint?.outline)
        ? (raw?.originSummary as any)?.template?.structureBlueprint?.outline
        : [];
    return {
      kind: 'presentation',
      originRecordId: String(originId),
      artifactId: raw.artifactId || raw.artifact_id,
      title: resolveArtifactTitle(raw, 'Presentation template'),
      statusKey: delivery,
      owner: raw.ownerName || raw.created_by_name || raw.createdByName || '—',
      updatedAt: raw.lastTransitionAt || raw.updatedAt || raw.createdAt || new Date().toISOString(),
      sourceType: String(
        (raw?.originSummary as any)?.template?.deckType || raw.sourceType || 'tool'
      ) as any,
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      slideCount: outline.length,
      exportFormats: [],
      fileFormat: resolveMaterialFileFormat(raw),
      governance: baseGov,
    };
  }

  if (runtime === 'sheet') {
    const delivery = String(raw.originStatus || raw.deliveryState || 'draft').toLowerCase();
    return {
      kind: 'sheet',
      originRecordId: String(originId),
      artifactId: raw.artifactId || raw.artifact_id,
      title: resolveArtifactTitle(raw, 'Sheet'),
      statusKey: delivery,
      owner: raw.ownerName || raw.created_by_name || raw.createdByName || '—',
      updatedAt: raw.lastTransitionAt || raw.updatedAt || raw.createdAt || new Date().toISOString(),
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      exportFormats: raw.exportFormat ? [raw.exportFormat] : [],
      fileFormat: resolveMaterialFileFormat(raw),
      governance: baseGov,
      sheetOrigin: resolveSheetOrigin(raw),
    };
  }

  return null;
}

/**
 * Map registry list-response fields to the canonical ArtifactGovernanceSummary.
 *
 * Two-tier governance model (P18 contract §2.3):
 *   1. **List-derived (this function):** populated from `GET /api/artifacts`
 *      registry rows. Covers core fields for table rendering and row actions.
 *      Does NOT include `lineagePaths` or `accessGrants` — those require the
 *      full trust-state bundle.
 *   2. **Preview-enriched:** when a row is selected, the preview fetches
 *      `GET /api/artifacts/:id/trust-state` and merges the authoritative
 *      payload (including `lineagePaths`, `accessGrants`, `originLinks`,
 *      `exportHistory`). This ensures preview always reflects the single
 *      trust-state authority without penalizing list performance.
 *
 * See also: `useTrustState` hook for the preview-enrichment fetch logic.
 */
function mapArtifactGovernance(raw: any): ArtifactGovernanceSummary {
  return {
    visibilityScope: raw.visibilityScope,
    publishState: raw.publishState,
    validationState: raw.validationState || null,
    // P2.6 — deck quality scorecard (checkDeckQualityGates) surfaced on the list row.
    deckScorecard:
      raw.deckScorecard && typeof raw.deckScorecard === 'object' ? raw.deckScorecard : null,
    validationChecks: Array.isArray(raw.validationChecks) ? raw.validationChecks : [],
    publishReviewers: Array.isArray(raw.publishReviewers) ? raw.publishReviewers : [],
    reviewGateCount: typeof raw.reviewGateCount === 'number' ? raw.reviewGateCount : 0,
    projectId: raw.projectId || null,
    executionRunId: raw.executionRunId || null,
    executionState: raw.executionState || null,
    contextSnapshotId: raw.contextSnapshotId || null,
    canonicalHome: raw.canonicalHome || null,
    lastTransitionAt: raw.lastTransitionAt || null,
    sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs : [],
    originSummary:
      raw.originSummary && typeof raw.originSummary === 'object' ? raw.originSummary : null,
    openPath: raw.openPath || null,
    exportPath: raw.exportPath || null,
    authority: raw.authority || null,
    manageAccessPath: raw.manageAccessPath || null,
    canManageAccess: Boolean(raw.canManageAccess),
    exportHistory: Array.isArray(raw.exportHistory) ? raw.exportHistory : [],
    reviewAuthority: raw.reviewAuthority || 'artifact_review',
    executionAuthority: raw.executionAuthority || 'execution_spine',
    accessGrants: Array.isArray(raw.accessGrants) ? raw.accessGrants : [],
    originLinks: Array.isArray(raw.originLinks) ? raw.originLinks : [],
  };
}

export type ArtifactOutputsRegistryView = 'all' | 'mine' | 'review';

export function useArtifactOutputsList(view: ArtifactOutputsRegistryView | null) {
  const [rows, setRows] = useState<UnifiedOutputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // L-08: distinguish "module disabled" (ENABLE_V8_GLOBAL OFF → 404 on the
  // artifact registry routes) from a generic load failure, so the UI can show a
  // dedicated "module turned off" banner instead of a "failed to load" error.
  const [moduleDisabled, setModuleDisabled] = useState(false);

  const fetchOutputs = useCallback(
    async (includeDrafts = false) => {
      if (!view) {
        setRows([]);
        setLoading(false);
        setError(null);
        setModuleDisabled(false);
        return;
      }
      setLoading(true);
      try {
        if (isMaterialsOwnerSampleEnabled()) {
          const mapped = materialsOwnerRegistryRows
            .map(mapRegistryItemToUnified)
            .filter((x: UnifiedOutputRow | null): x is UnifiedOutputRow => !!x);
          setRows(mapped);
          setError(null);
          setModuleDisabled(false);
          return;
        }
        const qs = new URLSearchParams({ limit: '200' });
        if (view === 'mine') qs.set('view', 'mine');
        if (view === 'review') qs.set('view', 'review');
        // M17 junk filter (S6.3): default excludes drafts + dedupes server-side.
        if (includeDrafts) qs.set('include', 'drafts');
        const res = await fetch(`${API_URL}/artifacts?${qs.toString()}`, { headers: getHeaders() });
        if (!res.ok) {
          setRows([]);
          // The whole module sits behind ENABLE_V8_GLOBAL; when OFF the registry
          // routes 404 (pre/post-auth). Treat 404 as "module disabled", everything
          // else as a generic failure.
          if (res.status === 404) {
            setModuleDisabled(true);
            setError(null);
          } else {
            setModuleDisabled(false);
            setError('Canonical artifact registry failed to load outputs.');
          }
          return;
        }
        const data = await res.json();
        const list = data.data || [];
        const mapped = list
          .map(mapRegistryItemToUnified)
          .filter((x: UnifiedOutputRow | null): x is UnifiedOutputRow => !!x);
        setRows(mapped);
        setError(null);
        setModuleDisabled(false);
      } catch {
        setRows([]);
        setModuleDisabled(false);
        setError('Canonical artifact registry failed to load outputs.');
      } finally {
        setLoading(false);
      }
    },
    [view]
  );

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { rows, loading, error, moduleDisabled, refetch: fetchOutputs };
}

export function useMyWorkArtifactOutputs(limit = 8) {
  const [mine, setMine] = useState<UnifiedOutputRow[]>([]);
  const [review, setReview] = useState<UnifiedOutputRow[]>([]);
  const [recent, setRecent] = useState<UnifiedOutputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOutputs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/artifacts/my-work?limit=${Math.max(1, limit)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        setMine([]);
        setReview([]);
        setRecent([]);
        setError('Canonical artifact registry failed to load My Work outputs.');
        return;
      }
      const data = await res.json();
      const payload = data?.data ?? data ?? {};
      const mapRows = (items: unknown) =>
        (Array.isArray(items) ? items : [])
          .map(mapRegistryItemToUnified)
          .filter((item: UnifiedOutputRow | null): item is UnifiedOutputRow => !!item);

      setMine(mapRows(payload.mine));
      setReview(mapRows(payload.review));
      setRecent(mapRows(payload.recent));
      setError(null);
    } catch {
      setMine([]);
      setReview([]);
      setRecent([]);
      setError('Canonical artifact registry failed to load My Work outputs.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { mine, review, recent, loading, error, refetch: fetchOutputs };
}

export function useArtifactOutputsForInitiative(
  initiativeId: string | null | undefined,
  limit = 8
) {
  const [rows, setRows] = useState<UnifiedOutputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOutputs = useCallback(async () => {
    const normalizedInitiativeId = String(initiativeId || '').trim();
    if (!normalizedInitiativeId) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams({
        sourceInitiativeId: normalizedInitiativeId,
        limit: String(Math.max(1, limit)),
      });
      const res = await fetch(`${API_URL}/artifacts?${qs.toString()}`, { headers: getHeaders() });
      if (!res.ok) {
        setRows([]);
        setError('Canonical artifact registry failed to load initiative outputs.');
        return;
      }
      const data = await res.json();
      const list = data.data || [];
      const mapped = list
        .map(mapRegistryItemToUnified)
        .filter((item: UnifiedOutputRow | null): item is UnifiedOutputRow => !!item);
      setRows(mapped);
      setError(null);
    } catch {
      setRows([]);
      setError('Canonical artifact registry failed to load initiative outputs.');
    } finally {
      setLoading(false);
    }
  }, [initiativeId, limit]);

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { rows, loading, error, refetch: fetchOutputs };
}

export function useArtifactOutputsForInitiatives(
  initiativeIds: string[] | null | undefined,
  limit = 8
) {
  const [rows, setRows] = useState<UnifiedOutputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedIds = Array.from(
    new Set((initiativeIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  ).sort();
  const idsKey = normalizedIds.join('|');

  const fetchOutputs = useCallback(async () => {
    if (!normalizedIds.length) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const responses = await Promise.all(
        normalizedIds.map(async (initiativeId) => {
          const qs = new URLSearchParams({
            sourceInitiativeId: initiativeId,
            limit: String(Math.max(1, limit)),
          });
          const res = await fetch(`${API_URL}/artifacts?${qs.toString()}`, {
            headers: getHeaders(),
          });
          if (!res.ok) {
            throw new Error('Canonical artifact registry failed to load initiative outputs.');
          }
          const data = await res.json();
          return Array.isArray(data.data) ? data.data : [];
        })
      );

      const seen = new Set<string>();
      const mapped = responses
        .flat()
        .map(mapRegistryItemToUnified)
        .filter((item: UnifiedOutputRow | null): item is UnifiedOutputRow => {
          if (!item) return false;
          const key = item.artifactId || `${item.kind}:${item.originRecordId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      setRows(mapped);
      setError(null);
    } catch {
      setRows([]);
      setError('Canonical artifact registry failed to load initiative outputs.');
    } finally {
      setLoading(false);
    }
  }, [idsKey, limit]);

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { rows, loading, error, refetch: fetchOutputs };
}

export function useArtifactOutputsForOrigins(
  origins: Array<{ type?: string | null; id?: string | null }> | null | undefined,
  limit = 8
) {
  const [rows, setRows] = useState<UnifiedOutputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedOrigins = Array.from(
    new Map(
      (origins || [])
        .map((origin) => {
          const type = String(origin?.type || '')
            .trim()
            .toLowerCase();
          const id = String(origin?.id || '').trim();
          const runtime =
            type === 'report'
              ? 'report'
              : type === 'presentation'
                ? 'presentation'
                : type === 'sheet'
                  ? 'sheet'
                  : null;
          if (!runtime || !id) return null;
          return [`${runtime}:${id}`, { runtime, id }] as const;
        })
        .filter(isOriginRuntimeEntry)
    ).values()
  ).slice(0, Math.max(1, limit));

  const originsKey = normalizedOrigins.map((origin) => `${origin.runtime}:${origin.id}`).join('|');

  const fetchOutputs = useCallback(async () => {
    if (!normalizedOrigins.length) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const responses = await Promise.all(
        normalizedOrigins.map(async ({ runtime, id }) => {
          const res = await fetch(
            `${API_URL}/artifacts/origin/${runtime}/${encodeURIComponent(id)}`,
            {
              headers: getHeaders(),
            }
          );
          if (!res.ok) {
            throw new Error('Canonical artifact registry failed to load notebook outputs.');
          }
          const data = await res.json();
          return data.data || null;
        })
      );

      const mapped = responses
        .map(mapRegistryItemToUnified)
        .filter((item: UnifiedOutputRow | null): item is UnifiedOutputRow => !!item);

      setRows(mapped);
      setError(null);
    } catch {
      setRows([]);
      setError('Canonical artifact registry failed to load notebook outputs.');
    } finally {
      setLoading(false);
    }
  }, [originsKey, limit]);

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { rows, loading, error, refetch: fetchOutputs };
}

export function useAssessmentOutputsForOrigins(
  origins: Array<{ type?: string | null; id?: string | null }> | null | undefined,
  limit = 8
) {
  const [rows, setRows] = useState<AssessmentOriginOutputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedOrigins = Array.from(
    new Map(
      (origins || [])
        .map((origin) => {
          const type = String(origin?.type || '')
            .trim()
            .toLowerCase();
          const id = String(origin?.id || '').trim();
          if (type !== 'assessment' || !id) return null;
          return [`assessment:${id}`, { id }] as const;
        })
        .filter(isAssessmentOriginEntry)
    ).values()
  ).slice(0, Math.max(1, limit));

  const originsKey = normalizedOrigins.map((origin) => origin.id).join('|');

  const fetchOutputs = useCallback(async () => {
    if (!normalizedOrigins.length) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const responses: Array<AssessmentOriginOutputRow | null> = await Promise.all(
        normalizedOrigins.map(async ({ id }) => {
          const res = await fetch(`${API_URL}/assessments/${encodeURIComponent(id)}`, {
            headers: getHeaders(),
          });
          if (!res.ok) {
            throw new Error('Assessment outputs failed to load.');
          }
          const data = await res.json();
          const assessment = data?.assessment || null;
          if (!assessment) return null;
          return {
            kind: 'assessment' as const,
            originRecordId: String(assessment.id || id),
            title: String(assessment.name || 'Assessment'),
            statusKey:
              String(assessment.status || 'draft')
                .trim()
                .toLowerCase() || 'draft',
            owner: String(assessment.organizationId || ''),
            updatedAt: String(assessment.updatedAt || assessment.createdAt || ''),
            governance: { visibilityScope: 'private' as const },
          };
        })
      );

      setRows(responses.filter(isAssessmentOutputRow));
      setError(null);
    } catch {
      setRows([]);
      setError('Assessment outputs failed to load.');
    } finally {
      setLoading(false);
    }
  }, [originsKey, limit]);

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { rows, loading, error, refetch: fetchOutputs };
}

export function usePresentations() {
  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresentations = useCallback(async (includeDrafts = false) => {
    setLoading(true);
    try {
      if (isMaterialsOwnerSampleEnabled()) {
        setPresentations(
          materialsOwnerRegistryRows
            .filter((item) => item.originRuntime === 'presentation')
            .map(mapArtifactPresentation)
        );
        setError(null);
        return;
      }
      const draftParam = includeDrafts ? '&include=drafts' : '';
      const artifactRes = await fetch(
        `${API_URL}/artifacts?outputType=presentation&limit=200${draftParam}`,
        {
          headers: getHeaders(),
        }
      );
      if (artifactRes.ok) {
        const artifactData = await artifactRes.json();
        const list = artifactData.data || [];
        const mapped = list
          .filter((item: any) => item.originRuntime === 'presentation' && item.originRecordId)
          .map(mapArtifactPresentation);
        setPresentations(mapped);
        setError(null);
        return;
      }

      setPresentations([]);
      setError('Canonical artifact registry failed to load presentations.');
    } catch {
      setPresentations([]);
      setError('Canonical artifact registry failed to load presentations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresentations();
  }, [fetchPresentations]);

  const deleteDeck = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/presentations/decks/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        setPresentations((prev) => prev.filter((p) => p.id !== id));
        return true;
      }
    } catch {
      /* noop */
    }
    return false;
  }, []);

  return { presentations, loading, error, fetchPresentations, deleteDeck };
}

export function useSheetOutputs() {
  const [rows, setRows] = useState<UnifiedOutputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheets = useCallback(async (includeDrafts = false) => {
    setLoading(true);
    try {
      if (isMaterialsOwnerSampleEnabled()) {
        const mapped = materialsOwnerRegistryRows
          .map(mapRegistryItemToUnified)
          .filter(
            (item: UnifiedOutputRow | null): item is UnifiedOutputRow => item?.kind === 'sheet'
          );
        setRows(mapped);
        setError(null);
        return;
      }
      const draftParam = includeDrafts ? '&include=drafts' : '';
      const res = await fetch(`${API_URL}/artifacts?outputType=sheet&limit=200${draftParam}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        const mapped = list
          .map(mapRegistryItemToUnified)
          .filter(
            (item: UnifiedOutputRow | null): item is UnifiedOutputRow => item?.kind === 'sheet'
          );
        setRows(mapped);
        setError(null);
        return;
      }

      setRows([]);
      setError('Canonical artifact registry failed to load sheets.');
    } catch {
      setRows([]);
      setError('Canonical artifact registry failed to load sheets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSheets();
  }, [fetchSheets]);

  return { rows, loading, error, fetchSheets };
}

// ─── Templates (merged: report + presentation) ───────────────────

/**
 * Status wzorca wg kontraktu `src/types/materials.ts`.
 * ★ Brak danych → `'unknown'`. Poprzednia wersja zwracała `'active'` także dla
 * pustego wejścia, więc wzorzec bez statusu wyglądał w tabeli na sprawny.
 * Legacy `'active'`/`'archived'` mapujemy na najbliższe kanoniczne znaczenie.
 */
export function mapTemplateStatus(statusRaw: unknown): MaterialTemplateStatus {
  const normalized = String(statusRaw ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'published' || normalized === 'active') return 'published';
  if (normalized === 'draft') return 'draft';
  if (normalized === 'deprecated' || normalized === 'archived') return 'deprecated';
  return 'unknown';
}

/**
 * Zakres wzorca wg kontraktu `src/types/materials.ts`.
 * ★ Brak danych → `'unknown'` (było: `'organization'` — czyli szablon bez
 * zakresu udawał firmowy). ★ `'application'`/`'app'` → kanoniczne `'system'`.
 */
export function mapTemplateScope(scopeRaw: unknown): MaterialTemplateScope {
  const normalized = String(scopeRaw ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'user' || normalized === 'personal') return 'personal';
  if (normalized === 'app' || normalized === 'application' || normalized === 'system') {
    return 'system';
  }
  if (normalized === 'org' || normalized === 'organization') return 'organization';
  return 'unknown';
}

/** Runtime pochodzenia kanonicznego szablonu; nieznana wartość → `null`. */
export function mapTemplateOriginRuntime(raw: unknown): TemplateOriginRuntime | null {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase();
  return isTemplateOriginRuntime(normalized) ? normalized : null;
}

const TEMPLATE_CATEGORIES: Array<TemplateItem['category']> = [
  'R1',
  'R2',
  'R3',
  'R4',
  'executive_update',
  'project_kickoff',
  'initiative_review',
  'financial_review',
  'assessment_results',
  'custom',
];

function coerceTemplateCategory(value: unknown, fallback: TemplateItem['category'] = 'custom') {
  const normalized = String(value || '').trim() as TemplateItem['category'];
  return TEMPLATE_CATEGORIES.includes(normalized) ? normalized : fallback;
}

export function mapCanonicalTemplateArtifact(raw: any): TemplateItem | null {
  const template = raw?.originSummary?.template;
  const outputType = String(raw?.outputType || '').toLowerCase();
  const resolvedTitle = String(raw?.resolvedTitle || raw?.titleSnapshot || raw?.title || '').trim();

  if (outputType !== 'report' && outputType !== 'presentation' && outputType !== 'sheet')
    return null;
  if (!resolvedTitle) return null;

  const metadata =
    template?.metadata && typeof template.metadata === 'object' ? template.metadata : {};
  // ★ Brak daty = brak daty. Poprzednio podstawialiśmy `new Date().toISOString()`,
  // więc każdy wzorzec bez znanej daty wyglądał na „zmieniony dzisiaj".
  const updatedAt =
    String((metadata as any).updatedAt || '').trim() ||
    String(raw?.lastTransitionAt || '').trim() ||
    String(raw?.createdAt || '').trim() ||
    null;

  // ★ `structureBlueprint` z INDEKSU służy WYŁĄCZNIE do liczników w widoku
  // (ile sekcji / slajdów). Nie jest źródłem prawdy dla generacji i celowo
  // NIE jest przekazywany dalej w TemplateItem — generator ma czytać kanoniczny
  // rekord szablonu po `canonicalTemplateId`.
  const structureBlueprint =
    template?.structureBlueprint && typeof template.structureBlueprint === 'object'
      ? template.structureBlueprint
      : null;
  const sections = Array.isArray((structureBlueprint as any)?.sections)
    ? (structureBlueprint as any).sections
    : [];
  const outline = Array.isArray((structureBlueprint as any)?.outline)
    ? (structureBlueprint as any).outline
    : [];

  // ★ ROZDZIAŁ TOŻSAMOŚCI: `artifactId` to wiersz indeksu, `canonicalTemplateId`
  // to rekord szablonu w jego runtime. Dotąd istniało tylko jedno `id`, więc
  // „Użyj wzorca" wysyłało id indeksu tam, gdzie oczekiwano id kanonicznego.
  const artifactIndexId = String(raw?.artifactId || '');
  const canonicalTemplateId = String(template?.canonicalTemplateId || '').trim() || null;
  const originRuntime = mapTemplateOriginRuntime(template?.originRuntime);
  const legacy =
    template?.legacy === true || String(template?.source || '').toLowerCase() === 'legacy';
  const source: TemplateSource = legacy ? 'legacy' : 'canonical';
  // Osierocony = indeks wie o wpisie, ale kanonicznego rekordu już nie ma.
  // ★ Czytamy WYŁĄCZNIE jawną flagę backendu. Domyślanie sieroty z samego braku
  // `canonicalTemplateId` unieruchomiłoby całą bibliotekę w chwili, gdy backend
  // jeszcze nie wystawia tego pola. Brak id i tak blokuje trasę użycia po
  // stronie `resolveTemplateUsePath` (zwraca null zamiast cichego fallbacku).
  const orphaned = template?.orphaned === true;

  return {
    id: artifactIndexId,
    artifactIndexId,
    canonicalTemplateId,
    originRuntime,
    source,
    legacy,
    orphaned,
    title: resolvedTitle,
    description: String(template?.description || '').trim(),
    type: outputType === 'report' ? 'report' : outputType === 'sheet' ? 'sheet' : 'presentation',
    category:
      outputType === 'report'
        ? coerceTemplateCategory(template?.reportType || template?.outputType || raw?.reportType)
        : coerceTemplateCategory(template?.deckType || template?.outputType),
    scope: mapTemplateScope(template?.scope),
    status: mapTemplateStatus(template?.status),
    updatedAt,
    createdBy: String((metadata as any).createdBy || raw?.createdBy || 'System'),
    sectionCount: outputType === 'report' ? sections.length : undefined,
    slideCount: outputType === 'presentation' ? outline.length : undefined,
    deprecationReason: template?.deprecationReason ? String(template.deprecationReason) : undefined,
    migrationHint: template?.migrationHint ? String(template.migrationHint) : undefined,
    replacedByArtifactId: template?.replacedByArtifactId
      ? String(template.replacedByArtifactId)
      : undefined,
  };
}

export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [rptRes, presRes, sheetRes] = await Promise.all([
        fetch(`${API_URL}/artifacts?limit=200&artifactFamily=template&outputType=report`, {
          headers: getHeaders(),
        }),
        fetch(`${API_URL}/artifacts?limit=200&artifactFamily=template&outputType=presentation`, {
          headers: getHeaders(),
        }),
        fetch(`${API_URL}/artifacts?limit=200&artifactFamily=template&outputType=sheet`, {
          headers: getHeaders(),
        }),
      ]);

      const merged: TemplateItem[] = [];

      if (rptRes.ok) {
        const rptData = await rptRes.json();
        const rptList = rptData.data || rptData.templates || [];
        merged.push(
          ...rptList
            .map(mapCanonicalTemplateArtifact)
            .filter((x: TemplateItem | null): x is TemplateItem => Boolean(x))
        );
      }

      if (presRes.ok) {
        const presData = await presRes.json();
        const presList = presData.data || presData.templates || [];
        merged.push(
          ...presList
            .map(mapCanonicalTemplateArtifact)
            .filter((x: TemplateItem | null): x is TemplateItem => Boolean(x))
        );
      }

      if (sheetRes.ok) {
        const sheetData = await sheetRes.json();
        const sheetList = sheetData.data || sheetData.templates || [];
        merged.push(
          ...sheetList
            .map(mapCanonicalTemplateArtifact)
            .filter((x: TemplateItem | null): x is TemplateItem => Boolean(x))
        );
      }

      if (!rptRes.ok && !presRes.ok && !sheetRes.ok) {
        setTemplates([]);
        setError('Canonical artifact registry failed to load templates.');
        return;
      }

      // Wzorce bez znanej daty (updatedAt === null) lądują na końcu listy —
      // nie udajemy, że zmieniono je „teraz", żeby wskoczyły na górę.
      const updatedTs = (item: TemplateItem): number => {
        const ts = item.updatedAt ? new Date(item.updatedAt).getTime() : NaN;
        return Number.isFinite(ts) ? ts : -Infinity;
      };
      merged.sort((a, b) => updatedTs(b) - updatedTs(a));
      setTemplates(merged);
      setError(null);
    } catch {
      setTemplates([]);
      setError('Failed to load real templates from the active data source.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, error, fetchTemplates };
}

// ─── Actions ─────────────────────────────────────────────────────

export function useRapActions() {
  const { t } = useTranslation();

  const exportReportPdf = useCallback(
    async (target: ReportActionTarget) => {
      if (!isExportApproved(target)) {
        toast.error(t('rap.toast.exportBlocked', 'Approve the artifact before exporting'));
        return;
      }
      const { originRecordId, artifactId } = normalizeReportActionTarget(target);
      const actionTarget = await fetchArtifactActionTarget(artifactId);
      const exportPath =
        actionTarget?.originRuntime === 'report' && actionTarget.exportPath
          ? actionTarget.exportPath
          : `${API_URL}/report-builder/${originRecordId}/export/pdf`;
      try {
        const res = await fetch(exportPath, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `report-${originRecordId.slice(0, 8)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(t('rap.toast.exported', 'Report exported'));
        } else {
          toast.error(t('rap.toast.exportFailed', 'Export failed'));
        }
      } catch {
        toast.error(t('rap.toast.exportFailed', 'Export failed'));
      }
    },
    [t]
  );

  const exportDeckPptx = useCallback(
    async (target: PresentationActionTarget) => {
      if (!isExportApproved(target)) {
        toast.error(t('rap.toast.exportBlocked', 'Approve the artifact before exporting'));
        return;
      }
      const { originRecordId, artifactId } = normalizePresentationActionTarget(target);
      const actionTarget = await fetchArtifactActionTarget(artifactId);
      const exportPath =
        actionTarget?.originRuntime === 'presentation' && actionTarget.exportPath
          ? actionTarget.exportPath
          : `${API_URL}/presentations/decks/${originRecordId}/download`;
      try {
        const res = await fetch(exportPath, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `presentation-${originRecordId.slice(0, 8)}.pptx`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(t('rap.toast.exported', 'Exported'));
        } else {
          toast.error(t('rap.toast.exportFailed', 'Export failed'));
        }
      } catch {
        toast.error(t('rap.toast.exportFailed', 'Export failed'));
      }
    },
    [t]
  );

  const archiveReport = useCallback(
    async (target: ReportActionTarget) => {
      const { originRecordId, artifactId } = normalizeReportActionTarget(target);
      const actionTarget = await fetchArtifactActionTarget(artifactId);
      const deletePath =
        actionTarget?.originRuntime === 'report' && actionTarget.deletePath
          ? actionTarget.deletePath
          : `${API_URL}/report-builder/${originRecordId}`;
      try {
        const res = await fetch(deletePath, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        if (res.ok) {
          toast.success(t('rap.toast.deleted', 'Deleted'));
          return true;
        }
      } catch {
        /* noop */
      }
      toast.error(t('rap.toast.deleteFailed', 'Failed to delete'));
      return false;
    },
    [t]
  );

  const archiveDeck = useCallback(
    async (target: PresentationActionTarget) => {
      const { originRecordId, artifactId } = normalizePresentationActionTarget(target);
      const actionTarget = await fetchArtifactActionTarget(artifactId);
      const deletePath =
        actionTarget?.originRuntime === 'presentation' && actionTarget.deletePath
          ? actionTarget.deletePath
          : `${API_URL}/presentations/decks/${originRecordId}`;
      try {
        const res = await fetch(deletePath, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        if (res.ok) {
          toast.success(t('rap.toast.deleted', 'Deleted'));
          return true;
        }
      } catch {
        /* noop */
      }
      toast.error(t('rap.toast.deleteFailed', 'Failed to delete'));
      return false;
    },
    [t]
  );

  const startArtifactReview = useCallback(
    async (artifactId: string) => {
      try {
        const res = await fetch(`${API_URL}/artifacts/${artifactId}/start-review`, {
          method: 'POST',
          headers: {
            ...getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reviewers: [] }),
        });
        if (res.ok) {
          toast.success(t('rap.toast.reviewStarted', 'Review started'));
          return true;
        }
      } catch {
        /* noop */
      }
      toast.error(t('rap.toast.reviewFailed', 'Failed to start review'));
      return false;
    },
    [t]
  );

  return { exportReportPdf, exportDeckPptx, archiveReport, archiveDeck, startArtifactReview };
}
