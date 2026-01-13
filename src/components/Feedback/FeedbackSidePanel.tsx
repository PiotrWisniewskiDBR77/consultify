// @ts-nocheck
/**
 * FeedbackSidePanel - Enterprise SaaS Feedback System
 *
 * Features:
 * - Bug/Idea reporting with severity levels
 * - Quick Pulse feedback (rapid NPS-style rating)
 * - Feature feedback with AI-driven categorization
 * - Smart suggestions based on context
 * - Analytics integration
 */

import {
  AlertTriangle,
  BarChart3,
  Bot,
  Bug,
  CheckCircle2,
  ChevronRight,
  Frown,
  Lightbulb,
  Loader2,
  Meh,
  MessageSquareWarning,
  Send,
  Smile,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

// ==================== TYPES ====================

type FeedbackTab = 'report' | 'pulse' | 'feature';
type ReportType = 'BUG' | 'IDEA';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type PulseRating = 1 | 2 | 3 | 4 | 5;
type FeatureCategory = 'usability' | 'performance' | 'missing' | 'improvement' | 'other';

interface QuickPulseData {
  rating: PulseRating;
  context: string; // current page/module
  comment?: string;
}

interface FeatureFeedbackData {
  category: FeatureCategory;
  featureName: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  useCase?: string;
}

interface AIInsight {
  type: 'suggestion' | 'similar' | 'trending';
  title: string;
  description: string;
  relevance: number;
}

// ==================== COMPONENT ====================

export const FeedbackSidePanel: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, activeSidePanel, closeSidePanel } = useAppStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<FeedbackTab>('report');

  // Report tab state
  const [reportType, setReportType] = useState<ReportType>('BUG');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');

  // Quick Pulse state
  const [pulseRating, setPulseRating] = useState<PulseRating | null>(null);
  const [pulseComment, setPulseComment] = useState('');
  const [showPulseComment, setShowPulseComment] = useState(false);

  // Feature Feedback state
  const [featureCategory, setFeatureCategory] = useState<FeatureCategory>('improvement');
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureImpact, setFeatureImpact] = useState<'low' | 'medium' | 'high'>('medium');

  // AI Insights
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Common state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const isOpen = activeSidePanel === 'FEEDBACK';

  // Get current context (page/module)
  const currentContext = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Fetch AI insights when panel opens
  useEffect(() => {
    if (isOpen && activeTab === 'feature') {
      fetchAIInsights();
    }
  }, [isOpen, activeTab]);

  const fetchAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const response = await fetch('/api/feedback/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          context: currentContext,
          userId: currentUser?.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.insights || []);
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Reset form after success
  const resetForm = useCallback(() => {
    setMessage('');
    setSeverity('MEDIUM');
    setPulseRating(null);
    setPulseComment('');
    setShowPulseComment(false);
    setFeatureName('');
    setFeatureDescription('');
    setFeatureImpact('medium');
  }, []);

  // Handle success state
  const handleSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      resetForm();
    }, 2500);
  };

  // ==================== SUBMIT HANDLERS ====================

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: currentUser?.id || 'anonymous',
          userEmail: currentUser?.email || 'anonymous',
          userName: currentUser?.full_name || currentUser?.firstName,
          type: reportType,
          message,
          severity,
          metadata: {
            context: currentContext,
            browser: navigator.userAgent,
            timestamp: new Date().toISOString(),
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
          },
        }),
      });

      if (response.ok) {
        handleSuccess(
          reportType === 'BUG'
            ? t('feedback.success.bugReported', "Bug reported! We'll investigate ASAP.")
            : t('feedback.success.ideaSubmitted', 'Great idea! Added to our backlog.')
        );
      } else {
        throw new Error('Failed to submit');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(t('feedback.error.submit', 'Failed to submit feedback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePulseSubmit = async (rating: PulseRating) => {
    setPulseRating(rating);

    // If low rating, ask for comment
    if (rating <= 2) {
      setShowPulseComment(true);
      return;
    }

    await submitPulse(rating);
  };

  const submitPulse = async (rating: PulseRating, comment?: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback/pulse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: currentUser?.id,
          rating,
          context: currentContext,
          comment: comment || pulseComment,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        handleSuccess(t('feedback.success.pulse', 'Thanks for your feedback! 🎉'));
      }
    } catch (error) {
      console.error('Error submitting pulse:', error);
      toast.error(t('feedback.error.submit', 'Failed to submit feedback'));
    } finally {
      setIsSubmitting(false);
      setShowPulseComment(false);
    }
  };

  const handleFeatureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featureName.trim() || !featureDescription.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback/feature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userId: currentUser?.id,
          userEmail: currentUser?.email,
          category: featureCategory,
          featureName,
          description: featureDescription,
          impact: featureImpact,
          context: currentContext,
          requestAIAnalysis: true, // Let AI analyze this
        }),
      });

      if (response.ok) {
        const data = await response.json();
        handleSuccess(
          data.aiSuggestion
            ? t(
                'feedback.success.featureWithAI',
                'Feature request submitted! AI found similar requests.'
              )
            : t('feedback.success.feature', 'Feature request submitted!')
        );
      }
    } catch (error) {
      console.error('Error submitting feature:', error);
      toast.error(t('feedback.error.submit', 'Failed to submit feedback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== RENDER HELPERS ====================

  const renderTabs = () => (
    <div className="flex border-b border-slate-200 dark:border-navy-700 px-2">
      {[
        { id: 'report', icon: Bug, label: t('feedback.tabs.report', 'Report') },
        { id: 'pulse', icon: Zap, label: t('feedback.tabs.pulse', 'Quick') },
        { id: 'feature', icon: Sparkles, label: t('feedback.tabs.feature', 'Feature') },
      ].map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id as FeedbackTab)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
            activeTab === id
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );

  const renderReportTab = () => (
    <form onSubmit={handleReportSubmit} className="flex flex-col gap-4 h-full">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('feedback.report.intro', 'Help us improve by reporting issues or sharing ideas.')}
      </p>

      {/* Type Selector */}
      <div className="flex bg-slate-100 dark:bg-navy-900 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setReportType('BUG')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
            reportType === 'BUG'
              ? 'bg-white dark:bg-navy-800 text-red-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Bug size={16} />
          {t('feedback.type.bug', 'Bug')}
        </button>
        <button
          type="button"
          onClick={() => setReportType('IDEA')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
            reportType === 'IDEA'
              ? 'bg-white dark:bg-navy-800 text-amber-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Lightbulb size={16} />
          {t('feedback.type.idea', 'Idea')}
        </button>
      </div>

      {/* Severity (for bugs) */}
      {reportType === 'BUG' && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            {t('feedback.severity.label', 'Severity')}
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[
              {
                value: 'LOW',
                label: 'Low',
                color: 'text-green-500 bg-green-50 dark:bg-green-900/20',
              },
              {
                value: 'MEDIUM',
                label: 'Medium',
                color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
              },
              {
                value: 'HIGH',
                label: 'High',
                color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
              },
              {
                value: 'CRITICAL',
                label: 'Critical',
                color: 'text-red-500 bg-red-50 dark:bg-red-900/20',
              },
            ].map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverity(value as Severity)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all border ${
                  severity === value
                    ? `${color} border-current`
                    : 'border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="flex-1 flex flex-col">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t(reportType === 'BUG' ? 'feedback.label.bug' : 'feedback.label.idea', 'Description')}
        </label>
        <textarea
          className="flex-1 w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 min-h-[120px]"
          placeholder={
            reportType === 'BUG'
              ? t('feedback.placeholder.bug', 'Describe what happened and steps to reproduce...')
              : t('feedback.placeholder.idea', 'Share your idea for improvement...')
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !message.trim()}
        className={`w-full py-2.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm ${
          severity === 'CRITICAL' && reportType === 'BUG'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {t('feedback.submitting', 'Submitting...')}
          </>
        ) : (
          <>
            <Send size={16} />
            {t('feedback.submit', 'Submit')}
          </>
        )}
      </button>
    </form>
  );

  const renderPulseTab = () => (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-4">
      {!showPulseComment ? (
        <>
          <div className="text-center">
            <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              {t('feedback.pulse.title', "How's your experience?")}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('feedback.pulse.subtitle', 'Quick feedback helps us improve')}
            </p>
          </div>

          {/* Emoji Rating */}
          <div className="flex items-center gap-3">
            {[
              {
                rating: 1,
                icon: Frown,
                label: 'Terrible',
                color: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
              },
              {
                rating: 2,
                icon: ThumbsDown,
                label: 'Poor',
                color: 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20',
              },
              {
                rating: 3,
                icon: Meh,
                label: 'Okay',
                color: 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
              },
              {
                rating: 4,
                icon: Smile,
                label: 'Good',
                color: 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20',
              },
              {
                rating: 5,
                icon: ThumbsUp,
                label: 'Excellent',
                color: 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
              },
            ].map(({ rating, icon: Icon, label, color }) => (
              <button
                key={rating}
                onClick={() => handlePulseSubmit(rating as PulseRating)}
                disabled={isSubmitting}
                className={`p-3 rounded-xl transition-all ${color} ${
                  pulseRating === rating ? 'ring-2 ring-current bg-current/10' : ''
                } disabled:opacity-50`}
                title={label}
              >
                <Icon size={28} />
              </button>
            ))}
          </div>

          {/* Context Info */}
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <BarChart3 size={12} />
            <span>
              {t('feedback.pulse.context', 'Feedback for:')} {currentContext}
            </span>
          </div>
        </>
      ) : (
        /* Comment for low rating */
        <div className="w-full space-y-4">
          <div className="text-center">
            <Frown size={40} className="mx-auto text-orange-500 mb-2" />
            <h4 className="text-base font-bold text-slate-800 dark:text-white">
              {t('feedback.pulse.sorry', 'Sorry to hear that!')}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('feedback.pulse.tellUs', 'Tell us what went wrong')}
            </p>
          </div>

          <textarea
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm min-h-[100px]"
            placeholder={t('feedback.pulse.commentPlaceholder', 'What can we improve?')}
            value={pulseComment}
            onChange={(e) => setPulseComment(e.target.value)}
            autoFocus
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowPulseComment(false);
                setPulseRating(null);
              }}
              className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={() => submitPulse(pulseRating!, pulseComment)}
              disabled={isSubmitting}
              className="flex-1 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {t('feedback.submit', 'Submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderFeatureTab = () => (
    <form onSubmit={handleFeatureSubmit} className="flex flex-col gap-4 h-full">
      {/* AI Insights Section */}
      {aiInsights.length > 0 && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={14} className="text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              {t('feedback.ai.insights', 'AI Insights')}
            </span>
          </div>
          <div className="space-y-2">
            {aiInsights.slice(0, 2).map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <TrendingUp size={12} className="text-purple-500 mt-0.5" />
                <div>
                  <span className="font-medium text-purple-800 dark:text-purple-200">
                    {insight.title}
                  </span>
                  <span className="text-purple-600 dark:text-purple-400">
                    {' '}
                    - {insight.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingInsights && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          {t('feedback.ai.loading', 'Loading AI insights...')}
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t('feedback.feature.category', 'Category')}
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: 'missing', label: 'Missing', icon: AlertTriangle },
            { value: 'improvement', label: 'Improve', icon: TrendingUp },
            { value: 'usability', label: 'UX', icon: Star },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFeatureCategory(value as FeatureCategory)}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                featureCategory === value
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                  : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-transparent'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t('feedback.feature.name', 'Feature Name')}
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
          placeholder={t('feedback.feature.namePlaceholder', 'e.g., Dark mode, Export to PDF')}
          value={featureName}
          onChange={(e) => setFeatureName(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="flex-1 flex flex-col">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t('feedback.feature.description', 'Description')}
        </label>
        <textarea
          className="flex-1 w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm min-h-[80px]"
          placeholder={t(
            'feedback.feature.descPlaceholder',
            'Describe the feature and how it would help you...'
          )}
          value={featureDescription}
          onChange={(e) => setFeatureDescription(e.target.value)}
          required
        />
      </div>

      {/* Impact */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t('feedback.feature.impact', 'Business Impact')}
        </label>
        <div className="flex gap-2">
          {[
            { value: 'low', label: 'Nice to have' },
            { value: 'medium', label: 'Important' },
            { value: 'high', label: 'Critical' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFeatureImpact(value as 'low' | 'medium' | 'high')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                featureImpact === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !featureName.trim() || !featureDescription.trim()}
        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {t('feedback.submitting', 'Submitting...')}
          </>
        ) : (
          <>
            <Sparkles size={16} />
            {t('feedback.feature.submit', 'Submit Feature Request')}
          </>
        )}
      </button>
    </form>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center h-full text-center animate-in zoom-in-95 py-8">
      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
        <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
      </div>
      <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
        {t('feedback.success.title', 'Thank You!')}
      </h4>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[250px]">{successMessage}</p>
    </div>
  );

  // ==================== MAIN RENDER ====================

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
        onClick={closeSidePanel}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-navy-700">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-navy-700 shrink-0 bg-slate-50 dark:bg-navy-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquareWarning size={18} className="text-amber-500" />
            {t('feedback.title', 'Feedback')}
          </h2>
          <button
            onClick={closeSidePanel}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {!showSuccess && renderTabs()}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {showSuccess ? (
            renderSuccess()
          ) : (
            <>
              {activeTab === 'report' && renderReportTab()}
              {activeTab === 'pulse' && renderPulseTab()}
              {activeTab === 'feature' && renderFeatureTab()}
            </>
          )}
        </div>

        {/* Footer */}
        {!showSuccess && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
            <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              {t('feedback.footer', 'Feedback sent as')} <b>{currentUser?.email || 'Anonymous'}</b>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default FeedbackSidePanel;
