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

import { API_URL, getHeaders, shouldAllowDemoData } from '../../services/api';
import type {
  ArtifactGovernanceSummary,
  PresentationItem,
  ReportItem,
  TemplateItem,
  UnifiedOutputRow,
} from './types';

export type ReportActionTarget =
  | string
  | Pick<ReportItem, 'id' | 'artifactId' | 'title'>
  | Pick<UnifiedOutputRow, 'originRecordId' | 'artifactId' | 'title'>;

export type PresentationActionTarget =
  | string
  | Pick<PresentationItem, 'id' | 'artifactId' | 'title'>
  | Pick<UnifiedOutputRow, 'originRecordId' | 'artifactId' | 'title'>;

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
        `report:${string}` | `presentation:${string}`,
        { readonly runtime: 'report' | 'presentation'; readonly id: string },
      ]
    | null
): entry is readonly [
  `report:${string}` | `presentation:${string}`,
  { readonly runtime: 'report' | 'presentation'; readonly id: string },
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

const DEMO_REPORTS: ReportItem[] = [
  {
    id: 'demo-r1',
    title: 'Weekly Execution Report – Sprint 14',
    reportType: 'R1',
    status: 'ready',
    owner: 'Anna Kowalska',
    goal: 'Stakeholder update',
    periodFrom: '2026-03-04',
    periodTo: '2026-03-10',
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-10T14:30:00Z',
    exportFormats: ['pdf', 'pptx'],
    sourceRefs: [],
  },
  {
    id: 'demo-r2',
    title: 'Steering Committee – Q1 2026',
    reportType: 'R2',
    status: 'ready',
    owner: 'Marek Nowak',
    goal: 'Board review',
    periodFrom: '2026-01-01',
    periodTo: '2026-03-31',
    createdAt: '2026-03-08T10:00:00Z',
    updatedAt: '2026-03-12T11:00:00Z',
    exportFormats: ['pdf'],
    sourceRefs: [],
  },
  {
    id: 'demo-r3',
    title: 'Benefits Tracking – Digital Transformation',
    reportType: 'R3',
    status: 'draft',
    owner: 'Katarzyna Wiśniewska',
    createdAt: '2026-03-14T08:00:00Z',
    updatedAt: '2026-03-15T16:00:00Z',
    exportFormats: [],
    sourceRefs: [],
  },
  {
    id: 'demo-r4',
    title: 'Portfolio Overview – All Initiatives',
    reportType: 'R4',
    status: 'exported',
    owner: 'Piotr Zieliński',
    periodFrom: '2025-07-01',
    periodTo: '2026-03-31',
    createdAt: '2026-02-20T12:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z',
    exportFormats: ['pdf', 'xlsx'],
    sourceRefs: [],
  },
  {
    id: 'demo-r5',
    title: 'Monthly Operations Review – Feb 2026',
    reportType: 'R1',
    status: 'ready',
    owner: 'Anna Kowalska',
    periodFrom: '2026-02-01',
    periodTo: '2026-02-28',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-02T10:00:00Z',
    exportFormats: ['pdf'],
    sourceRefs: [],
  },
];

const DEMO_PRESENTATIONS: PresentationItem[] = [
  {
    id: 'demo-p1',
    title: 'Digital Transformation Roadmap 2026',
    sourceType: 'tool',
    owner: 'Anna Kowalska',
    status: 'ready',
    presentationMode: 'briefing',
    createdAt: '2026-03-05T10:00:00Z',
    updatedAt: '2026-03-12T15:00:00Z',
    slideCount: 18,
    exportFormats: ['pptx'],
    sourceRefs: [],
  },
  {
    id: 'demo-p2',
    title: 'Q1 Financial Results – Board Deck',
    sourceType: 'finance',
    owner: 'Marek Nowak',
    status: 'shared',
    presentationMode: 'formal',
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-14T11:00:00Z',
    slideCount: 24,
    exportFormats: ['pptx', 'pdf'],
    sourceRefs: [],
  },
  {
    id: 'demo-p3',
    title: 'SWOT Analysis – Market Entry Strategy',
    sourceType: 'tool',
    owner: 'Katarzyna Wiśniewska',
    status: 'editing',
    presentationMode: 'workshop',
    createdAt: '2026-03-13T14:00:00Z',
    updatedAt: '2026-03-15T09:00:00Z',
    slideCount: 12,
    exportFormats: [],
    sourceRefs: [],
  },
  {
    id: 'demo-p4',
    title: 'Investment Case – Cloud Migration',
    sourceType: 'finance',
    owner: 'Piotr Zieliński',
    status: 'draft',
    presentationMode: 'briefing',
    createdAt: '2026-03-16T08:00:00Z',
    updatedAt: '2026-03-16T16:00:00Z',
    slideCount: 8,
    exportFormats: [],
    sourceRefs: [],
  },
];

const DEMO_TEMPLATES: TemplateItem[] = [
  {
    id: 'demo-t1',
    title: 'Weekly Execution Report',
    description: 'Standard weekly sprint/execution report template with KPI tracking',
    type: 'report',
    category: 'R1',
    scope: 'application',
    status: 'active',
    updatedAt: '2026-02-01T10:00:00Z',
    createdBy: 'System',
    sectionCount: 6,
  },
  {
    id: 'demo-t2',
    title: 'Steering Committee Deck',
    description: 'Formal board-level steering committee presentation',
    type: 'presentation',
    category: 'R2',
    scope: 'application',
    status: 'active',
    updatedAt: '2026-02-01T10:00:00Z',
    createdBy: 'System',
    slideCount: 15,
  },
  {
    id: 'demo-t3',
    title: 'Benefits Tracking Report',
    description: 'KPI and benefits realization tracking template',
    type: 'report',
    category: 'R3',
    scope: 'application',
    status: 'active',
    updatedAt: '2026-01-15T10:00:00Z',
    createdBy: 'System',
    sectionCount: 5,
  },
  {
    id: 'demo-t4',
    title: 'Portfolio Overview',
    description: 'Cross-initiative portfolio health and progress overview',
    type: 'report',
    category: 'R4',
    scope: 'application',
    status: 'active',
    updatedAt: '2026-01-15T10:00:00Z',
    createdBy: 'System',
    sectionCount: 8,
  },
  {
    id: 'demo-t5',
    title: 'Workshop Facilitation Deck',
    description: 'Interactive workshop presentation with exercises',
    type: 'presentation',
    category: 'initiative_review',
    scope: 'application',
    status: 'active',
    updatedAt: '2026-02-10T10:00:00Z',
    createdBy: 'System',
    slideCount: 20,
  },
  {
    id: 'demo-t6',
    title: 'Investment Case Template',
    description: 'NPV/IRR/ROI investment decision support template',
    type: 'report',
    category: 'financial_review',
    scope: 'application',
    status: 'active',
    updatedAt: '2026-02-20T10:00:00Z',
    createdBy: 'System',
    sectionCount: 7,
  },
];

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
    title: raw.resolvedTitle || raw.titleSnapshot || raw.title || 'Untitled',
    reportType: raw.reportType || 'custom',
    status: reportStatus,
    owner: raw.ownerUserId || raw.createdBy || '—',
    goal: raw.goal || undefined,
    communicationRegister: raw.communicationRegister || undefined,
    confidentiality: raw.confidentiality || undefined,
    periodFrom: raw.periodFrom || undefined,
    periodTo: raw.periodTo || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.lastTransitionAt || raw.updatedAt || new Date().toISOString(),
    exportFormats: raw.exportFormat ? [raw.exportFormat] : [],
    sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs : [],
    governance: mapArtifactGovernance(raw),
    sourceType: raw.originRuntime,
    sourceId: raw.originRecordId || undefined,
  };
}

export function useReports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const allowDemoData = shouldAllowDemoData();
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const artifactRes = await fetch(`${API_URL}/artifacts?outputType=report&limit=200`, {
        headers: getHeaders(),
      });
      if (artifactRes.ok) {
        const artifactData = await artifactRes.json();
        const list = artifactData.data || [];
        const mapped = list
          .filter((item: any) => item.originRuntime === 'report' && item.originRecordId)
          .map(mapArtifactReport);
        setReports(mapped);
        setError(null);
        return;
      }

      if (allowDemoData && (artifactRes.status === 404 || artifactRes.status === 501)) {
        setReports(DEMO_REPORTS);
        setError(null);
        return;
      }

      setReports([]);
      setError('Canonical artifact registry failed to load reports.');
    } catch {
      setReports([]);
      setError('Canonical artifact registry failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [allowDemoData]);

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

function mapArtifactPresentation(raw: any): PresentationItem {
  return {
    id: raw.originRecordId || raw.origin_record_id || raw.id,
    artifactId: raw.artifactId || raw.artifact_id,
    title: raw.resolvedTitle || raw.titleSnapshot || raw.title || 'Untitled',
    sourceType: (raw.sourceType || 'tool') as PresentationItem['sourceType'],
    owner: raw.ownerUserId || raw.createdBy || '—',
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

function mapRegistryItemToUnified(raw: any): UnifiedOutputRow | null {
  const runtime = raw?.originRuntime || raw?.origin_runtime;
  const originId = raw?.originRecordId || raw?.origin_record_id;
  if (!runtime || !originId) return null;

  const baseGov = mapArtifactGovernance(raw);

  if (runtime === 'report') {
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
      governance: p.governance || baseGov,
    };
  }

  if (runtime === 'report_template') {
    const delivery = String(raw.originStatus || raw.deliveryState || 'draft').toLowerCase();
    return {
      kind: 'document',
      originRecordId: String(originId),
      artifactId: raw.artifactId || raw.artifact_id,
      title: raw.resolvedTitle || raw.titleSnapshot || raw.title || 'Untitled',
      statusKey: delivery,
      owner: raw.ownerUserId || raw.createdBy || '—',
      updatedAt: raw.lastTransitionAt || raw.updatedAt || raw.createdAt || new Date().toISOString(),
      reportType:
        String((raw?.originSummary as any)?.template?.reportType || raw.reportType || 'custom') ||
        'custom',
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      exportFormats: [],
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
      title: raw.resolvedTitle || raw.titleSnapshot || raw.title || 'Untitled',
      statusKey: delivery,
      owner: raw.ownerUserId || raw.createdBy || '—',
      updatedAt: raw.lastTransitionAt || raw.updatedAt || raw.createdAt || new Date().toISOString(),
      sourceType: String(
        (raw?.originSummary as any)?.template?.deckType || raw.sourceType || 'tool'
      ) as any,
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      slideCount: outline.length,
      exportFormats: [],
      governance: baseGov,
    };
  }

  if (runtime === 'sheet') {
    const delivery = String(raw.originStatus || raw.deliveryState || 'draft').toLowerCase();
    return {
      kind: 'sheet',
      originRecordId: String(originId),
      artifactId: raw.artifactId || raw.artifact_id,
      title: raw.resolvedTitle || raw.titleSnapshot || raw.title || 'Untitled',
      statusKey: delivery,
      owner: raw.ownerUserId || raw.createdBy || '—',
      updatedAt: raw.lastTransitionAt || raw.updatedAt || raw.createdAt || new Date().toISOString(),
      sourceInitiativeId: raw.sourceInitiativeId || raw.source_initiative_id || undefined,
      exportFormats: raw.exportFormat ? [raw.exportFormat] : [],
      governance: baseGov,
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

  const fetchOutputs = useCallback(async () => {
    if (!view) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '200' });
      if (view === 'mine') qs.set('view', 'mine');
      if (view === 'review') qs.set('view', 'review');
      const res = await fetch(`${API_URL}/artifacts?${qs.toString()}`, { headers: getHeaders() });
      if (!res.ok) {
        setRows([]);
        setError('Canonical artifact registry failed to load outputs.');
        return;
      }
      const data = await res.json();
      const list = data.data || [];
      const mapped = list
        .map(mapRegistryItemToUnified)
        .filter((x: UnifiedOutputRow | null): x is UnifiedOutputRow => !!x);
      setRows(mapped);
      setError(null);
    } catch {
      setRows([]);
      setError('Canonical artifact registry failed to load outputs.');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { rows, loading, error, refetch: fetchOutputs };
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
  const allowDemoData = shouldAllowDemoData();
  const [error, setError] = useState<string | null>(null);

  const fetchPresentations = useCallback(async () => {
    setLoading(true);
    try {
      const artifactRes = await fetch(`${API_URL}/artifacts?outputType=presentation&limit=200`, {
        headers: getHeaders(),
      });
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

      if (allowDemoData && (artifactRes.status === 404 || artifactRes.status === 501)) {
        setPresentations(DEMO_PRESENTATIONS);
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
  }, [allowDemoData]);

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
  const allowDemoData = shouldAllowDemoData();
  const [error, setError] = useState<string | null>(null);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/artifacts?outputType=sheet&limit=200`, {
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

      if (allowDemoData && (res.status === 404 || res.status === 501)) {
        setRows([]);
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
  }, [allowDemoData]);

  useEffect(() => {
    void fetchSheets();
  }, [fetchSheets]);

  return { rows, loading, error, fetchSheets };
}

// ─── Templates (merged: report + presentation) ───────────────────

function mapTemplateStatus(statusRaw: unknown): TemplateItem['status'] {
  const normalized = String(statusRaw || '')
    .trim()
    .toLowerCase();
  if (normalized === 'draft') return 'draft';
  if (normalized === 'deprecated') return 'deprecated';
  if (normalized === 'archived') return 'archived';
  if (normalized === 'published' || normalized === 'active') return 'active';
  return 'active';
}

function mapTemplateScope(scopeRaw: unknown): TemplateItem['scope'] {
  const normalized = String(scopeRaw || '')
    .trim()
    .toLowerCase();
  if (normalized === 'user' || normalized === 'personal') return 'personal';
  if (normalized === 'app' || normalized === 'application' || normalized === 'system') {
    return 'application';
  }
  return 'organization';
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

function mapCanonicalTemplateArtifact(raw: any): TemplateItem | null {
  const template = raw?.originSummary?.template;
  const outputType = String(raw?.outputType || '').toLowerCase();
  const resolvedTitle = String(raw?.resolvedTitle || raw?.titleSnapshot || raw?.title || '').trim();

  if (outputType !== 'report' && outputType !== 'presentation' && outputType !== 'sheet')
    return null;
  if (!resolvedTitle) return null;

  const metadata =
    template?.metadata && typeof template.metadata === 'object' ? template.metadata : {};
  const updatedAt =
    String((metadata as any).updatedAt || '').trim() ||
    String(raw?.lastTransitionAt || raw?.createdAt || new Date().toISOString());

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

  return {
    id: String(raw.artifactId),
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
  const allowDemoData = shouldAllowDemoData();
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

      merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setTemplates(merged);
      setError(null);
    } catch {
      setTemplates([]);
      setError('Failed to load real templates from the active data source.');
    } finally {
      setLoading(false);
    }
  }, [allowDemoData]);

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
