/**
 * PublicMiniAssessmentView (T015)
 * Public-facing mini assessment with focus-flow UX, AI result, and CTA.
 */

import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import {
  type SurveyAnswer,
  type SurveySection,
  SurveyShell,
} from '../components/Survey/SurveyShell';
import { trackFunnelEvent } from '../services/funnelAnalytics';

const API_BASE = '/api/public/mini-assessment';

type ViewState = 'loading' | 'intro' | 'survey' | 'submitting' | 'result' | 'error';

interface AIResult {
  resultKind: 'rules_based_snapshot';
  resultLabel: string;
  methodNotes: string[];
  overallScore: number;
  overallLevel: string;
  dimensions: Array<{ name: string; score: number; maxScore: number; level: string }>;
  insights: string[];
  assumptions: string[];
  biggestChallenge: string | null;
  followUpTopics: string[];
  answerSummary: Array<{ questionId: string; question: string; answer: string }>;
}

export const PublicMiniAssessmentView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isDraftSaving, setIsDraftSaving] = useState(false);

  const lang = searchParams.get('lang') || i18n.language || 'en';

  useEffect(() => {
    if (!token) {
      startNewAssessment();
    } else {
      loadAssessment(token);
    }
  }, [token]);

  const startNewAssessment = async () => {
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          partnerCode: searchParams.get('partner') || undefined,
          sourceCampaign: searchParams.get('source') || undefined,
          utm: {
            utm_source: searchParams.get('utm_source') || undefined,
            utm_medium: searchParams.get('utm_medium') || undefined,
            utm_campaign: searchParams.get('utm_campaign') || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.token) {
        window.history.replaceState(null, '', `/assess/${data.token}?lang=${lang}`);
        await loadAssessment(data.token);
      }
    } catch {
      setViewState('error');
      setError('Failed to start assessment');
    }
  };

  const loadAssessment = async (t: string) => {
    try {
      const res = await fetch(`${API_BASE}/${t}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setAssessmentData(data);

      if (data.status === 'completed' && data.aiResult) {
        setAiResult(data.aiResult);
        setViewState('result');
        trackFunnelEvent('external_assessment_result_viewed');
      } else {
        setViewState('intro');
        trackFunnelEvent('external_assessment_opened');
      }
    } catch {
      setViewState('error');
      setError('Assessment not found');
    }
  };

  const surveySections: SurveySection[] = useMemo(() => {
    if (!assessmentData?.template?.questions) return [];
    const questions = assessmentData.template.questions;
    return [
      {
        id: 'main',
        title: {
          en: 'Digital Transformation Readiness',
          pl: 'Gotowość do transformacji cyfrowej',
        },
        questions,
      },
    ];
  }, [assessmentData]);

  const handleStart = useCallback(() => {
    setViewState('survey');
    trackFunnelEvent('external_assessment_started');
  }, []);

  const hasDraftAnswers =
    Array.isArray(assessmentData?.answers) && assessmentData.answers.length > 0;

  const handleAnswer = useCallback((answer: SurveyAnswer) => {
    // No-op for public assessment — answers tracked internally by SurveyShell
  }, []);

  const handleAutosave = useCallback(
    async (answers: SurveyAnswer[]) => {
      const currentToken = token || assessmentData?.token;
      if (!currentToken) return;

      setIsDraftSaving(true);
      try {
        await fetch(`${API_BASE}/${currentToken}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
      } catch {
        // Draft save is best-effort; keep the survey usable.
      } finally {
        setIsDraftSaving(false);
      }
    },
    [token, assessmentData]
  );

  const handleSubmit = useCallback(
    async (answers: SurveyAnswer[]) => {
      const currentToken = token || assessmentData?.token;
      if (!currentToken) return;
      setViewState('submitting');

      try {
        const res = await fetch(`${API_BASE}/${currentToken}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, respondentEmail: email || undefined }),
        });
        const data = await res.json();
        if (data.success && data.aiResult) {
          setAiResult(data.aiResult);
          setViewState('result');
          trackFunnelEvent('external_assessment_completed');
        } else {
          throw new Error(data.error || 'Submit failed');
        }
      } catch (err: any) {
        setViewState('survey');
        setError(err.message);
      }
    },
    [token, assessmentData, email]
  );

  const buildFollowUpBrief = useCallback(() => {
    if (!aiResult) return '';

    const lines = [
      lang === 'pl' ? 'Follow-up interview brief' : 'Follow-up interview brief',
      '',
      `${lang === 'pl' ? 'Snapshot' : 'Snapshot'}: ${aiResult.resultLabel}`,
      `${lang === 'pl' ? 'Score' : 'Score'}: ${aiResult.overallScore}% (${levelLabel(aiResult.overallLevel)})`,
      '',
      lang === 'pl' ? 'Najważniejsze obserwacje:' : 'Key observations:',
      ...aiResult.insights.map((insight) => `- ${insight}`),
      '',
      lang === 'pl' ? 'Główne wyzwanie respondenta:' : 'Main respondent challenge:',
      aiResult.biggestChallenge || (lang === 'pl' ? 'Brak odpowiedzi' : 'No answer provided'),
      '',
      lang === 'pl' ? 'Tematy do follow-up interview:' : 'Topics for follow-up interview:',
      ...aiResult.followUpTopics.map((topic) => `- ${topic}`),
      '',
      lang === 'pl' ? 'Odpowiedzi źródłowe:' : 'Source answers:',
      ...aiResult.answerSummary.map((entry) => `- ${entry.question}: ${entry.answer}`),
    ];

    return lines.join('\n');
  }, [aiResult, lang]);

  const handleCopyFollowUpBrief = useCallback(async () => {
    const brief = buildFollowUpBrief();
    if (!brief) return;

    try {
      await navigator.clipboard.writeText(brief);
      trackFunnelEvent('external_assessment_cta_clicked', { action: 'copy_follow_up_brief' });
    } catch {
      setError(
        lang === 'pl'
          ? 'Nie udało się skopiować briefu follow-up.'
          : 'Failed to copy the follow-up brief.'
      );
    }
  }, [buildFollowUpBrief, lang]);

  const handleRestart = useCallback(() => {
    const nextUrl = `/assess?lang=${encodeURIComponent(lang)}`;
    window.location.assign(nextUrl);
  }, [lang]);

  const levelColor = (level: string) => {
    switch (level) {
      case 'advanced':
        return 'text-c-success';
      case 'developing':
        return 'text-c-info';
      case 'basic':
        return 'text-c-warning';
      default:
        return 'text-c-danger';
    }
  };

  const levelLabel = (level: string) => {
    const labels: Record<string, Record<string, string>> = {
      advanced: { en: 'Advanced', pl: 'Zaawansowany' },
      developing: { en: 'Developing', pl: 'Rozwijający się' },
      basic: { en: 'Basic', pl: 'Podstawowy' },
      initial: { en: 'Initial', pl: 'Początkowy' },
    };
    return labels[level]?.[lang] || labels[level]?.en || level;
  };

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg">
        <Loader2 className="w-8 h-8 animate-spin text-c-accent" />
      </div>
    );
  }

  if (viewState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg p-4">
        <div className="text-center max-w-md">
          <p className="text-lg font-medium text-c-text mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-c-accent hover:underline text-sm"
          >
            {t('publicAssessment.tryAgain', 'Try again')}
          </button>
        </div>
      </div>
    );
  }

  if (viewState === 'intro') {
    return (
      <div
        className="min-h-screen bg-c-bg flex items-center justify-center p-4"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="max-w-lg w-full bg-c-surface rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-c-accent-soft rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-8 h-8 text-c-accent" />
          </div>
          <h1 className="text-2xl font-bold text-c-text mb-2">
            {t('publicAssessment.title', 'Digital Transformation Readiness Check')}
          </h1>
          <p className="text-c-text-muted mb-6">
            {t(
              'publicAssessment.subtitle',
              'Answer a few quick questions and get an AI-powered snapshot of your readiness.'
            )}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-c-text-muted mb-6">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" /> {assessmentData?.template?.questions?.length || 6}{' '}
              {t('publicAssessment.questions', 'questions')}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />{' '}
              {t('publicAssessment.aiResult', 'Rules-based snapshot')}
            </span>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-c-text-muted mb-1 text-left">
              {t('publicAssessment.emailOptional', 'Email (optional — to receive your results)')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-c-border bg-c-surface
                  text-sm text-c-text-secondary focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid"
              />
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-3 px-6 bg-c-accent text-white font-medium rounded-xl hover:opacity-90 transition-colors
              flex items-center justify-center gap-2 text-sm"
          >
            {hasDraftAnswers
              ? t('publicAssessment.continueButton', 'Continue Assessment')
              : t('publicAssessment.startButton', 'Start Assessment')}
            <ArrowRight className="w-4 h-4" />
          </button>

          {hasDraftAnswers && (
            <p className="text-xs text-c-accent mt-3">
              {t(
                'publicAssessment.resumeHint',
                'We found a saved draft and will reopen the first unanswered question.'
              )}
            </p>
          )}

          <p className="text-xs text-c-text-muted mt-4">
            {t(
              'publicAssessment.disclaimer',
              'Your answers are saved as a draft before submit and used to generate a rules-based readiness snapshot. No account required.'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (viewState === 'submitting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-c-accent mx-auto mb-4" />
          <p className="text-c-text-muted">
            {t('publicAssessment.analyzing', 'Analyzing your responses...')}
          </p>
        </div>
      </div>
    );
  }

  if (viewState === 'result' && aiResult) {
    return (
      <div
        className="min-h-screen bg-c-bg p-4 md:p-8"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="max-w-2xl mx-auto">
          <div className="bg-c-surface rounded-2xl shadow-xl overflow-hidden">
            {/* Score header */}
            <div className="bg-c-accent text-white p-8 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-white/80 mb-3">
                {aiResult.resultLabel}
              </p>
              <h1 className="text-xl font-bold mb-2">
                {t('publicAssessment.resultTitle', 'Your Readiness Score')}
              </h1>
              <div className="text-5xl font-bold mb-2">{aiResult.overallScore}%</div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium bg-white/20`}
              >
                {levelLabel(aiResult.overallLevel)}
              </span>
              <p className="text-xs text-white/80 mt-4 max-w-lg mx-auto">
                {t(
                  'publicAssessment.honestyLabel',
                  'This is a rules-based snapshot from your form answers, not a full consulting diagnosis.'
                )}
              </p>
            </div>

            {/* Dimensions */}
            <div className="p-6 border-b border-c-border">
              <h2 className="text-sm font-semibold text-c-text-muted uppercase tracking-wider mb-4">
                {t('publicAssessment.dimensions', 'Breakdown by Dimension')}
              </h2>
              <div className="space-y-3">
                {aiResult.dimensions.map((dim) => (
                  <div key={dim.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-c-text-secondary">{dim.name}</span>
                      <span className={`font-medium ${levelColor(dim.level)}`}>
                        {dim.score}/{dim.maxScore}
                      </span>
                    </div>
                    <div className="w-full bg-c-border-subtle rounded-full h-2">
                      <div
                        className="bg-c-accent h-2 rounded-full transition-all"
                        style={{ width: `${(dim.score / dim.maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div className="p-6 border-b border-c-border">
              <h2 className="text-sm font-semibold text-c-text-muted uppercase tracking-wider mb-3">
                <Sparkles className="w-4 h-4 inline mr-1" />
                {t('publicAssessment.keyInsights', 'Key Insights')}
              </h2>
              <ul className="space-y-2">
                {aiResult.insights.map((insight, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-c-text-secondary"
                  >
                    <TrendingUp className="w-4 h-4 text-c-accent mt-0.5 flex-shrink-0" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>

            {/* Biggest challenge */}
            <div className="p-6 border-b border-c-border">
              <h2 className="text-sm font-semibold text-c-text-muted uppercase tracking-wider mb-3">
                {t('publicAssessment.mainChallenge', 'Main challenge reported')}
              </h2>
              <p className="text-sm text-c-text-secondary">
                {aiResult.biggestChallenge ||
                  t('publicAssessment.noChallenge', 'No free-text challenge was provided.')}
              </p>
            </div>

            {/* Follow-up interview action */}
            <div className="p-6 border-b border-c-border">
              <h2 className="text-sm font-semibold text-c-text-muted uppercase tracking-wider mb-3">
                {t('publicAssessment.followUpTitle', 'Suggested follow-up interview focus')}
              </h2>
              <ul className="space-y-2">
                {aiResult.followUpTopics.map((topic, idx) => (
                  <li
                    key={`${topic}-${idx}`}
                    className="flex items-start gap-2 text-sm text-c-text-secondary"
                  >
                    <CheckCircle2 className="w-4 h-4 text-c-accent mt-0.5 flex-shrink-0" />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>

            {/* Source answers */}
            <div className="p-6 border-b border-c-border">
              <h2 className="text-sm font-semibold text-c-text-muted uppercase tracking-wider mb-3">
                {t('publicAssessment.sourceAnswers', 'Source answers used')}
              </h2>
              <div className="space-y-3">
                {aiResult.answerSummary.map((entry) => (
                  <div
                    key={entry.questionId}
                    className="rounded-xl bg-c-surface-raised p-3"
                  >
                    <p className="text-xs font-medium text-c-text-muted mb-1">
                      {entry.question}
                    </p>
                    <p className="text-sm text-c-text-secondary">{entry.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Assumptions */}
            <div className="p-6 border-b border-c-border bg-c-surface-raised">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-c-text-muted uppercase tracking-wider">
                  {t('publicAssessment.methodTitle', 'Method notes')}
                </p>
                <p className="text-xs text-c-text-muted italic">
                  {[...aiResult.methodNotes, ...aiResult.assumptions].join(' • ')}
                </p>
              </div>
            </div>

            {/* Action */}
            <div className="p-6">
              <h2 className="text-sm font-semibold text-c-text-secondary mb-4">
                {t('publicAssessment.nextSteps', 'Next action')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => void handleCopyFollowUpBrief()}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-c-accent text-white rounded-xl
                    hover:opacity-90 text-sm font-medium transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {t('publicAssessment.copyBrief', 'Copy Follow-up Interview Brief')}
                </button>
                <button
                  onClick={handleRestart}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-c-accent
                    text-c-accent rounded-xl hover:bg-c-accent-soft text-sm font-medium"
                >
                  {t('publicAssessment.restart', 'Start a New Assessment')}
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-c-text-muted mt-6">Powered by Consultify</p>
        </div>
      </div>
    );
  }

  // Survey state
  return (
    <div className="min-h-screen bg-c-bg" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-c-surface border-b border-c-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-sm font-semibold text-c-text-secondary">
            {t('publicAssessment.title', 'Digital Transformation Readiness Check')}
          </h1>
          <span className="text-xs text-c-text-muted">Consultify</span>
        </div>
      </header>
      <div className="max-w-3xl mx-auto py-6">
        {error && (
          <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div className="mb-4 px-1 text-xs text-c-text-muted">
          {isDraftSaving
            ? t('publicAssessment.savingDraft', 'Saving draft...')
            : t('publicAssessment.draftSaved', 'Draft answers are autosaved before submit.')}
        </div>
        <SurveyShell
          sections={surveySections}
          language={lang}
          initialAnswers={assessmentData?.answers || []}
          focusMode={true}
          estimatedMinutes={assessmentData?.template?.estimatedMinutes || 3}
          onAnswer={handleAnswer}
          onAutosave={handleAutosave}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};
