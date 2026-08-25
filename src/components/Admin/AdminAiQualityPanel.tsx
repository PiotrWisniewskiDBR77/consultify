import { Activity, MessageSquareText, Sparkles } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  getAiQualityAnalytics,
  getAiQualityFeedback,
  getAiQualityMetrics,
  getAiQualityPatterns,
  reviewAiQualityFeedback,
  updateAiQualityPatternStatus,
  type AiFeedback,
  type AiLearningPattern,
  type AiQualityMetrics,
} from '../../services/adminAiQualityApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';

const actionClass =
  'rounded-lg border border-c-border px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)] disabled:opacity-50';

export const AdminAiQualityPanel: React.FC = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<AiQualityMetrics | null>(null);
  const [feedback, setFeedback] = useState<AiFeedback[]>([]);
  const [patterns, setPatterns] = useState<AiLearningPattern[]>([]);
  const [analytics, setAnalytics] = useState({ contexts: 0, formats: 0, issues: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMetrics, nextFeedback, nextPatterns, nextAnalytics] = await Promise.all([
        getAiQualityMetrics(),
        getAiQualityFeedback(),
        getAiQualityPatterns(),
        getAiQualityAnalytics(),
      ]);
      setMetrics(nextMetrics);
      setFeedback(nextFeedback);
      setPatterns(nextPatterns);
      setAnalytics({
        contexts: nextAnalytics.contexts.length,
        formats: nextAnalytics.formats.length,
        issues: nextAnalytics.issues.length,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.aiQuality.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);
  React.useEffect(() => void load(), [load]);

  const review = async (item: AiFeedback) => {
    setBusy(item.id);
    try {
      await reviewAiQualityFeedback(item.id);
      const readback = await getAiQualityFeedback();
      const confirmed = readback.find((candidate) => candidate.id === item.id);
      if (!confirmed?.reviewed_at)
        throw new Error(
          t('admin.aiQuality.errors.reviewReadback', 'Serwer nie potwierdził przeglądu.')
        );
      setFeedback(readback);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('admin.aiQuality.errors.review'));
    } finally {
      setBusy(null);
    }
  };

  const updatePattern = async (item: AiLearningPattern, status: 'applied' | 'rejected') => {
    setBusy(item.id);
    try {
      await updateAiQualityPatternStatus(item.id, status);
      const readback = await getAiQualityPatterns();
      if (readback.find((candidate) => candidate.id === item.id)?.status !== status)
        throw new Error(
          t('admin.aiQuality.errors.patternReadback', 'Serwer nie potwierdził statusu.')
        );
      setPatterns(readback);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('admin.aiQuality.errors.pattern'));
    } finally {
      setBusy(null);
    }
  };

  const feedbackColumns = useMemo<TableColumn[]>(
    () => [
      { id: 'user_name', label: t('admin.aiQuality.feedback.user', 'Użytkownik') },
      { id: 'screen_context', label: t('admin.aiQuality.feedback.context', 'Kontekst') },
      { id: 'feedback_type', label: t('admin.aiQuality.feedback.type', 'Ocena') },
      {
        id: 'reviewed_at',
        label: t('admin.aiQuality.feedback.review', 'Przegląd'),
        render: (row) =>
          row.reviewed_at ? (
            t('admin.aiQuality.feedback.reviewed', 'Przejrzane')
          ) : (
            <button
              className={actionClass}
              disabled={busy === row.id}
              onClick={() => void review(row as unknown as AiFeedback)}
            >
              {t('admin.aiQuality.feedback.markReviewed', 'Oznacz jako przejrzane')}
            </button>
          ),
      },
    ],
    [busy, t]
  );
  const patternColumns = useMemo<TableColumn[]>(
    () => [
      { id: 'pattern_type', label: t('admin.aiQuality.pattern.type', 'Typ') },
      { id: 'pattern_value', label: t('admin.aiQuality.pattern.value', 'Wzorzec') },
      { id: 'confidence_score', label: t('admin.aiQuality.pattern.confidence', 'Pewność') },
      { id: 'status', label: t('admin.aiQuality.pattern.status', 'Status') },
      {
        id: 'actions',
        label: t('admin.aiQuality.pattern.actions', 'Akcje'),
        render: (row) => (
          <span className="flex gap-2">
            <button
              className={actionClass}
              disabled={busy === row.id}
              onClick={() => void updatePattern(row as unknown as AiLearningPattern, 'applied')}
            >
              {t('admin.aiQuality.pattern.apply', 'Zastosuj')}
            </button>
            <button
              className={actionClass}
              disabled={busy === row.id}
              onClick={() => void updatePattern(row as unknown as AiLearningPattern, 'rejected')}
            >
              {t('admin.aiQuality.pattern.reject', 'Odrzuć')}
            </button>
          </span>
        ),
      },
    ],
    [busy, t]
  );

  if (error)
    return (
      <section
        role="alert"
        className="rounded-2xl border border-c-danger bg-c-surface p-5 text-c-text"
      >
        <p>{error}</p>
        <button className={`${actionClass} mt-3`} onClick={() => void load()}>
          {t('common.retry', 'Spróbuj ponownie')}
        </button>
      </section>
    );

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.aiQuality.title', 'Ewaluacje jakości AI')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t(
            'admin.aiQuality.description',
            'Rzeczywisty feedback, wzorce uczenia i analityka organizacji.'
          )}
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            'satisfaction',
            t('admin.aiQuality.metrics.satisfaction', 'Satysfakcja'),
            metrics?.satisfactionRate == null ? '—' : `${metrics.satisfactionRate}%`,
          ],
          ['total', t('admin.aiQuality.metrics.total', 'Feedback'), metrics?.totalFeedback ?? 0],
          [
            'patterns',
            t('admin.aiQuality.metrics.patterns', 'Aktywne wzorce'),
            metrics?.activePatternsCount ?? 0,
          ],
          [
            'profiles',
            t('admin.aiQuality.metrics.profiles', 'Profile stylu'),
            metrics?.userProfilesCount ?? 0,
          ],
        ].map(([id, label, value]) => (
          <section key={String(id)} className="rounded-2xl border border-c-border bg-c-surface p-4">
            <p className="text-xs text-c-text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-c-text">{value}</p>
          </section>
        ))}
      </div>
      <section className="rounded-2xl border border-c-border bg-c-surface p-2">
        <h3 className="p-3 font-semibold text-c-text">
          <MessageSquareText className="mr-2 inline h-4 w-4" />
          {t('admin.aiQuality.feedback.title', 'Feedback')}
        </h3>
        <StandardTable
          columns={feedbackColumns}
          data={feedback as TableRow[]}
          loading={loading}
          error={null}
          empty={{
            icon: MessageSquareText,
            title: t('admin.aiQuality.feedback.empty', 'Brak feedbacku'),
            description: t(
              'admin.aiQuality.feedback.emptyDescription',
              'Nie zebrano jeszcze ocen odpowiedzi AI.'
            ),
          }}
          persistKey="admin.aiQuality.feedback"
        />
      </section>
      <section className="rounded-2xl border border-c-border bg-c-surface p-2">
        <h3 className="p-3 font-semibold text-c-text">
          <Sparkles className="mr-2 inline h-4 w-4" />
          {t('admin.aiQuality.pattern.title', 'Wzorce uczenia')}
        </h3>
        <StandardTable
          columns={patternColumns}
          data={patterns as TableRow[]}
          loading={loading}
          error={null}
          empty={{
            icon: Sparkles,
            title: t('admin.aiQuality.pattern.empty', 'Brak wzorców'),
            description: t(
              'admin.aiQuality.pattern.emptyDescription',
              'Nie wykryto jeszcze wzorców uczenia.'
            ),
          }}
          persistKey="admin.aiQuality.patterns"
        />
      </section>
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h3 className="font-semibold text-c-text">
          <Activity className="mr-2 inline h-4 w-4" />
          {t('admin.aiQuality.analytics.title', 'Analityka')}
        </h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-c-text-muted">
              {t('admin.aiQuality.analytics.contexts', 'Konteksty')}
            </dt>
            <dd className="text-xl text-c-text">{analytics.contexts}</dd>
          </div>
          <div>
            <dt className="text-xs text-c-text-muted">
              {t('admin.aiQuality.analytics.formats', 'Formaty')}
            </dt>
            <dd className="text-xl text-c-text">{analytics.formats}</dd>
          </div>
          <div>
            <dt className="text-xs text-c-text-muted">
              {t('admin.aiQuality.analytics.issues', 'Problemy')}
            </dt>
            <dd className="text-xl text-c-text">{analytics.issues}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
};

export default AdminAiQualityPanel;
