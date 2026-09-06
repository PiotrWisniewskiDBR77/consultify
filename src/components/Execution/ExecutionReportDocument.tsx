/**
 * Dokument migawki raportu Realizacji — archetyp B (Dokument) wg
 * `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`.
 *
 * Powłoka: pasek powrotu + tożsamość (tytuł, poziom, stan na, okres, RAG) → strefa akcji
 * (Pobierz DOCX / Pobierz PDF / Opublikuj) → treść dokumentu (sekcje). Centrum zmienia się
 * per archetyp; tutaj to ciąg sekcji z narracją, listami i tabelami.
 *
 * Kolor: WYŁĄCZNIE tokeny `c-*`. Czerwień (`c-danger`) tylko dla stanu krytycznego
 * (RAG czerwony / pozycje po terminie) — nigdy jako akcent CTA (pułapka #3 z CLAUDE.md:
 * tailwindowy `primary` w tym repo JEST crimsonem).
 */

import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  downloadExecutionReportFile,
  type ExecutionReportRag,
  type ExecutionReportRunDto,
  publishExecutionReportRun,
} from '@/services/executionReports/executionReportsApi';

interface Props {
  run: ExecutionReportRunDto;
  onBack: () => void;
  onChanged?: (run: ExecutionReportRunDto) => void;
}

const RAG_TONE: Record<ExecutionReportRag, string> = {
  GREEN: 'border-c-border bg-c-surface-raised text-c-text',
  AMBER: 'border-c-warning/50 bg-c-warning/10 text-c-text',
  RED: 'border-c-danger/50 bg-c-danger/10 text-c-text',
  GREY: 'border-dashed border-c-border bg-c-surface text-c-text-muted',
};

const METRIC_TONE: Record<string, string> = {
  CRIT: 'text-c-danger',
  WARN: 'text-c-warning',
  OK: 'text-c-text',
  GREY: 'text-c-text-muted',
  NEUTRAL: 'text-c-text',
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const ExecutionReportDocument = ({ run, onBack, onChanged }: Props) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'docx' | 'pdf' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payload = run.payload;

  const levelLabel = t(`executionReports.level.${run.level}`, run.level);
  const ragLabel = t(`executionReports.ragLabel.${run.rag}`, run.rag);
  const statusLabel =
    run.status === 'PUBLISHED'
      ? t('executionReports.status.published', 'Opublikowany')
      : t('executionReports.status.draft', 'Szkic');

  const download = useCallback(
    async (format: 'docx' | 'pdf') => {
      setBusy(format);
      setError(null);
      try {
        await downloadExecutionReportFile(run.id, format, run.title.replace(/[\\/:*?"<>|]/g, '-'));
      } catch (downloadError) {
        setError(
          downloadError instanceof Error
            ? downloadError.message
            : t('executionReports.error.download', 'Nie udało się pobrać pliku.')
        );
      } finally {
        setBusy(null);
      }
    },
    [run.id, run.title, t]
  );

  const publish = useCallback(async () => {
    setBusy('publish');
    setError(null);
    try {
      const updated = await publishExecutionReportRun(run.id);
      onChanged?.({ ...run, ...updated, payload: run.payload });
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : t('executionReports.error.publish', 'Nie udało się opublikować raportu.')
      );
    } finally {
      setBusy(null);
    }
  }, [onChanged, run, t]);

  return (
    <article
      aria-label={run.title}
      data-testid="execution-report-document"
      className="flex h-full min-h-0 flex-col overflow-auto bg-c-surface p-4 text-c-text"
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-c-text-muted hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('executionReports.back', 'Wróć do rejestru raportów')}
        </button>

        <header className="rounded-xl border border-c-border bg-c-surface-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {levelLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{run.title}</h1>
          {payload?.subtitle && (
            <p className="mt-1 text-sm text-c-text-muted">{payload.subtitle}</p>
          )}
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('executionReports.field.asOf', 'Stan danych na')}
              </dt>
              <dd className="font-medium">{formatDate(run.asOf)}</dd>
            </div>
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('executionReports.field.period', 'Okres')}
              </dt>
              <dd className="font-medium">
                {formatDate(run.period.start)} – {formatDate(run.period.end)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('executionReports.field.status', 'Status')}
              </dt>
              <dd className="font-medium">{statusLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-c-text-muted">
                {t('executionReports.field.author', 'Autor')}
              </dt>
              <dd className="font-medium">{run.createdByName || '—'}</dd>
            </div>
          </dl>
          <p
            data-testid="execution-report-rag"
            className={`mt-3 inline-flex flex-wrap items-baseline gap-2 rounded-lg border px-3 py-2 text-sm ${RAG_TONE[run.rag]}`}
          >
            <span className="font-semibold">
              {t('executionReports.field.rag', 'Ocena RAG')}: {ragLabel}
            </span>
            {payload?.ragReason && <span className="text-c-text-muted">{payload.ragReason}</span>}
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => void download('docx')}
            disabled={busy !== null}
          >
            {busy === 'docx' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
            {t('executionReports.action.downloadDocx', 'Pobierz DOCX')}
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => void download('pdf')}
            disabled={busy !== null}
          >
            {busy === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            {t('executionReports.action.downloadPdf', 'Pobierz PDF')}
          </button>
          {run.status !== 'PUBLISHED' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void publish()}
              disabled={busy !== null}
            >
              {t('executionReports.action.publish', 'Opublikuj')}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-c-danger/50 bg-c-danger/10 p-3 text-sm">
            {error}
          </p>
        )}

        {payload?.metrics?.length ? (
          <section
            aria-label={t('executionReports.section.metrics', 'Mierniki')}
            className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
          >
            {payload.metrics.map((metric) => (
              <div
                key={metric.id}
                className="rounded-xl border border-c-border bg-c-surface-raised p-3"
              >
                <p className="text-xs text-c-text-muted">{metric.label}</p>
                <p
                  className={`mt-1 text-xl font-semibold ${METRIC_TONE[metric.tone ?? 'NEUTRAL'] ?? ''}`}
                >
                  {metric.value}
                </p>
                {metric.hint && <p className="mt-0.5 text-xs text-c-text-muted">{metric.hint}</p>}
              </div>
            ))}
          </section>
        ) : null}

        {(payload?.sections ?? []).map((section) => (
          <section
            key={section.id}
            data-section-id={section.id}
            className="rounded-xl border border-c-border bg-c-surface-raised p-4"
          >
            <h2 className="font-semibold">{section.title}</h2>
            {section.narrative && (
              <p className="mt-2 text-sm leading-relaxed text-c-text">{section.narrative}</p>
            )}
            {section.bullets?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {section.bullets.map((bullet, index) => (
                  <li key={`${section.id}-b${index}`}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.table && section.table.rows.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                {/*
                  §27-exempt — to NIE jest ekran listowy w rozumieniu TRIADY
                  (DOKTRYNA_TABELA_NIE_EXCEL.md, reguła rozstrzygająca): wiersze są
                  ZAMROŻONĄ TREŚCIĄ dokumentu (archetyp B), nie rekordami do
                  filtrowania/otwierania — nie ma kliku w wiersz, kebaba, preview ani
                  sortowania, a ten sam zestaw wierszy trafia 1:1 do DOCX/PDF.
                  `StandardTable` (menu kolumn, persistKey, rowMenu) wprowadziłby tu
                  interakcje, których migawka mieć NIE MOŻE.
                */}
                <table data-canon="§27-exempt" className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-c-border text-left">
                      {section.table.columns.map((column) => (
                        <th
                          key={column.id}
                          scope="col"
                          className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, index) => (
                      <tr key={`${section.id}-r${index}`} className="border-b border-c-border/60">
                        {section.table!.columns.map((column) => (
                          <td key={column.id} className="px-2 py-2 align-top">
                            {row[column.id] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.empty && (
              <p className="mt-2 rounded-lg border border-dashed border-c-border px-3 py-2 text-sm text-c-text-muted">
                {section.empty}
              </p>
            )}
          </section>
        ))}
      </div>
    </article>
  );
};

export default ExecutionReportDocument;
