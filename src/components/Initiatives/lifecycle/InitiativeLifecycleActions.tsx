/**
 * Pasek działań łańcucha zarządzania inicjatywą — jedna powierzchnia dla listy
 * Inicjatyw i dla Realizacji.
 *
 * Kontrakt widoczny gołym okiem:
 *   • akcja bez uprawnienia w ogóle się nie renderuje (hak ją odfiltrował),
 *   • akcja z niespełnionym warunkiem jest nieaktywna, a POWÓD stoi obok, po polsku,
 *     nie tylko w tooltipie — właściciel ma go zobaczyć bez najeżdżania myszą,
 *   • akcja wymagająca powodu otwiera okno tekstowe,
 *   • nieudany zapis mówi, co się stało; nie ma cichej awarii.
 *
 * Czerwień (`danger-*`) wyłącznie dla odrzucenia/anulowania. Zatwierdzenie i start
 * są neutralne — `primary-*` w tym repo to crimson i jest zarezerwowany dla semantyki
 * krytycznej (reguła #3 kanonu).
 */

import { AlertCircle } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { InitiativeReasonDialog } from './InitiativeReasonDialog';
import {
  type InitiativeLifecycleAction,
  useInitiativeLifecycle,
} from './useInitiativeLifecycle';

export interface InitiativeLifecycleActionsProps {
  initiativeId: string | null | undefined;
  /** Wywoływane po UDANEJ zmianie — powierzchnia ma przeładować swoje dane. */
  onApplied?: () => void;
  enabled?: boolean;
  className?: string;
  /** `compact` — stopka podglądu; `full` — pasek nad treścią. */
  density?: 'compact' | 'full';
  /** Nagłówek sekcji; pomijany w stopce podglądu. */
  heading?: string;
}

const buttonBase =
  'inline-flex items-center justify-center h-8 rounded-full border px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-45 disabled:cursor-not-allowed';

const variantClass = (variant: InitiativeLifecycleAction['variant']): string =>
  variant === 'danger'
    ? 'border-danger-300/40 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200 hover:bg-danger-100/70 dark:hover:bg-danger-500/15'
    : variant === 'secondary'
      ? 'border-c-border bg-transparent text-c-text-secondary hover:bg-c-surface-2'
      : 'border-c-border bg-c-surface-2 text-c-text-primary hover:bg-c-surface-raised';

export const InitiativeLifecycleActions: React.FC<InitiativeLifecycleActionsProps> = ({
  initiativeId,
  onApplied,
  enabled = true,
  className,
  density = 'compact',
  heading,
}) => {
  const { t } = useTranslation();
  const translate = useCallback((key: string, fallback: string) => t(key, fallback), [t]);
  const { actions, loading, loadError, pendingActionId, run } = useInitiativeLifecycle(
    initiativeId,
    translate,
    { enabled, onApplied }
  );
  const [reasonAction, setReasonAction] = useState<InitiativeLifecycleAction | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);

  const execute = useCallback(
    async (action: InitiativeLifecycleAction, reason?: string) => {
      const failure = await run(action, reason);
      if (failure) {
        toast.error(failure, { duration: 6000 });
        return false;
      }
      toast.success(
        t('initiatives.lifecycle.applied', 'Zapisano: {{action}}', { action: action.label })
      );
      return true;
    },
    [run, t]
  );

  const onClick = useCallback(
    (action: InitiativeLifecycleAction) => {
      if (action.requiresReason) {
        setReasonAction(action);
        return;
      }
      void execute(action);
    },
    [execute]
  );

  if (!initiativeId || !enabled) return null;

  // Nagłówek sekcji stoi także nad stanem pustym/awarią — dowód 07.09 (zrzut 15):
  // bez niego zdanie „Nie masz uprawnień…" wisiało w podglądzie bez kontekstu.
  const sectionHeading =
    heading && density === 'full' ? (
      <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
        {heading}
      </div>
    ) : null;

  if (loadError) {
    return (
      <div className={['space-y-2', className || ''].join(' ')}>
        {sectionHeading}
        <div className="flex items-start gap-2 text-xs text-c-text-secondary">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--c-warning)]" />
          <span data-testid="initiative-lifecycle-load-error">{loadError}</span>
        </div>
      </div>
    );
  }

  if (loading && actions.length === 0) {
    return (
      <div className={['space-y-2', className || ''].join(' ')}>
        {sectionHeading}
        <div className="text-xs text-c-text-muted">
          {t('initiatives.lifecycle.loading', 'Sprawdzam dostępne działania…')}
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className={['space-y-2', className || ''].join(' ')}>
        {sectionHeading}
        <div className="text-xs text-c-text-muted" data-testid="initiative-lifecycle-empty">
          {t(
            'initiatives.lifecycle.none',
            'Nie masz uprawnień do zmiany etapu tej inicjatywy.'
          )}
        </div>
      </div>
    );
  }

  const blocked = actions.filter((action) => action.disabled && action.disabledReason);

  return (
    <div className={['space-y-2', className || ''].join(' ')} data-testid="initiative-lifecycle-actions">
      {sectionHeading}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            data-testid={`initiative-lifecycle-${action.id}`}
            data-gate={action.gate || ''}
            disabled={action.disabled || pendingActionId !== null}
            title={action.disabled ? action.disabledReason : undefined}
            aria-describedby={action.disabled ? `${action.id}-reason` : undefined}
            onClick={() => onClick(action)}
            className={[buttonBase, variantClass(action.variant)].join(' ')}
          >
            {pendingActionId === action.id
              ? t('initiatives.lifecycle.working', 'Zapisuję…')
              : action.label}
          </button>
        ))}
      </div>
      {blocked.length > 0 ? (
        <ul className="space-y-1">
          {blocked.map((action) => (
            <li
              key={action.id}
              id={`${action.id}-reason`}
              className="flex items-start gap-1.5 text-[11px] text-c-text-secondary"
              data-testid={`initiative-lifecycle-reason-${action.id}`}
            >
              <AlertCircle size={12} className="mt-0.5 shrink-0 text-[var(--c-warning)]" />
              <span>
                <span className="font-medium">{action.label}:</span> {action.disabledReason}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <InitiativeReasonPrompt
        action={reasonAction}
        busy={reasonBusy}
        onCancel={() => setReasonAction(null)}
        onConfirm={async (reason) => {
          if (!reasonAction) return;
          setReasonBusy(true);
          const ok = await execute(reasonAction, reason);
          setReasonBusy(false);
          if (ok) setReasonAction(null);
        }}
      />
    </div>
  );
};

/** Wydzielone, żeby okno nie było montowane, dopóki nie jest potrzebne. */
const InitiativeReasonPrompt: React.FC<{
  action: InitiativeLifecycleAction | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}> = ({ action, busy, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  if (!action) return null;
  return (
    <InitiativeReasonDialog
      open
      title={t('initiatives.lifecycle.reasonTitle', '{{action}} — podaj powód', {
        action: action.label,
      })}
      confirmLabel={action.label}
      destructive={action.variant === 'danger'}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

export default InitiativeLifecycleActions;
