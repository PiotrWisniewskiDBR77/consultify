/**
 * ActivityLogPanel
 *
 * Displays a timeline of all activities/actions performed on an assessment.
 * Shows who did what and when - for work tracking and audit purposes.
 */

import {
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Save,
  SkipForward,
  Target,
  User,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

interface Props {
  assessmentId: string;
  className?: string;
}

// ==========================================
// ACTION CONFIG
// ==========================================

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ASSESSMENT_CREATED: {
    label: 'Assessment created',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  },
  ASSESSMENT_UPDATED: {
    label: 'Assessment saved',
    icon: <Save className="w-4 h-4" />,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  },
  ASSESSMENT_DELETED: {
    label: 'Assessment deleted',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-danger-600 dark:text-danger-400 bg-danger-100 dark:bg-danger-900/30',
  },
  LEVEL_ACHIEVED: {
    label: 'Level marked as achieved',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  },
  LEVEL_TARGET_SET: {
    label: 'Target level set',
    icon: <Target className="w-4 h-4" />,
    color: 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30',
  },
  LEVEL_SKIPPED: {
    label: 'Level skipped',
    icon: <SkipForward className="w-4 h-4" />,
    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  },
  COMMENT_ADDED: {
    label: 'Comment added',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  },
  FILE_UPLOADED: {
    label: 'Attachment uploaded',
    icon: <Paperclip className="w-4 h-4" />,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30',
  },
  LINK_ADDED: {
    label: 'Link added',
    icon: <Link2 className="w-4 h-4" />,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  },
  STATUS_CHANGED: {
    label: 'Status changed',
    icon: <FileEdit className="w-4 h-4" />,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  },
  REPORT_GENERATED: {
    label: 'Report generated',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
  },
  INITIATIVES_GENERATED: {
    label: 'Initiatives generated',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30',
  },
  CHAT_CONTEXT_ATTACHED: {
    label: 'Chat context attached',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30',
  },
  TEAM_MEMBER_ADDED: {
    label: 'Team member added',
    icon: <User className="w-4 h-4" />,
    color: 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30',
  },
  TEAM_MEMBER_ROLE_UPDATED: {
    label: 'Team member role updated',
    icon: <User className="w-4 h-4" />,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  },
  TEAM_MEMBER_REMOVED: {
    label: 'Team member removed',
    icon: <User className="w-4 h-4" />,
    color: 'text-danger-600 dark:text-danger-400 bg-danger-100 dark:bg-danger-900/30',
  },
};

const DEFAULT_ACTION_CONFIG = {
  label: 'Action performed',
  icon: <Clock className="w-4 h-4" />,
  color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
};

// ==========================================
// HELPERS
// ==========================================

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionDetails(entry: ActivityLogEntry): string | null {
  const d = entry.details;
  if (!d) return null;

  if (entry.action === 'LEVEL_ACHIEVED' && d.areaId && d.level) {
    return `${d.areaId} · Level ${d.level}`;
  }
  if (entry.action === 'LEVEL_TARGET_SET' && d.areaId && d.level) {
    return `${d.areaId} · Target Level ${d.level}`;
  }
  if (entry.action === 'LEVEL_SKIPPED' && d.areaId && d.level) {
    return `${d.areaId} · Level ${d.level}`;
  }
  if (entry.action === 'COMMENT_ADDED' && d.areaId && d.level) {
    const preview = d.comment ? String(d.comment).slice(0, 50) : '';
    return `${d.areaId} L${d.level}${preview ? `: "${preview}..."` : ''}`;
  }
  if (entry.action === 'FILE_UPLOADED' && d.fileName) {
    return String(d.fileName);
  }
  if (entry.action === 'LINK_ADDED' && d.url) {
    return String(d.url).slice(0, 60);
  }
  if (entry.action === 'STATUS_CHANGED' && d.from && d.to) {
    return `${d.from} → ${d.to}`;
  }
  if (entry.action === 'INITIATIVES_GENERATED' && d.count) {
    return `${d.count} initiatives`;
  }
  if (entry.action === 'ASSESSMENT_UPDATED' && d.completionPercent !== undefined) {
    return `${d.completionPercent}% complete`;
  }

  return null;
}

// ==========================================
// COMPONENT
// ==========================================

export const ActivityLogPanel: React.FC<Props> = ({ assessmentId, className }) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!assessmentId) return;
    try {
      const resp = await Api.get(`/assessment-workflow/${assessmentId}/activity-logs`);
      const data = Array.isArray(resp?.logs) ? resp.logs : [];
      setLogs(data);
      setError(null);
    } catch (e: any) {
      console.error('[ActivityLogPanel] Error fetching logs:', e);
      setError(e?.message || 'Failed to load activity logs');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs();
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className || ''}`}>
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className || ''}`}>
        <div className="flex items-center gap-3 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 rounded-lg text-danger-700 dark:text-danger-300">
          <span>{error}</span>
          <button
            onClick={handleRefresh}
            className="ml-auto px-3 py-1 text-sm font-medium bg-danger-100 dark:bg-danger-900/30 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-900/50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className || ''}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy-900 dark:text-white">Activity Log</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-6">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No activity recorded yet</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Actions will appear here as you work on the assessment
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200 dark:bg-navy-700" />

            {/* Entries */}
            <div className="space-y-4">
              {logs.map((entry, idx) => {
                const config = ACTION_CONFIG[entry.action] || DEFAULT_ACTION_CONFIG;
                const details = getActionDetails(entry);
                const userName = entry.userName || entry.userEmail || 'System';

                return (
                  <div key={entry.id || idx} className="relative flex gap-4">
                    {/* Icon */}
                    <div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.color}`}
                    >
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-navy-900 dark:text-white">
                            {config.label}
                          </div>
                          {details && (
                            <div className="text-sm text-slate-600 dark:text-slate-300 truncate">
                              {details}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <User className="w-3 h-3" />
                            <span>{userName}</span>
                            <span>·</span>
                            <span title={formatFullTimestamp(entry.timestamp)}>
                              {formatTimestamp(entry.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogPanel;
