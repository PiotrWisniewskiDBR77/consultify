import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  Eye,
  FileText,
  GitCommit,
  History,
  RefreshCw,
  RotateCcw,
  Upload,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { PlaybookTemplateVersionHistory as VersionType } from '../../types';

interface PlaybookTemplateVersionHistoryProps {
  templateId: string;
  currentVersion: number;
  onRestore?: (version: number) => void;
}

export const PlaybookTemplateVersionHistory: React.FC<PlaybookTemplateVersionHistoryProps> = ({
  templateId,
  currentVersion,
  onRestore,
}) => {
  const token = localStorage.getItem('token');

  const [versions, setVersions] = useState<VersionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/playbooks/templates/${templateId}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  }, [token, templateId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleRestore = async (version: number) => {
    if (
      !confirm(
        `Are you sure you want to restore to version ${version}? This will create a new version.`
      )
    ) {
      return;
    }

    setRestoring(version);
    try {
      const res = await fetch(
        `/api/content/playbooks/templates/${templateId}/versions/${version}/restore`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        await loadVersions();
        onRestore?.(version);
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setRestoring(null);
    }
  };

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'CREATE':
        return <FileText size={14} className="text-emerald-400" />;
      case 'UPDATE':
        return <Edit size={14} className="text-blue-400" />;
      case 'PUBLISH':
        return <Upload size={14} className="text-primary-400" />;
      case 'RESTORE':
        return <RotateCcw size={14} className="text-amber-400" />;
      default:
        return <GitCommit size={14} className="text-slate-600 dark:text-slate-500" />;
    }
  };

  const getChangeTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      CREATE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      UPDATE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      PUBLISH: 'bg-primary-500/10 text-primary-400 border-primary-500/30',
      RESTORE: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[type] || 'bg-slate-50 dark:bg-navy-800/300/10 text-slate-600 dark:text-slate-500 border-slate-500/30'}`}
      >
        {getChangeTypeIcon(type)}
        {type}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-slate-600 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-primary-400" />
        <h3 className="font-semibold text-c-text">Version History</h3>
        <span className="px-2 py-0.5 bg-c-surface-raised text-slate-600 text-xs rounded-full">
          {versions.length} versions
        </span>
      </div>

      {/* Timeline */}
      {versions.length === 0 ? (
        <div className="text-center py-8">
          <History className="w-10 h-10 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-500">No version history available</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-c-surface-raised/50" />

          <div className="space-y-4">
            {versions.map((version, index) => {
              const isCurrent = version.version === currentVersion;
              const isExpanded = expandedVersion === version.version;

              return (
                <div key={version.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                      isCurrent
                        ? 'bg-c-surface border-c-border'
                        : 'bg-c-surface-raised border-slate-600'
                    }`}
                  />

                  <div
                    className={`bg-slate-800/50 border rounded-lg overflow-hidden ${
                      isCurrent ? 'border-primary-500/30' : 'border-c-border/50'
                    }`}
                  >
                    {/* Header */}
                    <button
                      onClick={() => setExpandedVersion(isExpanded ? null : version.version)}
                      className="w-full flex items-center justify-between p-4 hover:bg-c-surface-raised/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-semibold ${
                              isCurrent ? 'text-primary-400' : 'text-c-text'
                            }`}
                          >
                            v{version.version}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-primary-500/10 text-primary-400 text-xs rounded-full border border-primary-500/30">
                              Current
                            </span>
                          )}
                        </div>
                        {getChangeTypeBadge(version.changeType)}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="text-slate-600 dark:text-slate-500">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 text-xs">
                            {new Date(version.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-600 dark:text-slate-500" />
                        )}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-c-border/50">
                        <div className="pt-4 space-y-4">
                          {/* Change notes */}
                          {version.changeNotes && (
                            <div>
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                                Change Notes
                              </div>
                              <p className="text-sm text-slate-600">{version.changeNotes}</p>
                            </div>
                          )}

                          {/* Details grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                                Title
                              </div>
                              <p className="text-sm text-c-text truncate">{version.title}</p>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                                Status at Version
                              </div>
                              <p className="text-sm text-c-text">
                                {version.statusAtVersion || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                                Changed By
                              </div>
                              <p className="text-sm text-c-text">{version.changedBy || 'System'}</p>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                                Est. Duration
                              </div>
                              <p className="text-sm text-c-text">
                                {version.estimatedDurationMins
                                  ? `${version.estimatedDurationMins} mins`
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Description */}
                          {version.description && (
                            <div>
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                                Description
                              </div>
                              <p className="text-sm text-slate-600 line-clamp-3">
                                {version.description}
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          {!isCurrent && (
                            <div className="pt-2 border-t border-c-border/50 flex gap-2">
                              <button
                                onClick={() => handleRestore(version.version)}
                                disabled={restoring === version.version}
                                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-sm hover:bg-amber-500/20 disabled:opacity-50"
                              >
                                {restoring === version.version ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                                Restore
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaybookTemplateVersionHistory;
