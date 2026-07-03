/**
 * Analysis Catalog Component
 *
 * Grid/table view for managing digitization analyses
 * Features: search, filter, sort, bulk actions
 */

import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Grid,
  List,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { LoadingState } from '../ui/primitives';
import { AnalysisCatalogStats, AnalysisStatus, DigitizationAnalysis } from './types';

const formatCurrencyValue = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
};

interface AnalysisCatalogProps {
  onSelect: (analysis: DigitizationAnalysis) => void;
  onCreateNew: () => void;
  onImport: () => void;
}

export const AnalysisCatalog: React.FC<AnalysisCatalogProps> = ({
  onSelect,
  onCreateNew,
  onImport,
}) => {
  const [analyses, setAnalyses] = useState<DigitizationAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<AnalysisCatalogStats | null>(null);

  const loadAnalyses = useCallback(async () => {
    setIsLoading(true);
    try {
      const [analysesResult, statsResult] = await Promise.all([
        Api.getDigitizationAnalyses({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery || undefined,
        }),
        Api.getDigitizationStats(),
      ]);
      setAnalyses(analysesResult.analyses || []);
      setStats(statsResult);
    } catch (e) {
      console.error('Failed to load analyses:', e);
      toast.error('Failed to load analyses');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this analysis? This action cannot be undone.'))
      return;
    try {
      await Api.deleteDigitizationAnalysis(id);
      toast.success('Analysis deleted');
      loadAnalyses();
    } catch (e) {
      toast.error('Failed to delete analysis');
    }
  };

  const handleDuplicate = async (analysis: DigitizationAnalysis) => {
    try {
      await Api.duplicateDigitizationAnalysis(analysis.id, `${analysis.name} (Copy)`);
      toast.success('Analysis duplicated');
      loadAnalyses();
    } catch (e) {
      toast.error('Failed to duplicate analysis');
    }
  };

  const handleExport = async (id: string) => {
    try {
      const result = await Api.exportDigitizationAnalysis(id);
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
        toast.success('Export started');
      }
    } catch (e) {
      toast.error('Failed to export analysis');
    }
  };

  // Bulk Operations
  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.length} analyses? This action cannot be undone.`
      )
    )
      return;

    try {
      let successCount = 0;
      for (const id of selectedIds) {
        try {
          await Api.deleteDigitizationAnalysis(id);
          successCount++;
        } catch (e) {
          console.error(`Failed to delete ${id}:`, e);
        }
      }

      toast.success(`Deleted ${successCount}/${selectedIds.length} analyses`);
      setSelectedIds([]);
      loadAnalyses();
    } catch (e) {
      toast.error('Error occurred while deleting');
    }
  };

  const handleBulkExport = async () => {
    try {
      toast.loading(`Exporting ${selectedIds.length} analyses...`);
      let successCount = 0;

      for (const id of selectedIds) {
        try {
          const result = await Api.exportDigitizationAnalysis(id);
          if (result.downloadUrl) {
            // Open each download in a new tab with small delay
            setTimeout(() => window.open(result.downloadUrl, '_blank'), successCount * 500);
            successCount++;
          }
        } catch (e) {
          console.error(`Failed to export ${id}:`, e);
        }
      }

      toast.dismiss();
      toast.success(`Exported ${successCount}/${selectedIds.length} analyses`);
    } catch (e) {
      toast.dismiss();
      toast.error('Error occurred while exporting');
    }
  };

  const handleBulkStatusChange = async (newStatus: AnalysisStatus) => {
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        try {
          await Api.updateDigitizationAnalysis(id, { status: newStatus });
          successCount++;
        } catch (e) {
          console.error(`Failed to update status for ${id}:`, e);
        }
      }

      toast.success(`Changed status for ${successCount}/${selectedIds.length} analyses`);
      setSelectedIds([]);
      loadAnalyses();
    } catch (e) {
      toast.error('Error occurred while changing status');
    }
  };

  const clearSelection = () => setSelectedIds([]);

  // Filtering
  const filteredAnalyses = analyses.filter((a) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !a.name.toLowerCase().includes(q) &&
        !a.projectName?.toLowerCase().includes(q) &&
        !a.initiativeName?.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="All Analyses" value={stats.total} icon={BarChart3} color="purple" />
          <StatCard label="Completed" value={stats.completed} icon={TrendingUp} color="green" />
          <StatCard label="In Progress" value={stats.inProgress} icon={Calendar} color="yellow" />
          <StatCard
            label="Average Score"
            value={`${(stats.avgScore ?? 0).toFixed(1)}/7`}
            icon={TrendingUp}
            color="emerald"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 relative w-full md:w-auto">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            size={18}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search analyses by name or project..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                            dark:border-navy-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AnalysisStatus | 'all')}
              className="appearance-none px-4 py-2.5 pr-10 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                                dark:border-navy-700 rounded-xl text-sm cursor-pointer"
            >
              <option value="all">Wszystkie statusy</option>
              <option value="DRAFT">Szkic</option>
              <option value="REVIEW">In Progress</option>
              <option value="APPROVED">Completed</option>
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 pointer-events-none"
              size={16}
            />
          </div>

          {/* View Toggle */}
          <div className="flex bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:text-slate-600 dark:text-slate-400'}`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:text-slate-600 dark:text-slate-400'}`}
            >
              <List size={16} />
            </button>
          </div>

          {/* Compare Button */}
          {selectedIds.length >= 2 && (
            <button className="px-4 py-2.5 bg-c-text text-c-bg rounded-xl text-sm font-medium hover:bg-c-text-secondary transition-colors">
              Compare ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div
          className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-500/10 to-blue-500/10
                    border border-emerald-500/20 rounded-xl animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
              {selectedIds.length}
            </span>
            <span className="text-sm font-medium text-navy-900 dark:text-white">
              {selectedIds.length === 1
                ? 'analysis selected'
                : selectedIds.length < 5
                  ? 'analyses selected'
                  : 'analyses selected'}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-300 dark:bg-white/20" />
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-700
                                dark:border-navy-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300
                                hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <Download size={14} />
              Eksportuj
            </button>

            {/* Bulk Status Change Dropdown */}
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-700
                                    dark:border-navy-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300
                                    hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <CheckCircle size={14} />
                Change Status
                <ChevronDown size={14} />
              </button>
              <div
                className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-700
                                dark:border-navy-700 rounded-xl shadow-xl z-10 py-1 hidden group-hover:block"
              >
                <button
                  onClick={() => handleBulkStatusChange('DRAFT')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Szkic
                </button>
                <button
                  onClick={() => handleBulkStatusChange('REVIEW')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  In Progress
                </button>
                <button
                  onClick={() => handleBulkStatusChange('APPROVED')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Completed
                </button>
              </div>
            </div>

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200
                                dark:border-rose-500/30 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400
                                hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={clearSelection}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingState variant="spinner" className="h-64" />
      ) : filteredAnalyses.length === 0 ? (
        <EmptyState onCreateNew={onCreateNew} onImport={onImport} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnalyses.map((analysis) => (
            <AnalysisCard
              key={analysis.id}
              analysis={analysis}
              isSelected={selectedIds.includes(analysis.id)}
              onSelect={() => onSelect(analysis)}
              onToggleSelect={() =>
                setSelectedIds((prev) =>
                  prev.includes(analysis.id)
                    ? prev.filter((id) => id !== analysis.id)
                    : [...prev, analysis.id]
                )
              }
              onDelete={() => handleDelete(analysis.id)}
              onDuplicate={() => handleDuplicate(analysis)}
              onExport={() => handleExport(analysis.id)}
            />
          ))}
        </div>
      ) : (
        <AnalysisTable
          analyses={filteredAnalyses}
          selectedIds={selectedIds}
          onSelect={onSelect}
          onToggleSelect={(id) =>
            setSelectedIds((prev) =>
              prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
            )
          }
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onExport={handleExport}
        />
      )}
    </div>
  );
};

// ============================================
// Sub-components
// ============================================

const StatCard: React.FC<{ label: string; value: number | string; icon: any; color: string }> = ({
  label,
  value,
  icon: Icon,
  color,
}) => {
  const colors: Record<string, string> = {
    purple: 'bg-primary-500/10 text-primary-500',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
  };

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-navy-900 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ onCreateNew: () => void; onImport: () => void }> = ({
  onCreateNew,
  onImport,
}) => (
  <div className="flex flex-col items-center justify-center h-64 text-center">
    <div className="w-16 h-16 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
      <BarChart3 size={32} className="text-emerald-500" />
    </div>
    <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">No analyses</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
      Start assessing your organization's digital maturity. Create a new analysis or import dane z
      Excel.
    </p>
    <div className="flex gap-3">
      <button
        onClick={onImport}
        className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-navy-700
                    text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <Upload size={18} />
        Import Excel
      </button>
      <button
        onClick={onCreateNew}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors"
      >
        <Plus size={18} />
        New Analysis
      </button>
    </div>
  </div>
);

const AnalysisCard: React.FC<{
  analysis: DigitizationAnalysis;
  isSelected: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}> = ({ analysis, isSelected, onSelect, onToggleSelect, onDelete, onDuplicate, onExport }) => {
  const [showMenu, setShowMenu] = useState(false);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-500/10 text-slate-600 dark:text-slate-500',
    REVIEW: 'bg-yellow-500/10 text-yellow-500',
    APPROVED: 'bg-green-500/10 text-green-500',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Szkic',
    REVIEW: 'In Progress',
    APPROVED: 'Completed',
  };

  const statusLabelsFinancial: Record<string, string> = {
    DRAFT: 'Draft',
    REVIEW: 'Review',
    APPROVED: 'Approved',
  };

  return (
    <div
      className={`group bg-white dark:bg-navy-800 border rounded-xl p-4 transition-all cursor-pointer
                hover:shadow-lg hover:border-emerald-500/50 relative
                ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-navy-700'}`}
    >
      {/* Selection Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 left-4 w-4 h-4 rounded border-slate-300 dark:border-navy-700 accent-emerald-500"
      />

      {/* Menu */}
      <div className="absolute top-4 right-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
        >
          <MoreVertical size={16} className="text-slate-600 dark:text-slate-500" />
        </button>
        {showMenu && (
          <div
            className="absolute right-0 mt-1 w-44 bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-700
                        dark:border-navy-700 rounded-xl shadow-xl z-10 py-1 overflow-hidden"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
            >
              <Eye size={14} /> Open
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
            >
              <FileSpreadsheet size={14} /> Eksportuj
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
            >
              <Copy size={14} /> Duplicate
            </button>
            <hr className="my-1 border-slate-200 dark:border-navy-700" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div onClick={onSelect} className="pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
            <BarChart3 size={24} className="text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-navy-900 dark:text-white truncate">
              {analysis.name}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-500 truncate">
              {analysis.initiativeName || analysis.projectName || 'No initiative'}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 dark:text-slate-400">Progress</span>
            <span className="font-medium text-navy-900 dark:text-white">
              {analysis.completionPercent || 0}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${analysis.completionPercent || 0}%` }}
            />
          </div>
        </div>

        {/* Score & Status */}
        <div className="flex items-center justify-between">
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[analysis.status]}`}
          >
            {analysis.analysisType === 'financial'
              ? statusLabelsFinancial[analysis.status]
              : statusLabels[analysis.status]}
          </span>
          <div className="text-right">
            {analysis.analysisType === 'financial' ? (
              <>
                <span className="text-xs text-slate-600 dark:text-slate-500">NPV / ROI</span>
                <div className="text-sm font-semibold text-emerald-500">
                  {formatCurrencyValue(analysis.npv)} •{' '}
                  {analysis.roi !== null && analysis.roi !== undefined
                    ? `${(analysis.roi * 100).toFixed(1)}%`
                    : '—'}
                </div>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-600 dark:text-slate-500">Wynik</span>
                <div className="text-xl font-bold text-emerald-500">
                  {analysis.overallScore?.toFixed(1) || '-'}/7
                </div>
              </>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 text-xs text-slate-600 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <User size={12} /> {analysis.createdByName || 'Nieznany'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} /> {new Date(analysis.createdAt).toLocaleDateString('pl-PL')}
          </span>
        </div>
      </div>
    </div>
  );
};

const AnalysisTable: React.FC<{
  analyses: DigitizationAnalysis[];
  selectedIds: string[];
  onSelect: (analysis: DigitizationAnalysis) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (analysis: DigitizationAnalysis) => void;
  onExport: (id: string) => void;
}> = ({ analyses, selectedIds, onSelect, onToggleSelect, onDelete, onDuplicate, onExport }) => {
  const statusLabels: Record<string, string> = {
    DRAFT: 'Szkic',
    REVIEW: 'In Progress',
    APPROVED: 'Completed',
  };
  const statusLabelsFinancial: Record<string, string> = {
    DRAFT: 'Draft',
    REVIEW: 'Review',
    APPROVED: 'Approved',
  };

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-navy-900/50">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 accent-emerald-500"
                onChange={() => {
                  if (selectedIds.length === analyses.length) {
                    analyses.forEach((a) => onToggleSelect(a.id));
                  } else {
                    analyses.forEach((a) => {
                      if (!selectedIds.includes(a.id)) onToggleSelect(a.id);
                    });
                  }
                }}
                checked={selectedIds.length === analyses.length && analyses.length > 0}
              />
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Nazwa
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Projekt
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Initiative
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Status
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Progress
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Wynik
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              NPV / ROI
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Data
            </th>
            <th className="w-20 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
          {analyses.map((analysis) => (
            <tr
              key={analysis.id}
              className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              onClick={() => onSelect(analysis)}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(analysis.id)}
                  onChange={() => onToggleSelect(analysis.id)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 accent-emerald-500"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <BarChart3 size={16} className="text-emerald-500" />
                  </div>
                  <span className="font-medium text-navy-900 dark:text-white">{analysis.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {analysis.projectName || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {analysis.initiativeName || '-'}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    analysis.status === 'APPROVED'
                      ? 'bg-green-500/10 text-green-500'
                      : analysis.status === 'REVIEW'
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-500'
                  }`}
                >
                  {analysis.analysisType === 'financial'
                    ? statusLabelsFinancial[analysis.status]
                    : statusLabels[analysis.status]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${analysis.completionPercent || 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-10">
                    {analysis.completionPercent || 0}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-bold text-emerald-500">
                  {analysis.overallScore?.toFixed(1) || '-'}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-500">/7</span>
              </td>
              <td className="px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                {analysis.analysisType === 'financial' ? (
                  <>
                    {formatCurrencyValue(analysis.npv)} •{' '}
                    {analysis.roi !== null && analysis.roi !== undefined
                      ? `${(analysis.roi * 100).toFixed(1)}%`
                      : '—'}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {new Date(analysis.createdAt).toLocaleDateString('pl-PL')}
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onExport(analysis.id)}
                    className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                    title="Eksportuj"
                  >
                    <FileSpreadsheet size={16} />
                  </button>
                  <button
                    onClick={() => onDuplicate(analysis)}
                    className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(analysis.id)}
                    className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AnalysisCatalog;
