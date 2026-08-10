/**
 * CaseIntakeConfirmCard — R4-P1: karta potwierdzenia zlecenia (Case) w
 * strumieniu czatu Teresy.
 *
 * "Oto dokładnie to, co zrozumiałam, że chcesz — Potwierdź, żeby powstało
 * zlecenie." Woła WYŁĄCZNIE `src/components/CaseWorkspace/apiIntake.ts`
 * (nowe trasy `/api/v10/teresa/case-intake/...`, patrz nagłówek tamtego
 * pliku) — nie duplikuje żadnej logiki komendy.
 *
 * KANON, egzekwowany przez backend, nie przez ten komponent:
 *  · Ta karta renderuje się TYLKO gdy backend już PROPONOWAŁ work order
 *    (CW-CANON-01 — sama obecność karty niczego nie tworzy).
 *  · "Potwierdź" wysyła WYŁĄCZNIE `workOrderDigest` z propsów — nigdy
 *    przebudowanej treści (patrz `apiIntake.confirmConversationWorkOrder`).
 *  · Digest może się przeterminować (`intake_work_order_digest_stale`, 409) —
 *    ktoś zmienił zlecenie między pokazaniem a kliknięciem. Ta karta NIE
 *    próbuje cicho potwierdzić nowej wersji: pokazuje jawny stan "zlecenie
 *    się zmieniło" i wymaga świeżego odczytu, zanim można kliknąć ponownie.
 *  · Podwójny klik / retry po utracie odpowiedzi = TEN SAM Case (201 raz,
 *    200 przy każdym kolejnym) — obsłużone przez `busy` + backend, nie przez
 *    blokadę w tym komponencie.
 *
 * ★ CO ZOSTAJE PARTIAL (opisane też w raporcie zadania): ta karta nie ma
 * dziś ŻADNEGO produkcyjnego wywołującego. Żaden krok w
 * `MessageRenderer.tsx`/`UnifiedChatPanel.tsx` nie ustawia
 * `msg.metadata.type === 'case_intake_proposal'` — ta karta jest gotowa do
 * wpięcia (identyczny wzorzec co `table_proposal` → `ChatTableProposalCard`,
 * `MessageRenderer.tsx:814`), ale nic po stronie orkiestracji czatu jeszcze
 * jej nie emituje. To wymaga zmiany w miejscu, które SKŁADA odpowiedź
 * asystenta (poza allowlistem tego pakietu — `AIChat/**` dotyczy WYŁĄCZNIE
 * przycisku/karty potwierdzenia, nie przebudowy czatu).
 */
import { AlertTriangle, Check, ClipboardCheck, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  confirmConversationWorkOrder,
  getCurrentConversationWorkOrder,
  type CaseIntakeCanonicalWorkOrder,
  type CaseIntakeConfirmResult,
} from '@/components/CaseWorkspace/apiIntake';

interface CaseIntakeConfirmCardProps {
  conversationId: string;
  workOrder: CaseIntakeCanonicalWorkOrder;
  workOrderDigest: string;
  /** Wołane PO potwierdzeniu (utworzenie ALBO reużycie) — zawiera prawdziwy caseId. */
  onCaseCreated?: (result: CaseIntakeConfirmResult) => void;
  /** Domyślnie nawiguje na `/zlecenia/:caseId`. Nadpisywalne dla testów/harnessu. */
  onOpenCase?: (caseId: string) => void;
}

type CardState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'confirmed'; result: CaseIntakeConfirmResult }
  | { kind: 'stale'; freshWorkOrder: CaseIntakeCanonicalWorkOrder; freshDigest: string }
  | { kind: 'error'; message: string };

export const CaseIntakeConfirmCard: React.FC<CaseIntakeConfirmCardProps> = ({
  conversationId,
  workOrder,
  workOrderDigest,
  onCaseCreated,
  onOpenCase,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [state, setState] = useState<CardState>({ kind: 'idle' });
  const [current, setCurrent] = useState({ workOrder, workOrderDigest });

  const busy = state.kind === 'confirming';

  const handleConfirm = async () => {
    setState({ kind: 'confirming' });
    const outcome = await confirmConversationWorkOrder(conversationId, current.workOrderDigest);

    if (outcome.ok) {
      setState({ kind: 'confirmed', result: outcome.value });
      onCaseCreated?.(outcome.value);
      return;
    }

    if (outcome.failure.status === 409) {
      // Digest stale — someone changed the work order between display and
      // click. Re-read the CURRENT one so the human confirms what is really
      // there now, rather than retrying blindly against a version that no
      // longer exists.
      try {
        const fresh = await getCurrentConversationWorkOrder(conversationId);
        if (fresh) {
          setState({ kind: 'stale', freshWorkOrder: fresh.workOrder, freshDigest: fresh.workOrderDigest });
          return;
        }
      } catch {
        // fall through to the generic error state below
      }
    }

    setState({ kind: 'error', message: outcome.failure.message });
  };

  const handleUseFreshVersion = () => {
    if (state.kind !== 'stale') return;
    setCurrent({ workOrder: state.freshWorkOrder, workOrderDigest: state.freshDigest });
    setState({ kind: 'idle' });
  };

  const handleOpenCase = (caseId: string) => {
    if (onOpenCase) {
      onOpenCase(caseId);
      return;
    }
    window.location.href = `/zlecenia/${encodeURIComponent(caseId)}`;
  };

  if (state.kind === 'confirmed') {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <Check size={16} />
          {state.result.caseCreated
            ? isPl
              ? 'Zlecenie utworzone'
              : 'Case created'
            : isPl
              ? 'Zlecenie już istniało — otwieram istniejące'
              : 'Case already existed — opening the existing one'}
        </div>
        <button
          onClick={() => handleOpenCase(state.result.caseId)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised"
        >
          <ExternalLink size={13} />
          {isPl ? 'Otwórz zlecenie' : 'Open case'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-c-border bg-c-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
            <ClipboardCheck size={13} />
            {isPl ? 'Podsumowanie zlecenia' : 'Work order summary'}
          </div>
          <div className="text-sm font-semibold text-c-text">{current.workOrder.caseName}</div>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-xs text-c-text-secondary">
        <div>
          <dt className="font-medium text-c-text">{isPl ? 'Cel' : 'Goal'}</dt>
          <dd>{current.workOrder.goal}</dd>
        </div>
        <div>
          <dt className="font-medium text-c-text">{isPl ? 'Zakres' : 'Scope'}</dt>
          <dd>
            <ul className="list-disc pl-4">
              {current.workOrder.scope.map((line, index) => (
                <li key={`${current.workOrderDigest}-scope-${index}`}>{line}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-c-text">
            {isPl ? 'Oczekiwany rezultat' : 'Expected outcome'}
          </dt>
          <dd>{current.workOrder.expectedOutcome}</dd>
        </div>
      </dl>

      {state.kind === 'stale' && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            {isPl
              ? 'To zlecenie zmieniło się od momentu pokazania. Sprawdź nową wersję poniżej i potwierdź ponownie.'
              : 'This work order changed since it was shown. Review the new version below and confirm again.'}
          </div>
        </div>
      )}

      {state.kind === 'error' && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-400"
        >
          {state.message}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {state.kind === 'stale' ? (
          <button
            onClick={handleUseFreshVersion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-1.5 text-xs font-medium text-c-bg transition-colors hover:bg-c-text-secondary"
          >
            <RefreshCw size={13} />
            {isPl ? 'Pokaż nową wersję' : 'Show new version'}
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-1.5 text-xs font-medium text-c-bg transition-colors hover:bg-c-text-secondary disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {isPl ? 'Potwierdź i utwórz zlecenie' : 'Confirm and create case'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CaseIntakeConfirmCard;
