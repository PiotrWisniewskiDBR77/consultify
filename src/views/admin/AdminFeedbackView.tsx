/**
 * AdminFeedbackView - Comprehensive feedback management for admins
 *
 * Features:
 * - View all user feedback
 * - Filter by type, status, date
 * - Respond to feedback
 * - Mark as resolved
 * - Analytics dashboard
 */

import {
  AlertCircle,
  Archive,
  Bug,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  Filter,
  Flag,
  Lightbulb,
  MessageSquare,
  MoreVertical,
  Reply,
  Search,
  Send,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDemoSession } from '@/hooks/useDemoSession';

interface FeedbackItem {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: 'bug' | 'feature' | 'improvement' | 'praise' | 'other';
  category?: string;
  rating?: number;
  message: string;
  status: 'new' | 'pending' | 'in_progress' | 'reviewed' | 'resolved' | 'archived';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  adminNotes?: string;
  adminResponse?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: {
    browser?: string;
    page?: string;
    screenshot?: string;
  };
}

interface AdminFeedbackViewProps {
  className?: string;
}

export const AdminFeedbackView: React.FC<AdminFeedbackViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { isDemo } = useDemoSession();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/feedback', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Map API response to our interface
        const mapped = Array.isArray(data)
          ? data.map((item: any) => ({
              id: item.id,
              userId: item.user_id || item.userId,
              userEmail: item.user_email || item.userEmail,
              userName: item.user_name || item.userName,
              type: item.type || 'other',
              category: item.category,
              rating: item.rating,
              message: item.message,
              status: (item.status || 'new').toLowerCase().replace(' ', '_'),
              priority: item.priority,
              adminNotes: item.admin_notes || item.adminNotes,
              adminResponse: item.admin_response || item.adminResponse,
              respondedAt: item.responded_at || item.respondedAt,
              createdAt: item.created_at || item.createdAt,
              updatedAt: item.updated_at || item.updatedAt,
              metadata: item.metadata,
            }))
          : [];
        setFeedback(mapped);
      } else {
        throw new Error('Failed to fetch feedback');
      }
    } catch (error) {
      console.error('Feedback fetch error:', error);
      if (isDemo) {
        setFeedback([
          {
            id: 'demo-1',
            userId: 'u1',
            userEmail: 'jan.kowalski@firma.pl',
            userName: 'Jan Kowalski',
            type: 'bug',
            message:
              'Strona logowania nie ładuje się poprawnie na urządzeniach mobilnych. Problem występuje głównie na iPhone 14 Pro.',
            status: 'new',
            priority: 'high',
            createdAt: new Date().toISOString(),
            metadata: { browser: 'Safari Mobile 16.0', page: '/login' },
          },
          {
            id: 'demo-2',
            userId: 'u2',
            userEmail: 'anna.nowak@example.com',
            userName: 'Anna Nowak',
            type: 'feature',
            rating: 4,
            message:
              'Byłoby świetnie mieć tryb ciemny dla całego dashboardu. Pracuję często w nocy i jasne kolory męczą oczy.',
            status: 'in_progress',
            priority: 'medium',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            adminNotes: 'Dark mode już w rozwoju - planowany release Q2',
          },
          {
            id: 'demo-3',
            userId: 'u3',
            userEmail: 'piotr.wisniewski@corp.pl',
            userName: 'Piotr Wiśniewski',
            type: 'praise',
            rating: 5,
            message:
              'Świetny produkt! Moduł AI znacząco poprawił naszą produktywność. Szczególnie doceniam szybkość generowania raportów.',
            status: 'reviewed',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            adminResponse: 'Dziękujemy za miłe słowa! Cieszymy się, że platforma jest pomocna.',
            respondedAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 'demo-4',
            userId: 'u4',
            userEmail: 'maria.zielinska@startup.io',
            userName: 'Maria Zielińska',
            type: 'improvement',
            rating: 3,
            message:
              'Skróty klawiszowe byłyby bardzo przydatne dla power userów. Szczególnie dla nawigacji między modułami.',
            status: 'pending',
            priority: 'low',
            createdAt: new Date(Date.now() - 259200000).toISOString(),
          },
          {
            id: 'demo-5',
            userId: 'u5',
            userEmail: 'tomasz.kaczmarek@enterprise.com',
            userName: 'Tomasz Kaczmarek',
            type: 'bug',
            message:
              'Export do PDF nie działa dla raportów powyżej 100 stron. System zawiesza się.',
            status: 'resolved',
            priority: 'critical',
            createdAt: new Date(Date.now() - 604800000).toISOString(),
            adminResponse: 'Naprawione w wersji 2.3.1. Prosimy o aktualizację.',
            respondedAt: new Date(Date.now() - 432000000).toISOString(),
          },
        ]);
      } else {
        setFeedback([]);
        toast.error(t('admin.feedback.loadError', 'Nie udało się załadować feedbacku'));
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (feedbackId: string, status: string) => {
    try {
      await fetch(`/api/feedback/${feedbackId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status: status.toUpperCase() }),
      });
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === feedbackId ? { ...f, status: status as FeedbackItem['status'] } : f
        )
      );
      toast.success(t('admin.feedback.statusUpdated', 'Status zaktualizowany'));
    } catch (_error) {
      toast.error(t('admin.feedback.statusError', 'Błąd aktualizacji statusu'));
    }
  };

  const sendResponse = async () => {
    if (!selectedFeedback || !responseText.trim()) return;

    setSendingResponse(true);
    try {
      await fetch(`/api/feedback/${selectedFeedback.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ response: responseText }),
      });

      setFeedback((prev) =>
        prev.map((f) =>
          f.id === selectedFeedback.id
            ? {
                ...f,
                adminResponse: responseText,
                respondedAt: new Date().toISOString(),
                status: 'reviewed' as const,
              }
            : f
        )
      );

      setSelectedFeedback((prev) =>
        prev
          ? {
              ...prev,
              adminResponse: responseText,
              respondedAt: new Date().toISOString(),
              status: 'reviewed',
            }
          : null
      );

      setResponseText('');
      toast.success(t('admin.feedback.responseSent', 'Odpowiedź wysłana'));
    } catch (_error) {
      toast.error(t('admin.feedback.responseError', 'Błąd wysyłania odpowiedzi'));
    } finally {
      setSendingResponse(false);
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'bug':
        return {
          icon: <Bug size={16} />,
          color: 'text-danger-500 dark:text-danger-400',
          bgColor: 'bg-danger-100 dark:bg-danger-900/30',
          label: t('admin.feedback.types.bug', 'Błąd'),
        };
      case 'feature':
        return {
          icon: <Lightbulb size={16} />,
          color: 'text-blue-500 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          label: t('admin.feedback.types.feature', 'Funkcja'),
        };
      case 'improvement':
        return {
          icon: <Sparkles size={16} />,
          color: 'text-amber-500 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          label: t('admin.feedback.types.improvement', 'Ulepszenie'),
        };
      case 'praise':
        return {
          icon: <ThumbsUp size={16} />,
          color: 'text-green-500 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          label: t('admin.feedback.types.praise', 'Pochwała'),
        };
      default:
        return {
          icon: <MessageSquare size={16} />,
          color: 'text-c-text-muted',
          bgColor: 'bg-c-surface-raised',
          label: t('admin.feedback.types.other', 'Inne'),
        };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'new':
        return {
          color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
          icon: <Star size={12} />,
          label: t('admin.feedback.statuses.new', 'Nowy'),
        };
      case 'pending':
        return {
          color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
          icon: <Clock size={12} />,
          label: t('admin.feedback.statuses.pending', 'Oczekujący'),
        };
      case 'in_progress':
        return {
          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
          icon: <TrendingUp size={12} />,
          label: t('admin.feedback.statuses.inProgress', 'W realizacji'),
        };
      case 'reviewed':
        return {
          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
          icon: <Eye size={12} />,
          label: t('admin.feedback.statuses.reviewed', 'Przejrzany'),
        };
      case 'resolved':
        return {
          color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
          icon: <CheckCircle size={12} />,
          label: t('admin.feedback.statuses.resolved', 'Rozwiązany'),
        };
      case 'archived':
        return {
          color: 'bg-c-surface-raised text-c-text-secondary',
          icon: <Archive size={12} />,
          label: t('admin.feedback.statuses.archived', 'Zarchiwizowany'),
        };
      default:
        return {
          color: 'bg-c-surface-raised text-c-text-secondary',
          icon: null,
          label: status,
        };
    }
  };

  const getPriorityConfig = (priority?: string) => {
    switch (priority) {
      case 'critical':
        return { color: 'text-danger-600 dark:text-danger-400', label: 'Krytyczny' };
      case 'high':
        return { color: 'text-amber-600 dark:text-amber-400', label: 'Wysoki' };
      case 'medium':
        return { color: 'text-yellow-600 dark:text-yellow-400', label: 'Średni' };
      case 'low':
        return { color: 'text-green-600 dark:text-green-400', label: 'Niski' };
      default:
        return null;
    }
  };

  const filteredFeedback = feedback.filter((f) => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        f.message.toLowerCase().includes(query) ||
        f.userEmail.toLowerCase().includes(query) ||
        f.userName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    total: feedback.length,
    new: feedback.filter((f) => f.status === 'new').length,
    pending: feedback.filter((f) => f.status === 'pending' || f.status === 'in_progress').length,
    bugs: feedback.filter((f) => f.type === 'bug' && f.status !== 'resolved').length,
    avgRating:
      feedback.filter((f) => f.rating).reduce((acc, f) => acc + (f.rating || 0), 0) /
      (feedback.filter((f) => f.rating).length || 1),
  };

  const openDetailModal = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setShowDetailModal(true);
    setResponseText('');
    // Mark as read if new
    if (item.status === 'new') {
      updateStatus(item.id, 'pending');
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-c-surface rounded-xl border border-c-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-c-surface-raised rounded-lg">
              <MessageSquare size={18} className="text-c-text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-c-text">{stats.total}</p>
              <p className="text-xs text-c-text-muted">
                {t('admin.feedback.stats.total', 'Wszystkich')}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-c-surface rounded-xl border border-c-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Star size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary-600">{stats.new}</p>
              <p className="text-xs text-c-text-muted">{t('admin.feedback.stats.new', 'Nowych')}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-c-surface rounded-xl border border-c-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-c-text-muted">
                {t('admin.feedback.stats.pending', 'W toku')}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-c-surface rounded-xl border border-c-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
              <Bug size={18} className="text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-danger-600">{stats.bugs}</p>
              <p className="text-xs text-c-text-muted">
                {t('admin.feedback.stats.openBugs', 'Otwarte błędy')}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-c-surface rounded-xl border border-c-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Star size={18} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.avgRating.toFixed(1)}</p>
              <p className="text-xs text-c-text-muted">
                {t('admin.feedback.stats.avgRating', 'Śr. ocena')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-c-surface rounded-xl border border-c-border-subtle">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.feedback.searchPlaceholder', 'Szukaj w feedbacku...')}
              className="w-full pl-10 pr-4 py-2 border border-c-border-subtle rounded-lg bg-c-surface text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-c-text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface text-sm"
          >
            <option value="all">
              {t('admin.feedback.filters.allStatuses', 'Wszystkie statusy')}
            </option>
            <option value="new">{t('admin.feedback.filters.new', 'Nowe')}</option>
            <option value="pending">{t('admin.feedback.filters.pending', 'Oczekujące')}</option>
            <option value="in_progress">
              {t('admin.feedback.filters.inProgress', 'W realizacji')}
            </option>
            <option value="reviewed">{t('admin.feedback.filters.reviewed', 'Przejrzane')}</option>
            <option value="resolved">{t('admin.feedback.filters.resolved', 'Rozwiązane')}</option>
            <option value="archived">
              {t('admin.feedback.filters.archived', 'Zarchiwizowane')}
            </option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-c-border-subtle rounded-lg bg-c-surface text-sm"
          >
            <option value="all">{t('admin.feedback.filters.allTypes', 'Wszystkie typy')}</option>
            <option value="bug">{t('admin.feedback.filters.bugs', 'Błędy')}</option>
            <option value="feature">{t('admin.feedback.filters.features', 'Funkcje')}</option>
            <option value="improvement">
              {t('admin.feedback.filters.improvements', 'Ulepszenia')}
            </option>
            <option value="praise">{t('admin.feedback.filters.praise', 'Pochwały')}</option>
            <option value="other">{t('admin.feedback.filters.other', 'Inne')}</option>
          </select>
        </div>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-c-text-muted">{t('common.loading', 'Ładowanie...')}</p>
        </div>
      ) : filteredFeedback.length === 0 ? (
        <div className="p-12 text-center bg-c-surface rounded-xl border border-c-border-subtle">
          <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-c-text">
            {t('admin.feedback.noFeedback', 'Brak feedbacku')}
          </h3>
          <p className="text-c-text-muted mt-1">
            {t('admin.feedback.noFeedbackDesc', 'Nie znaleziono feedbacku spełniającego kryteria')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFeedback.map((item) => {
            const typeConfig = getTypeConfig(item.type);
            const statusConfig = getStatusConfig(item.status);
            const priorityConfig = getPriorityConfig(item.priority);

            return (
              <div
                key={item.id}
                onClick={() => openDetailModal(item)}
                className="p-4 bg-c-surface rounded-xl border border-c-border-subtle hover:border-brand/50 dark:hover:border-brand/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  {/* Type Icon */}
                  <div className={`p-2.5 rounded-lg ${typeConfig.bgColor} shrink-0`}>
                    <span className={typeConfig.color}>{typeConfig.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-c-text">
                        {item.userName || item.userEmail}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${statusConfig.color}`}
                      >
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${typeConfig.bgColor} ${typeConfig.color}`}
                      >
                        {typeConfig.label}
                      </span>
                      {priorityConfig && (
                        <span className={`text-xs font-medium ${priorityConfig.color}`}>
                          ● {priorityConfig.label}
                        </span>
                      )}
                    </div>

                    <p className="text-c-text-secondary line-clamp-2 text-sm">{item.message}</p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-c-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(item.createdAt).toLocaleDateString('pl-PL')}
                      </span>
                      {item.rating && (
                        <span className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={12}
                              className={
                                star <= item.rating!
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300'
                              }
                            />
                          ))}
                        </span>
                      )}
                      {item.adminResponse && (
                        <span className="flex items-center gap-1 text-green-500">
                          <Reply size={12} />
                          {t('admin.feedback.responded', 'Odpowiedziano')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetailModal(item);
                      }}
                      className="p-2 hover:bg-c-surface-raised rounded-lg"
                      title={t('admin.feedback.view', 'Zobacz szczegóły')}
                    >
                      <Eye size={18} className="text-c-text-muted" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-c-surface rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-c-border-subtle">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${getTypeConfig(selectedFeedback.type).bgColor}`}>
                    <span className={getTypeConfig(selectedFeedback.type).color}>
                      {getTypeConfig(selectedFeedback.type).icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-c-text">
                      {getTypeConfig(selectedFeedback.type).label}
                    </h3>
                    <p className="text-sm text-c-text-muted">
                      {selectedFeedback.userName || selectedFeedback.userEmail}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-c-surface-raised rounded-lg"
                >
                  <X size={20} className="text-c-text-muted" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status & Priority */}
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="text-xs text-c-text-muted mb-1 block">
                    {t('admin.feedback.status', 'Status')}
                  </label>
                  <select
                    value={selectedFeedback.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as FeedbackItem['status'];
                      updateStatus(selectedFeedback.id, newStatus);
                      setSelectedFeedback((prev) => (prev ? { ...prev, status: newStatus } : null));
                    }}
                    className="px-3 py-1.5 border border-c-border-subtle rounded-lg bg-c-surface text-sm"
                  >
                    <option value="new">Nowy</option>
                    <option value="pending">Oczekujący</option>
                    <option value="in_progress">W realizacji</option>
                    <option value="reviewed">Przejrzany</option>
                    <option value="resolved">Rozwiązany</option>
                    <option value="archived">Zarchiwizowany</option>
                  </select>
                </div>
                {selectedFeedback.rating && (
                  <div>
                    <label className="text-xs text-c-text-muted mb-1 block">
                      {t('admin.feedback.rating', 'Ocena')}
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={20}
                          className={
                            star <= selectedFeedback.rating!
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300'
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-c-text-muted mb-1 block">
                    {t('admin.feedback.date', 'Data')}
                  </label>
                  <p className="text-sm text-c-text">
                    {new Date(selectedFeedback.createdAt).toLocaleString('pl-PL')}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs text-c-text-muted mb-2 block">
                  {t('admin.feedback.message', 'Wiadomość')}
                </label>
                <div className="p-4 bg-c-surface-raised rounded-xl">
                  <p className="text-c-text-secondary whitespace-pre-wrap">
                    {selectedFeedback.message}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              {selectedFeedback.metadata && (
                <div>
                  <label className="text-xs text-c-text-muted mb-2 block">
                    {t('admin.feedback.context', 'Kontekst')}
                  </label>
                  <div className="flex gap-4 text-sm text-c-text-secondary">
                    {selectedFeedback.metadata.browser && (
                      <span>🌐 {selectedFeedback.metadata.browser}</span>
                    )}
                    {selectedFeedback.metadata.page && (
                      <span>📄 {selectedFeedback.metadata.page}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Previous Response */}
              {selectedFeedback.adminResponse && (
                <div>
                  <label className="text-xs text-c-text-muted mb-2 block flex items-center gap-2">
                    <Reply size={14} />
                    {t('admin.feedback.yourResponse', 'Twoja odpowiedź')}
                    <span className="text-c-text-muted">
                      ({new Date(selectedFeedback.respondedAt!).toLocaleDateString('pl-PL')})
                    </span>
                  </label>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <p className="text-green-800 dark:text-green-200 whitespace-pre-wrap">
                      {selectedFeedback.adminResponse}
                    </p>
                  </div>
                </div>
              )}

              {/* Response Input */}
              <div>
                <label className="text-xs text-c-text-muted mb-2 block">
                  {selectedFeedback.adminResponse
                    ? t('admin.feedback.updateResponse', 'Zaktualizuj odpowiedź')
                    : t('admin.feedback.writeResponse', 'Napisz odpowiedź')}
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder={t(
                    'admin.feedback.responsePlaceholder',
                    'Wpisz odpowiedź dla użytkownika...'
                  )}
                  rows={4}
                  className="w-full px-4 py-3 border border-c-border-subtle rounded-xl bg-c-surface resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-c-border-subtle flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus(selectedFeedback.id, 'archived')}
                  className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg flex items-center gap-2"
                >
                  <Archive size={16} />
                  {t('admin.feedback.archive', 'Archiwizuj')}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
                >
                  {t('common.close', 'Zamknij')}
                </button>
                <button
                  onClick={sendResponse}
                  disabled={!responseText.trim() || sendingResponse}
                  className="px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={16} />
                  {sendingResponse
                    ? t('common.sending', 'Wysyłanie...')
                    : t('admin.feedback.sendResponse', 'Wyślij odpowiedź')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeedbackView;
