/**
 * useRapData — Hook for fetching real data from backend for Reports & Presentations Hub
 *
 * Replaces MOCK_DATA with live API calls to:
 *   - GET /api/report-builder           → reports list
 *   - GET /api/report-builder/templates → report templates
 *   - GET /api/presentations/decks      → presentation decks
 *   - GET /api/presentations/templates  → presentation templates
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '../../services/api';
import type { PresentationItem, ReportItem, TemplateItem } from './types';

// ─── Reports ──────────────────────────────────────────────────────

function mapReport(raw: any): ReportItem {
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Untitled',
    reportType: raw.report_type || raw.reportType || raw.source_type || 'custom',
    status: (raw.status || 'draft').toLowerCase() as ReportItem['status'],
    owner: raw.created_by_name || raw.owner || raw.created_by || '—',
    periodFrom: raw.period_from || raw.periodFrom || undefined,
    periodTo: raw.period_to || raw.periodTo || undefined,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    exportFormats: raw.export_formats
      ? (typeof raw.export_formats === 'string' ? JSON.parse(raw.export_formats) : raw.export_formats)
      : [],
    sourceRefs: raw.source_refs_json
      ? (typeof raw.source_refs_json === 'string' ? JSON.parse(raw.source_refs_json) : raw.source_refs_json)
      : [],
    sourceType: raw.source_type,
    sourceId: raw.source_id,
  };
}

export function useReports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/report-builder`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.reports || data.data || [];
        setReports(list.map(mapReport));
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

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
    } catch { /* noop */ }
    return false;
  }, []);

  return { reports, loading, fetchReports, deleteReport };
}

// ─── Presentations (Decks) ────────────────────────────────────────

function mapDeck(raw: any): PresentationItem {
  return {
    id: raw.id,
    title: raw.title || 'Untitled',
    sourceType: raw.deck_type || raw.sourceType || 'tool',
    owner: raw.owner || raw.created_by || '—',
    status: (raw.status || 'draft').toLowerCase() as PresentationItem['status'],
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updated_at || raw.updatedAt || new Date().toISOString(),
    slideCount: raw.slide_count || raw.slideCount || 0,
    exportFormats: raw.export_format ? [raw.export_format] : [],
    sourceId: raw.source_id,
    thumbnailUrl: raw.thumbnail_url,
  };
}

export function usePresentations() {
  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresentations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/presentations/decks`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.data || data.decks || [];
        setPresentations(list.map(mapDeck));
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPresentations(); }, [fetchPresentations]);

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
    } catch { /* noop */ }
    return false;
  }, []);

  return { presentations, loading, fetchPresentations, deleteDeck };
}

// ─── Templates (merged: report + presentation) ───────────────────

function mapReportTemplate(raw: any): TemplateItem {
  const sections = typeof raw.sections_json === 'string'
    ? JSON.parse(raw.sections_json || '[]')
    : (raw.sections_json || raw.sections || []);
  return {
    id: raw.id,
    title: raw.name || raw.title || 'Untitled',
    description: raw.description || '',
    type: 'report',
    category: raw.report_type || raw.category || 'custom',
    scope: raw.is_system ? 'application' : 'organization',
    status: (raw.is_active === false || raw.status === 'archived') ? 'archived' : 'active',
    updatedAt: raw.updated_at || raw.createdAt || new Date().toISOString(),
    createdBy: raw.created_by || 'System',
    sectionCount: Array.isArray(sections) ? sections.length : 0,
  };
}

function mapPresentationTemplate(raw: any): TemplateItem {
  const outline = typeof raw.outline_json === 'string'
    ? JSON.parse(raw.outline_json || '[]')
    : (raw.outline_json || []);
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
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  return { templates, loading, fetchTemplates };
}

// ─── Actions ─────────────────────────────────────────────────────

export function useRapActions() {
  const { t } = useTranslation();

  const exportReportPdf = useCallback(async (reportId: string) => {
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
    } catch { toast.error(t('rap.toast.exportFailed', 'Export failed')); }
  }, [t]);

  const exportDeckPptx = useCallback(async (deckId: string) => {
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
    } catch { toast.error(t('rap.toast.exportFailed', 'Export failed')); }
  }, [t]);

  const archiveReport = useCallback(async (reportId: string) => {
    try {
      const res = await fetch(`${API_URL}/report-builder/${reportId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success(t('rap.toast.archived', 'Archived'));
        return true;
      }
    } catch { /* noop */ }
    toast.error(t('rap.toast.archiveFailed', 'Failed to archive'));
    return false;
  }, [t]);

  const archiveDeck = useCallback(async (deckId: string) => {
    try {
      const res = await fetch(`${API_URL}/presentations/decks/${deckId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        toast.success(t('rap.toast.archived', 'Archived'));
        return true;
      }
    } catch { /* noop */ }
    toast.error(t('rap.toast.archiveFailed', 'Failed to archive'));
    return false;
  }, [t]);

  return { exportReportPdf, exportDeckPptx, archiveReport, archiveDeck };
}
