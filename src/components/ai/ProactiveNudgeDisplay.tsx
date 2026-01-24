/**
 * Proactive Nudge Display Component
 *
 * Displays AI-driven proactive suggestions and nudges to users.
 * Features:
 * - Toast-style notifications
 * - Contextual suggestions based on user activity
 * - Dismissal tracking with feedback
 * - Priority-based display queue
 */

import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Lightbulb,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import api from '../../services/api';

interface Nudge {
  id: string;
  type: 'SUGGESTION' | 'REMINDER' | 'INSIGHT' | 'TIP' | 'WARNING';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  context?: {
    screen?: string;
    projectId?: string;
    initiativeId?: string;
  };
  expiresAt?: string;
  dismissible: boolean;
}

interface ProactiveNudgeDisplayProps {
  projectId?: string;
  screen?: string;
  maxVisible?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const nudgeStyles = {
  SUGGESTION: {
    icon: Lightbulb,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-900 dark:text-blue-100',
  },
  REMINDER: {
    icon: Clock,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-500',
    titleColor: 'text-yellow-900 dark:text-yellow-100',
  },
  INSIGHT: {
    icon: TrendingUp,
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    iconColor: 'text-purple-500',
    titleColor: 'text-purple-900 dark:text-purple-100',
  },
  TIP: {
    icon: Sparkles,
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500',
    titleColor: 'text-green-900 dark:text-green-100',
  },
  WARNING: {
    icon: AlertCircle,
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500',
    titleColor: 'text-red-900 dark:text-red-100',
  },
};

const positionStyles = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
};

export function ProactiveNudgeDisplay({
  projectId,
  screen,
  maxVisible = 3,
  position = 'bottom-right',
}: ProactiveNudgeDisplayProps) {
  const { t } = useTranslation();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'positive' | 'negative'>>({});

  const fetchNudges = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      if (screen) params.append('screen', screen);

      const response = await api.get(`/ai/proactive-nudges?${params.toString()}`);

      if (response.data.success) {
        const newNudges = (response.data.nudges || []).filter(
          (n: Nudge) => !dismissedIds.has(n.id)
        );
        setNudges(newNudges);
      }
    } catch (err) {
      console.error('Failed to fetch nudges:', err);
    }
  }, [projectId, screen, dismissedIds]);

  useEffect(() => {
    fetchNudges();

    // Refresh nudges every 5 minutes
    const interval = setInterval(fetchNudges, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNudges]);

  const handleDismiss = async (nudgeId: string, feedback?: 'positive' | 'negative') => {
    setDismissedIds((prev) => new Set(prev).add(nudgeId));
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));

    try {
      await api.post(`/ai/proactive-nudges/${nudgeId}/dismiss`, {
        feedback,
        dismissedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to record dismissal:', err);
    }
  };

  const handleFeedback = (nudgeId: string, feedback: 'positive' | 'negative') => {
    setFeedbackGiven((prev) => ({ ...prev, [nudgeId]: feedback }));
    // Auto-dismiss after feedback with a small delay
    setTimeout(() => handleDismiss(nudgeId, feedback), 500);
  };

  const handleAction = async (nudge: Nudge) => {
    try {
      await api.post(`/ai/proactive-nudges/${nudge.id}/action`, {
        actionTaken: true,
        actionAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to record action:', err);
    }

    // Navigate to action URL
    if (nudge.actionUrl) {
      window.location.href = nudge.actionUrl;
    }
  };

  const visibleNudges = nudges.slice(0, maxVisible);
  const hiddenCount = nudges.length - maxVisible;

  if (nudges.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${positionStyles[position]} z-50 flex flex-col gap-3 max-w-sm`}>
      {/* Collapse/Expand button when there are many nudges */}
      {nudges.length > 1 && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="self-end flex items-center gap-1 px-3 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-full text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-lg"
        >
          {collapsed ? (
            <>
              <ChevronUp size={14} />
              Show {nudges.length} suggestions
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Collapse
            </>
          )}
        </button>
      )}

      {!collapsed && (
        <>
          {visibleNudges.map((nudge, index) => {
            const style = nudgeStyles[nudge.type];
            const Icon = style.icon;
            const hasFeedback = feedbackGiven[nudge.id];

            return (
              <div
                key={nudge.id}
                className={`
                                    ${style.bgColor} ${style.borderColor}
                                    border rounded-xl shadow-lg p-4 
                                    animate-slideIn
                                    transition-all duration-300
                                `}
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${style.bgColor}`}>
                    <Icon size={18} className={style.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-medium ${style.titleColor} text-sm`}>{nudge.title}</h4>
                      {nudge.dismissible && (
                        <button
                          onClick={() => handleDismiss(nudge.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {nudge.message}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5 dark:border-navy-700">
                  {/* Feedback */}
                  <div className="flex items-center gap-1">
                    {hasFeedback ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <CheckCircle size={14} className="text-green-500" />
                        Thanks!
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleFeedback(nudge.id, 'positive')}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Helpful"
                        >
                          <ThumbsUp size={14} />
                        </button>
                        <button
                          onClick={() => handleFeedback(nudge.id, 'negative')}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Not helpful"
                        >
                          <ThumbsDown size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Action Button */}
                  {nudge.actionLabel && nudge.actionUrl && (
                    <button
                      onClick={() => handleAction(nudge)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      {nudge.actionLabel}
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Hidden count indicator */}
          {hiddenCount > 0 && (
            <div className="text-center text-xs text-slate-500 dark:text-slate-400">
              +{hiddenCount} more suggestions
            </div>
          )}
        </>
      )}

      {/* CSS for slide animation */}
      <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-slideIn {
                    animation: slideIn 0.3s ease-out forwards;
                }
            `}</style>
    </div>
  );
}

export default ProactiveNudgeDisplay;
