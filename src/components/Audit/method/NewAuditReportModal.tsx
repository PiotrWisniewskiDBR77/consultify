/**
 * NewAuditReportModal — cel CTA „Nowy raport" zakładki Raporty (DEC-417d,
 * 1.1-A2).
 *
 * ZMIERZONY PRODUCENT (nie nowy generator): raport poaudytowy powstaje przez
 * `POST /api/audits/reports` (`server/src/routes/audits/reports.routes.ts:184`
 * → `reportService.generateReport`), wołane z frontu przez
 * `auditsMethodApi.generateReport`. Do tej pory jedynym wejściem był kebab
 * wiersza na zakładce Wyniki („Generuj raport audytu"/„Generuj raport
 * naprawczy") — ta sama funkcja, zero drugiej ścieżki do serwera.
 *
 * Anatomia 1:1 z „Nowy raport" w Narzędziach i Wynikach: ŹRÓDŁO → TYP →
 * GENERUJ. Źródłem jest AKTUALNY wynik audytu (serwer odmawia raportu z
 * wyniku zastąpionego), typ to `audit_report` albo `remediation_progress`.
 *
 * DEC-417e (1.1-A4): zakładka „Wyniki" zniknęła z Menu 2 na rzecz „Wniosków",
 * więc pusty stan nie odsyła już do nieistniejącej zakładki — prowadzi wprost
 * do finalizacji sesji („Nowy wynik", `POST /audits/outputs/finalize`), czyli
 * jedynego producenta Outputu.
 */
import { Package } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/primitives/Button';
import { Modal } from '@/components/ui/primitives/Modal';
import { formatListDate } from '@/utils/listDateFormat';

import {
  generateReport,
  listOutputs,
  type AuditOutputSummary,
  type AuditReportSummary,
} from './auditsMethodApi';

export interface NewAuditReportModalProps {
  open: boolean;
  onClose: () => void;
  isPolish: boolean;
  /** `programId` → nazwa sesji (Hub już ma `listPrograms`). */
  programNameById?: Map<string, string>;
  /**
   * Pusty stan (żadnego aktualnego wyniku): DEC-417e zdjęło zakładkę „Wyniki"
   * z Menu 2, więc kieruje TU — do jawnej finalizacji sesji audytowej, czyli
   * jedynego producenta Outputu (`POST /audits/outputs/finalize`).
   */
  onFinalizeSession: () => void;
  onGenerated: (report: AuditReportSummary) => void;
}

const EMPTY_MAP = new Map<string, string>();

type ReportKind = 'audit_report' | 'remediation_progress';

export const NewAuditReportModal: React.FC<NewAuditReportModalProps> = ({
  open,
  onClose,
  isPolish,
  programNameById = EMPTY_MAP,
  onFinalizeSession,
  onGenerated,
}) => {
  const [outputs, setOutputs] = useState<AuditOutputSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [reportKind, setReportKind] = useState<ReportKind>('audit_report');
  const [asOfDate, setAsOfDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    listOutputs()
      .then((result) => setOutputs(result.items.filter((o) => !o.supersededBy)))
      .catch((e: any) =>
        setLoadError(
          e?.message || (isPolish ? 'Nie udało się wczytać wyników.' : 'Failed to load outputs.')
        )
      )
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    if (!open) return;
    setSelectedId('');
    setReportKind('audit_report');
    setAsOfDate('');
    setError(null);
    load();
  }, [open, load]);

  const run = async () => {
    const source = outputs.find((o) => o.id === selectedId);
    if (!source || busy) return;
    setBusy(true);
    setError(null);
    try {
      const report = await generateReport({
        programId: source.programId,
        outputId: source.id,
        reportKind,
        ...(reportKind === 'remediation_progress' && asOfDate ? { asOfDate } : {}),
      });
      onGenerated(report);
      onClose();
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
          e?.message ||
          (isPolish ? 'Nie udało się wygenerować raportu.' : 'Could not generate the report.')
      );
    } finally {
      setBusy(false);
    }
  };

  const isEmpty = !loading && !loadError && outputs.length === 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={isPolish ? 'Nowy raport' : 'New report'}
      description={
        isPolish
          ? 'Raport poaudytowy powstaje z zatwierdzonego wyniku audytu. Wybierz źródło i typ raportu.'
          : 'A post-audit report is generated from an approved audit output. Pick the source and the report type.'
      }
      size="md"
      footer={
        isEmpty ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {isPolish ? 'Zamknij' : 'Close'}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onFinalizeSession();
              }}
              data-testid="audits-new-report-finalize-session"
            >
              {isPolish ? 'Sfinalizuj sesję' : 'Finalize a session'}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {isPolish ? 'Anuluj' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!selectedId || busy}
              onClick={() => void run()}
              data-testid="audits-new-report-generate"
            >
              {isPolish ? 'Generuj' : 'Generate'}
            </Button>
          </div>
        )
      }
    >
      {loading ? (
        <p className="text-sm text-c-text-secondary">
          {isPolish ? 'Wczytywanie wyników…' : 'Loading outputs…'}
        </p>
      ) : loadError ? (
        <p className="text-sm text-c-danger" role="alert">
          {loadError}
        </p>
      ) : isEmpty ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised p-4">
          <Package size={18} className="text-c-text-muted" aria-hidden="true" />
          <p className="text-sm text-c-text-secondary">
            {isPolish
              ? 'Nie ma jeszcze żadnego aktualnego wyniku audytu. Wynik powstaje przez jawną finalizację sesji audytowej — przycisk „Sfinalizuj sesję” niżej.'
              : 'There is no current audit output yet. An output is created by an explicit audit-session finalization — use “Finalize a session” below.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-c-text-secondary">
              {isPolish ? 'Źródło — wynik audytu' : 'Source — audit output'}
            </span>
            <div
              role="listbox"
              aria-label={isPolish ? 'Wyniki audytu' : 'Audit outputs'}
              className="max-h-[35vh] overflow-auto rounded-xl border border-c-border-subtle"
            >
              {outputs.map((output) => {
                const isSelected = output.id === selectedId;
                return (
                  <button
                    key={output.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedId(output.id)}
                    className={`flex w-full items-start gap-3 border-b border-c-border-subtle px-3 py-2 text-left last:border-b-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                      isSelected ? 'bg-c-surface-raised' : 'hover:bg-c-surface-raised'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-c-text">{output.title}</div>
                      <div className="truncate text-xs text-c-text-muted">
                        {programNameById.get(output.programId) || output.programName || '—'}
                        {` · v${output.version} · ${formatListDate(output.finalizedAt)}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium text-c-text-secondary">
              {isPolish ? 'Typ raportu' : 'Report type'}
            </legend>
            {(
              [
                {
                  id: 'audit_report' as ReportKind,
                  label: isPolish ? 'Raport audytu' : 'Audit report',
                },
                {
                  id: 'remediation_progress' as ReportKind,
                  label: isPolish ? 'Postęp naprawy' : 'Remediation progress',
                },
              ]
            ).map((kind) => (
              <label
                key={kind.id}
                className="flex items-center gap-2 text-sm text-c-text"
                data-testid={`audits-new-report-kind-${kind.id}`}
              >
                <input
                  type="radio"
                  name="audit-report-kind"
                  value={kind.id}
                  checked={reportKind === kind.id}
                  onChange={() => setReportKind(kind.id)}
                  className="accent-c-focus-solid"
                />
                <span>{kind.label}</span>
              </label>
            ))}
          </fieldset>

          {reportKind === 'remediation_progress' ? (
            <label className="flex flex-col gap-1.5 text-sm text-c-text">
              <span className="text-xs font-medium text-c-text-secondary">
                {isPolish ? 'Stan na dzień (opcjonalnie)' : 'As-of date (optional)'}
              </span>
              <input
                type="date"
                value={asOfDate}
                onChange={(event) => setAsOfDate(event.target.value)}
                disabled={busy}
                className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
          ) : null}

          {error ? (
            <p className="text-xs text-c-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default NewAuditReportModal;
