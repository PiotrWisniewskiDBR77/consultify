/**
 * Consultify Document Studio — QA Panel (MVP-3 hardening).
 *
 * Renders the deterministic Brand QA + Language QA report for the active
 * document. The user triggers the run on demand; results show per-category
 * scores, blocking flag, and a finding list grouped by severity. Findings
 * link back to the section / block they reference so the consultant can
 * navigate quickly to the issue.
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

import { getDocumentStudioQaReport } from './api';
import type {
  DocumentQaCategoryReport,
  DocumentQaFinding,
  DocumentQaReport,
  DocumentQaSeverity,
} from './types';

interface DocumentStudioQaPanelProps {
  artifactId: string;
}

const SEVERITY_STYLES: Record<DocumentQaSeverity, string> = {
  high: 'border-danger-500/40 bg-danger-500/10 text-danger-700 dark:text-danger-300',
  medium:
    'border-amber-400/40 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300',
  low: 'border-c-border-subtle bg-c-surface-raised text-c-text',
};

/**
 * A3 — badge grounding/fabrykacji, addytywny do reszty raportu QA. Sygnał
 * jest JUŻ liczony deterministycznie (documentFabricationCheck) — ten
 * komponent tylko go POKAZUJE. Nie blokuje niczego: informacyjny, tokeny
 * c-* (c-warning dla zdegradowanego stanu; success dla zweryfikowanego).
 * Crimson celowo pominięty — to advisory, twarda blokada ma osobny,
 * czerwony banner przy samym eksporcie (DocumentStudioDocumentPanel).
 */
function FabricationBadge({
  fabrication,
}: {
  fabrication: DocumentQaReport['fabrication'];
}): React.ReactElement | null {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!fabrication) return null;
  const { count, sample } = fabrication;

  if (count === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-success-500/30 bg-success-500/10 px-2.5 py-1.5 text-xs font-medium text-success-700 dark:text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t(
          'documentStudio.qa.fabrication.notDetected',
          'Nie wykryto nieoznaczonych precyzyjnych liczb — ugruntowanie nie zostało zweryfikowane'
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-c-warning/40 bg-c-warning/10 px-2.5 py-1.5 text-xs text-c-text"
      data-testid="document-qa-fabrication-badge"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <span className="flex items-center gap-1.5 font-medium text-c-text">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-c-warning" aria-hidden />
          {t('documentStudio.qa.fabrication.degraded', {
            defaultValue: 'Zdegradowane ({{count}} nieoznaczonych liczb)',
            count,
          })}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-c-text-muted transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2 border-t border-c-warning/20 pt-2">
          {sample.length > 0 ? (
            <ul className="space-y-1 text-c-text-secondary">
              {sample.map((value, i) => (
                <li key={`${value}-${i}`}>
                  <code className="rounded bg-c-surface px-1 py-0.5 text-[11px] text-c-text">
                    {value}
                  </code>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-c-text-muted">
            {t(
              'documentStudio.qa.fabrication.hint',
              'Zweryfikuj te liczby wobec źródeł lub oznacz jako założenie „(założenie)" przed eksportem partnerskim/klientowi.'
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-success-600 dark:text-emerald-400';
  if (score >= 70) return 'text-warning-600 dark:text-amber-400';
  return 'text-danger-600 dark:text-danger-400';
}

function CategoryReportView({
  report,
  categoryLabel,
}: {
  report: DocumentQaCategoryReport;
  categoryLabel: string;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {report.blocking ? (
            <AlertTriangle className="h-4 w-4 text-danger-500" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success-500" aria-hidden />
          )}
          <h4 className="text-sm font-semibold text-c-text">{categoryLabel}</h4>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`text-base font-semibold ${scoreColor(report.score)}`}>
            {report.score}
          </span>
          <span className="text-c-text-secondary">/ 100</span>
          {report.blocking ? (
            <span className="rounded-full bg-danger-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
              {t('documentStudio.qa.blocking', 'blocking')}
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-c-text-secondary">{report.summary}</p>
      {report.findings.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {report.findings.map((finding: DocumentQaFinding) => (
            <li
              key={finding.findingId}
              className={`rounded-md border px-2 py-1.5 text-xs ${SEVERITY_STYLES[finding.severity]}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-block rounded bg-c-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {finding.severity}
                </span>
                <div className="flex-1">
                  <div>{finding.message}</div>
                  {finding.sectionId || finding.blockId ? (
                    <div className="mt-0.5 text-[10px] text-c-text-secondary">
                      {finding.sectionId ? `section: ${finding.sectionId}` : null}
                      {finding.sectionId && finding.blockId ? ' · ' : ''}
                      {finding.blockId ? `block: ${finding.blockId}` : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const DocumentStudioQaPanel: React.FC<DocumentStudioQaPanelProps> = ({ artifactId }) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<DocumentQaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const next = await getDocumentStudioQaReport(artifactId);
      setReport(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('documentStudio.qa.runFailed', 'Failed to run QA')
      );
    } finally {
      setLoading(false);
    }
  };

  const labelForCategory = (category: string): string => {
    if (category === 'brand') return t('documentStudio.qa.brand', 'Brand QA');
    if (category === 'language') return t('documentStudio.qa.language', 'Language QA');
    // Slice E5.6.qa — non-blocking advisory category for unpinned
    // source refs (NFR-17).
    if (category === 'source_drift') return t('documentStudio.qa.sourceDrift', 'Source pinning');
    return category;
  };

  return (
    <section className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {report ? (
            report.anyBlocking ? (
              <ShieldQuestion className="h-4 w-4 text-danger-500" aria-hidden />
            ) : (
              <ShieldCheck className="h-4 w-4 text-success-600" aria-hidden />
            )
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
          )}
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {t('documentStudio.qa.title', 'Quality QA — Brand + Language')}
          </h3>
        </div>
        <Button type="button" size="sm" onClick={handleRun} disabled={loading}>
          <span className="inline-flex items-center gap-1">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {report
              ? t('documentStudio.qa.rerun', 'Rerun QA')
              : t('documentStudio.qa.run', 'Run QA')}
          </span>
        </Button>
      </div>

      {!report && !error && !loading ? (
        <p className="text-xs text-c-text-secondary">
          {t(
            'documentStudio.qa.idleHint',
            'Run a deterministic check for banned phrases, register, language consistency, and density. Results are advisory; the export pipeline soft-blocks when a category goes blocking on documents that require approval.'
          )}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger-400/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}

      {report ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-c-text-secondary">
            <span>
              {t('documentStudio.qa.generatedAt', 'Generated at')}:{' '}
              {new Date(report.generatedAt).toLocaleString()}
            </span>
            {report.anyBlocking ? (
              <span className="rounded-full bg-danger-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
                {t('documentStudio.qa.attention', 'Attention required')}
              </span>
            ) : (
              <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-700 dark:text-emerald-300">
                {t('documentStudio.qa.allClear', 'All clear')}
              </span>
            )}
          </div>
          <FabricationBadge fabrication={report.fabrication} />
          <div className="grid gap-2 md:grid-cols-2">
            {report.categories.map((cat) => (
              <CategoryReportView
                key={cat.category}
                report={cat}
                categoryLabel={labelForCategory(cat.category)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default DocumentStudioQaPanel;
