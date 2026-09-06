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
  Paperclip,
  Send,
  Smile,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { buildFeedbackDossier } from '../../services/feedbackCollector';
import { useAppStore } from '../../store/useAppStore';
import TeresaMark from '../shared/TeresaMark';

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
  const [successReference, setSuccessReference] = useState<string | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  // Context snapshot - captured the moment user opens the panel
  const [capturedCtx, setCapturedCtx] = useState<CapturedContext | null>(null);
  const wasOpenRef = useRef(false);

  // Cursor-ready capture state (V2)
  // Screenshot is opt-in by default (off) — avoids payload bloat, GDPR
  // surprises and slow DOM rasterisation on large dashboards. Diagnostics
  // (console/network/breadcrumbs) stay on because they are cheap and textual.
  const [attachScreenshot, setAttachScreenshot] = useState(false);
  const [attachDiagnostics, setAttachDiagnostics] = useState(true);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isPreparingDossier, setIsPreparingDossier] = useState(false);

  // Feedback #00835312 — testers asked for a way to attach their OWN
  // screenshot to a bug report (screenshot of the full desktop, of a
  // different window, of a phone, annotated in Skitch, etc.). The old
  // flow only offered the auto-captured viewport via html-to-image,
  // which (a) often failed on complex dashboards and (b) never covered
  // anything outside the current browser tab. This state carries a
  // user-provided image (file upload OR clipboard paste) and takes
  // precedence over the auto-capture when set.
  const [uploadedScreenshot, setUploadedScreenshot] = useState<{
    dataUrl: string;
    approxBytes: number;
    width: number;
    height: number;
    fileName?: string;
  } | null>(null);
  const screenshotFileInputRef = useRef<HTMLInputElement | null>(null);

  const isOpen = activeSidePanel === 'FEEDBACK';

  // Capture context snapshot when panel opens
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setCapturedCtx(capturePageContext(t));
      // Accept optional prefill from ErrorBoundary or other sources
      try {
        const prefill = (window as any).__FEEDBACK_PREFILL__;
        if (prefill && typeof prefill === 'object') {
          if (prefill.type === 'BUG' || prefill.type === 'IDEA') {
            setReportType(prefill.type);
            setActiveTab('report');
          }
          if (typeof prefill.title === 'string') setReportTitle(prefill.title);
          if (typeof prefill.message === 'string') setMessage(prefill.message);
          if (
            prefill.severity === 'LOW' ||
            prefill.severity === 'MEDIUM' ||
            prefill.severity === 'HIGH' ||
            prefill.severity === 'CRITICAL'
          ) {
            setSeverity(prefill.severity);
          }
          if (prefill.error && typeof prefill.error === 'object') {
            const parts: string[] = [];
            if (prefill.error.message) parts.push(`Error: ${prefill.error.message}`);
            if (prefill.error.stack)
              parts.push(`Stack:\n${String(prefill.error.stack).slice(0, 2000)}`);
            if (parts.length) setActualBehavior(parts.join('\n\n'));
          }
          delete (window as any).__FEEDBACK_PREFILL__;
        }
      } catch {
        // ignore prefill failures
      }
    }
    if (!isOpen && wasOpenRef.current) {
      setScreenshotPreview(null);
      // Feedback #4f9a1697 — "attach screenshot" must NOT survive a close.
      // Left checked, it silently re-triggers the DOM capture effect below
      // on next open (before the user clicks anything), which on a heavy
      // dashboard freezes the page for several seconds with no visible cause.
      setAttachScreenshot(false);
      setUploadedScreenshot(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, t]);

  // When user enters Report tab in BUG mode, prepare a screenshot preview.
  useEffect(() => {
    let cancelled = false;
    async function preparePreview() {
      if (!isOpen || activeTab !== 'report' || !attachScreenshot) {
        setScreenshotPreview(null);
        return;
      }
      setIsPreparingDossier(true);
      try {
        const dossier = await buildFeedbackDossier({
          includeScreenshot: true,
          user: {
            userId: currentUser?.id || null,
            role: currentUser?.role || null,
          },
        });
        if (!cancelled) {
          setScreenshotPreview(dossier.screenshot?.dataUrl || null);
        }
      } catch (err) {
        if (!cancelled) setScreenshotPreview(null);
      } finally {
        if (!cancelled) setIsPreparingDossier(false);
      }
    }
    preparePreview();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, attachScreenshot, currentUser?.id, currentUser?.role]);

  // Listen for programmatic open events (e.g. ErrorBoundary)
  useEffect(() => {
    function onOpen() {
      try {
        const store = useAppStore.getState();
        if (store.activeSidePanel !== 'FEEDBACK') {
          store.toggleSidePanel('FEEDBACK');
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener('feedback:open', onOpen as EventListener);
    return () => window.removeEventListener('feedback:open', onOpen as EventListener);
  }, []);

  // Feedback #00835312 — load a user-provided image (file or clipboard
  // blob) into `uploadedScreenshot`. Server Zod schema caps the base64
  // dataUrl at 2,000,000 characters (~1.5 MB of image data after
  // encoding), so we cap the raw file at ~1.4 MB and hard-fail with a
  // toast instead of silently dropping the attachment.
  const MAX_UPLOADED_SCREENSHOT_BYTES = 1.4 * 1024 * 1024;
  const loadScreenshotFromFile = useCallback(
    async (file: File | Blob, fileName?: string) => {
      try {
        if (!file.type?.startsWith('image/')) {
          toast.error(
            t('feedback.attach.notAnImage', 'Plik musi być obrazem (PNG, JPG, GIF lub WebP).')
          );
          return;
        }
        if (file.size > MAX_UPLOADED_SCREENSHOT_BYTES) {
          toast.error(
            t(
              'feedback.attach.tooLarge',
              'Zrzut ekranu jest za duży (max ~1.4 MB). Użyj narzędzia do kompresji lub przytnij obraz.'
            )
          );
          return;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        if (!dataUrl || dataUrl.length < 100) {
          toast.error(
            t('feedback.attach.readFailed', 'Nie udało się odczytać pliku. Spróbuj ponownie.')
          );
          return;
        }
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({ width: 0, height: 0 });
          img.src = dataUrl;
        });
        setUploadedScreenshot({
          dataUrl,
          approxBytes: file.size,
          width: dims.width || 0,
          height: dims.height || 0,
          fileName: fileName || (file as File).name || 'screenshot.png',
        });
        toast.success(t('feedback.attach.uploaded', 'Screenshot dodany do zgłoszenia.'), {
          duration: 1500,
        });
      } catch (err) {
        console.warn('[FeedbackSidePanel] loadScreenshotFromFile failed:', err);
        toast.error(
          t('feedback.attach.readFailed', 'Nie udało się odczytać pliku. Spróbuj ponownie.')
        );
      }
    },
    [t]
  );

  const handleScreenshotFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await loadScreenshotFromFile(file);
      if (screenshotFileInputRef.current) screenshotFileInputRef.current.value = '';
    },
    [loadScreenshotFromFile]
  );

  // Ctrl/Cmd-V paste support while the Report tab is open.
  useEffect(() => {
    if (!isOpen || activeTab !== 'report' || reportType !== 'BUG') return;
    const onPaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find((it) => it.type?.startsWith('image/'));
      if (!imageItem) return;
      const blob = imageItem.getAsFile();
      if (!blob) return;
      e.preventDefault();
      await loadScreenshotFromFile(blob, `pasted-${Date.now()}.png`);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [isOpen, activeTab, reportType, loadScreenshotFromFile]);

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
    setUploadedScreenshot(null);
    setSubmitErrorMessage(null);
  }, []);

  // Handle success state. `referenceId` (when provided) is shown so the user
  // has a ticket number to quote when following up — closes the "did it even
  // send?" gap. Keep the success screen up a touch longer when there's an ID.
  const handleSuccess = (msg: string, referenceId?: string) => {
    setSuccessMessage(msg);
    setSuccessReference(referenceId || null);
    setShowSuccess(true);
    setTimeout(
      () => {
        setShowSuccess(false);
        setSuccessReference(null);
        resetForm();
      },
      referenceId ? 4000 : 2500
    );
  };

  // ==================== SUBMIT HANDLERS ====================

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setSubmitErrorMessage(null);
    const ctx = capturedCtx || capturePageContext(t);
    const structuredBlocks: string[] = [];
    if (stepsToReproduce.trim())
      structuredBlocks.push(`Steps to reproduce:\n${stepsToReproduce.trim()}`);
    if (expectedBehavior.trim()) structuredBlocks.push(`Expected:\n${expectedBehavior.trim()}`);
    if (actualBehavior.trim()) structuredBlocks.push(`Actual:\n${actualBehavior.trim()}`);
    if (impactNotes.trim()) structuredBlocks.push(`Impact:\n${impactNotes.trim()}`);

    const fullDescription = [message.trim(), ...structuredBlocks.map((b) => `\n\n${b}`)].join('');

    let dossier: Awaited<ReturnType<typeof buildFeedbackDossier>> | null = null;
    try {
      dossier = await buildFeedbackDossier({
        includeScreenshot: attachScreenshot,
        user: {
          userId: currentUser?.id || null,
          role: currentUser?.role || null,
        },
        forSignature: {
          message: `${reportTitle.trim()} ${message.trim()}`.trim(),
          route: ctx.routePath,
        },
      });
    } catch (err) {
      console.warn('[FeedbackSidePanel] buildFeedbackDossier failed:', err);
    }

    try {
      const submitResult = await Api.sendFeedback({
        userId: currentUser?.id || undefined,
        userEmail: currentUser?.email || undefined,
        userName:
          [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim() ||
          undefined,
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
        signatureHash: dossier?.signatureHash,
        appContext: dossier ? (dossier.appContext as any) : undefined,
        consoleLogs: attachDiagnostics && dossier ? (dossier.consoleLogs as any) : undefined,
        networkErrors: attachDiagnostics && dossier ? (dossier.networkErrors as any) : undefined,
        breadcrumbs: attachDiagnostics && dossier ? (dossier.breadcrumbs as any) : undefined,
        lastUncaughtError:
          attachDiagnostics && dossier
            ? ((dossier.lastUncaughtError as Record<string, unknown> | null) ?? undefined)
            : undefined,
        // Feedback #00835312 — user-uploaded image wins over the
        // auto-captured viewport so a tester who pastes / uploads their
        // own annotated screenshot always sees it travel with the
        // report, even if the `attachScreenshot` checkbox is off.
        screenshot: uploadedScreenshot
          ? {
              dataUrl: uploadedScreenshot.dataUrl,
              approxBytes: uploadedScreenshot.approxBytes,
              width: uploadedScreenshot.width,
              height: uploadedScreenshot.height,
            }
          : attachScreenshot && dossier?.screenshot
            ? {
                dataUrl: dossier.screenshot.dataUrl,
                approxBytes: dossier.screenshot.approxBytes,
                width: dossier.screenshot.width,
                height: dossier.screenshot.height,
              }
            : null,
      });
      // Surface a short ticket reference (first block of the UUID) so the user
      // can quote it when following up. Backend returns { success, id, taskId }.
      const rawId = (submitResult && (submitResult.id || submitResult.feedbackId)) || undefined;
      const reference =
        typeof rawId === 'string' && rawId.length >= 8
          ? rawId.slice(0, 8).toUpperCase()
          : undefined;
      handleSuccess(
        reportType === 'BUG'
          ? t('feedback.success.bugReported', "Bug reported! We'll investigate ASAP.")
          : t('feedback.success.ideaSubmitted', 'Great idea! Added to our backlog.'),
        reference
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setSubmitErrorMessage(t('feedback.error.submit', 'Failed to submit feedback'));
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
      // feedback 4424011a: surface server reason (e.g. "LLM provider not configured")
      // instead of a generic retry message that gives users no actionable information.
      const serverMsg = e instanceof Error ? e.message : '';
      const isUnavailable =
        serverMsg.toLowerCase().includes('unavailable') ||
        serverMsg.toLowerCase().includes('no_llm_provider') ||
        serverMsg.toLowerCase().includes('not configured');
      toast.error(
        isUnavailable
          ? t('feedback.ai.unavailable', 'AI assist is not available right now.')
          : serverMsg || t('feedback.ai.failed', 'AI assist failed. Please try again.')
      );
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
    setSubmitErrorMessage(null);
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
      setSubmitErrorMessage(t('feedback.error.submit', 'Failed to submit feedback'));
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
    setSubmitErrorMessage(null);
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
      setSubmitErrorMessage(t('feedback.error.submit', 'Failed to submit feedback'));
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
              ? 'bg-white dark:bg-navy-800 text-danger-600 shadow-sm'
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
                color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
              },
              {
                value: 'CRITICAL',
                label: t('feedback.severity.critical', 'Krytyczny'),
                color: 'text-danger-500 bg-danger-50 dark:bg-danger-900/20',
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
            <span className="text-[10px] text-slate-600 dark:text-slate-500">
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

      {/* Cursor-ready capture bundle */}
      {reportType === 'BUG' && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('feedback.attach.title', 'Cursor-ready dowody')}</span>
            {isPreparingDossier ? (
              <span className="inline-flex items-center gap-1 text-slate-600">
                <Loader2 size={12} className="animate-spin" />
                {t('feedback.attach.preparing', 'Przygotowuję…')}
              </span>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={attachScreenshot}
              onChange={(e) => setAttachScreenshot(e.target.checked)}
              className="h-3.5 w-3.5"
              disabled={!!uploadedScreenshot}
            />
            {t('feedback.attach.screenshot', 'Dołącz screenshot bieżącego widoku (opcjonalnie)')}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={attachDiagnostics}
              onChange={(e) => setAttachDiagnostics(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            {t(
              'feedback.attach.diagnostics',
              'Dołącz logi konsoli, błędy sieci i breadcrumbs (bez wartości z formularzy)'
            )}
          </label>

          {/* Feedback #00835312 — explicit upload + paste affordance so
              testers can attach their OWN screenshot (full desktop,
              another window, phone photo, annotated in Skitch, etc.).
              Takes precedence over the auto-captured viewport. */}
          <div className="mt-1 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => screenshotFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              title={t(
                'feedback.attach.uploadHint',
                'Wgraj własny zrzut ekranu (PNG/JPG, max ~1.4 MB) lub wklej obraz ze schowka (Ctrl/Cmd+V).'
              )}
            >
              <Upload size={12} />
              {uploadedScreenshot
                ? t('feedback.attach.replace', 'Wymień screenshot')
                : t('feedback.attach.upload', 'Wgraj własny screenshot')}
            </button>
            {uploadedScreenshot ? (
              <button
                type="button"
                onClick={() => setUploadedScreenshot(null)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-slate-500 hover:text-danger-600 dark:text-slate-400 dark:hover:text-danger-400 transition-colors"
                title={t('feedback.attach.remove', 'Usuń załączony screenshot')}
              >
                <X size={12} />
                {t('feedback.attach.removeShort', 'Usuń')}
              </button>
            ) : (
              <span className="text-[10px] text-slate-600 dark:text-slate-500">
                {t('feedback.attach.pasteHint', 'lub wklej (Ctrl/⌘+V)')}
              </span>
            )}
            <input
              ref={screenshotFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotFileChange}
              className="hidden"
            />
          </div>

          {uploadedScreenshot ? (
            <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-900">
              <img
                src={uploadedScreenshot.dataUrl}
                alt={uploadedScreenshot.fileName || 'uploaded-screenshot'}
                className="w-full h-auto max-h-48 object-contain object-top bg-slate-950"
              />
              <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-600">
                <span className="truncate">
                  <Paperclip size={10} className="inline-block mr-1 align-text-bottom" />
                  {uploadedScreenshot.fileName || 'screenshot.png'}
                  {uploadedScreenshot.width && uploadedScreenshot.height
                    ? ` — ${uploadedScreenshot.width}×${uploadedScreenshot.height}`
                    : ''}
                </span>
                <span className="shrink-0">
                  {Math.max(1, Math.round(uploadedScreenshot.approxBytes / 1024))} KB
                </span>
              </div>
            </div>
          ) : attachScreenshot && screenshotPreview ? (
            <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-900">
              <img
                src={screenshotPreview}
                alt="preview"
                className="w-full h-auto max-h-48 object-cover object-top"
                data-feedback-redact
              />
              <div className="px-2 py-1 text-[10px] text-slate-600">
                {t(
                  'feedback.attach.previewHint',
                  'Hasła i pola email są zamazywane automatycznie. Użyj atrybutu data-feedback-redact dla innych wrażliwych miejsc.'
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !message.trim()}
        className={`w-full py-2.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm ${
          severity === 'CRITICAL' && reportType === 'BUG'
            ? 'bg-danger-600 hover:bg-danger-700 text-white'
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
        <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2 mb-2">
            <TeresaMark size={14} className="text-primary-600 dark:text-primary-400" />
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
              {t('feedback.ai.insights', 'AI Insights')}
            </span>
          </div>
          <div className="space-y-2">
            {aiInsights.slice(0, 2).map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <TrendingUp size={12} className="text-primary-500 mt-0.5" />
                <div>
                  <span className="font-medium text-primary-800 dark:text-primary-200">
                    {insight.title}
                  </span>
                  <span className="text-primary-600 dark:text-primary-400">
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
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
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
          className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus-visible:ring-2 focus-visible:ring-c-focus outline-none text-sm"
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
          className="flex-1 w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus-visible:ring-2 focus-visible:ring-c-focus outline-none resize-none text-sm min-h-[80px]"
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
                  ? 'bg-navy-900 text-white'
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
        className="w-full py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
      {successReference ? (
        <div className="mt-3 flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('feedback.success.reference', 'Numer zgłoszenia')}
          </span>
          <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-navy-900 px-2.5 py-1 rounded-lg">
            #{successReference}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[220px]">
            {t('feedback.success.referenceHint', 'Powiadomimy Cię tutaj, gdy zmieni się status.')}
          </span>
        </div>
      ) : null}
    </div>
  );

  const clientEnv = ((import.meta.env as any)?.VITE_APP_ENV as string | undefined) || '';

  const renderQuickPulseHeader = () => (
    <div className="flex items-center gap-1.5">
      {clientEnv ? (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-navy-800 text-slate-700 dark:text-slate-200 mr-1">
          {clientEnv.toUpperCase()}
        </span>
      ) : null}
      {[
        {
          rating: 1,
          icon: Frown,
          color: 'text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20',
        },
        {
          rating: 2,
          icon: ThumbsDown,
          color: 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20',
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
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-dropdown transition-opacity"
        onClick={closeSidePanel}
        data-feedback-capture-exclude="1"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-overlay flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-navy-700"
        data-feedback-capture-exclude="1"
      >
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
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-danger-500 dark:text-slate-400 dark:hover:text-danger-400 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
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
              {submitErrorMessage ? (
                <div
                  role="alert"
                  className="mb-3 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
                >
                  {submitErrorMessage}
                </div>
              ) : null}
              {renderQuickPulseComment()}
              {activeTab === 'report' && renderReportTab()}
              {activeTab === 'feature' && renderFeatureTab()}
            </>
          )}
        </div>

        {/* Footer */}
        {!showSuccess && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
            <div className="text-[10px] text-slate-600 dark:text-slate-500 text-center">
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
