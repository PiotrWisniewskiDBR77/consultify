/**
 * ID BRIDGE (Gate E) — render gate for `FinanceHub.tsx`'s four v3 mount
 * branches (Baseline/Prediction/Analysis/Valuation). Wraps
 * `useFinanceLegacyBridge` with the honest UI CLAUDE.md §2.3 requires: three
 * user-visible states, never collapsed:
 *
 *   1. Loading    — small inline spinner, no flash of an empty workspace.
 *   2. Unresolved — "ten rekord nie ma jeszcze odpowiednika w nowym systemie"
 *                   (+ the QUARANTINED reason when the backfill recorded
 *                   one) — NEVER the workspace mounted with the legacy id
 *                   masquerading as a canonical one.
 *   3. Error      — "nie udało się sprawdzić tego rekordu" + Spróbuj ponownie.
 *   4. Resolved   — renders `children(resolved)` with the REAL canonical ids.
 *
 * This is the fix for the AP_MOUNT §B gap `FinanceHub.tsx` documented at its
 * v3 mount branches ("no ID bridge... row opened from today's list will pass
 * an old-system id into a new-system component") — the four branches use
 * THIS component instead of passing `activeDocument.id` straight through.
 */
import { AlertTriangle, Link2 } from 'lucide-react';
import React from 'react';

import { LoadingState } from '@/components/shared/states';
import {
  financeLegacyBridgeQuarantineReasonLabel,
  type LegacyFinanceTable,
} from '@/services/api/financeV2.types';

import { EmptyStateInline } from '../../shared/NModeBlocks/EmptyStateInline';
import { type FinanceLegacyBridgeResolved, useFinanceLegacyBridge } from './useFinanceLegacyBridge';

export interface FinanceLegacyBridgeGateProps {
  legacyTable: LegacyFinanceTable;
  legacyId: string;
  onBackToList: () => void;
  /** Functional legacy workspace shown when this exact row has not been migrated yet. */
  unresolvedFallback?: React.ReactNode;
  children: (resolved: FinanceLegacyBridgeResolved) => React.ReactNode;
}

export const FinanceLegacyBridgeGate: React.FC<FinanceLegacyBridgeGateProps> = ({
  legacyTable,
  legacyId,
  onBackToList,
  unresolvedFallback,
  children,
}) => {
  const { state, retry } = useFinanceLegacyBridge(legacyTable, legacyId);

  if (state.kind === 'loading') {
    return (
      <div className="p-6" data-testid="finance-bridge-loading">
        <LoadingState template="panel" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="p-4" data-testid="finance-bridge-error">
        <EmptyStateInline
          icon={AlertTriangle}
          message="Nie udało się sprawdzić tego rekordu w nowym systemie."
          hint={state.message}
          // ★ NAPRAWA (zaszyty prefiks "+" — patrz `EmptyStateInline.tsx`'s own
          // header comment): "Spróbuj ponownie" nie tworzy nowego obiektu, więc
          // `showPrefix: false, neutralAccent: true`.
          action={{
            label: 'Spróbuj ponownie',
            onClick: retry,
            showPrefix: false,
            neutralAccent: true,
          }}
        />
      </div>
    );
  }

  if (state.kind === 'unresolved') {
    // ★ NAPRAWA (surowy `mapping_reason` na ekranie — patrz
    // `financeLegacyBridgeQuarantineReasonLabel`'s own header comment for the
    // full incident): NIGDY interpolować `state.reason` wprost do tekstu
    // widocznego dla użytkownika — to backendowy kod/zdanie diagnostyczne
    // (`approved_without_snapshot`, `pack_status=...;...`), nie treść po
    // polsku. Etykieta poniżej tłumaczy znane powody na uczciwe, polskie
    // zdania i ma jeden bezpieczny fallback dla nieznanych wartości — nigdy
    // nie echouje surowego stringa.
    const hint =
      state.code === 'QUARANTINED'
        ? `Ten rekord został celowo pominięty przy przenoszeniu do nowego systemu. ${financeLegacyBridgeQuarantineReasonLabel(state.reason)}`
        : 'Ten rekord jeszcze nie ma odpowiednika w nowym systemie (nie został jeszcze przeniesiony).';
    if (unresolvedFallback) {
      return (
        <div data-testid="finance-bridge-legacy-fallback">
          <div className="mx-4 mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-c-text-secondary">
            <div className="font-medium text-c-text">Otwierasz sprawdzony widok klasyczny</div>
            <div className="mt-1">
              Nowy workspace nie ma jeszcze powiązania z tym rekordem. Możesz normalnie pracować
              na danych w dotychczasowym widoku; nic nie jest ukrywane ani symulowane.
            </div>
          </div>
          {unresolvedFallback}
        </div>
      );
    }
    return (
      <div className="p-4" data-testid="finance-bridge-unresolved">
        <EmptyStateInline
          icon={Link2}
          message="Nie można otworzyć tego rekordu w nowym module."
          hint={hint}
          // "Wróć do listy" nie tworzy nowego obiektu — patrz komentarz przy
          // "Spróbuj ponownie" wyżej.
          action={{
            label: 'Wróć do listy',
            onClick: onBackToList,
            showPrefix: false,
            neutralAccent: true,
          }}
        />
      </div>
    );
  }

  return <>{children(state)}</>;
};

export default FinanceLegacyBridgeGate;
