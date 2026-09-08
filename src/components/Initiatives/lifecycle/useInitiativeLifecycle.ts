/**
 * Hak łańcucha zarządzania inicjatywą (DEC-424).
 *
 * Jedna zasada, z której wszystko wynika:
 *   • brak roli  ⇒ akcji NIE MA na ekranie (użytkownik nie klika w 403),
 *   • warunek niespełniony ⇒ akcja WIDOCZNA, ale nieaktywna, z powodem po polsku,
 *   • powód wymagany ⇒ okno tekstowe, bez możliwości pominięcia.
 * Wszystkie trzy informacje przychodzą z `GET /:id/transition-preflight`, liczone tym
 * samym kodem, którym `PATCH /:id/status` odmawia. Front nie ma własnej kopii reguł.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  applyInitiativeTransition,
  fetchInitiativeTransitionPreflight,
  readInitiativeFailureRule,
  setInitiativeLifecycleFlag,
  type InitiativeTransitionPreflight,
} from '@/services/initiatives/lifecycleApi';

import { initiativeGateLabel, initiativeRuleMessage, type TranslateFn } from './initiativeLifecycleMessages';

export interface InitiativeLifecycleAction {
  id: string;
  kind: 'transition' | 'flag';
  gate: string | null;
  /** Dla `kind: 'transition'`. */
  targetStatus?: string;
  /** Dla `kind: 'flag'`. */
  operation?: 'HOLD' | 'RESUME';
  label: string;
  /** `danger` wyłącznie dla semantyki krytycznej (odrzucenie/anulowanie). */
  variant: 'primary' | 'secondary' | 'danger';
  disabled: boolean;
  /** Puste, gdy akcja jest aktywna. */
  disabledReason: string;
  requiresReason: boolean;
}

const DESTRUCTIVE_GATES = new Set(['REJECT', 'CANCEL']);

export interface UseInitiativeLifecycleResult {
  preflight: InitiativeTransitionPreflight | null;
  actions: InitiativeLifecycleAction[];
  loading: boolean;
  /** Awaria ODCZYTU podglądu, po polsku. Nigdy nie połykamy jej po cichu. */
  loadError: string | null;
  pendingActionId: string | null;
  reload: () => Promise<void>;
  /** Zwraca `null` przy sukcesie albo polski komunikat błędu. NIE rzuca. */
  run: (action: InitiativeLifecycleAction, reason?: string) => Promise<string | null>;
}

export function useInitiativeLifecycle(
  initiativeId: string | null | undefined,
  t: TranslateFn,
  options?: { enabled?: boolean; onApplied?: () => void }
): UseInitiativeLifecycleResult {
  const enabled = options?.enabled !== false && Boolean(initiativeId);
  const [preflight, setPreflight] = useState<InitiativeTransitionPreflight | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const onApplied = options?.onApplied;

  const reload = useCallback(async () => {
    if (!initiativeId || options?.enabled === false) {
      setPreflight(null);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const next = await fetchInitiativeTransitionPreflight(initiativeId);
      if (seq !== requestSeq.current) return;
      setPreflight(next);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      setPreflight(null);
      // Świadomie NIE `catch(() => {})`: gdy podgląd nie działa, użytkownik ma
      // zobaczyć dlaczego nie ma przycisków, zamiast pustego miejsca.
      setLoadError(
        t(
          'initiatives.lifecycle.preflightFailed',
          'Could not check the available actions for this initiative.'
        )
      );
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [initiativeId, options?.enabled, t]);

  useEffect(() => {
    if (!enabled) {
      setPreflight(null);
      setLoadError(null);
      return;
    }
    void reload();
  }, [enabled, reload]);

  const actions = useMemo<InitiativeLifecycleAction[]>(() => {
    if (!preflight) return [];
    const transitionActions = preflight.transitions
      // Brak roli ⇒ przycisku NIE MA. Świadomie nie renderujemy go wyszarzonego:
      // wyszarzenie sugeruje „dokończ warunek", a tu chodzi o cudzą kompetencję.
      .filter((item) => item.roleAllowed)
      .map<InitiativeLifecycleAction>((item) => ({
        id: `transition:${item.targetStatus}`,
        kind: 'transition',
        gate: item.gate,
        targetStatus: item.targetStatus,
        label: initiativeGateLabel(item.gate, t),
        variant: DESTRUCTIVE_GATES.has(String(item.gate)) ? 'danger' : item.gate === 'SEND_BACK' ? 'secondary' : 'primary',
        disabled: !item.conditionSatisfied,
        disabledReason: item.conditionSatisfied
          ? ''
          : initiativeRuleMessage(item.blockingRule, t, { items: item.blockingItems }),
        requiresReason: item.requiresReason,
      }));

    const flagActions = preflight.flags
      .filter((flag) => flag.operation === 'HOLD' || flag.operation === 'RESUME')
      .filter((flag) => flag.roleAllowed && flag.stateAllowed)
      .map<InitiativeLifecycleAction>((flag) => ({
        id: `flag:${flag.operation}`,
        kind: 'flag',
        gate: flag.gate,
        operation: flag.operation as 'HOLD' | 'RESUME',
        label: initiativeGateLabel(flag.gate, t),
        variant: 'secondary',
        disabled: false,
        disabledReason: '',
        requiresReason: flag.requiresReason,
      }));

    return [...transitionActions, ...flagActions];
  }, [preflight, t]);

  const run = useCallback(
    async (action: InitiativeLifecycleAction, reason?: string): Promise<string | null> => {
      if (!initiativeId) return t('initiatives.lifecycle.noInitiative', 'No initiative.');
      if (action.disabled) return action.disabledReason;
      if (action.requiresReason && !String(reason || '').trim()) {
        return initiativeRuleMessage('REASON_REQUIRED', t);
      }
      setPendingActionId(action.id);
      try {
        if (action.kind === 'flag' && action.operation) {
          await setInitiativeLifecycleFlag(initiativeId, action.operation, reason);
        } else if (action.targetStatus) {
          await applyInitiativeTransition(initiativeId, action.targetStatus, reason);
        } else {
          return initiativeRuleMessage('MISSING_TRANSITION_GATE', t);
        }
        await reload();
        onApplied?.();
        return null;
      } catch (error) {
        const rule = readInitiativeFailureRule(error);
        const missing = (error as { data?: { missing?: Array<{ key: string; label: string }> } } | null)?.data?.missing;
        // Gdy serwer nie podał kodu reguły (np. 500), pokazujemy JEGO treść —
        // nigdy „coś poszło nie tak".
        const message = rule
          ? initiativeRuleMessage(rule, t, { items: Array.isArray(missing) ? missing : undefined })
          : String((error as Error)?.message || '').trim() ||
            initiativeRuleMessage(null, t);
        await reload();
        return message;
      } finally {
        setPendingActionId(null);
      }
    },
    [initiativeId, onApplied, reload, t]
  );

  return { preflight, actions, loading, loadError, pendingActionId, reload, run };
}
