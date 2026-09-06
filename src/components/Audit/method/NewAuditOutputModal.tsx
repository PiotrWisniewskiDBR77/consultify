/**
 * NewAuditOutputModal — cel CTA „Nowy wynik" zakładki Wyniki (DEC-417d,
 * 1.1-A2).
 *
 * ZMIERZONY PRODUCENT (nie nowy generator): wynik audytu powstaje WYŁĄCZNIE
 * przez jawną finalizację sesji audytowej —
 * `POST /api/audits/outputs/finalize`
 * (`server/src/routes/audits/outputs.routes.ts:64` →
 * `outputService.finalizeOutput`), wołane z frontu przez
 * `auditsMethodApi.finalizeOutput` (ta sama funkcja, której używa
 * „Sfinalizuj Output" w podglądzie sesji na zakładce Sesje — zero drugiej
 * ścieżki do serwera).
 *
 * Anatomia 1:1 z „Nowy raport" w Narzędziach/Wynikach: ŹRÓDŁO → GENERUJ.
 * Źródłem jest sesja audytowa; stan pusty mówi prawdę (żadnej sesji nie ma —
 * idź na Sesje), zamiast obiecywać „Wkrótce".
 */
import { ClipboardList } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/primitives/Button';
import { Modal } from '@/components/ui/primitives/Modal';
import { formatListDate } from '@/utils/listDateFormat';

import { programLifecycleLabel } from './auditStatusTones';
import { finalizeOutput, type AuditOutputSummary, type AuditProgramSummary } from './auditsMethodApi';

export interface NewAuditOutputModalProps {
  open: boolean;
  onClose: () => void;
  /** Sesje audytowe wczytane przez Hub (`listPrograms`) — bez drugiego pobrania. */
  programs: AuditProgramSummary[];
  isPolish: boolean;
  /** Nawigacja do zakładki Sesje ze stanu pustego. */
  onGoToSessions: () => void;
  onFinalized: (output: AuditOutputSummary) => void;
}

export const NewAuditOutputModal: React.FC<NewAuditOutputModalProps> = ({
  open,
  onClose,
  programs,
  isPolish,
  onGoToSessions,
  onFinalized,
}) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedId('');
      setError(null);
    }
  }, [open]);

  const run = async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const output = await finalizeOutput(selectedId);
      onFinalized(output);
      onClose();
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;
      setError(
        status === 403
          ? isPolish
            ? 'Brak wymaganego uprawnienia: output.finalize.'
            : 'Missing required permission: output.finalize.'
          : e?.response?.data?.error ||
              e?.message ||
              (isPolish ? 'Nie udało się sfinalizować wyniku.' : 'Could not finalize the output.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={isPolish ? 'Nowy wynik' : 'New output'}
      description={
        isPolish
          ? 'Wynik audytu powstaje przez finalizację sesji audytowej. Wybierz sesję, którą chcesz zamknąć wynikiem.'
          : 'An audit output is created by finalizing an audit session. Pick the session to close with an output.'
      }
      size="md"
      footer={
        programs.length === 0 ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {isPolish ? 'Zamknij' : 'Close'}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onGoToSessions();
              }}
              data-testid="audits-new-output-go-sessions"
            >
              {isPolish ? 'Przejdź do Sesji' : 'Go to Sessions'}
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
              data-testid="audits-new-output-generate"
            >
              {isPolish ? 'Generuj' : 'Generate'}
            </Button>
          </div>
        )
      }
    >
      {programs.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised p-4">
          <ClipboardList size={18} className="text-c-text-muted" aria-hidden="true" />
          <p className="text-sm text-c-text-secondary">
            {isPolish
              ? 'Nie ma jeszcze żadnej sesji audytowej, którą można sfinalizować. Sesja powstaje z pakietu na zakładce Biblioteka i prowadzi się ją na zakładce Sesje.'
              : 'There is no audit session to finalize yet. A session starts from a pack on the Library tab and is run on the Sessions tab.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-c-text-secondary">
            {isPolish ? 'Źródło — sesja audytowa' : 'Source — audit session'}
          </span>
          <div
            role="listbox"
            aria-label={isPolish ? 'Sesje audytowe' : 'Audit sessions'}
            className="max-h-[45vh] overflow-auto rounded-xl border border-c-border-subtle"
          >
            {programs.map((program) => {
              const isSelected = program.id === selectedId;
              return (
                <button
                  key={program.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(program.id)}
                  className={`flex w-full items-start gap-3 border-b border-c-border-subtle px-3 py-2 text-left last:border-b-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    isSelected ? 'bg-c-surface-raised' : 'hover:bg-c-surface-raised'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-c-text">{program.name}</div>
                    <div className="truncate text-xs text-c-text-muted">
                      {programLifecycleLabel(program.lifecycleState, isPolish)}
                      {program.updatedAt ? ` · ${formatListDate(program.updatedAt)}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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

export default NewAuditOutputModal;
