import { AlertCircle, MessageSquare, PhoneIncoming, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';
import { Notification } from '../../types';
import { SignalNode } from './SignalNode';

interface SignalGroup {
  system: Notification[];
  client: Notification[];
  feedback: Notification[];
}

export const SuperAdminSignalCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<SignalGroup>({
    system: [],
    client: [],
    feedback: [],
  });
  const [selectedType, setSelectedType] = useState<'system' | 'client' | 'feedback' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedType(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const allSignals = await Api.getSuperAdminSignals();

      // Group by type
      const system = allSignals.filter((n: any) => n.type === 'SYSTEM_ALERT');
      const client = allSignals.filter((n: any) => n.type === 'CLIENT_TICKET');
      const feedback = allSignals.filter((n: any) => n.type === 'USER_FEEDBACK');

      setNotifications({ system, client, feedback });
      setError(false);
    } catch (err) {
      // Surface failure so the popover can show a Retry instead of an
      // indistinguishable "no signals" empty state (which read as "all clear").
      console.error('Failed to fetch signals', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (id: string, type: keyof SignalGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await Api.markNotificationRead(id);
      // Optimistic update
      setNotifications((prev) => ({
        ...prev,
        [type]: prev[type].filter((n) => n.id !== id),
      }));
    } catch (err) {
      console.error('Failed to dismiss', err);
      toast.error(t('superAdmin.signalCenter.dismissFailed'));
    }
  };

  /**
   * Resolve the deep-link for a signal. Prefers the server-provided
   * `actionUrl` (kept in sync on the backend), with explicit fallbacks
   * per signal type so older notifications without an action_url still
   * route somewhere useful.
   */
  const resolveTarget = (item: any, type: keyof SignalGroup): string | null => {
    const explicit =
      (item && (item.actionUrl || item.action_url)) ||
      (item && item.data && (item.data.actionUrl || item.data.action_url)) ||
      null;
    if (typeof explicit === 'string' && explicit.length > 0) return explicit;

    const feedbackId =
      item?.relatedObjectId ||
      item?.related_object_id ||
      item?.data?.feedbackId ||
      item?.data?.feedback_id ||
      null;

    if (type === 'feedback' || type === 'client') {
      return feedbackId
        ? `/superadmin/customers/feedback?feedbackId=${encodeURIComponent(feedbackId)}`
        : '/superadmin/customers/feedback';
    }
    if (type === 'system') return '/superadmin/system';
    return null;
  };

  const handleOpen = async (item: any, type: keyof SignalGroup) => {
    const target = resolveTarget(item, type);
    // Close popover regardless so the UI doesn't linger over the destination.
    setSelectedType(null);
    // Mark as read in the background — do NOT block navigation on it and
    // do NOT remove from the list until the request resolves so the user
    // can still see the signal they clicked if nav fails.
    Api.markNotificationRead(item.id)
      .then(() => {
        setNotifications((prev) => ({
          ...prev,
          [type]: prev[type].filter((n) => n.id !== item.id),
        }));
      })
      .catch((error) => console.error('Failed to mark notification read', error));
    if (target) {
      navigate(target);
    }
  };

  const getTypeLabel = (type: 'system' | 'client' | 'feedback') => {
    switch (type) {
      case 'system':
        return 'System Alerts';
      case 'client':
        return 'Client Requests';
      case 'feedback':
        return 'User Feedback';
    }
  };

  const getTypeColor = (type: 'system' | 'client' | 'feedback') => {
    switch (type) {
      case 'system':
        return 'text-danger-500';
      case 'client':
        return 'text-amber-500 dark:text-amber-400';
      case 'feedback':
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div
      className="relative flex items-center gap-2 mr-4 bg-white dark:bg-navy-900/50 p-1.5 rounded-xl border border-slate-200 dark:border-navy-700 backdrop-blur-sm shadow-sm dark:shadow-none"
      ref={containerRef}
    >
      {/* SYSTEM - HIGH PRIORITY */}
      <SignalNode
        type="system"
        icon={AlertCircle}
        label="System Alerts"
        count={notifications.system.length}
        colorClass="text-danger-500"
        active={selectedType === 'system'}
        onClick={() => setSelectedType(selectedType === 'system' ? null : 'system')}
      />

      <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

      {/* CLIENT - MEDIUM PRIORITY */}
      <SignalNode
        type="client"
        icon={PhoneIncoming}
        label="Client Tickets"
        count={notifications.client.length}
        colorClass="text-amber-500 dark:text-amber-400"
        active={selectedType === 'client'}
        onClick={() => setSelectedType(selectedType === 'client' ? null : 'client')}
      />

      <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

      {/* FEEDBACK - LOW PRIORITY */}
      <SignalNode
        type="feedback"
        icon={MessageSquare}
        label="Feedback"
        count={notifications.feedback.length}
        colorClass="text-blue-600 dark:text-blue-400"
        active={selectedType === 'feedback'}
        onClick={() => setSelectedType(selectedType === 'feedback' ? null : 'feedback')}
      />

      {/* POPOVER LIST */}
      {selectedType && (
        <div className="absolute top-full right-0 mt-3 w-80 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 flex items-center justify-between">
            <h3 className={`font-semibold text-sm ${getTypeColor(selectedType)}`}>
              {getTypeLabel(selectedType)}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {notifications[selectedType].length} Active
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                {t('superAdmin.signalCenter.loading')}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-xs">
                <p className="text-danger-500 mb-2">{t('superAdmin.signalCenter.loadFailed')}</p>
                <button
                  onClick={() => fetchSignals()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  {t('common.retry')}
                </button>
              </div>
            ) : notifications[selectedType].length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                {t('superAdmin.signalCenter.empty')}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-white/5">
                {notifications[selectedType].map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpen(item, selectedType)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpen(item, selectedType);
                      }
                    }}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group relative focus:outline-none focus:bg-slate-100 dark:focus:bg-white/10 cursor-pointer"
                    title="Open in module"
                  >
                    <div className="pr-6">
                      <p className="text-xs text-slate-800 dark:text-white font-medium mb-1">
                        {item.title || 'Untitled Signal'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.message || 'No details provided.'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(item.id, selectedType, e)}
                      className="absolute top-2 right-2 p-1 text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
                      aria-label="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
