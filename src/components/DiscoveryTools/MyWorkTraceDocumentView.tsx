/**
 * Odbiór na żywo 05.09 (04-narzędzia, defekt 5): 29 sesji ze statusem
 * „Zatwierdzone" (100%, nazwy „MyWork idea: …") otwierało ANGIELSKI widok
 * awaryjny z surowym JSON-em („Why you saw the placeholder — This session uses
 * a tool type that doesn't have a dedicated UI yet").
 *
 * Zmierzona przyczyna (server/src/routes/my-work.routes.ts:782
 * `createMyWorkToolSession`): konwersja pomysłu/notatki w Mojej Pracy na
 * inicjatywę/zadanie/decyzję zapisuje wiersz `tool_sessions` z
 * `tool_type = 'MYWORK'`, `status = 'APPROVED'`, `completion_percent = 100`
 * i `name = "MyWork idea: <tytuł>"`. To NIE jest sesja narzędzia — to ŚLAD
 * POCHODZENIA (traceability), materializowany po to, żeby inicjatywa miała
 * udokumentowane źródło. Warsztatu nie ma i mieć nie powinien.
 *
 * `MYWORK` nie jest w DEDICATED_TOOL_TYPES, więc hub spadał na
 * GenericToolDocumentView — angielski zrzut JSON-a. Ten ekran pokazuje
 * zamiast tego czytelny polski stan złożony z tych samych, prawdziwych
 * danych (`answers.origin/source/summary`), bez atrap.
 */
import { ArrowLeft, ExternalLink, Lightbulb, NotebookPen, Route } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';

export type MyWorkTraceSource = {
  type?: string | null;
  id?: string | null;
};

export type MyWorkTracePayload = {
  origin?: string | null;
  source?: MyWorkTraceSource | null;
  summary?: string | null;
};

type MyWorkTraceDocumentViewProps = {
  sessionId: string;
  title?: string;
  onBack: () => void;
};

const SOURCE_LABEL: Record<string, string> = {
  idea: 'Pomysł',
  notebook: 'Notatnik',
};

/** Deep link do źródła. Notatnik nie ma trasy per strona — prowadzimy do modułu. */
export function myWorkSourceHref(source: MyWorkTraceSource | null | undefined): string | null {
  const type = String(source?.type || '')
    .trim()
    .toLowerCase();
  const id = String(source?.id || '').trim();
  if (type === 'idea' && id) return `/my-work/ideas/${encodeURIComponent(id)}`;
  if (type === 'notebook') return '/my-work/notebook';
  return null;
}

/** Wyciąga ślad z odpowiedzi API — `answers`, a jak pusto, to `contextSnapshot`. */
export function readMyWorkTrace(session: unknown): MyWorkTracePayload {
  const s = (session || {}) as Record<string, unknown>;
  const answers = (s.answers || {}) as MyWorkTracePayload;
  const snapshot = (s.contextSnapshot || {}) as MyWorkTracePayload;
  const source = answers?.source?.id ? answers.source : snapshot?.source;
  return {
    origin: answers?.origin || snapshot?.origin || null,
    source: source || null,
    summary: answers?.summary || snapshot?.summary || null,
  };
}

export const MyWorkTraceDocumentView: React.FC<MyWorkTraceDocumentViewProps> = ({
  sessionId,
  title,
  onBack,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await Api.getToolSession(sessionId);
        if (!mounted) return;
        setSession(data);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Nie udało się wczytać śladu pochodzenia');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const trace = useMemo(() => readMyWorkTrace(session), [session]);
  const sourceType = String(trace.source?.type || '')
    .trim()
    .toLowerCase();
  const sourceLabel = SOURCE_LABEL[sourceType] || 'Moja Praca';
  const href = myWorkSourceHref(trace.source);
  const heading = title || String((session as { name?: string } | null)?.name || 'Ślad pochodzenia');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState variant="spinner" label="Wczytywanie śladu pochodzenia…" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" data-testid="mywork-trace-document-view">
      <div className="p-6 max-w-[900px] mx-auto">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-c-text-secondary hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)] rounded"
        >
          <ArrowLeft size={16} />
          Wróć do listy
        </button>

        <div className="mt-4 flex items-start gap-3">
          <span className="mt-1 text-c-text-muted">
            {sourceType === 'notebook' ? <NotebookPen size={20} /> : <Lightbulb size={20} />}
          </span>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.14em] text-c-text-muted">
              Ślad pochodzenia · {sourceLabel}
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-c-text truncate">{heading}</h1>
          </div>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-c-text-secondary" data-testid="mywork-trace-error">
            {error}
          </p>
        ) : null}

        <section className="mt-6 rounded-xl border border-c-border bg-c-surface p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-c-text-muted">
              <Route size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-c-text">Czym jest ten wpis</h2>
              <p className="mt-1.5 text-sm text-c-text-secondary leading-relaxed">
                To nie jest sesja narzędzia i nie ma warsztatu. Ten wpis powstał automatycznie,
                gdy {sourceLabel.toLowerCase()} z Mojej Pracy został przekształcony w inicjatywę,
                zadanie lub decyzję — po to, żeby ten obiekt miał udokumentowane źródło. Pracę
                prowadzi się w źródle albo w obiekcie, który z niego powstał.
              </p>
            </div>
          </div>
        </section>

        {trace.summary ? (
          <section className="mt-4 rounded-xl border border-c-border bg-c-surface p-5">
            <h2 className="text-sm font-semibold text-c-text">Streszczenie źródła</h2>
            <p
              className="mt-2 text-sm text-c-text-secondary whitespace-pre-wrap"
              data-testid="mywork-trace-summary"
            >
              {trace.summary}
            </p>
          </section>
        ) : null}

        <section className="mt-4 rounded-xl border border-c-border bg-c-surface p-5">
          <h2 className="text-sm font-semibold text-c-text">Źródło</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-c-text-muted">Rodzaj</dt>
              <dd className="text-c-text-secondary">{sourceLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-c-text-muted">Identyfikator</dt>
              <dd className="font-mono text-xs text-c-text-secondary">
                {trace.source?.id || '—'}
              </dd>
            </div>
          </dl>
          {href ? (
            <a
              href={href}
              data-testid="mywork-trace-source-link"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
            >
              <ExternalLink size={16} />
              Otwórz źródło w Mojej Pracy
            </a>
          ) : (
            <p className="mt-4 text-sm text-c-text-muted">
              Ten wpis nie niesie identyfikatora źródła — nie ma dokąd przejść.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyWorkTraceDocumentView;
