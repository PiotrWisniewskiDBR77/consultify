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
  MapPin,
  Meh,
  MessageSquareWarning,
  Monitor,
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
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

// ==================== CONTEXT SNAPSHOT ====================

interface CapturedContext {
  routePath: string;
  pageTitle: string;
  moduleName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screenSize: string;
  uiLanguage: string;
  uiTheme: string;
  timestamp: string;
  browser: string;
  scrollPosition: number;
}

function capturePageContext(
  translate?: (key: string, defaultValue: string) => string
): CapturedContext {
  const w = typeof window !== 'undefined' ? window : null;
  const pathname = w?.location.pathname || '/';
  const tx = (key: string, defaultValue: string) => translate?.(key, defaultValue) ?? defaultValue;

  const moduleMap: Record<string, string> = {
    '/my-work': tx('feedback.panelContext.modules.myWork', 'Moja praca'),
    '/interview': tx('feedback.panelContext.modules.interview', 'Wywiad'),
    '/tools': tx('feedback.panelContext.modules.tools', 'Narzędzia Discovery'),
    '/initiatives': tx('feedback.panelContext.modules.initiatives', 'Inicjatywy'),
    '/execution': tx('feedback.panelContext.modules.execution', 'Realizacja'),
    '/results': tx('feedback.panelContext.modules.results', 'Rezultaty'),
    '/finance': tx('feedback.panelContext.modules.finance', 'Finanse'),
    '/presentations': tx('feedback.panelContext.modules.presentations', 'Prezentacje'),
    '/assessment': tx('feedback.panelContext.modules.assessment', 'Ocena'),
    '/dashboard': tx('feedback.panelContext.modules.dashboard', 'Pulpit'),
    '/reports': tx('feedback.panelContext.modules.reports', 'Raporty'),
    '/settings': tx('feedback.panelContext.modules.settings', 'Ustawienia'),
    '/admin': tx('feedback.panelContext.modules.admin', 'Admin'),
    '/superadmin': tx('feedback.panelContext.modules.superadmin', 'SuperAdmin'),
    '/chat': tx('feedback.panelContext.modules.chat', 'Czat AI'),
    '/economics': tx('feedback.panelContext.modules.economics', 'Ekonomia'),
    '/implementation': tx('feedback.panelContext.modules.implementation', 'Wdrożenie'),
  };

  const matchedKey = Object.keys(moduleMap).find((key) => pathname.startsWith(key));
  const moduleName = matchedKey
    ? moduleMap[matchedKey]
    : pathname.split('/').filter(Boolean)[0] || tx('feedback.panelContext.modules.home', 'Start');

  const pageTitle = document.title?.replace(/\s*[-|].*$/, '') || moduleName;

  const width = w?.innerWidth || 0;
  const deviceType: 'mobile' | 'tablet' | 'desktop' =
    width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

  return {
    routePath: pathname,
    pageTitle,
    moduleName,
    deviceType,
    screenSize: `${w?.innerWidth || 0}x${w?.innerHeight || 0}`,
    uiLanguage: document.documentElement.lang || navigator.language,
    uiTheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    timestamp: new Date().toISOString(),
    browser: navigator.userAgent,
    scrollPosition: w?.scrollY || 0,
  };
}

// ==================== COMPONENT ====================

export const FeedbackSidePanel: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, activeSidePanel, closeSidePanel } = useAppStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<Exclude<FeedbackTab, 'pulse'>>('report');

  // Report tab state
  const [reportType, setReportType] = useState<ReportType>('BUG');
  const [reportTitle, setReportTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [impactNotes, setImpactNotes] = useState('');

  // AI compose (make reports task-grade)
  const [isComposing, setIsComposing] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);

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

  // Context snapshot - captured the moment user opens the panel
  const [capturedCtx, setCapturedCtx] = useState<CapturedContext | null>(null);
  const wasOpenRef = useRef(false);

  const isOpen = activeSidePanel === 'FEEDBACK';

  // Capture context snapshot when panel opens
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setCapturedCtx(capturePageContext(t));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, t]);

  const currentContext =
    capturedCtx?.routePath || (typeof window !== 'undefined' ? window.location.pathname : '/');

  // Fetch AI insights when panel opens
  useEffect(() => {
    if (isOpen && activeTab === 'feature') {
      fetchAIInsights();
    }
  }, [isOpen, activeTab]);

  const fetchAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const data = await Api.getFeedbackAIInsights({
        context: currentContext,
        userId: currentUser?.id,
      });
      setAiInsights(data?.insights || []);
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Reset form after success
  const resetForm = useCallback(() => {
    setReportTitle('');
    setMessage('');
    setSeverity('MEDIUM');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setActualBehavior('');
    setImpactNotes('');
    setAiQuestions([]);
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
    const ctx = capturedCtx || capturePageContext(t);
    const structuredBlocks: string[] = [];
    if (stepsToReproduce.trim())
      structuredBlocks.push(`Steps to reproduce:\n${stepsToReproduce.trim()}`);
    if (expectedBehavior.trim()) structuredBlocks.push(`Expected:\n${expectedBehavior.trim()}`);
    if (actualBehavior.trim()) structuredBlocks.push(`Actual:\n${actualBehavior.trim()}`);
    if (impactNotes.trim()) structuredBlocks.push(`Impact:\n${impactNotes.trim()}`);

    const fullDescription = [message.trim(), ...structuredBlocks.map((b) => `\n\n${b}`)].join('');
    try {
      await Api.sendFeedback({
        userId: currentUser?.id || undefined,
        userEmail: currentUser?.email || undefined,
        userName: currentUser?.full_name || currentUser?.firstName,
        type: reportType,
        title: reportTitle.trim() || undefined,
        message,
        description: fullDescription,
        severity,
        routePath: ctx.routePath,
        deviceType: ctx.deviceType,
        screenSize: ctx.screenSize,
        uiLanguage: ctx.uiLanguage,
        uiTheme: ctx.uiTheme,
        clientEnv,
        metadata: {
          context: ctx.routePath,
          moduleName: ctx.moduleName,
          pageTitle: ctx.pageTitle,
          browser: ctx.browser,
          timestamp: ctx.timestamp,
          screenSize: ctx.screenSize,
          scrollPosition: ctx.scrollPosition,
        },
      });
      handleSuccess(
        reportType === 'BUG'
          ? t('feedback.success.bugReported', "Bug reported! We'll investigate ASAP.")
          : t('feedback.success.ideaSubmitted', 'Great idea! Added to our backlog.')
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(t('feedback.error.submit', 'Failed to submit feedback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const improveReportWithAI = async () => {
    if (!message.trim()) return;
    const ctx = capturedCtx || capturePageContext(t);
    setIsComposing(true);
    setAiQuestions([]);
    try {
      const json = await Api.composeFeedback({
        type: reportType,
        title: reportTitle.trim() || undefined,
        message: message.trim(),
        severity,
        appEnv: clientEnv || undefined,
        context: {
          routePath: ctx.routePath,
          moduleName: ctx.moduleName,
          pageTitle: ctx.pageTitle,
          deviceType: ctx.deviceType,
          screenSize: ctx.screenSize,
          uiLanguage: ctx.uiLanguage,
          uiTheme: ctx.uiTheme,
        },
      });
      const data = json?.data || json;
      if (data?.title) setReportTitle(String(data.title));
      if (data?.summary) setMessage(String(data.summary));
      if (data?.steps)
        setStepsToReproduce(Array.isArray(data.steps) ? data.steps.join('\n') : String(data.steps));
      if (data?.expected) setExpectedBehavior(String(data.expected));
      if (data?.actual) setActualBehavior(String(data.actual));
      if (data?.impact) setImpactNotes(String(data.impact));
      if (Array.isArray(data?.questionsToClarify))
        setAiQuestions(data.questionsToClarify.map(String));
      if (typeof data?.isLikelyBug === 'boolean' && reportType === 'BUG' && !data.isLikelyBug) {
        toast(
          t('feedback.ai.maybeNotBug', 'AI suggests this might not be a bug. Please double-check.')
        );
      }
    } catch (e) {
      toast.error(t('feedback.ai.failed', 'AI assist failed. Please try again.'));
    } finally {
      setIsComposing(false);
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
    const ctx = capturedCtx || capturePageContext(t);
    try {
      await Api.submitPulseFeedback({
        userId: currentUser?.id,
        rating,
        context: ctx.routePath,
        comment: comment || pulseComment,
        timestamp: ctx.timestamp,
      });
      handleSuccess(t('feedback.success.pulse', 'Thanks for your feedback! 🎉'));
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
    const ctx = capturedCtx || capturePageContext(t);
    try {
      const data = await Api.submitFeatureFeedback({
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        category: featureCategory,
        featureName,
        description: featureDescription,
        impact: featureImpact,
        context: ctx.routePath,
        requestAIAnalysis: true,
      });
      handleSuccess(
        data.aiSuggestion
          ? t(
              'feedback.success.featureWithAI',
              'Feature request submitted! AI found similar requests.'
            )
          : t('feedback.success.feature', 'Feature request submitted!')
      );
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
        { id: 'feature', icon: Sparkles, label: t('feedback.tabs.feature', 'Feature') },
      ].map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id as Exclude<FeedbackTab, 'pulse'>)}
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

  const renderContextBadge = () => {
    if (!capturedCtx) return null;
    const deviceLabel = t(
      `feedback.panelContext.device.${capturedCtx.deviceType}`,
      capturedCtx.deviceType
    );
    return (
      <div className="flex items-center gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs">
        <MapPin size={14} className="text-indigo-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">
            {capturedCtx.moduleName}
          </span>
          <span className="text-indigo-500 dark:text-indigo-400 ml-1.5">
            {capturedCtx.routePath}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-400 dark:text-indigo-500 shrink-0">
          <Monitor size={12} />
          <span>{deviceLabel}</span>
        </div>
      </div>
    );
  };

  const renderReportTab = () => (
    <form onSubmit={handleReportSubmit} className="flex flex-col gap-4 h-full">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('feedback.report.intro', 'Help us improve by reporting issues or sharing ideas.')}
      </p>

      {renderContextBadge()}

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
                label: t('feedback.severity.low', 'Niski'),
                color: 'text-green-500 bg-green-50 dark:bg-green-900/20',
              },
              {
                value: 'MEDIUM',
                label: t('feedback.severity.medium', 'Średni'),
                color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
              },
              {
                value: 'HIGH',
                label: t('feedback.severity.high', 'Wysoki'),
                color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
              },
              {
                value: 'CRITICAL',
                label: t('feedback.severity.critical', 'Krytyczny'),
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

      {/* Title + AI Assist */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t('feedback.label.title', 'Title')}
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
          placeholder={t('feedback.placeholder.title', 'Short, specific summary')}
          value={reportTitle}
          onChange={(e) => setReportTitle(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={improveReportWithAI}
            disabled={isComposing || isSubmitting || !message.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-800 disabled:opacity-50 flex items-center gap-2"
          >
            {isComposing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t('feedback.ai.improve', 'Improve with AI')}
          </button>
          {aiQuestions.length > 0 ? (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {t('feedback.ai.questions', 'AI has questions')}
            </span>
          ) : null}
        </div>
        {aiQuestions.length > 0 ? (
          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('feedback.ai.clarify', 'To make this actionable, please clarify')}
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {aiQuestions.slice(0, 5).map((q, idx) => (
                <li key={idx}>{q}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

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

      {/* Bug structure helpers */}
      {reportType === 'BUG' && (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              {t('feedback.label.steps', 'Steps to reproduce')}
            </label>
            <textarea
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm min-h-[72px]"
              placeholder={t('feedback.placeholder.steps', '1) …\n2) …\n3) …')}
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t('feedback.label.expected', 'Expected')}
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm min-h-[72px]"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t('feedback.label.actual', 'Actual')}
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm min-h-[72px]"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              {t('feedback.label.impact', 'Impact')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
              placeholder={t('feedback.placeholder.impact', 'Who is affected / how bad is it?')}
              value={impactNotes}
              onChange={(e) => setImpactNotes(e.target.value)}
            />
          </div>
        </div>
      )}

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

  const renderFeatureTab = () => (
    <form onSubmit={handleFeatureSubmit} className="flex flex-col gap-4 h-full">
      {renderContextBadge()}

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
            {
              value: 'missing',
              label: t('feedback.feature.categories.missing', 'Brakująca funkcja'),
              icon: AlertTriangle,
            },
            {
              value: 'improvement',
              label: t('feedback.feature.categories.improvement', 'Usprawnienie'),
              icon: TrendingUp,
            },
            {
              value: 'usability',
              label: t('feedback.feature.categories.usability', 'UX'),
              icon: Star,
            },
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
            { value: 'low', label: t('feedback.feature.impactLevels.low', 'Dobrze mieć') },
            { value: 'medium', label: t('feedback.feature.impactLevels.medium', 'Ważne') },
            { value: 'high', label: t('feedback.feature.impactLevels.high', 'Krytyczne') },
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

  const clientEnv = ((import.meta as any)?.env?.VITE_APP_ENV as string | undefined) || '';

  const renderQuickPulseHeader = () => (
    <div className="flex items-center gap-1.5">
      {clientEnv ? (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-navy-800 text-slate-700 dark:text-slate-200 mr-1">
          {clientEnv.toUpperCase()}
        </span>
      ) : null}
      {[
        { rating: 1, icon: Frown, color: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' },
        {
          rating: 2,
          icon: ThumbsDown,
          color: 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20',
        },
        {
          rating: 3,
          icon: Meh,
          color: 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
        },
        {
          rating: 4,
          icon: Smile,
          color: 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20',
        },
        {
          rating: 5,
          icon: ThumbsUp,
          color: 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
        },
      ].map(({ rating, icon: Icon, color }) => (
        <button
          key={rating}
          onClick={() => handlePulseSubmit(rating as PulseRating)}
          disabled={isSubmitting}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${color} disabled:opacity-50`}
          title={t('feedback.quickPulse', 'Quick feedback')}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );

  const renderQuickPulseComment = () => {
    if (!showPulseComment) return null;
    return (
      <div className="mb-4 p-3 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t('feedback.pulse.tellUs', 'Tell us what went wrong')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {t('feedback.pulse.context', 'Feedback for:')}{' '}
              <span className="font-medium">{capturedCtx?.routePath || currentContext}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setShowPulseComment(false);
              setPulseRating(null);
              setPulseComment('');
            }}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>

        <textarea
          className="w-full px-3 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-sm min-h-[84px]"
          placeholder={t('feedback.pulse.commentPlaceholder', 'What can we improve?')}
          value={pulseComment}
          onChange={(e) => setPulseComment(e.target.value)}
          autoFocus
        />

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => submitPulse(pulseRating!, pulseComment)}
            disabled={isSubmitting || !pulseRating}
            className="flex-1 py-2 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {t('feedback.submit', 'Submit')}
          </button>
        </div>
      </div>
    );
  };

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
            {t('feedback.title', 'User Feedback & Triage')}
          </h2>
          <div className="flex items-center gap-2">
            {!showSuccess && renderQuickPulseHeader()}
            <button
              onClick={closeSidePanel}
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {!showSuccess && renderTabs()}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {showSuccess ? (
            renderSuccess()
          ) : (
            <>
              {renderQuickPulseComment()}
              {activeTab === 'report' && renderReportTab()}
              {activeTab === 'feature' && renderFeatureTab()}
            </>
          )}
        </div>

        {/* Footer */}
        {!showSuccess && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
            <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              {t('feedback.footer', 'Opinia wysyłana jako')}{' '}
              <b>{currentUser?.email || t('feedback.anonymous', 'Anonimowo')}</b>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default FeedbackSidePanel;
