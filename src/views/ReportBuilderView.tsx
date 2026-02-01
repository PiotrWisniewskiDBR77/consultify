/**
 * ReportBuilderView
 *
 * Main view for the Report Builder module.
 * Provides both list view for existing reports and wizard for creating new ones.
 */

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ReportBuilderWizard } from '../components/ReportBuilder';
import type {
  Report,
  ReportSourceType,
  ReportStatus,
} from '../components/ReportBuilder/useReportBuilder';
import { Api } from '../services/api';

// ==========================================
// TYPES
// ==========================================

interface ReportsListProps {
  onCreateNew: () => void;
  onOpenReport: (reportId: string) => void;
}

// ==========================================
// REPORTS LIST COMPONENT
// ==========================================

const ReportsList: React.FC<ReportsListProps> = ({ onCreateNew, onOpenReport }) => {
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
    <div className="space-y-6">
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

        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {isPl ? 'Nowy Raport' : 'New Report'}
        </button>
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
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
          className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{isPl ? 'Wszystkie statusy' : 'All statuses'}</option>
          <option value="DRAFT">{isPl ? 'Szkic' : 'Draft'}</option>
          <option value="GENERATED">{isPl ? 'Wygenerowane' : 'Generated'}</option>
          <option value="IN_REVIEW">{isPl ? 'W przeglądzie' : 'In Review'}</option>
          <option value="APPROVED">{isPl ? 'Zatwierdzone' : 'Approved'}</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">
              {isPl ? 'Brak raportów' : 'No reports yet'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {isPl
                ? 'Utwórz swój pierwszy raport z zatwierdzonej oceny'
                : 'Create your first report from an approved assessment'}
            </p>
            <button
              onClick={onCreateNew}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Sparkles className="w-4 h-4" />
              {isPl ? 'Utwórz Raport' : 'Create Report'}
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {isPl ? 'Tytuł' : 'Title'}
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {isPl ? 'Źródło' : 'Source'}
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {isPl ? 'Status' : 'Status'}
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {isPl ? 'Data' : 'Date'}
                </th>
                <th className="px-6 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  onClick={() => onOpenReport(report.id)}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{report.title}</div>
                    {report.description && (
                      <div className="text-sm text-slate-500 truncate max-w-md">
                        {report.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <FileText className="w-4 h-4" />
                      <span>{report.sourceName || report.sourceId}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{report.sourceFramework}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}
                    >
                      {report.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActionMenuId(actionMenuId === report.id ? null : report.id)
                        }
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {actionMenuId === report.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                          <button
                            onClick={() => onOpenReport(report.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Eye className="w-4 h-4" />
                            {isPl ? 'Otwórz' : 'Open'}
                          </button>
                          <button
                            onClick={() => handleDuplicate(report.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Copy className="w-4 h-4" />
                            {isPl ? 'Duplikuj' : 'Duplicate'}
                          </button>
                          {(report.status === 'DRAFT' || report.status === 'GENERATED') && (
                            <button
                              onClick={() => handleDelete(report.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                              {isPl ? 'Usuń' : 'Delete'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const reportId = params.reportId;

  // Get initial source from URL params (when coming from Assessment)
  const initialSourceType = searchParams.get('sourceType') as ReportSourceType | null;
  const initialSourceId = searchParams.get('sourceId');
  const initialSourceName = searchParams.get('sourceName');

  // Show wizard for new or editing
  const showWizard = isNew || !!reportId;

  const handleCreateNew = useCallback(() => {
    navigate('/reports/builder?new=true');
  }, [navigate]);

  const handleOpenReport = useCallback(
    (id: string) => {
      navigate(`/reports/builder/${id}`);
    },
    [navigate]
  );

  const handleWizardComplete = useCallback(
    (id: string) => {
      navigate('/reports/builder');
    },
    [navigate]
  );

  const handleWizardCancel = useCallback(() => {
    navigate('/reports/builder');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 p-6">
      <div className="max-w-7xl mx-auto">
        {showWizard ? (
          <div>
            {/* Back Button */}
            <button
              onClick={handleWizardCancel}
              className="flex items-center gap-2 mb-6 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              {/* Using i18n would require translation context here */}
              Powrót do listy
            </button>

            <ReportBuilderWizard
              reportId={reportId}
              initialSourceType={initialSourceType}
              initialSourceId={initialSourceId}
              initialSourceName={initialSourceName}
              onComplete={handleWizardComplete}
              onCancel={handleWizardCancel}
            />
          </div>
        ) : (
          <ReportsList onCreateNew={handleCreateNew} onOpenReport={handleOpenReport} />
        )}
      </div>
    </div>
  );
};

export default ReportBuilderView;
