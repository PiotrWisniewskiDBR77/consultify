/**
 * VersionHistory Component
 *
 * Version control panel for Management Reports.
 * Shows version history, allows comparison and restoration.
 *
 * PMO Standards: Configuration Management (PRINCE2)
 */

import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Eye,
  FileText,
  GitBranch,
  History,
  Minus,
  Plus,
  RotateCcw,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { ReportVersion, VersionComparisonResult } from '../../../types';

interface VersionHistoryProps {
  reportId: string;
  currentVersion?: number;
  versions: ReportVersion[];
  isLoading?: boolean;
  isLocked?: boolean;
  onLoadVersions?: () => Promise<void>;
  onViewVersion?: (versionNumber: number) => void;
  onCompareVersions?: (v1: number, v2: number) => Promise<VersionComparisonResult>;
  onRestoreVersion?: (versionNumber: number) => Promise<void>;
  className?: string;
}

// Change type badge
const ChangeTypeBadge: React.FC<{ type: 'added' | 'removed' | 'modified' }> = ({ type }) => {
  const config = {
    added: { icon: Plus, color: 'text-emerald-500 bg-emerald-500/10', label: 'Added' },
    removed: { icon: Minus, color: 'text-red-500 bg-red-500/10', label: 'Removed' },
    modified: { icon: Edit3, color: 'text-amber-500 bg-amber-500/10', label: 'Modified' },
  };
  const { icon: Icon, color, label } = config[type];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
};

// Single version item
const VersionItem: React.FC<{
  version: ReportVersion;
  isCurrent: boolean;
  isSelected: boolean;
  isComparing: boolean;
  onSelect: () => void;
  onView: () => void;
  onCompare: () => void;
}> = ({ version, isCurrent, isSelected, isComparing, onSelect, onView, onCompare }) => {
  return (
    <div
      className={`
                p-3 rounded-lg border transition-all cursor-pointer
                ${
                  isSelected
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : 'border-slate-200 dark:border-navy-700 hover:border-violet-300 dark:hover:border-violet-500/50'
                }
            `}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                        ${
                          isCurrent
                            ? 'bg-violet-500 text-white'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300'
                        }
                    `}
          >
            v{version.versionLabel}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-navy-900 dark:text-white">
                Version {version.versionLabel}
              </span>
              {isCurrent && (
                <span className="px-2 py-0.5 bg-violet-500 text-white text-xs rounded-full">
                  Current
                </span>
              )}
            </div>
            {version.changeSummary && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {version.changeSummary}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <User size={12} />
                {version.createdByName}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(version.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
            title="View version"
          >
            <Eye size={16} className="text-slate-400 dark:text-slate-500" />
          </button>
          {isComparing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCompare();
              }}
              className="p-2 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 rounded-lg transition-colors"
              title="Compare with selected"
            >
              <ArrowLeftRight size={16} className="text-violet-600 dark:text-violet-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Comparison view
const ComparisonView: React.FC<{
  comparison: VersionComparisonResult;
  onClose: () => void;
}> = ({ comparison, onClose }) => {
  return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-navy-800/50 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-navy-900 dark:text-white flex items-center gap-2">
          <ArrowLeftRight size={18} className="text-violet-500" />
          Comparing v{comparison.version1.versionLabel} → v{comparison.version2.versionLabel}
        </h4>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{comparison.summary}</p>

      {comparison.changes.length === 0 ? (
        <p className="text-center text-slate-400 dark:text-slate-500 py-4">
          No changes detected between versions
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {comparison.changes.map((change, index: number) => (
            <div
              key={index}
              className="flex items-start gap-3 p-2 bg-white dark:bg-navy-900 rounded-lg"
            >
              <ChangeTypeBadge type={change.type} />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm text-navy-900 dark:text-white">
                  {change.field}
                </span>
                {change.type === 'modified' && (
                  <div className="mt-1 text-xs">
                    <div className="text-red-500 line-through truncate">
                      {JSON.stringify(change.oldValue)?.substring(0, 100)}
                    </div>
                    <div className="text-emerald-500 truncate">
                      {JSON.stringify(change.newValue)?.substring(0, 100)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  reportId,
  currentVersion,
  versions,
  isLoading = false,
  isLocked = false,
  onLoadVersions,
  onViewVersion,
  onCompareVersions,
  onRestoreVersion,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparison, setComparison] = useState<VersionComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  // Load versions when expanded
  useEffect(() => {
    if (expanded && onLoadVersions && versions.length === 0) {
      onLoadVersions();
    }
  }, [expanded, onLoadVersions, versions.length]);

  // Handle compare
  const handleCompare = useCallback(
    async (v2: number) => {
      if (!selectedVersion || !onCompareVersions) return;

      setComparing(true);
      try {
        const result = await onCompareVersions(selectedVersion, v2);
        setComparison(result);
        setCompareMode(false);
      } catch (error) {
        console.error('Compare failed:', error);
      } finally {
        setComparing(false);
      }
    },
    [selectedVersion, onCompareVersions]
  );

  // Handle restore
  const handleRestore = useCallback(
    async (versionNumber: number) => {
      if (!onRestoreVersion) return;

      setRestoring(true);
      try {
        await onRestoreVersion(versionNumber);
        setConfirmRestore(null);
        onLoadVersions?.();
      } catch (error) {
        console.error('Restore failed:', error);
      } finally {
        setRestoring(false);
      }
    },
    [onRestoreVersion, onLoadVersions]
  );

  return (
    <div
      className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
            <History size={20} className="text-slate-600 dark:text-slate-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-navy-900 dark:text-white">Version History</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {versions.length} version{versions.length !== 1 ? 's' : ''} • Current: v
              {currentVersion || '1.0'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-slate-400 dark:text-slate-500" />
          {expanded ? (
            <ChevronUp size={20} className="text-slate-400 dark:text-slate-500" />
          ) : (
            <ChevronDown size={20} className="text-slate-400 dark:text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-navy-700">
          {/* Actions bar */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCompareMode(!compareMode);
                  setComparison(null);
                }}
                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                    ${
                                      compareMode
                                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                        : 'hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300'
                                    }
                                `}
              >
                <ArrowLeftRight size={14} />
                {compareMode ? 'Cancel Compare' : 'Compare'}
              </button>
            </div>
            {selectedVersion && selectedVersion !== currentVersion && !isLocked && (
              <button
                onClick={() => setConfirmRestore(selectedVersion)}
                disabled={restoring}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              >
                <RotateCcw size={14} />
                Restore v{versions.find((v) => v.versionNumber === selectedVersion)?.versionLabel}
              </button>
            )}
          </div>

          {compareMode && selectedVersion && (
            <div className="mb-3 p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-sm text-violet-700 dark:text-violet-300">
              Select another version to compare with v
              {versions.find((v) => v.versionNumber === selectedVersion)?.versionLabel}
            </div>
          )}

          {/* Version list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <FileText size={32} className="mx-auto mb-2 opacity-50" />
              <p>No versions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isCurrent={version.versionNumber === currentVersion}
                  isSelected={version.versionNumber === selectedVersion}
                  isComparing={
                    compareMode &&
                    selectedVersion !== null &&
                    version.versionNumber !== selectedVersion
                  }
                  onSelect={() => setSelectedVersion(version.versionNumber)}
                  onView={() => onViewVersion?.(version.versionNumber)}
                  onCompare={() => handleCompare(version.versionNumber)}
                />
              ))}
            </div>
          )}

          {/* Comparison view */}
          {comparison && (
            <ComparisonView comparison={comparison} onClose={() => setComparison(null)} />
          )}

          {/* Locked notice */}
          {isLocked && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Clock size={16} />
              Report is finalized. Restore is not available.
            </div>
          )}
        </div>
      )}

      {/* Restore confirmation modal */}
      {confirmRestore !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-900 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
              Restore Version?
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              This will create a new version with the content from v
              {versions.find((v) => v.versionNumber === confirmRestore)?.versionLabel}. The current
              version will not be deleted.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmRestore(null)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-navy-700 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(confirmRestore)}
                disabled={restoring}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg font-medium transition-colors"
              >
                {restoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
