import { format } from 'date-fns';
import { enUS, pl } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  Lightbulb,
  MessageSquare,
  MessageSquareWarning,
  Monitor,
  Palette,
  Search,
  Send,
  Star,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';

type FeedbackStatus = 'NEW' | 'PENDING' | 'IN_PROGRESS' | 'REVIEWED' | 'RESOLVED' | 'ARCHIVED';

interface StatusHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

interface FeedbackItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  type: 'BUG' | 'IDEA' | 'FEATURE' | 'PULSE';
  title?: string;
  message: string;
  status: FeedbackStatus;
  severity?: string;
  rating?: number;
  metadata?: string;
  admin_response?: string;
  responded_at?: string;
  route_path?: string;
  device_type?: string;
  screen_size?: string;
  ui_language?: string;
  ui_theme?: string;
  source_env?: string;
  linked_task_id?: string;
  created_at: string;
  updated_at?: string;
  statusHistory?: StatusHistoryEntry[];
}

const STATUS_ORDER: FeedbackStatus[] = [
  'NEW',
  'PENDING',
  'IN_PROGRESS',
  'REVIEWED',
  'RESOLVED',
  'ARCHIVED',
];

const STATUS_CONFIG: Record<FeedbackStatus, { color: string; bg: string; border: string }> = {
  NEW: {
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-600/10',
    border: 'border-blue-600/20',
  },
  PENDING: {
    color: 'text-yellow-800 dark:text-yellow-400',
    bg: 'bg-yellow-600/10',
    border: 'border-yellow-600/20',
  },
  IN_PROGRESS: {
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-600/10',
    border: 'border-orange-600/20',
  },
  REVIEWED: {
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-600/10',
    border: 'border-purple-600/20',
  },
  RESOLVED: {
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-600/10',
    border: 'border-green-600/20',
  },
  ARCHIVED: {
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-700/50',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  CRITICAL: { color: 'text-red-700 dark:text-red-400', icon: <AlertTriangle size={12} /> },
  HIGH: { color: 'text-orange-700 dark:text-orange-400', icon: <AlertTriangle size={12} /> },
  MEDIUM: { color: 'text-amber-700 dark:text-amber-400', icon: <AlertTriangle size={12} /> },
  LOW: { color: 'text-slate-600 dark:text-slate-500', icon: null },
};

export const SuperAdminFeedbackView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchFeedback = useCallback(async () => {
    try {
      const data = await Api.getFeedback();
      setFeedback(data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const updateStatus = async (id: string, newStatus: FeedbackStatus) => {
    try {
      await Api.updateFeedbackStatus(id, newStatus);
      setFeedback((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      if (selectedItem?.id === id)
        setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const sendResponse = async (id: string) => {
    if (!responseText.trim()) return;
    setIsSending(true);
    try {
      await Api.post(`/feedback/${id}/respond`, { response: responseText.trim() });
      setFeedback((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                admin_response: responseText.trim(),
                responded_at: new Date().toISOString(),
                status: 'REVIEWED' as FeedbackStatus,
              }
            : item
        )
      );
      if (selectedItem?.id === id) {
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                admin_response: responseText.trim(),
                responded_at: new Date().toISOString(),
                status: 'REVIEWED' as FeedbackStatus,
              }
            : null
        );
      }
      setResponseText('');
    } catch (error) {
      console.error('Error sending response:', error);
    } finally {
      setIsSending(false);
    }
  };

  const loadDetail = async (item: FeedbackItem) => {
    try {
      const detail = await Api.get(`/feedback/${item.id}`);
      setSelectedItem(detail);
    } catch {
      setSelectedItem(item);
    }
  };

  const filteredFeedback = useMemo(
    () =>
      feedback
        .filter((item) => {
          if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
          if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
          if (severityFilter !== 'ALL' && (item.severity || 'NORMAL') !== severityFilter)
            return false;
          return true;
        })
        .filter(
          (item) =>
            !search ||
            (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
            item.message.toLowerCase().includes(search.toLowerCase()) ||
            (item.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.linked_task_id || '').toLowerCase().includes(search.toLowerCase()) ||
            item.id.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [feedback, statusFilter, typeFilter, severityFilter, search]
  );

  const formatDate = (date: string) =>
    format(new Date(date), 'PPP p', { locale: i18n.language === 'pl' ? pl : enUS });
  const parseMetadata = (meta?: string): Record<string, unknown> => {
    if (!meta) return {};
    try {
      return JSON.parse(meta);
    } catch {
      return {};
    }
  };

  if (selectedItem) {
    const meta = parseMetadata(selectedItem.metadata);
    const statusHist = selectedItem.statusHistory || [];
    const sConf = STATUS_CONFIG[selectedItem.status] || STATUS_CONFIG.NEW;
    const nextStatuses = STATUS_ORDER.filter((s) => s !== selectedItem.status);

    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setSelectedItem(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} /> {t('feedback.backToList', 'Back to list')}
          </button>
          <InfoButton cardId="superadmin-feedback" position="header-inline" size="md" />
        </div>

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border ${
                    selectedItem.type === 'BUG'
                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-900'
                      : selectedItem.type === 'FEATURE'
                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-900'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-900'
                  }`}
                >
                  {selectedItem.type === 'BUG' ? <Bug size={12} /> : <Lightbulb size={12} />}
                  {selectedItem.type}
                </span>
                {selectedItem.source_env && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 dark:bg-navy-900/40 dark:text-slate-300 dark:border-slate-700">
                    {selectedItem.source_env}
                  </span>
                )}
                {selectedItem.severity && selectedItem.severity !== 'LOW' && (
                  <span
                    className={`text-xs font-bold ${SEVERITY_CONFIG[selectedItem.severity]?.color || 'text-slate-400'} flex items-center gap-1`}
                  >
                    {SEVERITY_CONFIG[selectedItem.severity]?.icon} {selectedItem.severity}
                  </span>
                )}
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${sConf.color} ${sConf.bg} border ${sConf.border}`}
                >
                  {selectedItem.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Copy size={10} /> {selectedItem.id}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(selectedItem.id, s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].border} hover:opacity-80`}
                >
                  → {s}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            {selectedItem.title ? (
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                {selectedItem.title}
              </p>
            ) : null}
            <p className="text-slate-800 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
              {selectedItem.message}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <User size={12} /> {selectedItem.user_email || selectedItem.user_name || 'Anonymous'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatDate(selectedItem.created_at)}
            </span>
            {selectedItem.rating && (
              <span className="flex items-center gap-1">
                <Star size={12} /> {selectedItem.rating}/5
              </span>
            )}
            {selectedItem.linked_task_id && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} /> Task {selectedItem.linked_task_id}
              </span>
            )}
          </div>
        </div>

        {(selectedItem.route_path || selectedItem.device_type || Object.keys(meta).length > 0) && (
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
              {t('feedback.context', 'Context & Metadata')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {selectedItem.route_path && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Globe size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.route_path}
                  </span>
                </div>
              )}
              {selectedItem.device_type && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Monitor size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.device_type}{' '}
                    {selectedItem.screen_size ? `(${selectedItem.screen_size})` : ''}
                  </span>
                </div>
              )}
              {selectedItem.ui_language && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Globe size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.ui_language}
                  </span>
                </div>
              )}
              {selectedItem.ui_theme && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Palette size={12} />{' '}
                  <span className="text-slate-800 dark:text-slate-300">
                    {selectedItem.ui_theme}
                  </span>
                </div>
              )}
              {Object.entries(meta)
                .filter(
                  ([k]) =>
                    ![
                      'userEmail',
                      'userName',
                      'type',
                      'severity',
                      'title',
                      'feedbackType',
                      'linkedTaskId',
                    ].includes(k)
                )
                .map(([k, v]) => (
                  <div key={k} className="text-slate-600 dark:text-slate-400">
                    <span className="text-slate-500">{k}:</span>{' '}
                    <span className="text-slate-800 dark:text-slate-300">{String(v)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {statusHist.length > 0 && (
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300">
              {t('feedback.statusHistory', 'Status History')}
            </h3>
            <div className="space-y-2">
              {statusHist.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400"
                >
                  <span className="text-slate-500">{formatDate(entry.created_at)}</span>
                  <ChevronRight size={12} />
                  <span>{entry.from_status || '—'}</span>
                  <span>→</span>
                  <span
                    className={
                      STATUS_CONFIG[entry.to_status as FeedbackStatus]?.color || 'text-slate-300'
                    }
                  >
                    {entry.to_status}
                  </span>
                  {entry.note && <span className="text-slate-500 italic">({entry.note})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 flex items-center gap-2">
            <MessageSquare size={14} /> {t('feedback.adminResponse', 'Admin Response')}
          </h3>
          {selectedItem.admin_response ? (
            <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-3">
              <p className="text-sm text-green-300 whitespace-pre-wrap">
                {selectedItem.admin_response}
              </p>
              {selectedItem.responded_at && (
                <p className="text-xs text-green-500/60 mt-2">
                  {formatDate(selectedItem.responded_at)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              {t('feedback.noResponse', 'No response yet')}
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder={t('feedback.responsePlaceholder', 'Type your response...')}
              className="flex-1 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              rows={2}
            />
            <button
              onClick={() => sendResponse(selectedItem.id)}
              disabled={!responseText.trim() || isSending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors self-end"
            >
              <Send size={14} /> {t('feedback.send', 'Send')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <MessageSquareWarning className="text-amber-500" size={32} />
              {t('feedback.title', 'User Feedback & Triage')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {t('feedback.subtitle', 'Manage incoming reports, ideas, and feature requests.')}
            </p>
          </div>
          <div className="pt-0.5">
            <InfoButton cardId="superadmin-feedback" position="header-inline" size="md" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-auto min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder={t('feedback.search', 'Search...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">{t('feedback.allStatuses', 'All Statuses')}</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">{t('feedback.allTypes', 'All Types')}</option>
            <option value="BUG">Bug</option>
            <option value="IDEA">Idea</option>
            <option value="FEATURE">Feature</option>
            <option value="PULSE">Pulse</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="ALL">{t('feedback.allSeverities', 'All Severities')}</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_ORDER.map((s) => {
          const count = feedback.filter((f) => f.status === s).length;
          const conf = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
              className={`rounded-lg p-3 text-center border transition-colors ${
                statusFilter === s
                  ? `${conf.bg} ${conf.border}`
                  : 'bg-white dark:bg-navy-800/50 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`text-lg font-bold ${conf.color}`}>{count}</div>
              <div className="text-xs text-slate-600 dark:text-slate-500">{s}</div>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin text-blue-500">Loading...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-navy-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-slate-500">
                {t('feedback.noResults', 'No feedback found matching your criteria.')}
              </p>
            </div>
          ) : (
            filteredFeedback.map((item) => {
              const sConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.NEW;
              return (
                <div
                  key={item.id}
                  onClick={() => loadDetail(item)}
                  className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border ${
                            item.type === 'BUG'
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-900'
                              : item.type === 'FEATURE'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-400 dark:border-purple-900'
                                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-900'
                          }`}
                        >
                          {item.type === 'BUG' ? <Bug size={12} /> : <Lightbulb size={12} />}{' '}
                          {item.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${sConf.color} ${sConf.bg} border ${sConf.border}`}
                        >
                          {item.status}
                        </span>
                        {item.source_env && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 dark:bg-navy-900/40 dark:text-slate-300 dark:border-slate-700">
                            {item.source_env}
                          </span>
                        )}
                        {item.severity && item.severity !== 'LOW' && (
                          <span
                            className={`text-xs font-bold ${SEVERITY_CONFIG[item.severity]?.color || 'text-slate-400'} flex items-center gap-1`}
                          >
                            {SEVERITY_CONFIG[item.severity]?.icon} {item.severity}
                          </span>
                        )}
                        <span className="text-slate-500 text-xs flex items-center gap-1">
                          <Clock size={12} /> {formatDate(item.created_at)}
                        </span>
                      </div>
                      {item.title ? (
                        <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {item.title}
                        </p>
                      ) : null}
                      <p className="text-slate-900 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed line-clamp-2">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <User size={12} /> {item.user_email || 'Anonymous'}
                        </span>
                        {item.route_path && (
                          <span className="flex items-center gap-1">
                            <Globe size={12} /> {item.route_path}
                          </span>
                        )}
                        {item.admin_response && (
                          <span className="flex items-center gap-1 text-green-500">
                            <MessageSquare size={12} /> Responded
                          </span>
                        )}
                        {item.linked_task_id && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={12} /> Task {item.linked_task_id}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 mt-2 shrink-0" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
