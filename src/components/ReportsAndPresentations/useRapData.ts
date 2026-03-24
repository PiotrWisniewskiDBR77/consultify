/**
 * useRapData — Hook for fetching real data from backend for Reports & Presentations Hub
 *
 * API calls:
 *   - GET /api/report-builder           → reports list
 *   - GET /api/report-builder/templates → report templates
 *   - GET /api/presentations/decks      → presentation decks
 *   - GET /api/presentations/templates  → presentation templates
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders, shouldAllowDemoData } from '../../services/api';
import type { PresentationItem, ReportItem, TemplateItem, UnifiedOutputRow } from './types';

const DEMO_REPORTS: ReportItem[] = [
  { id: 'demo-r1', title: 'Weekly Execution Report – Sprint 14', reportType: 'R1', status: 'ready', owner: 'Anna Kowalska', goal: 'Stakeholder update', periodFrom: '2026-03-04', periodTo: '2026-03-10', createdAt: '2026-03-10T09:00:00Z', updatedAt: '2026-03-10T14:30:00Z', exportFormats: ['pdf', 'pptx'], sourceRefs: [] },
  { id: 'demo-r2', title: 'Steering Committee – Q1 2026', reportType: 'R2', status: 'ready', owner: 'Marek Nowak', goal: 'Board review', periodFrom: '2026-01-01', periodTo: '2026-03-31', createdAt: '2026-03-08T10:00:00Z', updatedAt: '2026-03-12T11:00:00Z', exportFormats: ['pdf'], sourceRefs: [] },
  { id: 'demo-r3', title: 'Benefits Tracking – Digital Transformation', reportType: 'R3', status: 'draft', owner: 'Katarzyna Wiśniewska', createdAt: '2026-03-14T08:00:00Z', updatedAt: '2026-03-15T16:00:00Z', exportFormats: [], sourceRefs: [] },
  { id: 'demo-r4', title: 'Portfolio Overview – All Initiatives', reportType: 'R4', status: 'exported', owner: 'Piotr Zieliński', periodFrom: '2025-07-01', periodTo: '2026-03-31', createdAt: '2026-02-20T12:00:00Z', updatedAt: '2026-03-01T09:00:00Z', exportFormats: ['pdf', 'xlsx'], sourceRefs: [] },
  { id: 'demo-r5', title: 'Monthly Operations Review – Feb 2026', reportType: 'R1', status: 'ready', owner: 'Anna Kowalska', periodFrom: '2026-02-01', periodTo: '2026-02-28', createdAt: '2026-03-01T08:00:00Z', updatedAt: '2026-03-02T10:00:00Z', exportFormats: ['pdf'], sourceRefs: [] },
];

const DEMO_PRESENTATIONS: PresentationItem[] = [
  { id: 'demo-p1', title: 'Digital Transformation Roadmap 2026', sourceType: 'tool', owner: 'Anna Kowalska', status: 'ready', presentationMode: 'briefing', createdAt: '2026-03-05T10:00:00Z', updatedAt: '2026-03-12T15:00:00Z', slideCount: 18, exportFormats: ['pptx'], sourceRefs: [] },
  { id: 'demo-p2', title: 'Q1 Financial Results – Board Deck', sourceType: 'finance', owner: 'Marek Nowak', status: 'shared', presentationMode: 'formal', createdAt: '2026-03-10T09:00:00Z', updatedAt: '2026-03-14T11:00:00Z', slideCount: 24, exportFormats: ['pptx', 'pdf'], sourceRefs: [] },
  { id: 'demo-p3', title: 'SWOT Analysis – Market Entry Strategy', sourceType: 'tool', owner: 'Katarzyna Wiśniewska', status: 'editing', presentationMode: 'workshop', createdAt: '2026-03-13T14:00:00Z', updatedAt: '2026-03-15T09:00:00Z', slideCount: 12, exportFormats: [], sourceRefs: [] },
  { id: 'demo-p4', title: 'Investment Case – Cloud Migration', sourceType: 'finance', owner: 'Piotr Zieliński', status: 'draft', presentationMode: 'briefing', createdAt: '2026-03-16T08:00:00Z', updatedAt: '2026-03-16T16:00:00Z', slideCount: 8, exportFormats: [], sourceRefs: [] },
];

const DEMO_TEMPLATES: TemplateItem[] = [
  { id: 'demo-t1', title: 'Weekly Execution Report', description: 'Standard weekly sprint/execution report template with KPI tracking', type: 'report', category: 'R1', scope: 'application', status: 'active', updatedAt: '2026-02-01T10:00:00Z', createdBy: 'System', sectionCount: 6 },
  { id: 'demo-t2', title: 'Steering Committee Deck', description: 'Formal board-level steering committee presentation', type: 'presentation', category: 'R2', scope: 'application', status: 'active', updatedAt: '2026-02-01T10:00:00Z', createdBy: 'System', slideCount: 15 },
  { id: 'demo-t3', title: 'Benefits Tracking Report', description: 'KPI and benefits realization tracking template', type: 'report', category: 'R3', scope: 'application', status: 'active', updatedAt: '2026-01-15T10:00:00Z', createdBy: 'System', sectionCount: 5 },
  { id: 'demo-t4', title: 'Portfolio Overview', description: 'Cross-initiative portfolio health and progress overview', type: 'report', category: 'R4', scope: 'application', status: 'active', updatedAt: '2026-01-15T10:00:00Z', createdBy: 'System', sectionCount: 8 },
  { id: 'demo-t5', title: 'Workshop Facilitation Deck', description: 'Interactive workshop presentation with exercises', type: 'presentation', category: 'initiative_review', scope: 'application', status: 'active', updatedAt: '2026-02-10T10:00:00Z', createdBy: 'System', slideCount: 20 },
  { id: 'demo-t6', title: 'Investment Case Template', description: 'NPV/IRR/ROI investment decision support template', type: 'report', category: 'financial_review', scope: 'application', status: 'active', updatedAt: '2026-02-20T10:00:00Z', createdBy: 'System', sectionCount: 7 },
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
    delivery === 'ready' ? 'ready' :
    delivery === 'archived' ? 'archived' :
    delivery === 'shared' || delivery === 'exported' ? 'exported' :
    'draft';

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
    governance: {
      visibilityScope: raw.visibilityScope,
      publishState: raw.publishState,
      publishReviewers: Array.isArray(raw.publishReviewers) ? raw.publishReviewers : [],
      reviewGateCount: typeof raw.reviewGateCount === 'number' ? raw.reviewGateCount : 0,
      projectId: raw.projectId || null,
    },
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

      if (artifactRes.status !== 404 && artifactRes.status !== 501) {
        setReports([]);
        setError('Canonical artifact registry failed to load reports.');
        return;
      }

      const res = await fetch(`${API_URL}/report-builder`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.reports || data.data || [];
        const mapped = list.map(mapReport);
        setReports(mapped);
        setError(null);
      } else {
        setReports([]);
        setError('Failed to load real reports from the active data source.');
      }
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
    status: (raw.originStatus || raw.deliveryState || 'draft').toLowerCase() as PresentationItem['status'],
    presentationMode: raw.presentationMode || 'briefing',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.lastTransitionAt || raw.updatedAt || new Date().toISOString(),
    slideCount: raw.slideCount || 0,
    exportFormats: raw.exportFormat ? [raw.exportFormat] : [],
    sourceId: raw.originRecordId || undefined,
    thumbnailUrl: raw.thumbnailUrl,
    sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs : [],
    governance: {
      visibilityScope: raw.visibilityScope,
      publishState: raw.publishState,
      publishReviewers: Array.isArray(raw.publishReviewers) ? raw.publishReviewers : [],
      reviewGateCount: typeof raw.reviewGateCount === 'number' ? raw.reviewGateCount : 0,
      projectId: raw.projectId || null,
    },
  };
}

function mapRegistryItemToUnified(raw: any): UnifiedOutputRow | null {
  const runtime = raw?.originRuntime || raw?.origin_runtime;
  const originId = raw?.originRecordId || raw?.origin_record_id;
  if (!runtime || !originId) return null;

  const baseGov = {
    visibilityScope: raw.visibilityScope,
    publishState: raw.publishState,
    publishReviewers: Array.isArray(raw.publishReviewers) ? raw.publishReviewers : [],
    reviewGateCount: typeof raw.reviewGateCount === 'number' ? raw.reviewGateCount : 0,
    projectId: raw.projectId || null,
  };

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
      slideCount: p.slideCount,
      exportFormats: p.exportFormats,
      governance: p.governance || baseGov,
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
      exportFormats: raw.exportFormat ? [raw.exportFormat] : [],
      governance: baseGov,
    };
  }

  return null;
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

      if (artifactRes.status !== 404 && artifactRes.status !== 501) {
        setPresentations([]);
        setError('Canonical artifact registry failed to load presentations.');
        return;
      }

      const res = await fetch(`${API_URL}/presentations/decks`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.data || data.decks || [];
        const mapped = list.map(mapDeck);
        setPresentations(mapped);
        setError(null);
      } else {
        setPresentations([]);
        setError('Failed to load real presentations from the active data source.');
      }
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

// ─── Templates (merged: report + presentation) ───────────────────

function mapReportTemplate(raw: any): TemplateItem {
  const sections =
    typeof raw.sections_json === 'string'
      ? JSON.parse(raw.sections_json || '[]')
      : raw.sections_json || raw.sections || [];
  return {
    id: raw.id,
    title: raw.name || raw.title || 'Untitled',
    description: raw.description || '',
    type: 'report',
    category: raw.report_type || raw.category || 'custom',
    scope: raw.is_system ? 'application' : 'organization',
    status: raw.is_active === false || raw.status === 'archived' ? 'archived' : 'active',
    updatedAt: raw.updated_at || raw.createdAt || new Date().toISOString(),
    createdBy: raw.created_by || 'System',
    sectionCount: Array.isArray(sections) ? sections.length : 0,
  };
}

function mapPresentationTemplate(raw: any): TemplateItem {
  const outline =
    typeof raw.outline_json === 'string'
      ? JSON.parse(raw.outline_json || '[]')
      : raw.outline_json || [];
  return {
    id: raw.id,
    title: raw.name || raw.title || 'Untitled',
    description: raw.description || '',
    type: 'presentation',
    category: raw.intent || raw.category || 'custom',
    scope: raw.is_system ? 'application' : 'organization',
    status: raw.is_active === false ? 'archived' : 'active',
    updatedAt: raw.updated_at || new Date().toISOString(),
    createdBy: raw.created_by || 'System',
    slideCount: Array.isArray(outline) ? outline.length : 0,
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
      const [rptRes, presRes] = await Promise.all([
        fetch(`${API_URL}/report-builder/templates`, { headers: getHeaders() }),
        fetch(`${API_URL}/presentations/templates`, { headers: getHeaders() }),
      ]);

      const merged: TemplateItem[] = [];

      if (rptRes.ok) {
        const rptData = await rptRes.json();
        const rptList = rptData.templates || rptData.data || [];
        merged.push(...rptList.map(mapReportTemplate));
      }

      if (presRes.ok) {
        const presData = await presRes.json();
        const presList = presData.data || presData.templates || [];
        merged.push(...presList.map(mapPresentationTemplate));
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
    async (reportId: string) => {
      try {
        const res = await fetch(`${API_URL}/report-builder/${reportId}/export/pdf`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `report-${reportId.slice(0, 8)}.pdf`;
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
    async (deckId: string) => {
      try {
        const res = await fetch(`${API_URL}/presentations/decks/${deckId}/download`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `presentation-${deckId.slice(0, 8)}.pptx`;
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
    async (reportId: string) => {
      try {
        const res = await fetch(`${API_URL}/report-builder/${reportId}`, {
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
    async (deckId: string) => {
      try {
        const res = await fetch(`${API_URL}/presentations/decks/${deckId}`, {
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
