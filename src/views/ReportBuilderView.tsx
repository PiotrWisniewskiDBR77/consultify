/**
 * ReportBuilderView
 *
 * Main view for the Report Builder module.
 * Provides both list view for existing reports and the new Gamma-style editor.
 */

import {
  Calendar,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ReportEditor } from '../components/ReportBuilder/ReportEditor';
import { ReportsComposer } from '../components/ReportBuilder/ReportsComposer';
import type {
  Report,
  ReportSourceType,
  ReportStatus,
} from '../components/ReportBuilder/useReportBuilder';
import { Api } from '../services/api';

// ==========================================
// REPORTS LIST COMPONENT
// ==========================================

interface ReportsListProps {
  onCreateNew: () => void;
  onOpenReport: (reportId: string) => void;
  onManageComposer: () => void;
}

const ReportsList: React.FC<ReportsListProps> = ({
  onCreateNew,
  onOpenReport,
  onManageComposer,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        let url = '/report-builder';
        const queryParams: string[] = [];
        if (searchQuery) queryParams.push(`search=${encodeURIComponent(searchQuery)}`);
        if (statusFilter) queryParams.push(`status=${statusFilter}`);
        if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

        const response = await Api.get(url);
        setReports(response?.reports || []);
      } catch (err) {
        console.error('Failed to fetch reports:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [searchQuery, statusFilter]);

  // Status badge color
  const getStatusColor = (status: ReportStatus): string => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
      case 'CONFIGURING':
      case 'GENERATING':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
      case 'GENERATED':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300';
      case 'IN_REVIEW':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'APPROVED':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300';
      case 'UTILIZED':
        return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  // Handle duplicate
  const handleDuplicate = async (reportId: string) => {
    try {
      const response = await Api.post(`/report-builder/${reportId}/duplicate`, {});
      setReports((prev) => [response?.report, ...prev]);
      setActionMenuId(null);
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  };

  // Handle delete
  const handleDelete = async (reportId: string) => {
    if (
      !confirm(
        isPl
          ? 'Czy na pewno chcesz usunąć ten raport?'
          : 'Are you sure you want to delete this report?'
      )
    ) {
      return;
    }

    try {
      await Api.delete(`/report-builder/${reportId}`);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setActionMenuId(null);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isPl ? 'Kreator Raportów' : 'Report Builder'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {isPl
                ? 'Twórz profesjonalne raporty na podstawie ocen i analiz'
                : 'Create professional reports from assessments and analyses'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onManageComposer}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              {isPl ? 'Ustawienia' : 'Settings'}
            </button>
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25"
            >
              <Plus className="w-5 h-5" />
              {isPl ? 'Nowy Raport' : 'New Report'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isPl ? 'Szukaj raportów...' : 'Search reports...'}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
            className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{isPl ? 'Wszystkie statusy' : 'All statuses'}</option>
            <option value="DRAFT">{isPl ? 'Szkic' : 'Draft'}</option>
            <option value="GENERATED">{isPl ? 'Wygenerowane' : 'Generated'}</option>
            <option value="IN_REVIEW">{isPl ? 'W przeglądzie' : 'In Review'}</option>
            <option value="APPROVED">{isPl ? 'Zatwierdzone' : 'Approved'}</option>
          </select>
        </div>

        {/* Reports Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              {isPl ? 'Brak raportów' : 'No reports yet'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              {isPl
                ? 'Utwórz swój pierwszy raport z zatwierdzonej oceny'
                : 'Create your first report from an approved assessment'}
            </p>
            <button
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 font-medium shadow-lg shadow-blue-500/25"
            >
              <Sparkles className="w-5 h-5" />
              {isPl ? 'Utwórz Raport' : 'Create Report'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => onOpenReport(report.id)}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuId(actionMenuId === report.id ? null : report.id);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {actionMenuId === report.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReport(report.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-4 h-4" />
                          {isPl ? 'Otwórz' : 'Open'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(report.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Copy className="w-4 h-4" />
                          {isPl ? 'Duplikuj' : 'Duplicate'}
                        </button>
                        {(report.status === 'DRAFT' || report.status === 'GENERATED') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(report.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                            {isPl ? 'Usuń' : 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">
                  {report.title}
                </h3>

                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">
                  {report.sourceName || report.sourceId}
                </p>

                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}
                  >
                    {report.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                    {report.status}
                  </span>

                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// MAIN VIEW
// ==========================================

export const ReportBuilderView: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ reportId?: string }>();
  const [searchParams] = useSearchParams();

  const isNew = searchParams.get('new') === 'true';
  const tab = searchParams.get('tab') as 'composer' | 'blocks' | 'templates' | 'profiles' | null;
  const reportId = params.reportId;

  // Get initial source from URL params (when coming from Assessment)
  const initialSourceType = searchParams.get('sourceType') as ReportSourceType | null;
  const initialSourceId = searchParams.get('sourceId');
  const initialSourceName = searchParams.get('sourceName');

  // Determine view mode
  const isComposerTab =
    tab === 'composer' || tab === 'blocks' || tab === 'templates' || tab === 'profiles';
  const showEditor = !isComposerTab && (isNew || !!reportId);

  const handleCreateNew = useCallback(() => {
    navigate('/reports/builder?new=true');
  }, [navigate]);

  const handleOpenReport = useCallback(
    (id: string) => {
      navigate(`/reports/builder/${id}`);
    },
    [navigate]
  );

  const handleManageComposer = useCallback(() => {
    navigate('/reports/builder?tab=composer');
  }, [navigate]);

  const handleEditorClose = useCallback(() => {
    navigate('/reports/builder');
  }, [navigate]);

  const handleEditorSave = useCallback((id: string) => {
    // Stay in editor after save
  }, []);

  // Composer view
  if (isComposerTab) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <ReportsComposer
            onBack={() => navigate('/reports/builder')}
            initialTab={
              tab === 'composer' ? 'blocks' : (tab as 'blocks' | 'templates' | 'profiles')
            }
          />
        </div>
      </div>
    );
  }

  // Editor view
  if (showEditor) {
    return (
      <ReportEditor
        reportId={reportId}
        sourceType={initialSourceType || undefined}
        sourceId={initialSourceId || undefined}
        sourceName={initialSourceName || undefined}
        onSave={handleEditorSave}
        onClose={handleEditorClose}
      />
    );
  }

  // List view
  return (
    <ReportsList
      onCreateNew={handleCreateNew}
      onOpenReport={handleOpenReport}
      onManageComposer={handleManageComposer}
    />
  );
};

export default ReportBuilderView;
