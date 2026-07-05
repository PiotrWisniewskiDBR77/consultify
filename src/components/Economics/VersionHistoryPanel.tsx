/**
 * Version History Panel
 *
 * Panel for viewing and managing version history of digitization analyses.
 * Supports creating snapshots, comparing versions, and restoring.
 */

import {
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  GitCompare,
  History,
  Loader2,
  Plus,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { DigitizationAnalysis } from './types';

interface Version {
  id: string;
  analysis_id: string;
  version_number: number;
  version_name: string;
  version_type: 'snapshot' | 'baseline' | 'milestone';
  created_by: string;
  created_by_name?: string;
  created_at: string;
  notes?: string;
  overall_score?: number;
  completion_percent?: number;
}

interface VersionHistoryPanelProps {
  analysis: DigitizationAnalysis;
  onClose: () => void;
  onRestore?: (version: Version) => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  analysis,
  onClose,
  onRestore,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  // Create form state
  const [versionName, setVersionName] = useState('');
  const [versionType, setVersionType] = useState<'snapshot' | 'baseline' | 'milestone'>('snapshot');
  const [notes, setNotes] = useState('');

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await Api.getDigitizationVersions(analysis.id);
      setVersions(result.versions || []);
    } catch (err) {
      toast.error('Failed to load version');
    } finally {
      setIsLoading(false);
    }
  }, [analysis.id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleCreateVersion = async () => {
    setIsCreating(true);
    try {
      await Api.createDigitizationVersion(analysis.id, {
        versionName: versionName || undefined,
        versionType,
        notes: notes || undefined,
      });
      toast.success('Wersja utworzona');
      setShowCreateForm(false);
      setVersionName('');
      setNotes('');
      loadVersions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create version');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (version: Version) => {
    if (
      !confirm(
        `Czy na pewno chcesz restore analysis do version "${version.version_name}"? Obecny stan will be zapisany jako nowa wersja.`
      )
    ) {
      return;
    }

    try {
      await Api.restoreDigitizationVersion(analysis.id, version.id);
      toast.success(`Restored do version ${version.version_number}`);
      loadVersions();
      onRestore?.(version);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore version');
    }
  };

  const handleMarkAsBaseline = async (versionId: string) => {
    try {
      await Api.markVersionAsBaseline(analysis.id, versionId);
      toast.success('Marked jako baseline');
      loadVersions();
    } catch (err) {
      toast.error('Failed to mark jako baseline');
    }
  };

  const handleCompare = async () => {
    if (selectedForCompare.length !== 2) {
      toast.error('Select exactly 2 versions for comparison');
      return;
    }

    setIsComparing(true);
    try {
      const result = await Api.compareDigitizationVersions(
        analysis.id,
        selectedForCompare[0],
        selectedForCompare[1]
      );
      setComparisonResult(result);
    } catch (err: any) {
      toast.error(err.message || 'Failed to compare version');
    } finally {
      setIsComparing(false);
    }
  };

  const toggleVersionSelect = (versionId: string) => {
    if (selectedForCompare.includes(versionId)) {
      setSelectedForCompare(selectedForCompare.filter((id) => id !== versionId));
    } else if (selectedForCompare.length < 2) {
      setSelectedForCompare([...selectedForCompare, versionId]);
    }
  };

  const getVersionTypeIcon = (type: string) => {
    switch (type) {
      case 'baseline':
        return <Bookmark size={14} className="text-amber-500" />;
      case 'milestone':
        return <Flag size={14} className="text-emerald-500" />;
      default:
        return <Clock size={14} className="text-slate-600 dark:text-slate-500" />;
    }
  };

  const getVersionTypeLabel = (type: string) => {
    switch (type) {
      case 'baseline':
        return 'Baseline';
      case 'milestone':
        return 'Milestone';
      default:
        return 'Snapshot';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-navy-900 shadow-2xl z-overlay flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <History className="text-blue-500" size={20} />
          </div>
          <div>
            <h2 className="font-bold text-navy-900 dark:text-white">Historia version</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{analysis.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-600 dark:text-slate-500" />
        </button>
      </div>

      {/* Compare toolbar */}
      {selectedForCompare.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border-b border-blue-200 dark:border-blue-500/20 flex items-center justify-between">
          <span className="text-sm text-blue-600 dark:text-blue-400">
            Selected {selectedForCompare.length}/2 version for comparison
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedForCompare([])}
              className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-white rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCompare}
              disabled={selectedForCompare.length !== 2 || isComparing}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isComparing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <GitCompare size={14} />
              )}
              Compare
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-slate-600 dark:text-slate-500" size={24} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current state indicator */}
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Stan aktualny
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Wynik: {analysis.overallScore?.toFixed(1) || 0}/7
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {analysis.completionPercent || 0}% completed
                </span>
              </div>
            </div>

            {/* Create version form */}
            {showCreateForm && (
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
                <h4 className="font-medium text-navy-900 dark:text-white mb-4">
                  Create new version
                </h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nazwa version (opcjonalnie)"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    {(['snapshot', 'baseline', 'milestone'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setVersionType(type)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                          versionType === type
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30'
                        }`}
                      >
                        {getVersionTypeIcon(type)}
                        {getVersionTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Notatki (opcjonalnie)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateVersion}
                    disabled={isCreating}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium"
                  >
                    {isCreating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* Comparison result */}
            {comparisonResult && (
              <div className="bg-primary-50 dark:bg-primary-500/10 rounded-xl p-4 border border-primary-200 dark:border-primary-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-primary-700 dark:text-primary-400">
                    Version Comparison
                  </h4>
                  <button
                    onClick={() => {
                      setComparisonResult(null);
                      setSelectedForCompare([]);
                    }}
                    className="p-1 hover:bg-primary-200 dark:hover:bg-primary-500/20 rounded"
                  >
                    <X size={16} className="text-primary-500" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">
                      v{comparisonResult.version1.versionNumber}
                    </p>
                    <p className="font-medium text-navy-900 dark:text-white">
                      {comparisonResult.version1.versionName}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">
                      v{comparisonResult.version2.versionNumber}
                    </p>
                    <p className="font-medium text-navy-900 dark:text-white">
                      {comparisonResult.version2.versionName}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-500/20">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{comparisonResult.summary.totalChanges}</span>{' '}
                    changes w ocenach
                    {comparisonResult.summary.improved > 0 && (
                      <span className="text-emerald-500 ml-2">
                        +{comparisonResult.summary.improved} poprawionych
                      </span>
                    )}
                    {comparisonResult.summary.regressed > 0 && (
                      <span className="text-rose-500 ml-2">
                        -{comparisonResult.summary.regressed} pogorszonych
                      </span>
                    )}
                  </p>
                  <div className="mt-2 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Zmiana scoreu: </span>
                    <span
                      className={
                        (comparisonResult.metricsDiff?.overallScore?.change ?? 0) > 0
                          ? 'text-emerald-500'
                          : (comparisonResult.metricsDiff?.overallScore?.change ?? 0) < 0
                            ? 'text-rose-500'
                            : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {(comparisonResult.metricsDiff?.overallScore?.change ?? 0) > 0 ? '+' : ''}
                      {(comparisonResult.metricsDiff?.overallScore?.change ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Version timeline */}
            {versions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-navy-800 rounded-xl flex items-center justify-center mb-4">
                  <History className="text-slate-600 dark:text-slate-500" size={28} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  No zapisanych version
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-500">
                  Create first version to track changesy
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-white/10" />

                <div className="space-y-4">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={`relative pl-12 ${
                        selectedForCompare.includes(version.id)
                          ? 'bg-blue-50 dark:bg-blue-500/10 -ml-2 pl-14 py-2 rounded-xl'
                          : ''
                      }`}
                    >
                      {/* Timeline dot */}
                      <button
                        onClick={() => toggleVersionSelect(version.id)}
                        className={`absolute left-3 w-4 h-4 rounded-full border-2 transition-all ${
                          selectedForCompare.includes(version.id)
                            ? 'bg-blue-500 border-blue-500'
                            : version.version_type === 'baseline'
                              ? 'bg-amber-500 border-amber-500'
                              : version.version_type === 'milestone'
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'bg-white dark:bg-navy-900 border-slate-300 dark:border-white/20 hover:border-blue-500'
                        }`}
                      />

                      <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-500">
                                v{version.version_number}
                              </span>
                              {getVersionTypeIcon(version.version_type)}
                              <span className="text-xs text-slate-600 dark:text-slate-500">
                                {getVersionTypeLabel(version.version_type)}
                              </span>
                            </div>
                            <p className="font-medium text-navy-900 dark:text-white mt-1">
                              {version.version_name}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(version.created_at).toLocaleDateString('pl-PL')}
                              </span>
                              <span className="flex items-center gap-1">
                                <User size={12} />
                                {version.created_by_name || 'User'}
                              </span>
                            </div>
                            {version.notes && expandedVersion === version.id && (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-navy-900 p-2 rounded-lg">
                                {version.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-bold text-emerald-500">
                              {version.overall_score?.toFixed(1) || '0'}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-500">
                              {version.completion_percent || 0}%
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-navy-700">
                          {version.notes && (
                            <button
                              onClick={() =>
                                setExpandedVersion(
                                  expandedVersion === version.id ? null : version.id
                                )
                              }
                              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-white/5 rounded"
                            >
                              {expandedVersion === version.id ? (
                                <ChevronUp size={12} />
                              ) : (
                                <ChevronDown size={12} />
                              )}
                              Notatki
                            </button>
                          )}
                          {version.version_type !== 'baseline' && (
                            <button
                              onClick={() => handleMarkAsBaseline(version.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded"
                            >
                              <Bookmark size={12} />
                              Baseline
                            </button>
                          )}
                          <button
                            onClick={() => handleRestore(version)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded ml-auto"
                          >
                            <RotateCcw size={12} />
                            Restore
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!showCreateForm && (
        <div className="p-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={18} />
            Save Version
          </button>
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPanel;
