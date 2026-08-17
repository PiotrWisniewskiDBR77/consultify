import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  PublicInterviewApiError,
  type PublicInterviewSnapshot,
  publicInterviewApi,
} from '@/services/api/publicInterview';

const copy = {
  en: {
    complete: 'Submit interview',
    completed: 'Thank you. Your answers were submitted.',
    conflict: 'This answer changed elsewhere. Reload the latest version and try again.',
    error: 'We could not load this interview.',
    expired: 'This interview link expired or was revoked.',
    heading: 'Interview',
    loading: 'Loading interview…',
    required: 'Required',
    retry: 'Try again',
    save: 'Save answer',
    saved: 'Answer saved',
    saving: 'Saving…',
  },
  pl: {
    complete: 'Wyślij wywiad',
    completed: 'Dziękujemy. Odpowiedzi zostały wysłane.',
    conflict: 'Odpowiedź zmieniła się w innym miejscu. Wczytaj aktualną wersję i spróbuj ponownie.',
    error: 'Nie udało się wczytać wywiadu.',
    expired: 'Ten link wygasł albo został cofnięty.',
    heading: 'Wywiad',
    loading: 'Ładowanie wywiadu…',
    required: 'Wymagane',
    retry: 'Spróbuj ponownie',
    save: 'Zapisz odpowiedź',
    saved: 'Odpowiedź zapisana',
    saving: 'Zapisywanie…',
  },
} as const;

function idempotencyKey(questionId: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `respondent-${questionId}-${uuid}`;
}

export const PublicInterviewRespondentView: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const { i18n } = useTranslation();
  const text = copy[i18n.resolvedLanguage?.startsWith('pl') ? 'pl' : 'en'];
  const [snapshot, setSnapshot] = React.useState<PublicInterviewSnapshot | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<{ code: string; status: number } | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const pendingKeys = React.useRef(new Map<string, { answerText: string; key: string }>());

  const load = React.useCallback(async () => {
    setError(null);
    setSnapshot(null);
    try {
      const next = await publicInterviewApi.load(token);
      pendingKeys.current.clear();
      setSnapshot(next);
      setCompleted(next.status === 'completed');
      setDrafts(Object.fromEntries(next.questions.map((q) => [q.id, q.answerText ?? ''])));
    } catch (cause) {
      const apiError = cause instanceof PublicInterviewApiError ? cause : null;
      setError({ code: apiError?.code ?? 'REQUEST_FAILED', status: apiError?.status ?? 500 });
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (questionId: string) => {
    const question = snapshot?.questions.find((item) => item.id === questionId);
    if (!question) return;
    setBusyId(questionId);
    setSavedId(null);
    setError(null);
    const answerText = drafts[questionId] ?? '';
    const pending = pendingKeys.current.get(questionId);
    const key = pending?.answerText === answerText ? pending.key : idempotencyKey(questionId);
    pendingKeys.current.set(questionId, { answerText, key });
    try {
      const result = await publicInterviewApi.answer(token, questionId, {
        answerText,
        contextNote: question.contextNote,
        expectedUpdatedAt: question.updatedAt,
        idempotencyKey: key,
      });
      setSnapshot((current) =>
        current
          ? {
              ...current,
              questions: current.questions.map((item) =>
                item.id === questionId ? { ...item, answerText, updatedAt: result.updatedAt } : item
              ),
            }
          : current
      );
      pendingKeys.current.delete(questionId);
      setSavedId(questionId);
    } catch (cause) {
      const apiError = cause instanceof PublicInterviewApiError ? cause : null;
      setError({ code: apiError?.code ?? 'REQUEST_FAILED', status: apiError?.status ?? 500 });
    } finally {
      setBusyId(null);
    }
  };

  const complete = async () => {
    setBusyId('complete');
    setError(null);
    try {
      await publicInterviewApi.complete(token);
      setCompleted(true);
    } catch (cause) {
      const apiError = cause instanceof PublicInterviewApiError ? cause : null;
      setError({ code: apiError?.code ?? 'REQUEST_FAILED', status: apiError?.status ?? 500 });
    } finally {
      setBusyId(null);
    }
  };

  if (!snapshot && !error)
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
        <p role="status" className="flex gap-2 text-slate-700 dark:text-slate-200">
          <Loader2 className="animate-spin" aria-hidden />
          {text.loading}
        </p>
      </main>
    );
  if (!snapshot && error) {
    const terminal = error.status === 404 || error.status === 410;
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <section className="max-w-lg rounded-xl bg-white p-8 shadow dark:bg-slate-900">
          <AlertCircle className="mb-4 text-red-600" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
            {terminal ? text.expired : text.error}
          </h1>
          {!terminal && (
            <button
              className="mt-6 rounded bg-indigo-600 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onClick={() => void load()}
            >
              {text.retry}
            </button>
          )}
        </section>
      </main>
    );
  }
  if (!snapshot) return null;
  if (completed)
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <section className="max-w-lg rounded-xl bg-white p-8 text-center shadow dark:bg-slate-900">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-600" aria-hidden />
          <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{text.completed}</h1>
        </section>
      </main>
    );

  const hasUnsavedAnswers = snapshot.questions.some(
    (question) => (drafts[question.id] ?? '') !== (question.answerText ?? '')
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-8">
      <section className="mx-auto max-w-2xl rounded-xl bg-white p-5 shadow dark:bg-slate-900 sm:p-8">
        <h1 className="mb-8 text-2xl font-semibold text-slate-950 dark:text-white">
          {text.heading}
        </h1>
        {error && (
          <div
            role="alert"
            className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100"
          >
            {error.status === 409 ? text.conflict : text.error}{' '}
            <button className="ml-2 underline" onClick={() => void load()}>
              {text.retry}
            </button>
          </div>
        )}
        <div className="space-y-8">
          {snapshot.questions.map((question, index) => (
            <div key={question.id}>
              <label
                htmlFor={`answer-${question.id}`}
                className="mb-2 block font-medium text-slate-900 dark:text-white"
              >
                {index + 1}. {question.questionText}{' '}
                {question.isRequired && <span className="text-red-600">({text.required})</span>}
              </label>
              <textarea
                id={`answer-${question.id}`}
                autoFocus={index === 0}
                rows={5}
                required={question.isRequired}
                value={drafts[question.id] ?? ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                }
                className="w-full rounded border border-slate-300 bg-white p-3 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  disabled={
                    busyId !== null || (question.isRequired && !(drafts[question.id] ?? '').trim())
                  }
                  onClick={() => void save(question.id)}
                  className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {busyId === question.id ? text.saving : text.save}
                </button>
                {savedId === question.id && (
                  <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
                    {text.saved}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          disabled={
            busyId !== null ||
            hasUnsavedAnswers ||
            snapshot.questions.some((q) => q.isRequired && !(drafts[q.id] ?? '').trim())
          }
          onClick={() => void complete()}
          className="mt-10 w-full rounded bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {busyId === 'complete' ? text.saving : text.complete}
        </button>
      </section>
    </main>
  );
};

export default PublicInterviewRespondentView;
